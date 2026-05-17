import { ConfigService } from '@nestjs/config';

export function getThrottlerConfig(configService: ConfigService) {
  return [
    {
      ttl: (configService.get<number>('throttlerTtl') ?? 60) * 1000,
      limit: configService.get<number>('throttlerLimit') ?? 30,
    },
  ];
}
