import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExperienceController } from './experience.controller';
import { ExperienceService } from './experience.service';

@Module({
  imports: [PrismaModule],
  controllers: [ExperienceController],
  providers: [ExperienceService],
  exports: [ExperienceService],
})
export class ExperienceModule {}
