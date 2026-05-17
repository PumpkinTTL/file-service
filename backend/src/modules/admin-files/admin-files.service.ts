import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { FileEntity } from '../../entities/file.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminFilesService {
  constructor(
    @InjectRepository(FileEntity)
    private fileRepo: Repository<FileEntity>,
    private configService: ConfigService,
  ) {}

  async findAll(page: number, limit: number) {
    const [items, total] = await this.fileRepo.findAndCount({
      where: { deletedAt: undefined as any },
      order: { uploadedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async remove(id: number) {
    const file = await this.fileRepo.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    // Delete physical file — 防止路径遍历
    const uploadBaseDir = this.configService.get<string>('uploadBaseDir');
    const physicalPath = path.resolve(uploadBaseDir, file.relativePath.replace('uploads/', ''));
    if (!physicalPath.startsWith(path.resolve(uploadBaseDir))) {
      throw new BadRequestException('无效的文件路径');
    }
    if (fs.existsSync(physicalPath)) {
      fs.unlinkSync(physicalPath);
    }

    // Soft delete — sets deletedAt via @DeleteDateColumn
    await this.fileRepo.softRemove(file);

    return { message: '文件已成功删除' };
  }
}
