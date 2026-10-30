import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const tcpPort = Number(process.env.SERVICE_PORT ?? 4016);
  const httpPort = Number(process.env.HTTP_PORT ?? 4015);

  app.connectMicroservice({
    transport: Transport.TCP,
    options: { host: '0.0.0.0', port: tcpPort },
  });

  await app.startAllMicroservices();
  await app.listen(httpPort, '0.0.0.0');
}
void bootstrap();
