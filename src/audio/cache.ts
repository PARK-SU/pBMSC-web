import type { AudioAsset, AssetSource } from './assets.ts';

interface Entry {
  readonly buffer: AudioBuffer;
  readonly bytes: number;
  pins: number;
}
export interface AudioLease {
  readonly buffer: AudioBuffer;
  release(): void;
}

export class AudioCache {
  private readonly entries = new Map<string, Entry>();
  private readonly pending = new Map<string, Promise<Entry>>();
  private queue = Promise.resolve();
  private total = 0;
  readonly budget: number;
  private readonly decode: (blob: Blob) => Promise<AudioBuffer>;
  constructor(budget: number, decode: (blob: Blob) => Promise<AudioBuffer>) {
    this.budget = budget;
    this.decode = decode;
  }

  get bytes(): number {
    return this.total;
  }

  async acquire(source: AssetSource, asset: AudioAsset): Promise<AudioLease> {
    let entry = this.entries.get(asset.key);
    if (!entry) {
      let pending = this.pending.get(asset.key);
      if (!pending) {
        pending = this.queue.then(async () => {
          const buffer = await this.decode(await source.read(asset));
          const value = { buffer, bytes: buffer.length * buffer.numberOfChannels * 4, pins: 0 };
          asset.duration = buffer.duration;
          this.entries.set(asset.key, value);
          this.total += value.bytes;
          return value;
        });
        this.pending.set(asset.key, pending);
        this.queue = pending.then(
          () => {},
          () => {},
        );
      }
      try {
        entry = await pending;
      } finally {
        this.pending.delete(asset.key);
      }
    }
    entry.pins++;
    this.entries.delete(asset.key);
    this.entries.set(asset.key, entry);
    this.trim();
    let released = false;
    return {
      buffer: entry.buffer,
      release: () => {
        if (released) return;
        released = true;
        entry.pins--;
        this.trim();
      },
    };
  }

  private trim(): void {
    for (const [key, entry] of this.entries) {
      if (this.total <= this.budget) break;
      if (entry.pins) continue;
      this.entries.delete(key);
      this.total -= entry.bytes;
    }
  }

  clear(): void {
    for (const [key, entry] of this.entries) {
      if (entry.pins) continue;
      this.entries.delete(key);
      this.total -= entry.bytes;
    }
  }
}
