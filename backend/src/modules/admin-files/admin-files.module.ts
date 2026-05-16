import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminFilesController } from './admin-files.controller';
import { AdminFilesService } from './admin-files.service';
import { FileEntity } from '../../entities/file.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwtSecret'),
      }),
    }),
  ],
  controllers: [AdminFilesController],
  providers: [AdminFilesService, JwtAuthGuard],
})
export class AdminFilesModule {}
