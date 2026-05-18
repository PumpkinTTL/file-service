import { Controller, Get, Post, Delete, UseGuards, Param, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BackupService, BackupOptions } from './backup.service';

@Controller('admin/backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('status')
  async getStatus() {
    return await this.backupService.getBackups();
  }

  @Post('trigger')
  async triggerBackup(@Body() body: { type?: 'database' | 'files'; name?: string; remark?: string }) {
    const options: BackupOptions = {};
    if (body?.type === 'database' || body?.type === 'files') {
      options.type = body.type;
    }
    if (body?.name && typeof body.name === 'string') {
      options.name = body.name;
    }
    if (body?.remark && typeof body.remark === 'string') {
      options.remark = body.remark.slice(0, 200);
    }
    return await this.backupService.createBackup(options);
  }

  @Get('download/:id')
  async downloadBackup(@Param('id') id: string) {
    return await this.backupService.downloadBackup(id);
  }

  @Delete(':id')
  async deleteBackup(@Param('id') id: string) {
    return await this.backupService.deleteBackup(id);
  }
}
