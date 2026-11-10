export interface WavePeaks {
  readonly duration: number;
  readonly sampleRate: number;
  readonly bucketFrames: number;
  readonly min: readonly Float32Array[];
  readonly max: readonly Float32Array[];
}

export function buildPeaks(
  channels: readonly Float32Array[],
  sampleRate: number,
  bucketFrames = 128,
): WavePeaks {
  const length = channels[0]?.length ?? 0;
  const count = Math.ceil(length / bucketFrames);
  const min: Float32Array[] = [],
    max: Float32Array[] = [];
  for (const channel of channels.slice(0, 2)) {
    const low = new Float32Array(count),
      high = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let a = Infinity,
        b = -Infinity;
      for (let j = i * bucketFrames; j < Math.min(length, (i + 1) * bucketFrames); j++) {
        const v = channel[j]!;
        if (v < a) a = v;
        if (v > b) b = v;
      }
      low[i] = a;
      high[i] = b;
    }
    min.push(low);
    max.push(high);
  }
  return { duration: length / sampleRate, sampleRate, bucketFrames, min, max };
}

export function peakRange(
  peaks: WavePeaks,
  channel: number,
  from: number,
  to: number,
): readonly [number, number] {
  const min = peaks.min[Math.min(channel, peaks.min.length - 1)];
  const max = peaks.max[Math.min(channel, peaks.max.length - 1)];
  if (!min || !max || to < 0 || from >= peaks.duration) return [0, 0];
  const start = Math.max(0, Math.floor((from * peaks.sampleRate) / peaks.bucketFrames));
  const end = Math.min(min.length - 1, Math.floor((to * peaks.sampleRate) / peaks.bucketFrames));
  let a = 0,
    b = 0;
  for (let i = start; i <= end; i++) {
    a = Math.min(a, min[i]!);
    b = Math.max(b, max[i]!);
  }
  return [a, b];
}
