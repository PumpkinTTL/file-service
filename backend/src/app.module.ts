import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { UploadModule } from './modules/upload/upload.module';
import { AdminFilesModule } from './modules/admin-files/admin-files.module';
import { AdminTokensModule } from './modules/admin-tokens/admin-tokens.module';
import { FileEntity } from './entities/file.entity';
import { UploadTokenEntity } from './entities/upload-token.entity';
import { UploadSessionEntity } from './entities/upload-session.entity';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env',
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('databaseHost') || 'localhost',
        port: configService.get<number>('databasePort') || 3306,
        username: configService.get<string>('databaseUser') || 'root',
        password: configService.get<string>('databasePassword') || 'root',
        database: configService.get<string>('databaseName') || 'file_service',
        entities: [FileEntity, UploadTokenEntity, UploadSessionEntity],
        synchronize: true,
        logging: false,
        charset: 'utf8mb4',
      }),
    }),
    AuthModule,
    UploadModule,
    AdminFilesModule,
    AdminTokensModule,
  ],
})
export class AppModule {}
