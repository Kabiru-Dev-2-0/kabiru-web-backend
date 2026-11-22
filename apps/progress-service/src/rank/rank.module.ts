import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RankController } from './rank.controller';
import { RankService } from './rank.service';

@Module({
  imports: [PrismaModule],
  controllers: [RankController],
  providers: [RankService],
  exports: [RankService],
})
export class RankModule {}
