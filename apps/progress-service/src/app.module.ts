import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { LeaderboardController } from './leaderboard/leaderboard.controller';
import { LeaderboardService } from './leaderboard/leaderboard.service';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  controllers: [
    AppController,
    LeaderboardController,
  ],

  imports: [PrismaModule],

  providers: [LeaderboardService],
})
export class AppModule {}