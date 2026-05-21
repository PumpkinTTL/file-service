import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { promises as fsp } from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';
import { Archiver, ZipArchive } from 'archiver';
import { LogsService } from '../admin-logs/logs.service';
import { formatSize } from '../../common/utils/format-size.util';

interface CreateTableRow extends RowDataPacket {
  Table: string;
  'Create Table': string;
}

export interface BackupEntry {
  id: string;
  type: 'database' | 'files';
  size: number;
  createdAt: Date;
  filePath: string;
  remark?: string;
}

interface BackupMeta {
  timestamp: string;
  type: 'database' | 'files';
  remark: string | null;
  source: string;
}

interface BackupTask {
  type: 'database' | 'files';
  outputFiles: string[];
  run: () => Promise<void>;
}

type BackupJobStatus = 'running' | 'success' | 'failed';

export interface BackupJob {
  id: string;
  status: BackupJobStatus;
  message: string;
  startedAt: Date;
  finishedAt?: Date;
  error?: string;
}

export interface BackupOptions {
  type?: 'database' | 'files'; // 不传则全量备份
  name?: string;               // 文件名前缀，如 'prod-daily'，仅允许字母数字下划线连字符
  remark?: string;             // 备份备注，如 '上线前备份'
}

@Injectable()
export class BackupService {
  private readonly backupDir: string;
  private readonly jobs = new Map<string, BackupJob>();
  // 合法表名字符：字母、数字、下划线、连字符
  private static readonly SAFE_TABLE_NAME = /^[a-zA-Z0-9_-]+$/;
  private static readonly RUNNING_JOB_TIMEOUT_MS = 2 * 60 * 60 * 1000;
  private static readonly FINISHED_JOB_TTL_MS = 10 * 60 * 1000;

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
    const databaseFilename = `${id}.sql`;
    const filesFilename = `${id}.files.zip`;
    const datedBackupDir = this.getDatedBackupDir(timestamp);

    const createdFiles: string[] = [];
    const tasks: BackupTask[] = [];
    if (!type || type === 'database') {
      tasks.push({
        type: 'database',
        outputFiles: [
          path.join(datedBackupDir, databaseFilename),
          this.getMetaPathForFile(path.join(datedBackupDir, databaseFilename)),
        ],
        run: () => this.createDatabaseBackup(id, timestamp, remark),
      });
    }
    if (!type || type === 'files') {
      tasks.push({
        type: 'files',
        outputFiles: [
          path.join(datedBackupDir, filesFilename),
          this.getMetaPathForFile(path.join(datedBackupDir, filesFilename)),
        ],
        run: () => this.createFilesBackup(id, timestamp, remark),
      });
    }

    try {
      for (const task of tasks) {
        createdFiles.push(...task.outputFiles);
        await task.run();
      }
    } catch (error) {
      await this.cleanupCreatedFiles(createdFiles);
      const message = this.toBackupErrorMessage(error);
      this.logsService.error(`备份创建失败: ${id} - ${message}`);
      throw new InternalServerErrorException(message);
    }

