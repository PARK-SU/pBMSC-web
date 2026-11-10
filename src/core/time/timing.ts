import { niBPM, niSTOP } from '../model/constants.ts';
import type { Note } from '../model/note.ts';

export interface TempoStop {
  readonly vPosition: number;
  readonly length: number;
}

export interface TempoSegment {
  readonly vPosition: number;
  readonly nextVPosition: number | undefined;
  readonly secondsPerBeat: number;
  readonly bpmContrib: number;
  readonly stopContrib: number;
  readonly stops: readonly TempoStop[];
  readonly vPositionReach: number;
  readonly timeReach: number;
}

export interface TempoMap {
  readonly segments: readonly TempoSegment[];
  readonly hasStops: boolean;
}

export function buildTempoMap(notes: readonly Readonly<Note>[]): TempoMap {
  const bpmNotes = notes.filter((note) => note.columnIndex === niBPM);
  const stopNotes = notes.filter((note) => note.columnIndex === niSTOP);
  if (bpmNotes.length === 0) throw new RangeError('no BPM note: the #BPM sentinel is missing');
  const hasStops = stopNotes.length > 0;

  const segments: TempoSegment[] = [];
  let bpmContrib = 0;
  let stopContrib = 0;
  let vPositionReach = -Infinity;
  let timeReach = -Infinity;
  for (let i = 0; i < bpmNotes.length; i++) {
    const currentNote = bpmNotes[i]!;
    const nextVPosition = bpmNotes[i + 1]?.vPosition;
    const notevpos = Math.max(0, currentNote.vPosition);
    const currentBps = 60 / (currentNote.value / 10000);
    const duration = nextVPosition === undefined ? Infinity : nextVPosition - notevpos;
    const end = notevpos + duration;
    const stops = stopNotes
      .filter((stp) => stp.vPosition >= notevpos && stp.vPosition < end)
      .map((stp) => ({ vPosition: stp.vPosition, length: stp.value / 10000 }));

    const segmentBpmContrib = bpmContrib;
    const segmentStopContrib = stopContrib;
    let endTime = Infinity;
    if (nextVPosition !== undefined) {
      bpmContrib += (currentBps * duration) / 48;
      if (hasStops) stopContrib += currentBps * (stopLength(stops, end) / 48);
      endTime = stopContrib + bpmContrib;
    }
    if (notevpos > vPositionReach) vPositionReach = notevpos;
    timeReach = Math.max(timeReach, Number.isNaN(endTime) ? Infinity : endTime);
    segments.push({
      vPosition: notevpos,
      nextVPosition,
      secondsPerBeat: currentBps,
      bpmContrib: segmentBpmContrib,
      stopContrib: segmentStopContrib,
      stops,
      vPositionReach,
      timeReach,
    });
  }
  return { segments, hasStops };
}

export function timeFromVPosition(map: TempoMap, vpos: number): number {
  const segments = map.segments;
  const count = firstIndex(segments.length, (i) => segments[i]!.vPositionReach > vpos);
  const segment = segments[count - 1];
  if (segment === undefined) return 0;

  const duration =
    (segment.nextVPosition === undefined ? vpos : Math.min(segment.nextVPosition, vpos)) -
    segment.vPosition;
  const bpmContrib = segment.bpmContrib + (segment.secondsPerBeat * duration) / 48;
  let stopContrib = segment.stopContrib;
  if (map.hasStops) {
    const stopBeats = stopLength(segment.stops, segment.vPosition + duration) / 48;
    stopContrib += segment.secondsPerBeat * stopBeats;
  }
  return stopContrib + bpmContrib;
}

export function vPositionFromTime(map: TempoMap, time: number): number {
  const segments = map.segments;
  const index = firstIndex(segments.length - 1, (i) => segments[i]!.timeReach >= time);
  const segment = segments[index]!;
  let distance =
    ((time - (segment.stopContrib + segment.bpmContrib)) * 48) / segment.secondsPerBeat;
  for (const stop of segment.stops) {
    const offset = stop.vPosition - segment.vPosition;
    if (distance <= offset) break;
    if (distance <= offset + stop.length) return stop.vPosition;
    distance -= stop.length;
  }
  return segment.vPosition + distance;
}

export function getTimeFromVPosition(
  chart: { readonly notes: readonly Readonly<Note>[] },
  vpos: number,
): number {
  return timeFromVPosition(buildTempoMap(chart.notes), vpos);
}

export function getVPositionFromTime(
  chart: { readonly notes: readonly Readonly<Note>[] },
  time: number,
): number {
  return vPositionFromTime(buildTempoMap(chart.notes), time);
}

function stopLength(stops: readonly TempoStop[], end: number): number {
  let sum = 0;
  for (const stop of stops) if (stop.vPosition < end) sum += stop.length;
  return sum;
}

function firstIndex(length: number, holds: (index: number) => boolean): number {
  let low = 0;
  let high = length;
  while (low < high) {
    const middle = Math.trunc((low + high) / 2);
    if (holds(middle)) high = middle;
    else low = middle + 1;
  }
  return low;
}
