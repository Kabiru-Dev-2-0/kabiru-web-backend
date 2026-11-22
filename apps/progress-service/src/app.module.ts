import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ActivityModule } from './activity/activity.module';
import { ExperienceModule } from './experience/experience.module';
import { StreakModule } from './streak/streak.module';
import { ChallengeProgressModule } from './challenge/challenge.module';
import { BadgeProgressModule } from './badge/badge.module';
import { RankModule } from './rank/rank.module';

@Module({
  imports: [
    PrismaModule,
    ActivityModule,
    ExperienceModule,
    StreakModule,
    ChallengeProgressModule,
    BadgeProgressModule,
    RankModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
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
