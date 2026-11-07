import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { ServiceRpcExceptionFilter } from './common/rpc-exception.filter';
import { CurriculumModule } from './curriculum/curriculum.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, CurriculumModule],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ServiceRpcExceptionFilter,
    },
  ],
})
export class AppModule {}