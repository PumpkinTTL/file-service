import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LogsService } from './logs.service';

@Controller('admin/logs')
@UseGuards(JwtAuthGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  async getLogs(
    @Query('level') level?: string,
    @Query('keyword') keyword?: string,
    @Query('limit') limit: string = '100',
  ) {
    return await this.logsService.queryLogs({
      level,
      keyword,
      limit: parseInt(limit, 10) || 100,
    });
  }
}
