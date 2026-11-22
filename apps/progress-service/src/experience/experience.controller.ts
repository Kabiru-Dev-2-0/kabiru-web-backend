import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MasteryLevel } from '@prisma/client';
import { ExperienceService } from './experience.service';
import {
  AddExperienceDto,
  CreateMasteryRuleDto,
  GetExpHistoryDto,
} from './dto/add-experience.dto';

@Controller()
export class ExperienceController {
  constructor(private readonly experienceService: ExperienceService) {}

  @MessagePattern('progress.experience.add')
  addExperience(@Payload() payload: AddExperienceDto) {
    return this.experienceService.addExperience(payload);
  }

  @MessagePattern('progress.experience.history')
  getTransactionHistory(@Payload() payload: GetExpHistoryDto) {
    return this.experienceService.getTransactionHistory(payload);
  }

  @MessagePattern('progress.experience.levels')
  getLevels() {
    return this.experienceService.getLevels();
  }

  @MessagePattern('progress.experience.userLevel')
  getUserLevel(@Payload() payload: { userId: string }) {
    return this.experienceService.getUserLevel(payload.userId);
  }

  @MessagePattern('progress.experience.masteryRules')
  getMasteryRules() {
    return this.experienceService.getMasteryRules();
  }

  @MessagePattern('progress.experience.getMasteryRule')
  getMasteryRule(@Payload() payload: { mastery: MasteryLevel }) {
    return this.experienceService.getMasteryRule(payload.mastery);
  }

  @MessagePattern('progress.experience.createMasteryRule')
  createMasteryRule(@Payload() payload: CreateMasteryRuleDto) {
    return this.experienceService.createMasteryRule(payload);
  }
}
