import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import multipart from '@fastify/multipart';
import helmet from '@fastify/helmet';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const maxSize = 209715200; // 200MB fallback

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 200 * 1024 * 1024, // Fastify body limit 200MB
      logger: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
  );

  const configService = app.get(ConfigService);
  const maxFileSize = configService.get<number>('maxFileSize') || maxSize;

  // Security headers (helmet) — CSP allows unpkg CDN + inline scripts for frontend
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "blob:"],
        workerSrc: ["'self'", "blob:"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "https:", "data:"],
        connectSrc: ["'self'", "https://unpkg.com"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  });

  // Register multipart support
  await app.register(multipart, {
    limits: {
      fileSize: maxFileSize,
      fieldSize: 1024 * 1024,
      fields: 10,
      files: 1,
    },
  });

  // CORS
  app.enableCors();

  // Validation pipe
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // Exception filter & transform interceptor
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Auto create upload directory
  const uploadBaseDir = configService.get<string>('uploadBaseDir');
  if (!fs.existsSync(uploadBaseDir)) {
    fs.mkdirSync(uploadBaseDir, { recursive: true });
  }

  // Serve frontend static files
  const frontendPath = path.join(__dirname, '..', '..', 'frontend');
  if (fs.existsSync(frontendPath)) {
    app.useStaticAssets({
      root: frontendPath,
      prefix: '/',
      decorateReply: false,
    });
  }

  const port = configService.get<number>('port') || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`File Service running on http://localhost:${port}`);
  logger.log(`Environment: ${configService.get<string>('nodeEnv')}`);
  logger.log(`Upload dir: ${uploadBaseDir}`);
  logger.log(`Max file size: ${(maxFileSize / 1024 / 1024).toFixed(0)}MB`);
}

bootstrap();
