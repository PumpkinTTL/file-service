import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { UploadTokenEntity } from '../../entities/upload-token.entity';

@Injectable()
export class AdminTokensService {
  constructor(
    @InjectRepository(UploadTokenEntity)
    private tokenRepo: Repository<UploadTokenEntity>,
  ) {}

  async create(dto: { name: string; description?: string; expiresAt?: string }) {
    // Generate a secure random token
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

    token.enabled = enabled;
    if (!enabled) {
      token.revokedAt = new Date();
    } else {
      token.revokedAt = null;
    }

    await this.tokenRepo.save(token);
    return { id: token.id, enabled: token.enabled };
  }

  async rotate(id: number) {
    const token = await this.tokenRepo.findOne({ where: { id } });
    if (!token) {
      throw new NotFoundException('令牌未找到');
    }

    const rawToken = `fs_${crypto.randomBytes(32).toString('hex')}`;
    token.tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    token.tokenPrefix = rawToken.substring(0, 8);
    token.revokedAt = null;
    token.enabled = true;

    await this.tokenRepo.save(token);

    return {
      id: token.id,
      name: token.name,
      token: rawToken,
      tokenPrefix: token.tokenPrefix,
      warning: '该令牌仅显示一次，请妥善保存',
    };
  }

  async remove(id: number) {
    const token = await this.tokenRepo.findOne({ where: { id } });
    if (!token) {
      throw new NotFoundException('令牌未找到');
    }

    await this.tokenRepo.remove(token);
    return { message: '令牌已成功删除' };
  }
}
