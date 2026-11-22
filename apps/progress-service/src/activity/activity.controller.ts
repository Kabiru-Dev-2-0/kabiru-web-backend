import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ActivityService } from './activity.service';
import {
  GetActivityQueryDto,
  GetActivityRangeQueryDto,
  RecordActivityDto,
} from './dto/record-activity.dto';

@Controller()
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @MessagePattern('progress.activity.record')
  recordActivity(@Payload() payload: RecordActivityDto) {
    return this.activityService.recordActivity(payload);
  }

  @MessagePattern('progress.activity.get')
  getActivity(@Payload() payload: GetActivityQueryDto) {
    return this.activityService.getActivity(payload);
  }

  @MessagePattern('progress.activity.range')
  getActivitiesRange(@Payload() payload: GetActivityRangeQueryDto) {
    return this.activityService.getActivitiesRange(payload);
  }
}
