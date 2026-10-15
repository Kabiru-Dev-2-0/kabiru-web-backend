import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class AppController {
  @MessagePattern({ cmd: 'health' })
  health() {
    return { status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() };
  }
}
