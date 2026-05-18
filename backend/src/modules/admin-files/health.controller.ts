import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FilesService } from './files.service';
import { SystemMonitorService } from './system-monitor.service';
import { ConfigService } from '@nestjs/config';

@Controller('admin/health')
@UseGuards(JwtAuthGuard)
export class HealthController {
  constructor(
    private readonly filesService: FilesService,
    private readonly systemMonitor: SystemMonitorService,
    private readonly configService: ConfigService,
  ) {}

  @Get('stats')
  async getStats() {
    const uploadBaseDir = this.configService.get<string>('uploadBaseDir') || './uploads';

    const [system, uploadStats] = await Promise.all([
      this.systemMonitor.getStats(uploadBaseDir),
      this.filesService.getUploadStats(),
    ]);

    return {
      system,
      uploadStats,
    };
  }
}
