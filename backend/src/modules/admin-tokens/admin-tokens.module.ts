import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminTokensController } from './admin-tokens.controller';
import { AdminTokensService } from './admin-tokens.service';
import { UploadTokenEntity } from '../../entities/upload-token.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([UploadTokenEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwtSecret'),
      }),
    }),
  ],
  controllers: [AdminTokensController],
  providers: [AdminTokensService, JwtAuthGuard],
})
export class AdminTokensModule {}
