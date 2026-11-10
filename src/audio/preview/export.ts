import { chunkFrames, checkAbort, type ChunkRenderer, type PreparedScore } from './renderer.ts';
import { wavHeader, pcmBytes } from '../wav.ts';

export interface WaveWriter {
  write(bytes: Uint8Array): Promise<void>;
}

export async function exportWave(
  p: PreparedScore,
  renderer: ChunkRenderer,
  writer: WaveWriter,
  signal?: AbortSignal,
  progress?: (value: number) => void,
): Promise<void> {
  const rate = 44100,
    total = Math.max(1, Math.ceil((p.end - p.score.start) * rate));
  await writer.write(wavHeader(total, rate));
  for (let frame = 0, index = 0; frame < total; index++) {
    checkAbort(signal);
    const count = Math.min(chunkFrames(index, rate), total - frame);
    const buffer = await renderer.render(p, frame, count, rate, signal);
    await writer.write(pcmBytes(buffer));
    frame += count;
    progress?.(frame / total);
  }
}
