import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BadgeProgressService } from './badge.service';
import { AwardBadgeDto, UpdateBadgeProgressDto } from './dto/update-badge-progress.dto';

@Controller()
export class BadgeProgressController {
  constructor(private readonly badgeService: BadgeProgressService) {}

  @MessagePattern('progress.badge.get')
  getBadgeProgress(@Payload() payload: { userId: string; badgeId: string }) {
    return this.badgeService.getBadgeProgress(payload.userId, payload.badgeId);
  }

  @MessagePattern('progress.badge.userBadges')
  getUserBadges(@Payload() payload: { userId: string }) {
    return this.badgeService.getUserBadges(payload.userId);
  }

  @MessagePattern('progress.badge.updateProgress')
  updateBadgeProgress(@Payload() payload: UpdateBadgeProgressDto) {
    return this.badgeService.updateBadgeProgress(payload);
  }

  @MessagePattern('progress.badge.award')
  awardBadgeDirectly(@Payload() payload: AwardBadgeDto) {
    return this.badgeService.awardBadgeDirectly(payload);
  }
}
