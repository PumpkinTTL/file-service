import { Controller, Get, Post, Delete, UseGuards, Param, Body, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BackupService, BackupOptions } from './backup.service';

interface BinaryReply {
  header(name: string, value: string): BinaryReply;
  send(payload: Buffer): void;
}

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
    return this.backupService.startBackup(options);
  }

  @Get('job/:id')
  async getBackupJob(@Param('id') id: string) {
    return this.backupService.getJob(id);
  }

  @Get('download/:id')
  async downloadBackup(@Param('id') id: string, @Res() reply: BinaryReply) {
    const backup = await this.backupService.downloadBackup(id);
    reply
      .header('Content-Type', this.getContentType(backup.filename))
      .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(backup.filename)}`)
      .send(backup.file);
  }

  @Delete(':id')
  async deleteBackup(@Param('id') id: string) {
    return await this.backupService.deleteBackup(id);
  }

  private getContentType(filename: string): string {
    if (filename.endsWith('.sql')) return 'application/sql; charset=utf-8';
    if (filename.endsWith('.zip')) return 'application/zip';
    if (filename.endsWith('.json')) return 'application/json; charset=utf-8';
    return 'application/octet-stream';
  }
}
