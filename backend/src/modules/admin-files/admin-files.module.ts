import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminFilesController } from './admin-files.controller';
import { AdminFilesService } from './admin-files.service';
import { HealthController } from './health.controller';
import { FilesService } from './files.service';
import { SystemMonitorService } from './system-monitor.service';
import { FileEntity } from '../../entities/file.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LogsModule } from '../admin-logs/admin-logs.module';

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
    LogsModule,
  ],
  controllers: [AdminFilesController, HealthController],
  providers: [AdminFilesService, FilesService, SystemMonitorService, JwtAuthGuard],
  exports: [FilesService],
})
export class AdminFilesModule {}
