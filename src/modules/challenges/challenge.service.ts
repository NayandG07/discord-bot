import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  CreateChallengeDto,
  CastVoteDto,
  ChallengeEvaluationResult,
} from './challenge.types';
import {
  ChallengeStatus,
  ChallengeIntensity,
  TopicCategory,
  ParticipantStatus,
  XpSource,
  ProblemDifficulty,
} from '@prisma/client';

@Injectable()
export class ChallengeService {
  private readonly logger = new Logger(ChallengeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async createChallenge(dto: CreateChallengeDto) {
    return this.prisma.$transaction(async (tx) => {
      const challenge = await tx.challenge.create({
        data: {
          guildId: dto.guildId,
          creatorId: dto.creatorId,
          format: dto.format,
          status: ChallengeStatus.CREATED,
          durationHours: dto.durationHours || 24,
          intensity: dto.intensity || ChallengeIntensity.CASUAL,
        },
      });

      // Add Host as accepted in Team 1
      await tx.challengeParticipant.create({
        data: {
          challengeId: challenge.id,
          userId: dto.creatorId,
          teamNumber: 1,
          status: ParticipantStatus.ACCEPTED,
        },
      });

      // Add remaining Team 1 participants
      for (const uid of dto.team1UserIds) {
        if (uid === dto.creatorId) continue;
        await tx.challengeParticipant.create({
          data: {
            challengeId: challenge.id,
            userId: uid,
            teamNumber: 1,
            status: ParticipantStatus.INVITED,
          },
        });
      }

      // Add Team 2 participants
      for (const uid of dto.team2UserIds) {
        await tx.challengeParticipant.create({
          data: {
            challengeId: challenge.id,
            userId: uid,
            teamNumber: 2,
            status: ParticipantStatus.INVITED,
          },
        });
      }

      return challenge;
    });
  }

  async acceptInvite(challengeId: string, userId: string) {
    const participant = await this.prisma.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId, userId } },
    });

    if (!participant) {
      throw new NotFoundException('Invitation not found for this user.');
    }

    await this.prisma.challengeParticipant.update({
      where: { id: participant.id },
      data: { status: ParticipantStatus.ACCEPTED },
    });

    // Check if all players have accepted
    const pending = await this.prisma.challengeParticipant.count({
      where: { challengeId, status: ParticipantStatus.INVITED },
    });

    if (pending === 0) {
      // Transition to VOTING state
      const now = new Date();
      const votingEnds = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes voting
      await this.prisma.challenge.update({
        where: { id: challengeId },
        data: {
          status: ChallengeStatus.VOTING,
          votingStartsAt: now,
          votingEndsAt: votingEnds,
        },
      });
      this.logger.log(`Challenge ${challengeId} transitioned to VOTING.`);
    }

    return { success: true, allAccepted: pending === 0 };
  }

  async castVote(dto: CastVoteDto) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: dto.challengeId },
      include: { participants: true },
    });

    if (!challenge) throw new NotFoundException('Challenge not found.');
    if (challenge.status !== ChallengeStatus.VOTING) {
      throw new BadRequestException('Challenge is not in voting phase.');
    }

    const isMember = challenge.participants.some(
      (p) => p.userId === dto.userId && p.status === ParticipantStatus.ACCEPTED,
    );
    if (!isMember) {
      throw new BadRequestException('User is not an accepted participant in this challenge.');
    }

    await this.prisma.challengeVote.upsert({
      where: { challengeId_userId: { challengeId: dto.challengeId, userId: dto.userId } },
      update: {
        topicVote: dto.topicVote,
        durationVoteHours: dto.durationVoteHours,
        intensityVote: dto.intensityVote,
      },
      create: {
        challengeId: dto.challengeId,
        userId: dto.userId,
        topicVote: dto.topicVote,
        durationVoteHours: dto.durationVoteHours,
        intensityVote: dto.intensityVote,
      },
    });

    return { success: true, message: 'Vote successfully recorded.' };
  }

  async finalizeVotingAndStart(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { votes: true },
    });

    if (!challenge || challenge.status !== ChallengeStatus.VOTING) return;

    // Tally votes
    const topicCounts = new Map<TopicCategory, number>();
    const intensityCounts = new Map<ChallengeIntensity, number>();
    const durationCounts = new Map<number, number>();

    challenge.votes.forEach((v) => {
      if (v.topicVote) topicCounts.set(v.topicVote, (topicCounts.get(v.topicVote) || 0) + 1);
      if (v.intensityVote) intensityCounts.set(v.intensityVote, (intensityCounts.get(v.intensityVote) || 0) + 1);
      if (v.durationVoteHours) durationCounts.set(v.durationVoteHours, (durationCounts.get(v.durationVoteHours) || 0) + 1);
    });

    // Select winning parameters (with fallback)
    let selectedTopic: TopicCategory = TopicCategory.MIXED;
    let maxTopicVotes = 0;
    topicCounts.forEach((count, topic) => {
      if (count > maxTopicVotes) {
        maxTopicVotes = count;
        selectedTopic = topic;
      }
    });

    let selectedIntensity: ChallengeIntensity = ChallengeIntensity.CASUAL;
    let maxIntensityVotes = 0;
    intensityCounts.forEach((count, intensity) => {
      if (count > maxIntensityVotes) {
        maxIntensityVotes = count;
        selectedIntensity = intensity;
      }
    });

    let selectedDuration = 24;
    let maxDurationVotes = 0;
    durationCounts.forEach((count, duration) => {
      if (count > maxDurationVotes) {
        maxDurationVotes = count;
        selectedDuration = duration;
      }
    });

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + selectedDuration * 60 * 60 * 1000);

    return this.prisma.challenge.update({
      where: { id: challengeId },
      data: {
        status: ChallengeStatus.ACTIVE,
        selectedTopic,
        intensity: selectedIntensity,
        durationHours: selectedDuration,
        startsAt,
        endsAt,
      },
    });
  }

  calculateProblemPoints(
    difficulty: ProblemDifficulty,
    primaryTopic: TopicCategory,
    selectedTopic: TopicCategory | null,
    intensity: ChallengeIntensity,
  ): number {
    let base = 0;
    if (difficulty === ProblemDifficulty.EASY) base = 10;
    if (difficulty === ProblemDifficulty.MEDIUM) base = 30;
    if (difficulty === ProblemDifficulty.HARD) base = 75;

    // In HARDCORE mode, easy problems grant 0 challenge points
    if (intensity === ChallengeIntensity.HARDCORE && difficulty === ProblemDifficulty.EASY) {
      return 0;
    }

    // Topic matching multiplier
    const isTopicMatch = selectedTopic && selectedTopic !== TopicCategory.MIXED && primaryTopic === selectedTopic;
    const topicMultiplier = isTopicMatch ? 1.5 : 1.0;

    // Intensity multiplier
    let intensityMultiplier = 1.0;
    if (intensity === ChallengeIntensity.COMPETITIVE) intensityMultiplier = 1.25;
    if (intensity === ChallengeIntensity.HARDCORE) intensityMultiplier = 1.5;

    return Number((base * topicMultiplier * intensityMultiplier).toFixed(2));
  }

  normalizeTeamScores(team1Raw: number, team1Size: number, team2Raw: number, team2Size: number) {
    if (team1Size <= 0 || team2Size <= 0) {
      return { team1Final: team1Raw, team2Final: team2Raw };
    }

    const avgSize = (team1Size + team2Size) / 2.0;
    const team1Factor = Math.pow(team1Size, 0.75);
    const team2Factor = Math.pow(team2Size, 0.75);
    const targetScale = Math.pow(avgSize, 0.75);

    const team1Final = Number(((team1Raw / team1Factor) * targetScale).toFixed(2));
    const team2Final = Number(((team2Raw / team2Factor) * targetScale).toFixed(2));

    return { team1Final, team2Final };
  }

  async evaluateChallenge(challengeId: string): Promise<ChallengeEvaluationResult> {
    const lock = await this.redis.acquireLock(`challenge:${challengeId}:eval`, 30000);

    try {
      const challenge = await this.prisma.challenge.findUnique({
        where: { id: challengeId },
        include: { participants: { include: { user: true } } },
      });

      if (!challenge) throw new NotFoundException('Challenge not found.');

      await this.prisma.challenge.update({
        where: { id: challengeId },
        data: { status: ChallengeStatus.EVALUATING },
      });

      const startTime = challenge.startsAt || challenge.createdAt;
      const endTime = challenge.endsAt || new Date();

      let team1Raw = 0;
      let team2Raw = 0;
      let team1Count = 0;
      let team2Count = 0;
      let mvpUserId: string | null = null;
      let highestPoints = -1;

      // Calculate contribution per participant
      for (const p of challenge.participants) {
        if (p.teamNumber === 1) team1Count++;
        if (p.teamNumber === 2) team2Count++;

        // Fetch verified activities within challenge time window
        const activities = await this.prisma.activity.findMany({
          where: {
            userId: p.userId,
            submissionTimestamp: { gte: startTime, lte: endTime },
          },
        });

        let participantPoints = 0;
        for (const act of activities) {
          participantPoints += this.calculateProblemPoints(
            act.difficulty,
            act.primaryTopic,
            challenge.selectedTopic,
            challenge.intensity,
          );
        }

        if (p.teamNumber === 1) team1Raw += participantPoints;
        if (p.teamNumber === 2) team2Raw += participantPoints;

        if (participantPoints > highestPoints && participantPoints > 0) {
          highestPoints = participantPoints;
          mvpUserId = p.userId;
        }

        await this.prisma.challengeParticipant.update({
          where: { id: p.id },
          data: {
            contributionPoints: participantPoints,
            problemsSolved: activities.length,
            isMvp: false, // will update winning mvp later
          },
        });
      }

      if (mvpUserId) {
        await this.prisma.challengeParticipant.updateMany({
          where: { challengeId, userId: mvpUserId },
          data: { isMvp: true },
        });
      }

      // Normalization for uneven teams
      const { team1Final, team2Final } = this.normalizeTeamScores(team1Raw, team1Count, team2Raw, team2Count);

      let winningTeam: number | null = null;
      if (team1Final > team2Final) winningTeam = 1;
      else if (team2Final > team1Final) winningTeam = 2;

      // Disburse XP and reliability adjustments
      await this.prisma.$transaction(async (tx) => {
        await tx.challenge.update({
          where: { id: challengeId },
          data: {
            status: ChallengeStatus.COMPLETED,
            winningTeamNumber: winningTeam,
          },
        });

        // XP constants
        const winXp = challenge.intensity === ChallengeIntensity.HARDCORE ? 225 : 150;
        const lossXp = challenge.intensity === ChallengeIntensity.HARDCORE ? 75 : 50;

        for (const p of challenge.participants) {
          const isWinner = winningTeam !== null && p.teamNumber === winningTeam;
          const awardedXp = isWinner ? winXp : lossXp;

          await tx.xPTransactions.create({
            data: {
              userId: p.userId,
              guildId: challenge.guildId,
              challengeId: challenge.id,
              source: isWinner ? XpSource.CHALLENGE_WIN : XpSource.CHALLENGE_PARTICIPATION,
              baseAmount: awardedXp,
              finalAmount: awardedXp,
              reason: isWinner ? 'Challenge Victory Bonus' : 'Challenge Participation XP',
            },
          });

          await tx.guildMember.updateMany({
            where: { guildId: challenge.guildId, userId: p.userId },
            data: { guildXp: { increment: awardedXp } },
          });

          // Reliability adjustment
          const pPoints = Number(p.contributionPoints);
          if (pPoints > 0) {
            await tx.user.update({
              where: { id: p.userId },
              data: {
                reliabilityScore: {
                  increment: 3.0,
                },
              },
            });
          } else {
            // AFK penalty
            const penalty = challenge.intensity === ChallengeIntensity.HARDCORE ? 25.0 : 15.0;
            await tx.user.update({
              where: { id: p.userId },
              data: {
                reliabilityScore: {
                  decrement: penalty,
                },
              },
            });
          }
        }
      });

      return {
        challengeId,
        winningTeam,
        team1RawScore: team1Raw,
        team1FinalScore: team1Final,
        team2RawScore: team2Raw,
        team2FinalScore: team2Final,
        mvpUserId,
        intensity: challenge.intensity,
      };
    } finally {
      await lock.release();
    }
  }
}
