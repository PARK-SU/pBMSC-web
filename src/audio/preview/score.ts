import type { ReadonlyChart } from '../../core/model/chart.ts';
import { isColumnSound } from '../../core/model/column.ts';
import {
  buildPreviewTempoMap,
  rawTimeFromVPosition,
  timeFromVPosition,
  type PreviewTempoMap,
} from './tempo.ts';
import { cint } from '../../core/vb.ts';

export interface ScoreEvent {
  readonly id: number;
  readonly name: string;
  readonly noteIndex: number;
  readonly column: number;
  readonly vPosition: number;
  readonly time: number;
  readonly trigger: number;
  readonly cut: number;
}

export interface Score {
  readonly tempo: PreviewTempoMap;
  readonly start: number;
  readonly startPosition: number;
  readonly tail: number;
  readonly events: readonly ScoreEvent[];
}

export function buildScore(chart: ReadonlyChart, startPosition = 0, selectedOnly = false): Score {
  if (!Number.isFinite(startPosition) || startPosition < 0)
    throw new Error('Invalid playback position');
  const tempo = buildPreviewTempoMap(chart.notes);
  const candidates: Omit<ScoreEvent, 'cut'>[] = [];
  for (let i = 1; i < chart.notes.length; i++) {
    const n = chart.notes[i]!;
    if (
      n.comment ||
      n.ghost ||
      n.landmine ||
      !isColumnSound(n.columnIndex) ||
      (selectedOnly && !n.selected)
    )
      continue;
    const id = cint(n.value / 10000);
    const name = chart.hWAV[id];
    if (!name) continue;
    const time = rawTimeFromVPosition(tempo, n.vPosition);
    const trigger = timeFromVPosition(tempo, n.vPosition);
    if (!Number.isFinite(time) || !Number.isFinite(trigger)) throw new Error('Invalid note time');
    candidates.push({
      id,
      name,
      time,
      trigger,
      noteIndex: i,
      column: n.columnIndex,
      vPosition: n.vPosition,
    });
  }
  if (selectedOnly && candidates.length) startPosition = candidates[0]!.vPosition;
  const start = timeFromVPosition(tempo, startPosition);
  const next = new Map<number, number>();
  const events: ScoreEvent[] = [];
  for (let i = candidates.length - 1; i >= 0; i--) {
    const e = candidates[i]!;
    const cut = next.get(e.id) ?? Infinity;
    next.set(e.id, e.trigger);
    if (e.vPosition >= startPosition || cut > start) events.push({ ...e, cut });
  }
  events.reverse();
  const last = selectedOnly
    ? (candidates.at(-1)?.vPosition ?? startPosition)
    : chart.notes.reduce(
        (p, n) => (!n.ghost && !n.comment ? Math.max(p, n.vPosition) : p),
        startPosition,
      );
  return {
    tempo,
    start,
    startPosition,
    events,
    tail: Math.max(start, timeFromVPosition(tempo, last)) + 2,
  };
}

export function scoreEnd(score: Score, durations: ReadonlyMap<number, number>): number {
  return score.events.reduce(
    (end, e) => Math.max(end, Math.min(e.cut, e.time + (durations.get(e.id) ?? 0))),
    score.tail,
  );
}
