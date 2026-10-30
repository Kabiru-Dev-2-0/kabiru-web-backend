import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  health() {
    return { status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() };
  }
}
