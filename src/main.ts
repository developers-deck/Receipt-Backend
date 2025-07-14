import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('[Bootstrap] Starting application...');
  try {
    console.log('[Bootstrap] Creating Nest application instance...');
    const app = await NestFactory.create(AppModule);
    console.log('[Bootstrap] Nest application instance created.');

    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`[Bootstrap] Application is running on: ${await app.getUrl()}`);

  } catch (error) {
    console.error('[Bootstrap] Error during application startup:', error);
    process.exit(1);
  }
}

bootstrap();
