import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3001').split(','), credentials: true });
  await app.listen(Number(process.env.GATEWAY_PORT ?? 3000), '0.0.0.0');
}
void bootstrap();
