import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { getThrottlerConfig } from './config/throttler.config';
import * as Joi from 'joi';
import { AuthModule } from './modules/auth/auth.module';
import { UploadModule } from './modules/upload/upload.module';
import { AdminFilesModule } from './modules/admin-files/admin-files.module';
import { AdminTokensModule } from './modules/admin-tokens/admin-tokens.module';
import { FileEntity } from './entities/file.entity';
import { UploadTokenEntity } from './entities/upload-token.entity';
import { UploadSessionEntity } from './entities/upload-session.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env',
      ],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production').default('development'),
        PORT: Joi.number().default(3000),
        UPLOAD_BASE_DIR: Joi.string(),
        DATABASE_HOST: Joi.string(),
        DATABASE_PORT: Joi.number(),
        DATABASE_USER: Joi.string(),
        DATABASE_PASSWORD: Joi.string(),
        DATABASE_NAME: Joi.string(),
        BASE_URL: Joi.string(),
        JWT_SECRET: Joi.string(),
        JWT_EXPIRES_IN: Joi.string().default('7d'),
        ADMIN_USERNAME: Joi.string(),
        ADMIN_PASSWORD: Joi.string(),
        MAX_FILE_SIZE: Joi.number().default(209715200),
        ALLOWED_FILE_TYPES: Joi.string(),
      }),
      // Don't throw in dev when optional vars are missing — just warn
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => getThrottlerConfig(cs),
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
        synchronize: configService.get<string>('nodeEnv') === 'development',
        logging: false,
        charset: 'utf8mb4',
      }),
    }),
    AuthModule,
    UploadModule,
    AdminFilesModule,
    AdminTokensModule,
  ],
  providers: [
    // Global throttler guard — rate limiting on all endpoints
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
