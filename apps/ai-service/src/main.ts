import 'reflect-metadata';
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
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  const tcpPort = Number(process.env.SERVICE_PORT ?? process.env.AI_SERVICE_PORT ?? 4016);
  const httpPort = Number(process.env.HTTP_PORT ?? process.env.AI_SERVICE_HTTP_PORT ?? 4015);

  app.connectMicroservice({
    transport: Transport.TCP,
    options: { host: '0.0.0.0', port: tcpPort },
  });

  await app.startAllMicroservices();
  await app.listen(httpPort, '0.0.0.0');
}
void bootstrap();
