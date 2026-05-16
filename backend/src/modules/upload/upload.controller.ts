import { Controller, Post, UseGuards, BadRequestException, PayloadTooLargeException, Req } from '@nestjs/common';
import { UploadTokenGuard } from '../../common/guards/upload-token.guard';
import { UploadService } from './upload.service';
import { ConfigService } from '@nestjs/config';

@Controller('upload')
export class UploadController {
  constructor(
    private uploadService: UploadService,
    private configService: ConfigService,
  ) {}

  @Post()
  @UseGuards(UploadTokenGuard)
  async uploadFile(@Req() request: any) {
    const maxFileSize = this.configService.get<number>('maxFileSize') || 209715200;
    const maxMB = (maxFileSize / 1024 / 1024).toFixed(0);

    let data: any;
    try {
      data = await request.file({
        limits: {
          fileSize: maxFileSize,
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

    return this.uploadService.handleUpload(
      buffer,
      data.filename,
      data.mimetype,
      buffer.length,
      token,
    );
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
