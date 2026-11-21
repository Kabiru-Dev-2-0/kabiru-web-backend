import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { LeaderboardController } from './leaderboard/leaderboard.controller';
import { LeaderboardService } from './leaderboard/leaderboard.service';
import { PrismaService } from './prisma/prisma.service';

@Module({
  controllers: [
    AppController,
    LeaderboardController,
  ],

  providers: [
    PrismaService,
    LeaderboardService,
  ],
})
export class AppModule {}