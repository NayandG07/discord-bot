import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserService } from './user.service';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':idOrDiscordId')
  @ApiOperation({ summary: 'Get detailed user profile by ID or Discord Snowflake' })
  async getUser(@Param('idOrDiscordId') idOrDiscordId: string) {
    const user = await this.userService.getUserById(idOrDiscordId);
    return { success: true, user };
  }
}
