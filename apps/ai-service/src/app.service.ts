import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: false;
  raw?: boolean;
  system?: string;
  options?: {
    num_predict?: number;
    temperature?: number;
    repeat_penalty?: number;
    repeat_last_n?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  done_reason?: string;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaAssessmentScores {
  fungsionalitas: number;
  logika: number;
  syntax: number;
  code_style: number;
  dokumentasi: number;
  konsep: number;
}

export interface OllamaAssessmentResult {
  aiScore: OllamaAssessmentScores;
  overallScore: number;
  flagOverride: boolean;
  aiSuggestion: string;
  aiFinishTime: string;
  hintUsage: number;
  level: string;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly ollamaUrl: string;
  private readonly ollamaModel: string;
  private readonly levels = [
    { level: 'Novice', min: 0 },
    { level: 'Beginner', min: 50 },
    { level: 'Advance/Beginner', min: 60 },
    { level: 'Advance', min: 70 },
    { level: 'Competent', min: 80 },
    { level: 'Expert', min: 90 },
  ];

  constructor() {
    const host = process.env.AI_SERVICE_HOST ?? 'localhost';
    const port = process.env.AI_SERVICE_PORT ?? '11434';
    this.ollamaUrl = process.env.OLLAMA_URL ?? `http://${host}:${port}`;
    this.ollamaModel = process.env.OLLAMA_MODEL ?? 'its-codellama-7b:latest';
  }

  async generate(prompt: string, systemContext?: string): Promise<string> {
    const { response } = await this.callOllama(prompt, systemContext);
    return response;
  }

  checkLevel(avgScore: number, hintUsage: number): string {
    let currentLevel = 'Novice';

    switch (hintUsage) {
      case 1:
        return 'Advance/Beginner';
      case 2:
        return 'Beginner';
      case 3:
        return 'Novice';
    }

    for (const { level, min } of this.levels) {
      if (avgScore >= min) {
        if (min !== 0 && avgScore >= min) currentLevel = level;
      }
    }

    return currentLevel;
  }

  async submitCode(
    soal: string,
    expectedOutput: string,
    studentCode: string,
    hintUsage: number = 0,
    _testId?: string,
    _userId?: string,
    _isRetrying: boolean = false,
    _retryData?: any,
  ): Promise<OllamaAssessmentResult> {
    const prompt =
      `<s>[INST] Soal: ${soal}\n` +
      `Output yang diharapkan: ${expectedOutput}\n\n` +
      `Kode siswa:\n\`\`\`python\n${studentCode}\n\`\`\`\n\n` +
      `Nilai kode siswa ini dan berikan penilaian dalam format berikut:\n` +
      `fungsionalitas: <skor 0-100>\n` +
      `logika: <skor 0-100>\n` +
      `syntax: <skor 0-100>\n` +
      `code_style: <skor 0-100>\n` +
      `dokumentasi: <skor 0-100>\n` +
      `konsep: <skor 0-100>\n` +
      `overallScore: <rata-rata skor>\n` +
      `feedback: <saran/evaluasi maksimal 100 kata> [/INST]`;

    const { response: raw, duration } = await this.callOllama(prompt);
    const parsed = this.parseAssessmentResponse(raw);

    const result: OllamaAssessmentResult = {
      aiScore: parsed.aiScore,
      overallScore: parsed.overallScore,
      flagOverride: false,
      aiSuggestion: parsed.aiSuggestion,
      aiFinishTime: this.secondsToReadable(duration),
      hintUsage,
      level: this.checkLevel(parsed.overallScore, hintUsage),
    };

    return result;
  }

  async checkOllamaConnection(): Promise<{ connected: boolean; url: string; error?: string }> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      return { connected: response.ok, url: this.ollamaUrl };
    } catch (err: any) {
      return { connected: false, url: this.ollamaUrl, error: err.message };
    }
  }

  private limitWords(text: string, maxWords = 100): string {
    if (!text) return '';
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/);
    if (words.length <= maxWords) {
      return trimmed;
    }
    return words
      .slice(0, maxWords)
      .join(' ')
      .replace(/[,;:\-\s]+$/, '');
  }

  private parseAssessmentResponse(raw: string): {
    aiScore: OllamaAssessmentScores;
    overallScore: number;
    aiSuggestion: string;
  } {
    const scoreKeys: (keyof OllamaAssessmentScores)[] = [
      'fungsionalitas',
      'logika',
      'syntax',
      'code_style',
      'dokumentasi',
      'konsep',
    ];

    const aiScore = {} as OllamaAssessmentScores;

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[0]);
        for (const key of scoreKeys) {
          if (typeof json[key] === 'number') {
            aiScore[key] = json[key];
          }
        }
        const overall =
          typeof json.overallScore === 'number'
            ? json.overallScore
            : typeof json.averageScore === 'number'
              ? json.averageScore
              : 0;
        const suggestion =
          typeof json.feedback === 'string'
            ? json.feedback
            : typeof json.aiSuggestion === 'string'
              ? json.aiSuggestion
              : '';

        if (scoreKeys.every((k) => typeof aiScore[k] === 'number')) {
          const sum = scoreKeys.reduce((acc, k) => acc + aiScore[k], 0);
          const computedOverall = Math.round((sum / scoreKeys.length) * 100) / 100;
          return {
            aiScore,
            overallScore: overall || computedOverall,
            aiSuggestion: this.limitWords(suggestion, 100),
          };
        }
      } catch {
        // Fallback to regex
      }
    }

    for (const key of scoreKeys) {
      const match = raw.match(
        new RegExp(`${key}\\s*[:=]\\s*(\\d+(?:\\.\\d+)?)`, 'i'),
      );
      aiScore[key] = match ? parseFloat(match[1]) : 0;
    }

    const overallMatch = raw.match(
      /(?:rata-rata|overallScore|overall\s*score)\s*[:=]?\s*(\d+(?:\.\d+)?)/i,
    );
    let overallScore = overallMatch ? parseFloat(overallMatch[1]) : 0;

    if (!overallScore) {
      const scores = Object.values(aiScore);
      const sum = scores.reduce((acc, val) => acc + val, 0);
      overallScore =
        scores.length > 0 ? Math.round((sum / scores.length) * 100) / 100 : 0;
    }

    const feedbackMatch = raw.match(
      /(?:feedback|aiSuggestion|suggestion)\s*[:=]?\s*([\s\S]+)/i,
    );
    const rawSuggestion = feedbackMatch
      ? feedbackMatch[1].replace(/<\/s>/g, '').trim()
      : raw.trim();

    const aiSuggestion = this.limitWords(rawSuggestion, 100);

    return { aiScore, overallScore, aiSuggestion };
  }

  private async callOllama(
    prompt: string,
    systemContext?: string,
  ): Promise<{ response: string; duration: number }> {
    const startTime = Date.now();
    const url = `${this.ollamaUrl}/api/generate`;
    const body: OllamaGenerateRequest = {
      model: this.ollamaModel,
      prompt,
      stream: false,
      ...(systemContext ? { system: systemContext } : {}),
      options: {
        num_predict: 512,
        temperature: 0.3,
        repeat_penalty: 1.2,
        repeat_last_n: 64,
      },
    };
    this.logger.log(`Calling Ollama [${this.ollamaModel}] at ${url}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        this.logger.error('Ollama request timed out after 120s');
        throw new InternalServerErrorException(
          'Ollama response timed out. The model is taking too long to generate.',
        );
      }
      this.logger.error('Failed to connect to Ollama', err);
      throw new InternalServerErrorException(
        `Unable to reach Ollama at ${this.ollamaUrl}. Make sure Ollama is running.`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Ollama returned ${response.status}: ${text}`);
      throw new InternalServerErrorException(
        `Ollama error (${response.status}): ${text}`,
      );
    }
    const data = (await response.json()) as OllamaGenerateResponse;
    const durationSec = data.total_duration
      ? data.total_duration / 1e9
      : (Date.now() - startTime) / 1000;

    return {
      response: data.response,
      duration: durationSec,
    };
  }

  private secondsToReadable(totalSeconds: number): string {
    const ms = Math.round(totalSeconds * 1000);
    const hours = Math.floor(ms / 3_600_000) % 24;
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
  }
}

export { AppService as OllamaService };
