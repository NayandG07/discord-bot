import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserById(idOrDiscordId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ id: idOrDiscordId }, { discordId: idOrDiscordId }],
      },
      include: {
        leetCodeProfile: true,
        guildMemberships: { include: { guild: true } },
        userAchievements: { include: { achievement: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found.');
    return user;
  }
}
