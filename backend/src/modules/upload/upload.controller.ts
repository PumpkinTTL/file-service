import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Body,
  BadRequestException,
  PayloadTooLargeException,
  Req,
} from '@nestjs/common';
import { UploadTokenGuard } from '../../common/guards/upload-token.guard';
import { UploadService } from './upload.service';
import { ConfigService } from '@nestjs/config';
import { CheckUploadDto } from './dto/check-upload.dto';
import { MergeChunksDto } from './dto/merge-chunks.dto';

@Controller('upload')
export class UploadController {
  private maxFileSize: number;
  private chunkThreshold: number;

  constructor(
    private uploadService: UploadService,
    private configService: ConfigService,
  ) {
    this.maxFileSize = this.configService.get<number>('maxFileSize') || 209715200;
    this.chunkThreshold = 10 * 1024 * 1024; // 10MB 以上走切片
  }

  /**
   * POST /upload/check — 查重秒传 + 创建切片会话
   */
  @Post('check')
  @UseGuards(UploadTokenGuard)
  async checkFile(@Body() dto: CheckUploadDto, @Req() request: any) {
    const { hash, filename, size } = dto;
    const token = request.uploadToken;

    // 查重
    const result = await this.uploadService.checkFile(hash, filename, size);

    if (result.exists) {
      return result; // 秒传
    }

    // 文件不存在，创建切片上传会话（大文件用）
    // 切片大小 2MB
    const chunkSize = 2 * 1024 * 1024;
    const session = await this.uploadService.createSession(
      hash,
      filename,
      size,
      chunkSize,
      'application/octet-stream', // 前端可以传 mimeType 过来
      token,
    );

    return {
      exists: false,
      ...session,
    };
  }

  /**
   * POST /upload — 小文件直接上传（保留原有功能）
   */
  @Post()
  @UseGuards(UploadTokenGuard)
  async uploadFile(@Req() request: any) {
    const maxMB = (this.maxFileSize / 1024 / 1024).toFixed(0);

    let data: any;
    try {
      data = await request.file({
        limits: {
          fileSize: this.maxFileSize,
        },
      });
    } catch (err: any) {
      if (this.isFileTooLarge(err)) {
        throw new PayloadTooLargeException(`文件大小超过限制（最大 ${maxMB}MB）`);
      }
      throw new BadRequestException(`文件上传失败：${err?.message || '未知错误'}`);
    }

    if (!data) {
      throw new BadRequestException('未检测到上传文件');
    }

    const allowedTypes = this.configService
      .get<string>('allowedFileTypes')
      .split(',')
      .map((t) => t.trim().toLowerCase());

    const ext = data.filename.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(ext)) {
      throw new BadRequestException(`不支持 .${ext} 文件类型`);
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch (err: any) {
      if (this.isFileTooLarge(err)) {
        throw new PayloadTooLargeException(`文件大小超过限制（最大 ${maxMB}MB）`);
      }
      throw new BadRequestException(`文件读取失败：${err?.message || '未知错误'}`);
    }

    const token = request.uploadToken;

    // 从 fields 中取 hash（如果前端传了）
    const fields = data.fields;
    const clientHash = fields?.hash?.value || undefined;

    return this.uploadService.handleUpload(
      buffer,
      data.filename,
      data.mimetype,
      buffer.length,
      clientHash,
      token,
    );
  }

  /**
   * POST /upload/chunk — 切片上传
   */
  @Post('chunk')
  @UseGuards(UploadTokenGuard)
  async uploadChunk(@Req() request: any) {
    let uploadId: string;
    let chunkIndex: number;
    let chunkBuffer: Buffer;

    try {
      // 使用 parts() 逐个读取 multipart 字段，比 file() 更可靠
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'uploadId') {
            uploadId = part.value;
          } else if (part.fieldname === 'chunkIndex') {
            chunkIndex = parseInt(part.value, 10);
          }
        } else if (part.type === 'file') {
          // 限制单个切片大小 5MB
          const chunks: Buffer[] = [];
          let totalSize = 0;
          for await (const chunk of part.file) {
            totalSize += chunk.length;
            if (totalSize > 5 * 1024 * 1024) {
              throw new PayloadTooLargeException('单个切片大小超过限制（最大 5MB）');
            }
            chunks.push(chunk);
          }
          chunkBuffer = Buffer.concat(chunks);
        }
      }
    } catch (err: any) {
      if (this.isFileTooLarge(err)) {
        throw new PayloadTooLargeException('单个切片大小超过限制（最大 5MB）');
      }
      throw new BadRequestException(`切片上传失败：${err?.message || '未知错误'}`);
    }

    if (!chunkBuffer || !uploadId || chunkIndex === undefined || isNaN(chunkIndex)) {
      throw new BadRequestException('缺少必要参数：uploadId、chunkIndex 或 file');
    }

    const token = request.uploadToken;

    return this.uploadService.uploadChunk(
      chunkBuffer,
      uploadId,
      chunkIndex,
      token,
    );
  }

  /**
   * POST /upload/merge — 合并切片
   */
  @Post('merge')
  @UseGuards(UploadTokenGuard)
  async mergeChunks(@Body() dto: MergeChunksDto, @Req() request: any) {
    const { uploadId, filename, hash, totalChunks } = dto;
    const token = request.uploadToken;

    if (!uploadId || !filename || !hash || !totalChunks) {
      throw new BadRequestException('缺少必要参数：uploadId、filename、hash、totalChunks');
    }

    return this.uploadService.mergeChunks(uploadId, filename, hash, totalChunks, token);
  }

  /**
   * GET /upload/progress/:uploadId — 断点续传查询
   */
  @Get('progress/:uploadId')
  @UseGuards(UploadTokenGuard)
  async getProgress(@Param('uploadId') uploadId: string) {
    return this.uploadService.getProgress(uploadId);
  }

  private isFileTooLarge(err: any): boolean {
    return (
      err?.code === 'FST_REQ_FILE_TOO_LARGE' ||
      err?.statusCode === 413 ||
      err?.message?.includes('too large') ||
      err?.message?.includes('maxFileSize') ||
      err?.type === 'entity.too.large'
    );
  }
}
