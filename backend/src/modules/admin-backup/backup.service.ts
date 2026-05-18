import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';
import { LogsService } from '../admin-logs/logs.service';
import { formatSize } from '../../common/utils/format-size.util';

export interface BackupEntry {
  id: string;
  type: 'database' | 'files';
  size: number;
  createdAt: Date;
  filePath: string;
  remark?: string;
}

export interface BackupOptions {
  type?: 'database' | 'files'; // 不传则全量备份
  name?: string;               // 文件名前缀，如 'prod-daily'，仅允许字母数字下划线连字符
  remark?: string;             // 备份备注，如 '上线前备份'
}

@Injectable()
export class BackupService {
  private readonly backupDir: string;
  // 合法表名字符：字母、数字、下划线、连字符
  private static readonly SAFE_TABLE_NAME = /^[a-zA-Z0-9_-]+$/;

  constructor(
    private readonly configService: ConfigService,
    private readonly logsService: LogsService,
  ) {
    this.backupDir = path.join(
      this.configService.get<string>('UPLOAD_BASE_DIR') || './uploads',
      'backups'
    );
  }

  async createBackup(options: BackupOptions = {}): Promise<{ message: string }> {
    await this.ensureBackupDir();

    const timestamp = new Date();
    // 清理前缀：非法字符替换为空，超长截断
    const rawPrefix = (options.name || 'backup').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
    const prefix = rawPrefix || 'backup';
    const id = `${prefix}-${timestamp.getTime()}`;
    const { type, remark } = options;

    const tasks: Promise<void>[] = [];
    if (!type || type === 'database') {
      tasks.push(this.createDatabaseBackup(id, timestamp, remark));
    }
    if (!type || type === 'files') {
      tasks.push(this.createFilesBackup(id, timestamp, remark));
    }

    await Promise.all(tasks);

    const typeLabel = !type ? '全部' : type === 'database' ? '数据库' : '文件';
    this.logsService.info(`备份已创建: ${id} (${typeLabel})${remark ? ` — ${remark}` : ''}`);
    return { message: 'Backup created successfully' };
  }

  async getBackups(): Promise<{ backups: BackupEntry[] }> {
    await this.ensureBackupDir();

    const entries = await fs.readdir(this.backupDir);
    const backups: BackupEntry[] = [];

    for (const entry of entries) {
      const filePath = path.join(this.backupDir, entry);
      const stats = await fs.stat(filePath);

      if (entry.endsWith('.json') && !entry.endsWith('.files.json')) {
        const remark = await this.readRemark(filePath);
        backups.push({
          id: entry,
          type: 'database',
          size: stats.size,
          createdAt: stats.birthtime,
          filePath,
          remark,
        });
      } else if (entry.endsWith('.files.json')) {
        const remark = await this.readRemark(filePath);
        backups.push({
          id: entry,
          type: 'files',
          size: stats.size,
          createdAt: stats.birthtime,
          filePath,
          remark,
        });
      }
    }

    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { backups };
  }

  async downloadBackup(id: string): Promise<{ file: Buffer; filename: string }> {
    const backups = await this.getBackups();
    const backup = backups.backups.find(b => b.id === id);

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    const file = await fs.readFile(backup.filePath);
    this.logsService.info(`备份已下载: ${id} (${formatSize(file.length)})`);
    return { file, filename: backup.id };
  }

  async deleteBackup(id: string): Promise<{ message: string }> {
    const backups = await this.getBackups();
    const backup = backups.backups.find(b => b.id === id);

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    await fs.unlink(backup.filePath);
    this.logsService.info(`备份已删除: ${id}`);
    return { message: 'Backup deleted successfully' };
  }

  private async ensureBackupDir(): Promise<void> {
    try {
      await fs.access(this.backupDir);
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true });
    }
  }

  private async readRemark(filePath: string): Promise<string | undefined> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      return data.remark || undefined;
    } catch {
      return undefined;
    }
  }

  private async createDatabaseBackup(id: string, timestamp: Date, remark?: string): Promise<void> {
    const filename = `${id}.json`;
    const filePath = path.join(this.backupDir, filename);

    const dbHost = this.configService.get<string>('DATABASE_HOST', 'localhost');
    const dbPort = this.configService.get<number>('DATABASE_PORT', 3306);
    const dbUser = this.configService.get<string>('DATABASE_USER', 'root');
    const dbPassword = this.configService.get<string>('DATABASE_PASSWORD', '');
    const dbName = this.configService.get<string>('DATABASE_NAME', 'file_service');

    const connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
    });

    try {
      const [rows] = await connection.query('SHOW TABLES');
      const tables = Array.isArray(rows) ? rows.map((row: any) => Object.values(row)[0] as string) : [];

      const backup: any = { timestamp: timestamp.toISOString(), database: dbName, remark: remark || null, tables: {} };

      for (const table of tables) {
        // 防止 SQL 注入：校验表名格式
        if (!BackupService.SAFE_TABLE_NAME.test(table)) continue;
        const [data] = await connection.query(`SELECT * FROM ??`, [table]);
        backup.tables[table] = Array.isArray(data) ? data : [];
      }

      await fs.writeFile(filePath, JSON.stringify(backup, null, 2), 'utf-8');
    } finally {
      await connection.end();
    }
  }

  private async createFilesBackup(id: string, timestamp: Date, remark?: string): Promise<void> {
    const filename = `${id}.files.json`;
    const filePath = path.join(this.backupDir, filename);
    const uploadDir = this.configService.get<string>('UPLOAD_BASE_DIR') || './uploads';

    const backup = {
      timestamp: timestamp.toISOString(),
      uploadDir,
      remark: remark || null,
      message: 'Files backup metadata (actual files not packed)',
    };

    await fs.writeFile(filePath, JSON.stringify(backup, null, 2), 'utf-8');
  }
}
