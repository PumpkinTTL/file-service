import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const adminUsername = this.configService.get<string>('adminUsername');
    const adminPassword = this.configService.get<string>('adminPassword');

    if (dto.username !== adminUsername || dto.password !== adminPassword) {
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
