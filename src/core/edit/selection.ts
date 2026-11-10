import type { Chart, ReadonlyChart } from '../model/chart.ts';
import { calculateGreatestVPosition, measureAtDisplacement } from '../model/measure.ts';
import type { Note } from '../model/note.ts';
import { cint, VbError } from '../vb.ts';

export type ColumnPredicate = (iCol: number) => boolean;

export interface TimeSelection {
  readonly start: number;
  readonly length: number;
  readonly half: number;
}

export const initialTimeSelection: TimeSelection = { start: 192, length: 0, half: 0 };

export interface ScrollTarget {
  readonly vPosition: number;
  readonly length: number;
}

function mathSign(v: number): number {
  if (Number.isNaN(v)) throw new VbError('Arithmetic');
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

export function validateSelection(sel: TimeSelection, maxVPosition: number): TimeSelection {
  let vSelStart = sel.start;
  let vSelLength = sel.length;
  let vSelHalf = sel.half;
  if (vSelStart < 0) {
    vSelLength += vSelStart;
    vSelHalf += vSelStart;
    vSelStart = 0;
  }
  if (vSelStart > maxVPosition - 1) {
    vSelLength += vSelStart - maxVPosition + 1;
    vSelHalf += vSelStart - maxVPosition + 1;
    vSelStart = maxVPosition - 1;
  }
  if (vSelStart + vSelLength < 0) vSelLength = -vSelStart;
  if (vSelStart + vSelLength > maxVPosition - 1) vSelLength = maxVPosition - 1 - vSelStart;

  if (mathSign(vSelHalf) !== mathSign(vSelLength)) vSelHalf = 0;
  if (Math.abs(vSelHalf) > Math.abs(vSelLength)) vSelHalf = vSelLength;
  return { start: vSelStart, length: vSelLength, half: vSelHalf };
}

export function selectAll(chart: Chart, isEnabled: ColumnPredicate): void {
  for (let xI1 = 1; xI1 <= chart.notes.length - 1; xI1++) {
    chart.notes[xI1]!.selected = isEnabled(chart.notes[xI1]!.columnIndex);
  }
}

export function selectAllTimeSelection(chart: Chart, sel: TimeSelection): TimeSelection {
  calculateGreatestVPosition(chart);
  const xMeasure = measureAtDisplacement(chart, chart.greatestVPosition);
  return {
    start: 0,
    length: chart.measureBottom[xMeasure]! + chart.measureLength[xMeasure]!,
    half: sel.half,
  };
}

function noteAt(notes: readonly Readonly<Note>[], i: number): Readonly<Note> {
  const note = notes[i];
  if (note === undefined) throw new RangeError(`Notes(${i}) is out of range`);
  return note;
}

function hWAVAt(chart: Pick<ReadonlyChart, 'hWAV'>, i: number): string {
  const wav = chart.hWAV[i];
  if (wav === undefined) throw new RangeError(`hWAV(${i}) is out of range`);
  return wav;
}

export function isLabelMatch(
  chart: Pick<ReadonlyChart, 'notes' | 'hWAV'>,
  note: Readonly<Note>,
  index: number,
  showFileName: boolean,
): boolean {
  if (showFileName) {
    const wavidx = cint(noteAt(chart.notes, index).value / 10000);
    const wav = hWAVAt(chart, wavidx);
    if (hWAVAt(chart, cint(note.value / 10000)) === wav) return true;
  } else {
    if (note.value === noteAt(chart.notes, index).value) return true;
  }
  return false;
}

export function selectAllWithHoveredNoteLabel(
  chart: Chart,
  kMouseOver: number,
  showFileName: boolean,
): void {
  for (let xI1 = 0; xI1 <= chart.notes.length - 1; xI1++) {
    const matches = isLabelMatch(chart, chart.notes[xI1]!, kMouseOver, showFileName);
    chart.notes[xI1]!.selected = matches ? true : chart.notes[xI1]!.selected;
  }
}

export function getNotesBySelectedAndVPosition(
  notes: readonly Readonly<Note>[],
  vPos: number,
  xI = 1,
): number[] {
  const xIArr: number[] = [];
  for (let xIN = xI; xIN <= notes.length - 1; xIN++) {
    const note = notes[xIN]!;
    if (!note.selected || note.ghost) continue;

    if (note.vPosition === vPos) {
      xIArr.push(xIN);
    } else if (note.vPosition > vPos) {
      break;
    }
  }
  return xIArr;
}

export interface NoteSelectionBounds {
  readonly hasSelectedNotes: boolean;
  readonly firstSelectedNote: number;
  readonly lastSelectedNote: number;
}

export interface TabBetweenNotesResult {
  readonly selected: number;
  readonly scrollTo: ScrollTarget;
}

export function tabBetweenNotes(
  chart: Chart,
  bounds: NoteSelectionBounds,
  backward: boolean,
  panelVScroll: number,
): TabBetweenNotesResult {
  const notes: readonly Note[] = chart.notes;
  let target: number;
  if (!backward) {
    let firstSelectedNote = bounds.firstSelectedNote;
    if (!bounds.hasSelectedNotes) {
      for (let xIN = 1; xIN <= notes.length - 1; xIN++) {
        if (notes[xIN]!.vPosition >= -panelVScroll) {
          firstSelectedNote = xIN - 1;
          break;
        }
      }
    }
    for (let xIN = 1; xIN <= notes.length - 1; xIN++) notes[xIN]!.selected = false;
    firstSelectedNote += 1;
    target = firstSelectedNote;
  } else {
    let lastSelectedNote = bounds.lastSelectedNote;
    if (!bounds.hasSelectedNotes) {
      for (let xIN = notes.length - 1; xIN >= 1; xIN--) {
        if (notes[xIN]!.vPosition >= -panelVScroll) {
          lastSelectedNote = xIN + 1;
          break;
        }
      }
    }
    for (let xIN = 1; xIN <= notes.length - 1; xIN++) notes[xIN]!.selected = false;
    lastSelectedNote -= 1;
    target = lastSelectedNote;
  }
  const note = notes[target];
  if (note === undefined) throw new RangeError(`Notes(${target}) is out of range`);
  note.selected = true;
  return { selected: target, scrollTo: { vPosition: note.vPosition, length: note.length } };
}
