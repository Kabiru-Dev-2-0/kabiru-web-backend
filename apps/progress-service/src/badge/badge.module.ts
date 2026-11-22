import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BadgeProgressController } from './badge.controller';
import { BadgeProgressService } from './badge.service';

@Module({
  imports: [PrismaModule],
  controllers: [BadgeProgressController],
  providers: [BadgeProgressService],
  exports: [BadgeProgressService],
})
export class BadgeProgressModule {}
