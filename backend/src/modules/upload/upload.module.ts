import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { FileEntity } from '../../entities/file.entity';
import { UploadTokenEntity } from '../../entities/upload-token.entity';
import { UploadTokenGuard } from '../../common/guards/upload-token.guard';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity, UploadTokenEntity])],
  controllers: [UploadController],
  providers: [UploadService, UploadTokenGuard],
  exports: [UploadService],
})
export class UploadModule {}
