import { Module } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { env } from 'node:process';
import { AppController } from './app.controller';

const tcpClient = (port: number, host = 'localhost') =>
    ClientProxyFactory.create({
        transport: Transport.TCP,
        options: {
        host,
        port,
        },
    });

@Module({
    controllers: [AppController],
    providers: [
        {
        provide: 'AUTH_CLIENT',
        useFactory: () => tcpClient(Number(env.AUTH_SERVICE_PORT ?? 4011), env.AUTH_SERVICE_HOST ?? 'localhost'),
        },
        {
        provide: 'USER_CLIENT',
        useFactory: () => tcpClient(Number(env.USER_SERVICE_PORT ?? 4012), env.USER_SERVICE_HOST ?? 'localhost'),
        },
        {
        provide: 'LEARNING_CLIENT',
        useFactory: () =>
            tcpClient(Number(env.LEARNING_SERVICE_PORT ?? 4013), env.LEARNING_SERVICE_HOST ?? 'localhost'),
        },
        {
        provide: 'PROGRESS_CLIENT',
        useFactory: () =>
            tcpClient(Number(env.PROGRESS_SERVICE_PORT ?? 4014), env.PROGRESS_SERVICE_HOST ?? 'localhost'),
        },
        {
        provide: 'AI_CLIENT',
        useFactory: () =>
            tcpClient(Number(env.AI_SERVICE_PORT ?? 4016), env.AI_SERVICE_HOST ?? 'localhost'),
        },
    ],
    exports: ['AUTH_CLIENT', 'USER_CLIENT', 'LEARNING_CLIENT', 'PROGRESS_CLIENT', 'AI_CLIENT'],
})
export class AppModule {}