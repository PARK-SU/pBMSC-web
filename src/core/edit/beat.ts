import { getDenominator } from '../bms/decimal.ts';
import type { Chart } from '../model/chart.ts';
import { calculateGreatestVPosition, updateMeasureBottom } from '../model/measure.ts';
import { sortByVPositionInsertion } from '../model/sort.ts';
import { cint, doubleTryParse, toDotNetString, VbError } from '../vb.ts';
import {
  redoChangeMeasure,
  redoChangeMeasureLengthSelected,
  redoLongNoteModify,
  redoRemoveNote,
  UndoChainBuilder,
} from './chain.ts';
import { removeNote, type EditContext } from './ops.ts';
import { updatePairing } from './pairing.ts';

export type BeatMode = 'preserve' | 'measure' | 'cut' | 'scale';

export function applyBeat(
  chart: Chart,
  ratio: number,
  mode: BeatMode,
  ctx: EditContext,
  b: UndoChainBuilder,
  sub = 4,
  fraction?: { n: number; d: number },
): void {
  sortByVPositionInsertion(chart.notes);
  if (fraction === undefined && ratio !== 1) {
    const denominator = cint(getDenominator(ratio));
    cint(ratio * denominator);
  } else if (fraction === undefined) {
    cint(sub);
  }
  const indices = [...ctx.session.beatSelection];
  redoChangeMeasureLengthSelected(b, chart, indices, 192 * ratio);
  for (const index of indices) {
    if (index < 0 || index >= 1000) throw new RangeError(`Measure ${index}`);
    let bottom = 0;
    for (let i = 0; i < index; i++) bottom += chart.measureLength[i]!;
    const before = bottom + chart.measureLength[index]!;
    const delta = ratio * 192 - chart.measureLength[index]!;
    const factor = (ratio * 192) / chart.measureLength[index]!;
    const after = before + delta;
    if (mode === 'cut' && delta < 0) {
      if (chart.ntInput) {
        let i = 1;
        while (i < chart.notes.length) {
          const n = chart.notes[i]!;
          if (n.vPosition < after) {
            if (n.vPosition + n.length >= after && n.vPosition + n.length < before) {
              const length = after - n.vPosition - 1;
              redoLongNoteModify(b, n, n.vPosition, length);
              n.length = length;
            }
          } else if (n.vPosition < before) {
            if (n.vPosition + n.length < before) {
              redoRemoveNote(b, n);
              removeNote(chart, i, true, ctx.session);
              continue;
            }
            const length = n.length - before + n.vPosition;
            redoLongNoteModify(b, n, before, length);
            n.length = length;
            n.vPosition = before;
          }
          i++;
        }
      } else {
        let first = 1;
        while (first < chart.notes.length && chart.notes[first]!.vPosition < after) first++;
        let end = first;
        while (end < chart.notes.length && chart.notes[end]!.vPosition < before) end++;
        for (let i = first; i < end; i++) redoRemoveNote(b, chart.notes[i]!);
        chart.notes.splice(first, end - first);
      }
    }
    if (mode === 'measure' || mode === 'cut') {
      for (let i = 1; i < chart.notes.length; i++) {
        const n = chart.notes[i]!;
        if (n.vPosition >= before) {
          redoLongNoteModify(b, n, n.vPosition + delta, n.length);
          n.vPosition += delta;
        } else if (chart.ntInput && n.vPosition + n.length >= before) {
          redoLongNoteModify(b, n, n.vPosition, n.length + delta);
          n.length += delta;
        }
      }
    } else if (mode === 'scale') {
      let first = 1;
      while (first < chart.notes.length && chart.notes[first]!.vPosition < bottom) first++;
      for (let i = 1; i < chart.notes.length; i++) {
        const n = chart.notes[i]!;
        let position = n.vPosition;
        let length = n.length;
        if (position < bottom) {
          if (!chart.ntInput) continue;
          if (position + length > before) length += delta;
          else if (position + length > bottom)
            length = (length + position - bottom) * factor + bottom - position;
          else continue;
        } else if (position < before) {
          length = chart.ntInput
            ? position + length > before
              ? (before - position) * factor + position + length - before
              : length * factor
            : length;
          position = (position - bottom) * factor + bottom;
        } else position += delta;
        const recorded = !chart.ntInput && n.vPosition < before ? chart.notes[first]! : n;
        redoLongNoteModify(
          b,
          recorded,
          position,
          !chart.ntInput && n.vPosition < before ? recorded.length : length,
        );
        n.length = length;
        n.vPosition = position;
      }
    }
    chart.measureLength[index] = ratio * 192;
  }
  updateMeasureBottom(chart);
  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
  ctx.calculateTotalPlayableNotes?.(chart);
  calculateGreatestVPosition(chart);
}

export function changeBeat(
  chart: Chart,
  ratio: number,
  mode: BeatMode,
  ctx: EditContext,
  sub = 4,
  fraction?: { n: number; d: number },
): void {
  const b = new UndoChainBuilder();
  applyBeat(chart, ratio, mode, ctx, b, sub, fraction);
  ctx.addUndo(b.undoHead(), b.redoHead());
}

export function copyBeats(
  chart: Readonly<Pick<Chart, 'measureLength'>>,
  selected: readonly number[],
): string {
  return selected.map((_, i) => toDotNetString(chart.measureLength[i]! / 192)).join('\r\n');
}

export function pasteBeats(
  chart: Chart,
  text: string,
  mode: BeatMode,
  ctx: EditContext,
  sub = 4,
): boolean {
  const first = ctx.session.beatSelection[0];
  if (first === undefined) return true;
  const before = [...chart.measureLength];
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const b = new UndoChainBuilder();
  for (let i = 0; i < lines.length; i++) {
    ctx.session.beatSelection = [];
    const ratio = doubleTryParse(lines[i]!);
    if (ratio === undefined) continue;
    if (ratio <= 0 || ratio >= 1000) return false;
    if (first + i >= 1000) throw new VbError('Argument');
    ctx.session.beatSelection = [first + i];
    applyBeat(chart, ratio, mode, ctx, b, sub);
  }
  if (first + lines.length > 1000) throw new VbError('Argument');
  ctx.session.beatSelection = lines.map((_, i) => first + i);
  redoChangeMeasure(b, before, chart.measureLength);
  ctx.addUndo(b.undoHead(), b.redoHead());
  return true;
}
