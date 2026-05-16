import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileEntity } from '../../entities/file.entity';
import { UploadTokenEntity } from '../../entities/upload-token.entity';
import { ConfigService } from '@nestjs/config';
import { getDatePath } from '../../common/utils/date-path.util';
import { computeBufferHash } from '../../common/utils/file-hash.util';

@Injectable()
export class UploadService {
  constructor(
    @InjectRepository(FileEntity)
    private fileRepo: Repository<FileEntity>,
    @InjectRepository(UploadTokenEntity)
    private tokenRepo: Repository<UploadTokenEntity>,
    private configService: ConfigService,
  ) {}

  async handleUpload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    size: number,
    token?: UploadTokenEntity,
  ) {
    // 1. Compute SHA256 hash
    const hash = computeBufferHash(buffer);

    // 2. Check for duplicate
    const existing = await this.fileRepo.findOne({
      where: { hash },
    });

    if (existing) {
      return {
        duplicated: true,
        fileName: existing.fileName,
        relativePath: existing.relativePath,
        fullUrl: existing.fullUrl,
        size: existing.size,
        hash: existing.hash,
      };
    }

    // 3. Save file to disk
    const datePath = getDatePath();
    const ext = path.extname(originalName).toLowerCase();
    const fileName = `${uuidv4()}${ext}`;
    const relativePath = `uploads/${datePath}/${fileName}`;
    const uploadBaseDir = this.configService.get<string>('uploadBaseDir');
    const fullDirPath = path.join(uploadBaseDir, datePath);

    // Auto create directory
    if (!fs.existsSync(fullDirPath)) {
      fs.mkdirSync(fullDirPath, { recursive: true });
    }

    const fullPath = path.join(uploadBaseDir, datePath, fileName);
    fs.writeFileSync(fullPath, buffer);

    // 4. Build full URL
    const baseUrl = this.configService.get<string>('baseUrl');
    const fullUrl = `${baseUrl}/${relativePath}`;

    // 5. Save to database
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

    return {
      duplicated: false,
      fileName,
      relativePath,
      fullUrl,
      size,
      hash,
    };
  }
}
