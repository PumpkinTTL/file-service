import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const adminUsername = this.configService.get<string>('adminUsername');
    const adminPasswordHash = this.configService.get<string>('adminPassword');

    // Verify username
    if (dto.username !== adminUsername) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // Support both bcrypt hash (starts with $2b$) and plaintext for migration
    let passwordMatch: boolean;
    if (adminPasswordHash.startsWith('$2b$') || adminPasswordHash.startsWith('$2a$')) {
      passwordMatch = await bcrypt.compare(dto.password, adminPasswordHash);
    } else {
      // Plaintext fallback (legacy, will be removed)
      passwordMatch = dto.password === adminPasswordHash;
    }

    if (!passwordMatch) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload = { username: dto.username, sub: 'admin' };
    const secret = this.configService.get<string>('jwtSecret');
    const expiresIn = this.configService.get<string>('jwtExpiresIn');

    const token = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: expiresIn as any,
    });

    return { access_token: token };
  }
}
