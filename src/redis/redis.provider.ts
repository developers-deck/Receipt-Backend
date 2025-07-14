import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const redis = new Redis({
      url: configService.get<string>('UPSTASH_REDIS_REST_URL')!,
      token: configService.get<string>('UPSTASH_REDIS_REST_TOKEN')!,
    });
    return redis;
  },
};
