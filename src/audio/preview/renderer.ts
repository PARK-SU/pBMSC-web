import type { AssetSource, AudioAsset } from '../assets.ts';
import type { AudioCache, AudioLease } from '../cache.ts';
import { scoreEnd, type Score } from './score.ts';
import { pcm16 } from '../wav.ts';
import { readDuration } from '../durationIndex.ts';

export interface PreparedScore {
  readonly score: Score;
  readonly source: AssetSource;
  readonly assets: ReadonlyMap<number, AudioAsset>;
  readonly durations: ReadonlyMap<number, number>;
  readonly end: number;
  readonly warnings: Map<string, string>;
  readonly estimatedBytes: number;
}

export function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Playback cancelled', 'AbortError');
}

export async function prepareScore(
  score: Score,
  source: AssetSource,
  cache: AudioCache,
  signal?: AbortSignal,
): Promise<PreparedScore> {
  const assets = new Map<number, AudioAsset>(),
    durations = new Map<number, number>(),
    warnings = new Map<string, string>();
  let estimatedBytes = 0;
  for (const event of score.events) {
    if (durations.has(event.id)) continue;
    checkAbort(signal);
    durations.set(event.id, 0);
    const asset = source.resolve(event.name);
    if (!asset) {
      warnings.set(event.name, 'File not found');
      continue;
    }
    try {
      if (asset.duration === undefined) {
        asset.duration = await readDuration(await source.read(asset));
        if (asset.duration === undefined) {
          const lease = await cache.acquire(source, asset);
          asset.duration = lease.buffer.duration;
          lease.release();
        }
      }
      checkAbort(signal);
      const duration = asset.duration;
      if (duration === undefined || !(Number.isFinite(duration) && duration >= 0))
        throw new Error('Invalid audio duration');
      assets.set(event.id, asset);
      durations.set(event.id, duration);
      estimatedBytes += duration * 44100 * 2 * 4;
    } catch (error) {
      checkAbort(signal);
      warnings.set(event.name, error instanceof Error ? error.message : String(error));
    }
  }
  return {
    score,
    source,
    assets,
    durations,
    warnings,
    estimatedBytes,
    end: scoreEnd(score, durations),
  };
}

export function chunkFrames(index: number, rate: number): number {
  return Math.round(Math.min(10, 2 ** (index + 1)) * rate);
}

export class ChunkRenderer {
  private queue = Promise.resolve();
  private readonly cache: AudioCache;
  private readonly factory: (frames: number, rate: number) => OfflineAudioContext;
  constructor(
    cache: AudioCache,
    factory = (frames: number, rate: number) => new OfflineAudioContext(2, frames, rate),
  ) {
    this.cache = cache;
    this.factory = factory;
  }

  render(
    prepared: PreparedScore,
    firstFrame: number,
    frames: number,
    rate: number,
    signal?: AbortSignal,
  ): Promise<AudioBuffer> {
    const pending = this.queue.then(() => this.mix(prepared, firstFrame, frames, rate, signal));
    this.queue = pending.then(
      () => {},
      () => {},
    );
    return pending;
  }

  private async mix(
    p: PreparedScore,
    first: number,
    frames: number,
    rate: number,
    signal?: AbortSignal,
  ): Promise<AudioBuffer> {
    checkAbort(signal);
    const context = this.factory(frames, rate);
    const leases = new Map<string, AudioLease>();
    try {
      for (const e of p.score.events) {
        const asset = p.assets.get(e.id);
        if (!asset || p.warnings.has(e.name)) continue;
        const start = Math.round((e.time - p.score.start) * rate);
        const trigger = Math.round((e.trigger - p.score.start) * rate);
        let end = Math.round(
          (Math.min(e.cut, e.time + (p.durations.get(e.id) ?? 0)) - p.score.start) * rate,
        );
        if (trigger >= first + frames || end <= first || end <= trigger) continue;
        checkAbort(signal);
        let lease = leases.get(asset.key);
        if (!lease) {
          try {
            lease = await this.cache.acquire(p.source, asset);
            leases.set(asset.key, lease);
          } catch (error) {
            checkAbort(signal);
            p.warnings.set(e.name, error instanceof Error ? error.message : String(error));
            continue;
          }
        }
        checkAbort(signal);
        end = Math.round((Math.min(e.cut, e.time + lease.buffer.duration) - p.score.start) * rate);
        const a = Math.max(first, trigger),
          b = Math.min(first + frames, end);
        if (b <= a) continue;
        const source = context.createBufferSource();
        source.buffer = lease.buffer;
        source.connect(context.destination);
        source.start((a - first) / rate, (a - start) / rate, (b - a) / rate);
      }
      const mixed = await context.startRendering();
      checkAbort(signal);
      const channels = Array.from({ length: mixed.numberOfChannels }, (_, i) =>
        mixed.getChannelData(i),
      );
      for (let offset = 0; offset < mixed.length; offset += 32768) {
        checkAbort(signal);
        const end = Math.min(mixed.length, offset + 32768);
        for (const samples of channels)
          for (let i = offset; i < end; i++) samples[i] = pcm16(samples[i]!) / 32768;
        if (end < mixed.length) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      return mixed;
    } finally {
      for (const lease of leases.values()) lease.release();
    }
  }
}
