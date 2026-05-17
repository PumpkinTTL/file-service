import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('缺少 Authorization 请求头');
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Authorization 格式错误，需要 Bearer <token>');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwtSecret'),
      });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('JWT Token 无效或已过期');
    }
  }
}
