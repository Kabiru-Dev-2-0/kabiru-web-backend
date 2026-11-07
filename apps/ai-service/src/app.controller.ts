import { Body, Controller, Get, Post } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // HTTP endpoints (for direct testing with Hoppscotch / Postman / curl)
  @Get('health')
  healthHttp() {
    return this.health();
  }

  @Post('generate')
  async generateHttp(@Body() body: any) {
    return this.generate(body);
  }

  @Post('submit')
  async submitCodeHttp(@Body() body: any) {
    return this.submitCode(body);
  }

  @Get('ollama-status')
  async ollamaStatusHttp() {
    return this.ollamaStatus();
  }

  // TCP Microservice message patterns (for internal service-to-service communication)
  @MessagePattern({ cmd: 'health' })
  @MessagePattern('ai.health')
  @MessagePattern('ai.health.check')
  health() {
    return { status: 'ok', service: 'ai-service', timestamp: new Date().toISOString() };
  }

  @MessagePattern({ cmd: 'generate' })
  @MessagePattern('ai.generate')
  async generate(@Payload() payload: any) {
    const data =
      payload && typeof payload === 'object' && 'data' in payload && payload.data
        ? payload.data
        : payload;
    const prompt = typeof data === 'string' ? data : (data?.prompt ?? '');
    const systemContext = typeof data === 'string' ? undefined : data?.systemContext;
    return this.appService.generate(prompt, systemContext);
  }

  @MessagePattern({ cmd: 'submit' })
  @MessagePattern({ cmd: 'submit_code' })
  @MessagePattern({ cmd: 'submitCode' })
  @MessagePattern('ai.submit')
  @MessagePattern('ai.submit_code')
  @MessagePattern('ai.submitCode')
  async submitCode(@Payload() payload: any) {
    const data =
      payload && typeof payload === 'object' && 'data' in payload && payload.data
        ? payload.data
        : payload;
    const soal = data?.soal ?? data?.question ?? '';
    const expectedOutput = data?.expectedOutput ?? '';
    const studentCode = data?.studentCode ?? data?.code ?? '';
    const hintUsage = Number(data?.hintUsage ?? 0);
    return this.appService.submitCode(soal, expectedOutput, studentCode, hintUsage);
  }

  @MessagePattern({ cmd: 'ollama_status' })
  @MessagePattern('ai.ollama.status')
  async ollamaStatus() {
    return this.appService.checkOllamaConnection();
  }
}
