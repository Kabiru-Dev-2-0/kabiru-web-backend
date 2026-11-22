import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StreakService } from './streak.service';
import {
  AddStreakFreezeDto,
  SetDailyTargetDto,
  UpdateStreakDto,
} from './dto/update-streak.dto';

@Controller()
export class StreakController {
  constructor(private readonly streakService: StreakService) {}

  @MessagePattern('progress.streak.get')
  getUserStat(@Payload() payload: { userId: string }) {
    return this.streakService.getUserStat(payload.userId);
  }

  @MessagePattern('progress.streak.update')
  updateStreakOnActivity(@Payload() payload: UpdateStreakDto) {
    return this.streakService.updateStreakOnActivity(payload);
  }

  @MessagePattern('progress.streak.addFreeze')
  addStreakFreeze(@Payload() payload: AddStreakFreezeDto) {
    return this.streakService.addStreakFreeze(payload);
  }

  @MessagePattern('progress.streak.setTarget')
  setDailyTarget(@Payload() payload: SetDailyTargetDto) {
    return this.streakService.setDailyTarget(payload);
  }
}
