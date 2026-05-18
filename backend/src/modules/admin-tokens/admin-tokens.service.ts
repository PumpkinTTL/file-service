import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { UploadTokenEntity } from '../../entities/upload-token.entity';
import { LogsService } from '../admin-logs/logs.service';

@Injectable()
export class AdminTokensService {
  constructor(
    @InjectRepository(UploadTokenEntity)
    private tokenRepo: Repository<UploadTokenEntity>,
    private logsService: LogsService,
  ) {}

  async create(dto: { name: string; description?: string; expiresAt?: string }) {
    const rawToken = `fs_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = rawToken.substring(0, 8);

    const entity = this.tokenRepo.create({
      name: dto.name,
      tokenHash,
      tokenPrefix,
      description: dto.description || null,
      enabled: true,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt.replace(' ', 'T')) : null,
    });

    await this.tokenRepo.save(entity);

    this.logsService.info(`Token 已创建: ${dto.name} (${tokenPrefix}***)`);

    // Return raw token ONLY on creation (never stored)
    return {
      id: entity.id,
      name: entity.name,
      token: rawToken,
      tokenPrefix,
      description: entity.description,
      enabled: entity.enabled,
      expiresAt: entity.expiresAt,
      createdAt: entity.createdAt,
      warning: '该令牌仅显示一次，请妥善保存',
    };
  }

  async findAll(page: number, limit: number) {
    const [items, total] = await this.tokenRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Remove tokenHash from response for security
    const safeItems = items.map(({ tokenHash, ...rest }) => rest);

    return {
      items: safeItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async setEnabled(id: number, enabled: boolean) {
    const token = await this.tokenRepo.findOne({ where: { id } });
    if (!token) {
      throw new NotFoundException('令牌未找到');
    }

    await this.tokenRepo.update(id, {
      enabled,
      revokedAt: enabled ? null : new Date(),
    });

    this.logsService.info(`Token 状态变更: ${token.name} → ${enabled ? '启用' : '禁用'}`);
    return { id, enabled };
  }

  async rotate(id: number) {
    const token = await this.tokenRepo.findOne({ where: { id } });
    if (!token) {
      throw new NotFoundException('令牌未找到');
    }

    const rawToken = `fs_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = rawToken.substring(0, 8);

    await this.tokenRepo.update(id, {
      tokenHash,
      tokenPrefix,
      revokedAt: null,
      enabled: true,
    });

    this.logsService.info(`Token 已轮换: ${token.name} (新前缀: ${tokenPrefix}***)`);

    return {
      id,
      name: token.name,
      token: rawToken,
      tokenPrefix,
      warning: '该令牌仅显示一次，请妥善保存',
    };
  }

  async remove(id: number) {
    const token = await this.tokenRepo.findOne({ where: { id } });
    if (!token) {
      throw new NotFoundException('令牌未找到');
    }

    await this.tokenRepo.delete(id);
    this.logsService.info(`Token 已删除: ${token.name}`);
    return { message: '令牌已成功删除' };
  }
}
