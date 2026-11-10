import { niBPM, niSTOP } from '../../core/model/constants.ts';
import type { Note } from '../../core/model/note.ts';

interface TempoPoint {
  readonly position: number;
  readonly time: number;
  readonly after: number;
  readonly reached: number;
  readonly secondsPerUnit: number;
}

interface TempoSegment {
  readonly position: number;
  readonly time: number;
  readonly unitsPerSecond: number;
}

export interface PreviewTempoMap {
  readonly points: readonly TempoPoint[];
  readonly segments: readonly TempoSegment[];
}

export function buildPreviewTempoMap(notes: readonly Readonly<Note>[]): PreviewTempoMap {
  const events = notes
    .filter((n) => !n.ghost && !n.comment && (n.columnIndex === niBPM || n.columnIndex === niSTOP))
    .toSorted((a, b) => a.vPosition - b.vPosition || a.columnIndex - b.columnIndex);
  for (const n of events)
    if (!Number.isFinite(n.value) || (n.columnIndex === niBPM && n.value === 0))
      throw new Error('Playback needs finite nonzero BPM and finite STOP values');
  const initial = events.find((n) => n.columnIndex === niBPM && n.vPosition <= 0 && n.value > 0);
  if (!initial) throw new Error('Playback needs finite nonzero BPM and finite STOP values');
  const points: TempoPoint[] = [],
    segments: TempoSegment[] = [];
  let position = 0,
    time = 0,
    reached = 0,
    secondsPerUnit = 60 / (initial.value / 10000) / 48;
  for (let i = 0; i < events.length;) {
    const nextPosition = Math.max(0, events[i]!.vPosition);
    const arrival = time + (nextPosition - position) * secondsPerUnit;
    if (arrival > reached) {
      const start = Math.max(reached, time);
      segments.push({
        time: start,
        position: position + (start - time) / secondsPerUnit,
        unitsPerSecond: 1 / secondsPerUnit,
      });
    }
    reached = Math.max(reached, arrival);
    const arrivalReach = reached;
    time = arrival;
    position = nextPosition;
    for (; i < events.length && Math.max(0, events[i]!.vPosition) === position; i++) {
      const n = events[i]!;
      if (n.columnIndex === niBPM) {
        if (n.value > 0) secondsPerUnit = 60 / (n.value / 10000) / 48;
      } else {
        const after = time + (n.value / 10000) * secondsPerUnit;
        if (after > reached) segments.push({ time: reached, position, unitsPerSecond: 0 });
        reached = Math.max(reached, after);
        time = after;
      }
    }
    points.push({ position, time: arrival, after: time, reached: arrivalReach, secondsPerUnit });
  }
  segments.push({
    time: reached,
    position: position + (reached - time) / secondsPerUnit,
    unitsPerSecond: 1 / secondsPerUnit,
  });
  return { points, segments };
}

function lastIndex<T>(items: readonly T[], holds: (item: T) => boolean): number {
  let low = 0,
    high = items.length;
  while (low < high) {
    const middle = Math.trunc((low + high) / 2);
    if (holds(items[middle]!)) low = middle + 1;
    else high = middle;
  }
  return Math.max(0, low - 1);
}

export function rawTimeFromVPosition(map: PreviewTempoMap, position: number): number {
  const point = map.points[lastIndex(map.points, (p) => p.position <= position)]!;
  return position === point.position
    ? point.time
    : point.after + (position - point.position) * point.secondsPerUnit;
}

export function timeFromVPosition(map: PreviewTempoMap, position: number): number {
  const point = map.points[lastIndex(map.points, (p) => p.position <= position)]!;
  return Math.max(point.reached, rawTimeFromVPosition(map, position));
}

export function vPositionFromTime(map: PreviewTempoMap, time: number): number {
  const segment = map.segments[lastIndex(map.segments, (s) => s.time <= time)]!;
  return segment.position + (time - segment.time) * segment.unitsPerSecond;
}
