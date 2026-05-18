import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { FileEntity } from '../../entities/file.entity';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileEntity)
    private filesRepository: Repository<FileEntity>,
  ) {}

  async getUploadStats() {
    const now = new Date();
    const hours = Array.from({ length: 24 }, (_, i) => {
      const start = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      return { start, end };
    });

    const stats = await Promise.all(
      hours.map(async ({ start, end }) => {
        const count = await this.filesRepository.count({
          where: {
            uploadedAt: Between(start, end),
          },
        });
        return count;
      }),
    );

    return { hours: stats };
  }
}
