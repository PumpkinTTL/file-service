import { ConfigService } from '@nestjs/config';

export function getThrottlerConfig(configService: ConfigService) {
  return [
    {
      ttl: parseInt(process.env.THROTTLE_TTL || '60', 10) * 1000,
      limit: parseInt(process.env.THROTTLE_LIMIT || '30', 10),
    },
  ];
}
