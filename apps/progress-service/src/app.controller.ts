import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class AppController {
  @MessagePattern({ cmd: 'health' })
  health() {
    return { status: 'ok', service: 'progress-service', timestamp: new Date().toISOString() };
  }
}
