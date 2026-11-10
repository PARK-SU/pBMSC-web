import { vPositionFromTime, type PreviewTempoMap } from './tempo.ts';

export function followPosition(
  map: PreviewTempoMap,
  start: number,
  audioTime: number,
  origin: number,
  outputLatency = 0,
  offsetMs = 0,
): number {
  return Math.max(
    0,
    vPositionFromTime(
      map,
      start + Math.max(0, audioTime - origin) + outputLatency + offsetMs / 1000,
    ),
  );
}
