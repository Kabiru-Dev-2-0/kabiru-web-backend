import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CurriculumModule } from './curriculum/curriculum.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, CurriculumModule],
  controllers: [AppController],
})
export class AppModule {}