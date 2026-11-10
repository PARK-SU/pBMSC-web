import { MaxId62 } from '../bms/base.ts';
import type { Chart } from '../model/chart.ts';
import { getMaxVPosition } from '../model/measure.ts';
import { cloneNote, type Note } from '../model/note.ts';
import { sortByVPositionInsertion } from '../model/sort.ts';
import { cint } from '../vb.ts';
import type { PerformContext, UndoChain } from './commands.ts';
import { updatePairing } from './pairing.ts';
import { removeCommentLine, removeNote as removeNoteOnly } from './random.ts';
import { decreaseCurrentWAV, type EditSession } from './session.ts';

export interface EditContext extends PerformContext {
  addUndo(undo: UndoChain | null, redo: UndoChain | null, overWrite?: boolean): void;
}

const vbAnd = (a: boolean, b: boolean): boolean => a && b;

export function addNote(
  chart: Chart,
  note: Readonly<Note>,
  ctx: PerformContext,
  overWrite = true,
  sortAndUpdatePairing = true,
): boolean {
  if (note.vPosition < 0 || note.vPosition >= getMaxVPosition(chart)) return false;

  let removed = false;
  let xI1 = 1;

  if (overWrite) {
    while (xI1 <= chart.notes.length - 1) {
      if (
        chart.notes[xI1]!.vPosition === note.vPosition &&
        chart.notes[xI1]!.columnIndex === note.columnIndex
      ) {
        removeNote(chart, xI1, true, ctx.session);
        removed = true;
      } else {
        xI1 += 1;
      }
    }
  }

  const xNote = cloneNote(note);
  xNote.selected = vbAnd(xNote.selected, ctx.nEnabled(xNote.columnIndex));
  chart.notes.push(xNote);

  if (sortAndUpdatePairing) {
    sortByVPositionInsertion(chart.notes);
    updatePairing(chart);
  }
  ctx.calculateTotalPlayableNotes?.(chart);
  return removed;
}

export function removeNote(
  chart: Chart,
  i: number,
  sortAndUpdatePairing = true,
  session?: EditSession,
): void {
  if (session?.wavIncrease === true) {
    if (chart.notes[i]!.value === session.currentWav * 10000) decreaseCurrentWAV(session);
  }

  removeNoteOnly(chart, i, sortAndUpdatePairing);
}

export function removeNotes(
  chart: Chart,
  ctx: PerformContext,
  sortAndUpdatePairing = true,
): boolean {
  if (chart.notes.length - 1 === 0) return false;

  let xI1 = 1;
  do {
    if (chart.notes[xI1]!.selected && !chart.notes[xI1]!.ghost) {
      for (let xI2 = xI1 + 1; xI2 <= chart.notes.length - 1; xI2++) {
        chart.notes[xI2 - 1] = chart.notes[xI2]!;
      }
      chart.notes.length -= 1;
      xI1 = 0;
    }
    xI1 += 1;
  } while (xI1 < chart.notes.length - 1 + 1);

  const xComCount = new Array<number>(MaxId62 + 1).fill(0);
  const comCount = (i: number): number => {
    const count = xComCount[i];
    if (count === undefined) throw new RangeError(`xComCount(${i}) is out of range`);
    return count;
  };
  for (xI1 = 1; xI1 <= chart.notes.length - 1; xI1++) {
    if (chart.notes[xI1]!.comment) {
      const xIC = cint(chart.notes[xI1]!.value / 10000);
      xComCount[xIC] = comCount(xIC) + 1;
    }
  }
  xI1 = 1;
  while (xI1 <= chart.hCOMNum) {
    if (comCount(xI1) === 0) {
      removeCommentLine(chart, xI1);
      if (xI1 === xComCount.length) {
        xComCount[xI1] = 0;
        break;
      } else {
        xComCount[xI1] = comCount(xI1 + 1);
      }
      for (let xI2 = 1; xI2 <= chart.notes.length - 1; xI2++) {
        if (chart.notes[xI2]!.value / 10000 > xI1) chart.notes[xI2]!.value -= 10000;
      }
    } else {
      xI1 += 1;
    }
  }

  if (sortAndUpdatePairing) {
    sortByVPositionInsertion(chart.notes);
    updatePairing(chart);
  }
  ctx.calculateTotalPlayableNotes?.(chart);
  return true;
}
