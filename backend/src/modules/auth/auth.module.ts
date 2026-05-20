import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

type JwtDurationUnit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y';
type JwtDurationString = `${number}${JwtDurationUnit}` | `${number} ${JwtDurationUnit}`;

function isJwtDurationString(value: string): value is JwtDurationString {
  return /^\d+\s?(ms|s|m|h|d|w|y)$/.test(value);
}

function getJwtExpiresIn(value?: string): number | JwtDurationString {
  if (!value) {
    return '7d';
  }

  const seconds = Number(value);
  if (Number.isInteger(seconds) && seconds > 0) {
    return seconds;
  }

  return isJwtDurationString(value) ? value : '7d';
}

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('jwtSecret'),
        signOptions: {
          expiresIn: getJwtExpiresIn(config.get<string>('jwtExpiresIn')),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
