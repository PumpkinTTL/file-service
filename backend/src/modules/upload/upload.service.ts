import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileEntity } from '../../entities/file.entity';
import { UploadTokenEntity } from '../../entities/upload-token.entity';
import { UploadSessionEntity } from '../../entities/upload-session.entity';
import { ConfigService } from '@nestjs/config';
import { getDatePath } from '../../common/utils/date-path.util';
import { computeBufferHash, computeFileHash } from '../../common/utils/file-hash.util';
import { LogsService } from '../admin-logs/logs.service';
import { formatSize } from '../../common/utils/format-size.util';
const UPLOAD_ID_REGEX = /^[a-f0-9]{32}$/i;

@Injectable()
export class UploadService {
  private uploadBaseDir: string;
  private baseUrl: string;

  constructor(
    @InjectRepository(FileEntity)
    private fileRepo: Repository<FileEntity>,
    @InjectRepository(UploadTokenEntity)
    private tokenRepo: Repository<UploadTokenEntity>,
    @InjectRepository(UploadSessionEntity)
    private sessionRepo: Repository<UploadSessionEntity>,
    private configService: ConfigService,
    private logsService: LogsService,
  ) {
    this.uploadBaseDir = this.configService.get<string>('uploadBaseDir');
    this.baseUrl = this.configService.get<string>('baseUrl');
  }

  /**
   * POST /upload/check — 客户端算好 hash，查重秒传
   */
  async checkFile(hash: string, filename: string, size: number) {
    if (!hash || !filename || !size) {
      throw new BadRequestException('缺少必要参数：hash、filename、size');
    }

    const existing = await this.fileRepo.findOne({ where: { hash } });

    if (existing) {
      this.logsService.info(`文件秒传: ${filename} (${formatSize(size)})`);
      return {
        exists: true,
        duplicated: true,
        fileName: existing.fileName,
        relativePath: existing.relativePath,
        fullUrl: existing.fullUrl,
        size: Number(existing.size),
        hash: existing.hash,
      };
    }

    return { exists: false };
  }

