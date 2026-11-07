import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1) Prefix HTTP must be /v1, not /api/v1
  app.setGlobalPrefix('v1');

  // 2) Provide a default requestId if the client does not send one
  app.use((req: any, _res: any, next: () => void) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] ?? randomUUID();
    next();
  });

  // 3) CORS for local frontend
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3001').split(','),
    credentials: true,
  });

  await app.listen(Number(process.env.GATEWAY_PORT ?? 3000), '0.0.0.0');
}

void bootstrap();