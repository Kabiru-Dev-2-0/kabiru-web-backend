import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RankService } from './rank.service';
import { CreateRankTierDto, UpdateRankDto } from './dto/update-rank.dto';

@Controller()
export class RankController {
  constructor(private readonly rankService: RankService) {}

  @MessagePattern('progress.rank.get')
  getUserRank(@Payload() payload: { userId: string; menu: string }) {
    return this.rankService.getUserRank(payload.userId, payload.menu);
  }

  @MessagePattern('progress.rank.list')
  getUserRanks(@Payload() payload: { userId: string }) {
    return this.rankService.getUserRanks(payload.userId);
  }

  @MessagePattern('progress.rank.tiers')
  getRankTiers() {
    return this.rankService.getRankTiers();
  }

  @MessagePattern('progress.rank.createTier')
  createRankTier(@Payload() payload: CreateRankTierDto) {
    return this.rankService.createRankTier(payload);
  }

  @MessagePattern('progress.rank.update')
  updateUserRank(@Payload() payload: UpdateRankDto) {
    return this.rankService.updateUserRank(payload);
  }
}
