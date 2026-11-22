import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChallengeProgressController } from './challenge.controller';
import { ChallengeProgressService } from './challenge.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChallengeProgressController],
  providers: [ChallengeProgressService],
  exports: [ChallengeProgressService],
})
export class ChallengeProgressModule {}
