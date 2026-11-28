import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PROGRESS_PATTERNS } from '@kabiru/contracts';
import { SubmissionService, type CreateGameSubmissionInput } from './submission.service';

@Controller()
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @MessagePattern(PROGRESS_PATTERNS.SUBMISSION_CREATE)
  createSubmission(
    @Payload() payload: { data?: CreateGameSubmissionInput } & CreateGameSubmissionInput,
  ) {
    const data = payload?.data ?? payload;
    return this.submissionService.submitGameTest(data);
  }
}
