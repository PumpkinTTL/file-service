import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { UploadTokenEntity } from '../../entities/upload-token.entity';

@Injectable()
export class UploadTokenGuard implements CanActivate {
  constructor(
    @InjectRepository(UploadTokenEntity)
    private tokenRepo: Repository<UploadTokenEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tokenValue = request.headers['x-upload-token'];

    if (!tokenValue) {
      throw new UnauthorizedException('缺少 x-upload-token 请求头');
    }

    const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

    const token = await this.tokenRepo.findOne({
      where: { tokenHash, enabled: true },
    });

    if (!token) {
      throw new UnauthorizedException('Upload Token 无效或已被禁用');
    }

    if (token.expiresAt && new Date() > token.expiresAt) {
      throw new UnauthorizedException('Upload Token 已过期');
    }

    // Update last used info — lightweight UPDATE instead of full save()
    await this.tokenRepo.update(token.id, {
      lastUsedAt: new Date(),
      lastUsedIp: request.ip || request.headers['x-forwarded-for'] || 'unknown',
    });

    request.uploadToken = token;
    return true;
  }
}
