import { Controller, Get, Patch, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Request } from 'express';

@ApiTags('Admin Panel')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('audit-logs')
  @ApiOperation({ summary: 'View immutable system audit logs' })
  async getAuditLogs(@Query('limit') limit = 50) {
    const logs = await this.adminService.getAuditLogs(limit);
    return { success: true, count: logs.length, data: logs };
  }

  @Patch('guilds/:id/xp-config')
  @ApiOperation({ summary: 'Adjust guild XP values and anti-farming thresholds' })
  async updateXpConfig(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const adminUserId = (req as any).user?.id || 'system-admin';
    const updated = await this.adminService.updateGuildXpConfig(
      adminUserId,
      id,
      body,
      req.ip,
    );
    return { success: true, updated };
  }
}
