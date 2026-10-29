import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { LEARNING_PATTERNS } from '@kabiru/contracts';

@Controller()
export class AppController {
  @MessagePattern({ cmd: 'health' })
  healthLegacy() {
    return this.buildHealthResponse();
  }

  @MessagePattern(LEARNING_PATTERNS.HEALTH_CHECK)
  health() {
    return this.buildHealthResponse();
  }

  private buildHealthResponse() {
    return {
      status: 'ok',
      service: 'learning-service',
      timestamp: new Date().toISOString(),
    };
  }
}