    const typeLabel = !type ? '全部' : type === 'database' ? '数据库' : '文件';
    this.logsService.info(`备份已创建: ${id} (${typeLabel})${remark ? ` — ${remark}` : ''}`);
    return { message: `${typeLabel}备份已创建` };
  }

  startBackup(options: BackupOptions = {}): BackupJob {
    this.cleanupExpiredJobs();

    const jobId = `job-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    const job: BackupJob = {
      id: jobId,
      status: 'running',
      message: '备份任务正在执行',
      startedAt: new Date(),
    };
    this.jobs.set(jobId, job);

    void this.createBackup(options)
      .then(result => {
        job.status = 'success';
        job.message = result.message;
        job.finishedAt = new Date();
      })
      .catch(error => {
        job.status = 'failed';
        job.error = this.toBackupErrorMessage(error);
        job.message = job.error;
        job.finishedAt = new Date();
      });

    return job;
  }

  getJob(jobId: string): BackupJob {
    this.cleanupExpiredJobs();

    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException('备份任务不存在，可能是服务已重启或任务记录已过期');
    }
    return job;
  }

  private cleanupExpiredJobs(): void {
    const now = Date.now();

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'running') {
        const runningMs = now - job.startedAt.getTime();
        if (runningMs > BackupService.RUNNING_JOB_TIMEOUT_MS) {
          job.status = 'failed';
          job.error = '备份任务执行超时，请检查数据库、上传目录大小或服务器负载';
          job.message = job.error;
          job.finishedAt = new Date(now);
        }
        continue;
      }

      const finishedAt = job.finishedAt?.getTime() || job.startedAt.getTime();
      if (now - finishedAt > BackupService.FINISHED_JOB_TTL_MS) {
        this.jobs.delete(jobId);
      }
    }
  }

  async getBackups(): Promise<{ backups: BackupEntry[] }> {
    await this.ensureBackupDir();

    const backups = await this.collectBackups(this.backupDir);

    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { backups };
  }

  async downloadBackup(id: string): Promise<{ file: Buffer; filename: string }> {
    const backups = await this.getBackups();
    const backup = backups.backups.find(b => b.id === id);

    if (!backup) {
      throw new NotFoundException('备份文件不存在或已被删除');
    }

    const file = await fsp.readFile(backup.filePath);
    this.logsService.info(`备份已下载: ${id} (${formatSize(file.length)})`);
    return { file, filename: backup.id };
  }

  async deleteBackup(id: string): Promise<{ message: string }> {
    const backups = await this.getBackups();
    const backup = backups.backups.find(b => b.id === id);

    if (!backup) {
      throw new NotFoundException('备份文件不存在或已被删除');
    }

    await fsp.unlink(backup.filePath);
    await this.deleteMeta(backup.filePath);
    this.logsService.info(`备份已删除: ${id}`);
    return { message: '备份已删除' };
  }

  private async ensureBackupDir(): Promise<void> {
    try {
      await fsp.access(this.backupDir);
    } catch {
      await fsp.mkdir(this.backupDir, { recursive: true });
    }
  }

  private async readRemark(filePath: string): Promise<string | undefined> {
    try {
      const content = await fsp.readFile(this.getMetaPathForFile(filePath), 'utf-8');
      const data = JSON.parse(content) as BackupMeta;
      return data.remark || undefined;
    } catch {
      return undefined;
    }
  }

  private async writeMeta(filePath: string, meta: BackupMeta): Promise<void> {
    await fsp.writeFile(this.getMetaPathForFile(filePath), JSON.stringify(meta, null, 2), 'utf-8');
  }

  private async deleteMeta(filePath: string): Promise<void> {
    try {
      await fsp.unlink(this.getMetaPathForFile(filePath));
    } catch (error) {
      if (!this.isFileNotFound(error)) {
        throw error;
      }
    }
  }

  private getMetaPathForFile(filePath: string): string {
    return `${filePath}.meta.json`;
  }

  private async createDatabaseBackup(id: string, timestamp: Date, remark?: string): Promise<void> {
    const filename = `${id}.sql`;
    const filePath = path.join(this.getDatedBackupDir(timestamp), filename);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });

    const dbHost = this.configService.get<string>('DATABASE_HOST', 'localhost');
    const dbPort = this.configService.get<number>('DATABASE_PORT', 3306);
    const dbUser = this.configService.get<string>('DATABASE_USER', 'root');
    const dbPassword = this.configService.get<string>('DATABASE_PASSWORD', '');
    const dbName = this.configService.get<string>('DATABASE_NAME', 'file_service');
    if (!BackupService.SAFE_TABLE_NAME.test(dbName)) {
      throw new BadRequestException('数据库名称包含非法字符，无法创建 SQL 备份');
    }

    const connection = await this.createDatabaseConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
    });

    try {
      const [rows] = await connection.query<RowDataPacket[]>('SHOW TABLES');
      const tables = rows
        .map(row => this.getFirstStringValue(row))
        .filter((table): table is string => Boolean(table));

      const stream = fs.createWriteStream(filePath, { encoding: 'utf-8' });
      try {
        await this.writeSqlLine(stream, `-- 文件服务数据库备份`);
        await this.writeSqlLine(stream, `-- Database: ${dbName}`);
        await this.writeSqlLine(stream, `-- Created At: ${timestamp.toISOString()}`);
        if (remark) await this.writeSqlLine(stream, `-- Remark: ${remark.replace(/[\r\n]+/g, ' ')}`);
        await this.writeSqlLine(stream, `CREATE DATABASE IF NOT EXISTS ${this.quoteIdentifier(dbName)} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await this.writeSqlLine(stream, `USE ${this.quoteIdentifier(dbName)};`);
        await this.writeSqlLine(stream, 'SET FOREIGN_KEY_CHECKS=0;');
        await this.writeSqlLine(stream, 'SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";');
        await this.writeSqlLine(stream, 'SET NAMES utf8mb4;');
        await this.writeSqlLine(stream, 'SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;');
        await this.writeSqlLine(stream, 'START TRANSACTION WITH CONSISTENT SNAPSHOT;');

        for (const table of tables) {
          // 防止 SQL 注入：校验表名格式
          if (!BackupService.SAFE_TABLE_NAME.test(table)) continue;
          await this.dumpTable(connection, stream, table);
        }

        await this.writeSqlLine(stream, 'COMMIT;');
        await this.writeSqlLine(stream, 'SET FOREIGN_KEY_CHECKS=1;');
      } finally {
        await new Promise<void>((resolve, reject) => {
          stream.end(resolve);
          stream.on('error', reject);
        });
      }

      await this.writeMeta(filePath, {
        timestamp: timestamp.toISOString(),
        type: 'database',
        remark: remark || null,
        source: dbName,
      });
    } finally {
      await connection.end();
    }
  }

  private async createFilesBackup(id: string, timestamp: Date, remark?: string): Promise<void> {
    const filename = `${id}.files.zip`;
    const filePath = path.join(this.getDatedBackupDir(timestamp), filename);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const uploadDir = this.configService.get<string>('UPLOAD_BASE_DIR') || './uploads';
    const resolvedUploadDir = path.resolve(uploadDir);
    const resolvedBackupDir = path.resolve(this.backupDir);

    await this.ensureReadableUploadDir(resolvedUploadDir);

    const manifest = {
      timestamp: timestamp.toISOString(),
      uploadDir: resolvedUploadDir,
      remark: remark || null,
      message: '上传文件压缩备份，已排除备份目录和临时切片目录。',
    };

    await this.createZipArchive(filePath, resolvedUploadDir, resolvedBackupDir, manifest);
    await this.writeMeta(filePath, {
      timestamp: timestamp.toISOString(),
      type: 'files',
      remark: remark || null,
      source: resolvedUploadDir,
    });
  }

  private async createDatabaseConnection(options: mysql.ConnectionOptions): Promise<mysql.Connection> {
    try {
      return await mysql.createConnection(options);
    } catch (error) {
      throw new InternalServerErrorException(`数据库连接失败：${this.getErrorDetail(error)}`);
    }
  }

  private async ensureReadableUploadDir(uploadDir: string): Promise<void> {
    try {
      const stat = await fsp.stat(uploadDir);
      if (!stat.isDirectory()) {
        throw new BadRequestException(`上传目录不是有效文件夹：${uploadDir}`);
      }
      await fsp.access(uploadDir, fs.constants.R_OK);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`上传目录不可读取：${uploadDir}，${this.getErrorDetail(error)}`);
    }
  }

  private async dumpTable(
    connection: mysql.Connection,
    stream: fs.WriteStream,
    table: string,
  ): Promise<void> {
    const quotedTable = this.quoteIdentifier(table);
    const [createRows] = await connection.query<CreateTableRow[]>('SHOW CREATE TABLE ??', [table]);
    const createTableSql = createRows[0]?.['Create Table'];
    if (!createTableSql) return;

    await this.writeSqlLine(stream, '');
    await this.writeSqlLine(stream, `-- Table structure for ${quotedTable}`);
    await this.writeSqlLine(stream, `DROP TABLE IF EXISTS ${quotedTable};`);
    await this.writeSqlLine(stream, `${createTableSql};`);

    const [rows] = await connection.query<RowDataPacket[]>('SELECT * FROM ??', [table]);
    if (rows.length === 0) return;

    await this.writeSqlLine(stream, '');
    await this.writeSqlLine(stream, `-- Data for ${quotedTable}`);
    const columns = Object.keys(rows[0]).map(column => this.quoteIdentifier(column)).join(', ');
    const batchSize = 200;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = batch.map(row => {
        const rowValues = Object.values(row).map(value => connection.escape(value)).join(', ');
        return `(${rowValues})`;
      });
      await this.writeSqlLine(stream, `INSERT INTO ${quotedTable} (${columns}) VALUES`);
      await this.writeSqlLine(stream, `${values.join(',\n')};`);
    }
  }

  private async createZipArchive(
    filePath: string,
    uploadDir: string,
    backupDir: string,
    manifest: Record<string, unknown>,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(filePath);
      const archive = new ZipArchive({ zlib: { level: 9 } });

      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
      archive.pipe(output);
      archive.append(JSON.stringify(manifest, null, 2), { name: 'backup-manifest.json' });

      this.appendDirectoryToArchive(archive, uploadDir, uploadDir, backupDir)
        .then(() => archive.finalize())
        .catch(reject);
    });
  }

  private async appendDirectoryToArchive(
    archive: Archiver,
    rootDir: string,
    currentDir: string,
    backupDir: string,
  ): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      throw new InternalServerErrorException(`读取上传目录失败：${currentDir}，${this.getErrorDetail(error)}`);
    }
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const resolvedFullPath = path.resolve(fullPath);
      if (resolvedFullPath === backupDir || resolvedFullPath.startsWith(`${backupDir}${path.sep}`)) continue;
      if (entry.isDirectory() && entry.name === '.chunks') continue;

      if (entry.isDirectory()) {
        await this.appendDirectoryToArchive(archive, rootDir, fullPath, backupDir);
      } else if (entry.isFile()) {
        archive.file(fullPath, { name: path.relative(rootDir, fullPath).replace(/\\/g, '/') });
      }
    }
  }

  private async writeSqlLine(stream: fs.WriteStream, line: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      stream.write(`${line}\n`, error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private quoteIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  private getFirstStringValue(row: RowDataPacket): string | undefined {
    const value = Object.values(row)[0];
    return typeof value === 'string' ? value : undefined;
  }

  private async cleanupCreatedFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await fsp.unlink(filePath);
      } catch (error) {
        if (!this.isFileNotFound(error)) {
          this.logsService.error(`清理失败备份文件失败: ${filePath} - ${this.getErrorDetail(error)}`);
        }
      }
    }
  }

  private toBackupErrorMessage(error: unknown): string {
    if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (typeof response === 'object' && response !== null && 'message' in response) {
        const message = (response as { message?: unknown }).message;
        if (Array.isArray(message)) return message.join('；');
        if (typeof message === 'string') return message;
      }
    }
    return `备份创建失败：${this.getErrorDetail(error)}`;
  }

  private getErrorDetail(error: unknown): string {
    if (error instanceof Error && error.message) return this.translateSystemError(error.message);
    return '未知错误';
  }

  private translateSystemError(message: string): string {
    return message
      .replace(/connect ECONNREFUSED/i, '数据库连接被拒绝')
      .replace(/Access denied for user/i, '数据库账号或密码错误')
      .replace(/Unknown database/i, '数据库不存在')
      .replace(/ENOENT/i, '路径不存在')
      .replace(/EACCES/i, '权限不足')
      .replace(/EPERM/i, '没有操作权限');
  }

  private isFileNotFound(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
  }

  private getDatedBackupDir(timestamp: Date): string {
    const year = String(timestamp.getFullYear());
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    return path.join(this.backupDir, year, month, day);
  }

  private async collectBackups(dir: string): Promise<BackupEntry[]> {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (this.isFileNotFound(error)) return [];
      throw error;
    }

    const backups: BackupEntry[] = [];
    for (const entry of entries) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        backups.push(...await this.collectBackups(filePath));
        continue;
      }
      if (!entry.isFile() || entry.name.endsWith('.meta.json')) continue;

      const type = this.getBackupType(entry.name);
      if (!type) continue;

      const stats = await fsp.stat(filePath);
      backups.push({
        id: entry.name,
        type,
        size: stats.size,
        createdAt: stats.birthtime,
        filePath,
        remark: await this.readRemark(filePath),
      });
    }
    return backups;
  }

  private getBackupType(filename: string): 'database' | 'files' | undefined {
    if (filename.endsWith('.files.json') || filename.endsWith('.zip')) return 'files';
    if (filename.endsWith('.json') || filename.endsWith('.sql')) return 'database';
    return undefined;
  }
}
