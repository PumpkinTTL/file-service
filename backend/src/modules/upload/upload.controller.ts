import { Controller, Post, UseGuards, BadRequestException, Req } from '@nestjs/common';
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
    const data = await request.file({
      limits: {
        fileSize: this.configService.get<number>('maxFileSize'),
      },
    });

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

    const buffer = await data.toBuffer();
    const token = request.uploadToken;

    return this.uploadService.handleUpload(
      buffer,
      data.filename,
      data.mimetype,
      buffer.length,
      token,
    );
  }
}
