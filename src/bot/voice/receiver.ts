import { VoiceConnection, EndBehaviorType } from '@discordjs/voice';
import prism from 'prism-media';
import { logger } from '../../core/logging.js';
import { transcribeAudio } from '../../core/stt/whisper.js';
import { parseIntent } from '../../core/nlu/gpt-tools.js';
import { userContextStore } from '../../core/context/user-context.js';
import { getNotionClient } from '../../core/notion/client.js';
import { executeIntent } from './intent-executor.js';
import { randomUUID } from 'crypto';

const CHUNK_DURATION_MS = 4000; // 4 seconds chunks
const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;
const CHUNK_SIZE = (SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * CHUNK_DURATION_MS) / 1000;

interface AudioChunker {
  buffer: Buffer;
  userId: string;
  timeout: NodeJS.Timeout | null;
}

const activeChunkers = new Map<string, AudioChunker>();

/**
 * Start receiving voice from a specific user
 */
export function startVoiceReceiver(connection: VoiceConnection, authorId: string): void {
  const receiver = connection.receiver;

  logger.info({ authorId }, 'Voice receiver started');

  receiver.speaking.on('start', (userId) => {
    if (userId !== authorId) {
      // Ignore other users
      return;
    }

    logger.debug({ userId }, 'User started speaking');

    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1000,
      },
    });

    const pcmStream = new prism.opus.Decoder({
      rate: SAMPLE_RATE,
      channels: CHANNELS,
      frameSize: 960,
    });

    opusStream.pipe(pcmStream);

    // Get or create chunker
    if (!activeChunkers.has(userId)) {
      activeChunkers.set(userId, {
        buffer: Buffer.alloc(0),
        userId,
        timeout: null,
      });
    }

    const chunker = activeChunkers.get(userId)!;

    // Clear previous timeout
    if (chunker.timeout) {
      clearTimeout(chunker.timeout);
      chunker.timeout = null;
    }

    pcmStream.on('data', (chunk: Buffer) => {
      chunker.buffer = Buffer.concat([chunker.buffer, chunk]);

      // If buffer exceeds chunk size, process it
      if (chunker.buffer.length >= CHUNK_SIZE) {
        const audioData = chunker.buffer.slice(0, CHUNK_SIZE);
        chunker.buffer = chunker.buffer.slice(CHUNK_SIZE);

        void processAudioChunk(audioData, userId);
      }

      // Reset timeout - process remaining buffer after silence
      if (chunker.timeout) {
        clearTimeout(chunker.timeout);
      }

      chunker.timeout = setTimeout(() => {
        if (chunker.buffer.length > 0) {
          const audioData = chunker.buffer;
          chunker.buffer = Buffer.alloc(0);
          void processAudioChunk(audioData, userId);
        }
      }, 2000);
    });

    pcmStream.on('error', (error) => {
      logger.error({ error, userId }, 'PCM stream error');
    });
  });
}

/**
 * Process an audio chunk through the pipeline
 */
async function processAudioChunk(audioData: Buffer, userId: string): Promise<void> {
  const correlationId = randomUUID();
  const log = logger.child({ correlationId, userId });

  try {
    log.info({ size: audioData.length }, '🎤 Processing audio chunk');

    // Skip if buffer is too small
    if (audioData.length < SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * 0.5) {
      log.debug('Audio chunk too small, skipping');
      return;
    }

    // STT: Whisper
    const { text: transcription, duration: sttDuration } = await transcribeAudio(
      audioData,
      correlationId
    );

    if (!transcription || transcription.length < 3) {
      log.debug({ transcription }, 'Transcription too short, skipping');
      return;
    }

    userContextStore.addLatency(userId, 'stt', sttDuration);
    log.info({ transcription, sttDuration }, '🗣️ Transcription');

    // NLU: GPT function-calling
    const { intent, duration: nluDuration } = await parseIntent(transcription, correlationId);
    userContextStore.addLatency(userId, 'nlu', nluDuration);
    log.info({ intent, nluDuration }, '🧠 Intent parsed');

    // Execute intent
    const notion = getNotionClient(userId);
    if (!notion) {
      log.error('No Notion client available for user');
      return;
    }

    const result = await executeIntent(notion, userId, intent, correlationId);
    userContextStore.addLatency(userId, 'notion', result.duration);

    log.info({ result }, '✅ Intent executed');

    // TODO: Send feedback to Discord text channel
    // For now, just log the result
  } catch (error) {
    log.error({ error }, '❌ Failed to process audio chunk');
  }
}

/**
 * Clean up chunker for a user
 */
export function stopVoiceReceiver(userId: string): void {
  const chunker = activeChunkers.get(userId);
  if (chunker?.timeout) {
    clearTimeout(chunker.timeout);
  }
  activeChunkers.delete(userId);
  logger.info({ userId }, 'Voice receiver stopped');
}
