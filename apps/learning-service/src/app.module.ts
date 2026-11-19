import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { ServiceRpcExceptionFilter } from './common/rpc-exception.filter';
import { CurriculumModule } from './curriculum/curriculum.module';
import { GameModuleModule } from './game-module/game-module.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule, CurriculumModule, GameModuleModule],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ServiceRpcExceptionFilter,
    },
  ],
})
export class AppModule {}