import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

// Load root .env secara transparan
try {
  process.loadEnvFile?.(resolve(process.cwd(), '.env'));
} catch {
  try {
    process.loadEnvFile?.(resolve(process.cwd(), '../../.env'));
  } catch {}
}

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MAX_MODULE_VERSION_BYTES } from '@kabiru/contracts';
import { AppModule } from './app.module';

// File dikirim sebagai base64 (overhead ~4/3) di dalam JSON, ditambah 1 MB untuk field lain.
// Diturunkan dari kontrak agar batas gateway ikut berubah jika batas versi modul diubah.
const JSON_BODY_LIMIT_BYTES = Math.ceil((MAX_MODULE_VERSION_BYTES * 4) / 3) + 1024 * 1024;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Default Express hanya 100 KB -> upload file modul / asset akan 413 di gateway sebelum sampai service.
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT_BYTES });

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