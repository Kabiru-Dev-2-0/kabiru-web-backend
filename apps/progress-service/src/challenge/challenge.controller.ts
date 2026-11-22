import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChallengeProgressService } from './challenge.service';
import {
  GetChallengeProgressDto,
  UpdateChallengeProgressDto,
} from './dto/update-challenge-progress.dto';

@Controller()
export class ChallengeProgressController {
  constructor(private readonly challengeService: ChallengeProgressService) {}

  @MessagePattern('progress.challenge.get')
  getProgress(@Payload() payload: GetChallengeProgressDto) {
    return this.challengeService.getProgress(payload);
  }

  @MessagePattern('progress.challenge.list')
  getUserChallenges(@Payload() payload: { userId: string }) {
    return this.challengeService.getUserChallenges(payload.userId);
  }

  @MessagePattern('progress.challenge.update')
  updateProgress(@Payload() payload: UpdateChallengeProgressDto) {
    return this.challengeService.updateProgress(payload);
  }
}