  /**
   * POST /upload — 小文件直接上传（保留原有逻辑）
   */
  async handleUpload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    size: number,
    clientHash?: string,
    token?: UploadTokenEntity,
  ) {
    const hash = computeBufferHash(buffer);

    // 如果前端传了 hash，校验一致性
    if (clientHash && clientHash !== hash) {
      throw new BadRequestException('文件哈希校验失败，文件可能已损坏');
    }

    // 查重
    const existing = await this.fileRepo.findOne({ where: { hash } });
    if (existing) {
      return {
        duplicated: true,
        fileName: existing.fileName,
        relativePath: existing.relativePath,
        fullUrl: existing.fullUrl,
        size: Number(existing.size),
        hash: existing.hash,
      };
    }

    // 保存文件
    const result = await this.saveFileToDisk(buffer, originalName, mimeType, size, hash, token);
    return { duplicated: false, ...result };
  }

  /**
   * POST /upload/chunk — 切片上传
   */
  async uploadChunk(
    chunkBuffer: Buffer,
    uploadId: string,
    chunkIndex: number,
    token?: UploadTokenEntity,
  ) {
    // 防止路径遍历：uploadId 必须是 32 位 hex
    if (!UPLOAD_ID_REGEX.test(uploadId)) {
      throw new BadRequestException('无效的上传会话 ID');
    }

    // 查找 session
    const session = await this.sessionRepo.findOne({ where: { uploadId } });

    if (!session) {
      throw new NotFoundException('上传会话不存在，请先调用 /upload/check 创建');
    }

    if (session.status !== 'uploading') {
      throw new BadRequestException('该上传会话已完成或已过期');
    }

    if (chunkIndex < 0 || chunkIndex >= Number(session.totalChunks)) {
      throw new BadRequestException(`切片索引无效，有效范围：0-${Number(session.totalChunks) - 1}`);
    }

    // 校验切片大小：最后一个切片允许小于 chunkSize，其余不允许超过
    const isLastChunk = chunkIndex === Number(session.totalChunks) - 1;
    if (!isLastChunk && chunkBuffer.length > Number(session.chunkSize)) {
      throw new BadRequestException(`切片 ${chunkIndex} 大小 ${chunkBuffer.length} 超过限制 ${session.chunkSize}`);
    }
    // 所有切片都不允许超过 2x chunkSize（防止恶意上传）
    if (chunkBuffer.length > Number(session.chunkSize) * 2) {
      throw new BadRequestException(`切片 ${chunkIndex} 大小异常，远超 chunkSize`);
    }

    // 保存切片到临时目录（纯磁盘写入，无 DB 操作）
    const chunkDir = path.join(this.uploadBaseDir, '.chunks', uploadId);
    await fs.promises.mkdir(chunkDir, { recursive: true });

    const chunkPath = path.join(chunkDir, String(chunkIndex));
    await fs.promises.writeFile(chunkPath, chunkBuffer);

    return {
      uploadId: session.uploadId,
      chunkIndex,
      totalChunks: Number(session.totalChunks),
    };
  }

  /**
   * POST /upload/merge — 合并切片
   */
  async mergeChunks(
    uploadId: string,
    filename: string,
    hash: string,
    totalChunks: number,
    token?: UploadTokenEntity,
  ) {
    // 防止路径遍历
    if (!UPLOAD_ID_REGEX.test(uploadId)) {
      throw new BadRequestException('无效的上传会话 ID');
    }

    // 原子操作：将 status 从 'uploading' 改为 'merging'，防止并发合并
    const claimed = await this.sessionRepo.update(
      { uploadId, status: 'uploading' },
      { status: 'merging' },
    );
    if (claimed.affected === 0) {
      const exists = await this.sessionRepo.findOne({ where: { uploadId } });
      if (!exists) {
        throw new NotFoundException('上传会话不存在');
      }
      throw new BadRequestException('该上传会话已完成或正在合并中');
    }

    const session = await this.sessionRepo.findOne({ where: { uploadId } });

    // 校验客户端传的 totalChunks 与 session 一致
    if (totalChunks !== Number(session.totalChunks)) {
      await this.sessionRepo.update({ uploadId }, { status: 'uploading' });
      throw new BadRequestException(
        `切片数量不一致：客户端 ${totalChunks}，会话 ${Number(session.totalChunks)}`,
      );
    }

    const chunkDir = path.join(this.uploadBaseDir, '.chunks', uploadId);

    try {
      // 先查重：重复文件直接返回，避免后续磁盘 I/O
      const existing = await this.fileRepo.findOne({ where: { hash } });
      if (existing) {
        this.cleanupChunks(chunkDir);
        await this.sessionRepo.update({ uploadId }, { status: 'merged' });

        return {
          duplicated: true,
          fileName: existing.fileName,
          relativePath: existing.relativePath,
          fullUrl: existing.fullUrl,
          size: Number(existing.size),
          hash: existing.hash,
        };
      }

      // 从磁盘读取已上传切片，验证完整性
      const uploadedChunks = await this.getChunkFiles(uploadId);
      if (uploadedChunks.length !== totalChunks) {
        throw new BadRequestException(
          `切片不完整：已上传 ${uploadedChunks.length}/${totalChunks} 个切片`,
        );
      }

      // 合并切片 — 使用 stream/promises/pipeline 正确处理背压
      const datePath = getDatePath();
      const ext = path.extname(filename).toLowerCase();
      const fileName = `${uuidv4()}${ext}`;
      const relativePath = `uploads/${datePath}/${fileName}`;
      const fullDirPath = path.join(this.uploadBaseDir, datePath);
      await fs.promises.mkdir(fullDirPath, { recursive: true });

      const fullPath = path.join(this.uploadBaseDir, datePath, fileName);

      // DEBUG: 记录每个切片大小和 session 文件大小
      const chunkSizes: number[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(chunkDir, String(i));
        const stat = await fs.promises.stat(chunkPath);
        chunkSizes.push(stat.size);
      }
      const totalChunkBytes = chunkSizes.reduce((a, b) => a + b, 0);
      this.logsService.error(
        `[DEBUG] 合并前: session.fileSize=${Number(session.fileSize)}, totalChunks=${totalChunks}, 切片总大小=${totalChunkBytes}, 各切片大小=${JSON.stringify(chunkSizes.slice(0, 5))}...${chunkSizes.length > 5 ? `(共${chunkSizes.length}个)` : ''}`,
      );

      const writeStream = fs.createWriteStream(fullPath);

      try {
        for (let i = 0; i < totalChunks; i++) {
          const chunkPath = path.join(chunkDir, String(i));
          const chunkData = await fs.promises.readFile(chunkPath);
          await new Promise<void>((resolve, reject) => {
            writeStream.write(chunkData, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
        await new Promise<void>((resolve, reject) => {
          writeStream.end(() => resolve());
          writeStream.on('error', reject);
        });
      } catch (streamErr) {
        writeStream.destroy();
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        throw streamErr;
      }

      // 验证合并后的 hash
      const actualHash = await computeFileHash(fullPath);
      const mergedStat = await fs.promises.stat(fullPath);
      this.logsService.error(
        `[DEBUG] 合并后: 合并文件大小=${mergedStat.size}, actualHash=${actualHash}, clientHash=${hash}`,
      );
      if (hash && actualHash !== hash) {
        fs.unlinkSync(fullPath);
        const detail = `客户端: ${hash}, 服务端: ${actualHash}, 文件: ${filename}, 切片数: ${totalChunks}, sessionFileSize: ${Number(session.fileSize)}, mergedSize: ${mergedStat.size}, chunkTotal: ${totalChunkBytes}`;
        this.logsService.error(`哈希校验失败 — ${detail}`);
        throw new BadRequestException(`文件合并后哈希校验失败: ${detail}`);
      }

      const fullUrl = `${this.baseUrl}/${relativePath}`;

      // 入库
      const fileRecord = this.fileRepo.create({
        originalName: filename,
        fileName,
        relativePath,
        fullUrl,
        hash: actualHash,
        hashAlgorithm: 'sha256',
        mimeType: session.mimeType || 'application/octet-stream',
        size: session.fileSize,
        tokenId: token?.id || session.tokenId || null,
        tokenName: token?.name || null,
      });
      await this.fileRepo.save(fileRecord);

      // 清理
      this.cleanupChunks(chunkDir);
      await this.sessionRepo.update({ uploadId }, { status: 'merged' });

      this.logsService.info(`文件上传成功: ${filename} (${formatSize(Number(session.fileSize))})`);

      return {
        duplicated: false,
        fileName,
        relativePath,
        fullUrl,
        size: Number(session.fileSize),
        hash: actualHash,
      };
    } catch (err) {
      // 失败时重置状态，允许客户端重试（保留切片文件）
      try {
        await this.sessionRepo.update({ uploadId }, { status: 'uploading' });
      } catch {
        // 忽略重置失败
      }
      this.logsService.error(`文件合并失败: ${filename} - ${err.message}`);
      throw err;
    }
  }

  /**
   * GET /upload/progress/:uploadId — 断点续传查询
   */
  async getProgress(uploadId: string) {
    if (!UPLOAD_ID_REGEX.test(uploadId)) {
      throw new BadRequestException('无效的上传会话 ID');
    }

    const session = await this.sessionRepo.findOne({ where: { uploadId } });

    if (!session) {
      throw new NotFoundException('上传会话不存在');
    }

    // 从磁盘读取已上传的切片列表（零 DB 操作）
    const uploadedChunks = await this.getChunkFiles(uploadId);

    return {
      uploadId: session.uploadId,
      uploadedChunks,
      totalChunks: Number(session.totalChunks),
      chunkSize: Number(session.chunkSize),
      status: session.status,
      originalName: session.originalName,
      fileSize: Number(session.fileSize),
    };
  }

  /**
   * 创建切片上传会话（check 接口在文件不存在时调用）
   */
  async createSession(
    hash: string,
    filename: string,
    size: number,
    chunkSize: number,
    mimeType: string,
    token?: UploadTokenEntity,
  ) {
    // 如果这个 hash 已有进行中的会话，直接复用（续传场景）
    const existing = await this.sessionRepo.findOne({
      where: { fileHash: hash, status: 'uploading' },
    });
    if (existing) {
      return {
        uploadId: existing.uploadId,
        chunkSize: Number(existing.chunkSize),
        totalChunks: Number(existing.totalChunks),
      };
    }

    const totalChunks = Math.ceil(size / chunkSize);
    const uploadId = uuidv4().replace(/-/g, '');

    const session = this.sessionRepo.create({
      uploadId,
      fileHash: hash,
      originalName: filename,
      fileSize: size,
      chunkSize,
      totalChunks,
      mimeType,
      tokenId: token?.id || null,
      status: 'uploading',
    });

    await this.sessionRepo.save(session);

    // 防并发：检查是否有其他请求同时创建了相同 hash 的 session
    const sessions = await this.sessionRepo.find({
      where: { fileHash: hash, status: 'uploading' },
      order: { id: 'ASC' },
    });
    if (sessions.length > 1) {
      const [first, ...duplicates] = sessions;
      await this.sessionRepo.remove(duplicates);
      return {
        uploadId: first.uploadId,
        chunkSize: Number(first.chunkSize),
        totalChunks: Number(first.totalChunks),
      };
    }

    return {
      uploadId,
      chunkSize,
      totalChunks,
    };
  }

  /**
   * 保存文件到磁盘并入库
   */
  private async saveFileToDisk(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    size: number,
    hash: string,
    token?: UploadTokenEntity,
  ) {
    const datePath = getDatePath();
    const ext = path.extname(originalName).toLowerCase();
    const fileName = `${uuidv4()}${ext}`;
    const relativePath = `uploads/${datePath}/${fileName}`;
    const fullDirPath = path.join(this.uploadBaseDir, datePath);
    await fs.promises.mkdir(fullDirPath, { recursive: true });

    const fullPath = path.join(this.uploadBaseDir, datePath, fileName);
    await fs.promises.writeFile(fullPath, buffer);

    const fullUrl = `${this.baseUrl}/${relativePath}`;

    const fileRecord = this.fileRepo.create({
      originalName,
      fileName,
      relativePath,
      fullUrl,
      hash,
      hashAlgorithm: 'sha256',
      mimeType,
      size,
      tokenId: token?.id || null,
      tokenName: token?.name || null,
    });

    await this.fileRepo.save(fileRecord);

    this.logsService.info(`文件上传成功: ${originalName} (${formatSize(size)})`);

    return { fileName, relativePath, fullUrl, size, hash };
  }

  /**
   * 从磁盘读取已上传的切片索引列表
   */
  private async getChunkFiles(uploadId: string): Promise<number[]> {
    const chunkDir = path.join(this.uploadBaseDir, '.chunks', uploadId);
    try {
      const files = await fs.promises.readdir(chunkDir);
      return files
        .map(name => parseInt(name, 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  /**
   * 清理临时切片目录
   */
  private cleanupChunks(chunkDir: string) {
    if (fs.existsSync(chunkDir)) {
      fs.rmSync(chunkDir, { recursive: true, force: true });
    }
  }
}
