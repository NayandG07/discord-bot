import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TeamService } from './team.service';

class CreateTeamDto {
  guildId: string;
  leaderId: string;
  name: string;
  tag: string;
}

@ApiTags('Teams')
@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new permanent squad / team' })
  async createTeam(@Body() dto: CreateTeamDto) {
    const team = await this.teamService.createTeam(dto.guildId, dto.leaderId, dto.name, dto.tag);
    return { success: true, team };
  }

  @Get(':tagOrId')
  @ApiOperation({ summary: 'Get team statistics and member roster' })
  async getTeam(@Param('tagOrId') tagOrId: string, @Query('guildId') guildId?: string) {
    return this.teamService.getTeamStats(tagOrId, guildId);
  }
}
