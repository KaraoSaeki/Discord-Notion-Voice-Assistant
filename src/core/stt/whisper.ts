import OpenAI from 'openai';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../logging.js';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/**
 * Convert PCM buffer to WAV format
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate = 48000, channels = 2): Buffer {
  const wavHeader = Buffer.alloc(44);
  const dataSize = pcmBuffer.length;

  // RIFF chunk
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + dataSize, 4);
  wavHeader.write('WAVE', 8);

  // fmt chunk
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // Subchunk size
  wavHeader.writeUInt16LE(1, 20); // Audio format (PCM)
  wavHeader.writeUInt16LE(channels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * channels * 2, 28); // Byte rate
  wavHeader.writeUInt16LE(channels * 2, 32); // Block align
  wavHeader.writeUInt16LE(16, 34); // Bits per sample

  // data chunk
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(dataSize, 40);

  return Buffer.concat([wavHeader, pcmBuffer]);
}

export interface TranscriptionResult {
  text: string;
  duration: number;
}

/**
 * Transcribe PCM audio buffer using OpenAI Whisper
 */
export async function transcribeAudio(
  pcmBuffer: Buffer,
  correlationId: string
): Promise<TranscriptionResult> {
  const startTime = Date.now();
  const tempFilePath = join(tmpdir(), `audio-${randomUUID()}.wav`);

  try {
    // Convert PCM to WAV
    const wavBuffer = pcmToWav(pcmBuffer);

    // Write to temp file
    await writeFile(tempFilePath, wavBuffer);

    logger.debug(
      { correlationId, size: wavBuffer.length, path: tempFilePath },
      'Transcribing audio with Whisper'
    );

    // Call Whisper API
    const response = await openai.audio.transcriptions.create({
      file: await import('fs').then((fs) => fs.createReadStream(tempFilePath)),
      model: env.OPENAI_MODEL_WHISPER,
      language: 'fr', // Adjust based on your needs
      temperature: 0.0,
    });

    const duration = Date.now() - startTime;
    const text = response.text.trim();

    logger.info(
      { correlationId, text, duration, size: pcmBuffer.length },
      'Transcription completed'
    );

    return { text, duration };
  } catch (error) {
    logger.error({ correlationId, error }, 'Whisper transcription failed');
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown'}`);
  } finally {
    // Clean up temp file
    try {
      await unlink(tempFilePath);
    } catch (error) {
      logger.warn({ correlationId, path: tempFilePath }, 'Failed to delete temp file');
    }
  }
}
