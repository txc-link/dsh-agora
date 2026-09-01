/**
 * v0.1 — Fish-Speech TTS HTTP adapter for `/agora say <text>`.
 *
 * Wraps `POST {baseUrl}/v1/tts` with JSON body `{text, voice?, format?, sample_rate?}`.
 * Returns WAV (default) or MP3 bytes plus metadata for Matrix upload.
 *
 * v0.1 design notes:
 * - Single-shot synthesis; no streaming.
 * - timeoutMs default 10s (fish-speech local GPU is ~3.5s for short text).
 * - text length capped via maxLen (default 500 chars) to avoid huge payloads.
 */

export interface FishSpeechConfig {
  baseUrl: string;
  voice?: string;
  format?: 'wav' | 'mp3';
  sampleRate?: number;
  timeoutMs?: number;
  maxTextLength?: number;
}

export interface SynthResult {
  bytes: Uint8Array;
  mediaType: string;
  filename: string;
}

export class FishSpeechTtsError extends Error {
  constructor(message: string, public readonly httpStatus?: number) {
    super(message);
    this.name = 'FishSpeechTtsError';
  }
}

export class FishSpeechTtsAdapter {
  private readonly baseUrl: string;
  private readonly voice: string | undefined;
  private readonly format: 'wav' | 'mp3';
  private readonly sampleRate: number;
  private readonly timeoutMs: number;
  private readonly maxTextLength: number;

  constructor(config: FishSpeechConfig) {
    if (!config.baseUrl || typeof config.baseUrl !== 'string') {
      throw new FishSpeechTtsError('baseUrl is required');
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.voice = config.voice;
    this.format = config.format ?? 'wav';
    this.sampleRate = config.sampleRate ?? 22050;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.maxTextLength = config.maxTextLength ?? 500;
  }

  async synthesize(text: string): Promise<SynthResult> {
    const trimmed = (text ?? '').trim();
    if (trimmed.length === 0) {
      throw new FishSpeechTtsError('text is empty');
    }
    if (trimmed.length > this.maxTextLength) {
      throw new FishSpeechTtsError(
        `text length ${trimmed.length} exceeds maxTextLength ${this.maxTextLength}`,
      );
    }

    const url = `${this.baseUrl}/v1/tts`;
    const body: Record<string, unknown> = {
      text: trimmed,
      format: this.format,
      sample_rate: this.sampleRate,
    };
    if (this.voice) {
      body.voice = this.voice;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === 'AbortError') {
        throw new FishSpeechTtsError(`tts request timed out after ${this.timeoutMs}ms`);
      }
      throw new FishSpeechTtsError(`tts request failed: ${(err as Error).message}`);
    }
    clearTimeout(timer);

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new FishSpeechTtsError(
        `tts request returned HTTP ${response.status}: ${detail.slice(0, 200)}`,
        response.status,
      );
    }

    const ab = await response.arrayBuffer();
    const bytes = new Uint8Array(ab);
    if (bytes.length === 0) {
      throw new FishSpeechTtsError('tts returned empty body');
    }

    const mediaType = this.format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    const ext = this.format === 'mp3' ? 'mp3' : 'wav';
    const filename = `tts-${Date.now()}.${ext}`;
    return { bytes, mediaType, filename };
  }
}
