import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const serviceEnvPath = resolve(process.cwd(), '.env');
const rootEnvPath = resolve(process.cwd(), '../../.env');

if (existsSync(serviceEnvPath)) {
  process.loadEnvFile?.(serviceEnvPath);
}

if (!process.env.PROGRESS_DATABASE_URL && existsSync(rootEnvPath)) {
  process.loadEnvFile?.(rootEnvPath);
}

if (process.env.PROGRESS_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.PROGRESS_DATABASE_URL;
}

import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

function getServicePort(): number {
  const configuredPort = process.env.SERVICE_PORT ?? process.env.PROGRESS_SERVICE_PORT ?? '4014';
  const port = Number(configuredPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid progress-service port: ${configuredPort}`);
  }

  return port;
}

async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL or PROGRESS_DATABASE_URL must be configured for progress-service.');
  }

  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: getServicePort(),
    },
  });
  app.enableShutdownHooks();
  await app.listen();
}

void bootstrap().catch((error: unknown) => {
  console.error('Failed to start progress-service:', error);
  process.exitCode = 1;
});
