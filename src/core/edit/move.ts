import type { Chart } from '../model/chart.ts';
import { isColumnSound } from '../model/column.ts';
import { niB } from '../model/constants.ts';
import { calculateGreatestVPosition, getMaxVPosition } from '../model/measure.ts';
import type { Note } from '../model/note.ts';
import { sortByVPositionInsertion } from '../model/sort.ts';
import { cint } from '../vb.ts';
import {
  redoHiddenNoteModify,
  redoLongNoteModify,
  redoLongNoteModifyLongNote,
  redoMoveNote,
  type UndoChainBuilder,
} from './chain.ts';
import type { EditContext } from './ops.ts';
import { updatePairing } from './pairing.ts';
import type { ScrollTarget } from './selection.ts';

export type MoveContext = Pick<EditContext, 'nEnabled' | 'addUndo' | 'calculateTotalPlayableNotes'>;

function addUndo(ctx: MoveContext, b: UndoChainBuilder): void {
  ctx.addUndo(b.undoHead(), b.redoHead());
}

export interface LaneMoveResult {
  readonly previewIndex: number | undefined;
}

function deselectFirstMovedNote(notes: readonly Note[], xI2: number, b: UndoChainBuilder): void {
  notes[xI2]!.selected = false;
  for (let xI3 = 1; xI3 <= notes.length - 1; xI3++) {
    if (xI3 === xI2) continue;
    if (notes[xI3]!.selected) {
      redoMoveNote(b, notes[xI3]!, notes[xI3]!.columnIndex, notes[xI3]!.vPosition);
    }
  }
}

export function moveToColumn(
  chart: Chart,
  xTargetColumn: number,
  shift: boolean,
  b: UndoChainBuilder,
  ctx: MoveContext,
): LaneMoveResult {
  if (xTargetColumn === -1) return { previewIndex: undefined };
  if (!ctx.nEnabled(xTargetColumn)) return { previewIndex: undefined };
  const bMoveAndDeselectFirstNote = shift;
  const notes: readonly Note[] = chart.notes;
  let previewIndex: number | undefined;

  for (let xI2 = 1; xI2 <= notes.length - 1; xI2++) {
    if (!notes[xI2]!.selected || notes[xI2]!.ghost) continue;

    redoMoveNote(b, notes[xI2]!, xTargetColumn, notes[xI2]!.vPosition);
    notes[xI2]!.columnIndex = xTargetColumn;

    if (bMoveAndDeselectFirstNote) {
      previewIndex = xI2;
      deselectFirstMovedNote(notes, xI2, b);
      break;
    }
  }
  addUndo(ctx, b);
  updatePairing(chart);
  ctx.calculateTotalPlayableNotes?.(chart);
  return { previewIndex };
}

export function moveToBGM(
  chart: Chart,
  shift: boolean,
  b: UndoChainBuilder,
  ctx: MoveContext,
): LaneMoveResult {
  const bMoveAndDeselectFirstNote = shift;
  const notes: readonly Note[] = chart.notes;
  let previewIndex: number | undefined;

  for (let xI2 = 1; xI2 <= notes.length - 1; xI2++) {
    if (!notes[xI2]!.selected || !isColumnSound(notes[xI2]!.columnIndex)) continue;

    let currentBGMColumn = niB;
    const uBound = notes.length - 1;
    if (chart.ntInput) {
      for (let xI0 = 1; xI0 <= uBound; xI0++) {
        const intersectA = notes[xI0]!.vPosition <= notes[xI2]!.vPosition + notes[xI2]!.length;
        const intersectB = notes[xI0]!.vPosition + notes[xI0]!.length >= notes[xI2]!.vPosition;
        if (notes[xI0]!.columnIndex === currentBGMColumn && intersectA && intersectB) {
          currentBGMColumn += 1;
          xI0 = 1;
        }
      }
    } else {
      for (let xI0 = 1; xI0 <= uBound; xI0++) {
        if (
          notes[xI0]!.columnIndex === currentBGMColumn &&
          notes[xI0]!.vPosition === notes[xI2]!.vPosition
        ) {
          currentBGMColumn += 1;
          xI0 = 1;
        }
      }
    }

    redoMoveNote(b, notes[xI2]!, currentBGMColumn, notes[xI2]!.vPosition);
    notes[xI2]!.columnIndex = currentBGMColumn;

    if (bMoveAndDeselectFirstNote) {
      previewIndex = xI2;
      deselectFirstMovedNote(notes, xI2, b);
      break;
    }
  }

  addUndo(ctx, b);
  updatePairing(chart);
  ctx.calculateTotalPlayableNotes?.(chart);
  return { previewIndex };
}

export function moveSelectedNotesVertical(
  chart: Chart,
  direction: 1 | -1,
  gDivide: number,
  ctrl: boolean,
  b: UndoChainBuilder,
  ctx: MoveContext,
): ScrollTarget[] {
  const notes: readonly Note[] = chart.notes;
  let xVPosition: number;
  let xLimit: number;

  if (direction === 1) {
    xVPosition = 192 / gDivide;
    if (ctrl) xVPosition = 1;

    let muVPosition = getMaxVPosition(chart) - 1;
    for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
      if (notes[xI1]!.selected) {
        const ntLength = chart.ntInput ? notes[xI1]!.length : 0;
        const top = notes[xI1]!.vPosition + ntLength + xVPosition;
        muVPosition = top > muVPosition ? top : muVPosition;
      }
    }
    muVPosition -= 191999;
    xLimit = muVPosition;
  } else {
    xVPosition = -192 / gDivide;
    if (ctrl) xVPosition = -1;

    let mVPosition = 0;
    for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
      if (notes[xI1]!.selected) {
        const bottom = notes[xI1]!.vPosition + xVPosition;
        mVPosition = bottom < mVPosition ? bottom : mVPosition;
      }
    }
    xLimit = mVPosition;
  }

  const scrollTo: ScrollTarget[] = [];
  for (let xI1 = notes.length - 1; xI1 >= 1; xI1--) {
    if (!notes[xI1]!.selected || notes[xI1]!.ghost) continue;

    const xVPos = notes[xI1]!.vPosition + xVPosition - xLimit;
    redoMoveNote(b, notes[xI1]!, notes[xI1]!.columnIndex, xVPos);
    notes[xI1]!.vPosition = xVPos;
    scrollTo.push({ vPosition: xVPos, length: notes[xI1]!.length });
  }

  if (xVPosition - xLimit !== 0) addUndo(ctx, b);
  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
  ctx.calculateTotalPlayableNotes?.(chart);
  calculateGreatestVPosition(chart);
  return scrollTo;
}

export interface ColumnMap {
  toEnabled(column: number): number;
  toColumn(enabledIndex: number): number;
}

export function moveSelectedNotesHorizontal(
  chart: Chart,
  direction: 1 | -1,
  columns: ColumnMap,
  b: UndoChainBuilder,
  ctx: MoveContext,
): ScrollTarget[] {
  const notes: readonly Note[] = chart.notes;
  const scrollTo: ScrollTarget[] = [];

  if (direction === -1) {
    let mLeft = 0;
    for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
      if (notes[xI1]!.selected) {
        const left = columns.toEnabled(notes[xI1]!.columnIndex) - 1;
        mLeft = cint(left < mLeft ? left : mLeft);
      }
    }

    for (let xI1 = notes.length - 1; xI1 >= 1; xI1--) {
      if (!notes[xI1]!.selected || notes[xI1]!.ghost) continue;

      const xCol = columns.toColumn(columns.toEnabled(notes[xI1]!.columnIndex) - 1 - mLeft);
      redoMoveNote(b, notes[xI1]!, xCol, notes[xI1]!.vPosition);
      notes[xI1]!.columnIndex = xCol;
      scrollTo.push({ vPosition: notes[xI1]!.vPosition, length: notes[xI1]!.length });
    }

    if (-1 - mLeft !== 0) addUndo(ctx, b);
  } else {
    for (let xI1 = notes.length - 1; xI1 >= 1; xI1--) {
      if (!notes[xI1]!.selected || notes[xI1]!.ghost) continue;

      const xCol = columns.toColumn(columns.toEnabled(notes[xI1]!.columnIndex) + 1);
      redoMoveNote(b, notes[xI1]!, xCol, notes[xI1]!.vPosition);
      notes[xI1]!.columnIndex = xCol;
      scrollTo.push({ vPosition: notes[xI1]!.vPosition, length: notes[xI1]!.length });
    }

    addUndo(ctx, b);
  }

  updatePairing(chart);
  ctx.calculateTotalPlayableNotes?.(chart);
  return scrollTo;
}

function sortAndPair(chart: Chart): void {
  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
}

export function pobHiddenClick(chart: Chart, b: UndoChainBuilder, ctx: MoveContext): void {
  const notes: readonly Note[] = chart.notes;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    if (!notes[xI1]!.selected || notes[xI1]!.landmine || notes[xI1]!.ghost) continue;

    redoHiddenNoteModify(b, notes[xI1]!, true);
    notes[xI1]!.hidden = true;
  }
  addUndo(ctx, b);
  sortAndPair(chart);
}

export function pobVisibleClick(chart: Chart, b: UndoChainBuilder, ctx: MoveContext): void {
  const notes: readonly Note[] = chart.notes;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    if (!notes[xI1]!.selected || notes[xI1]!.ghost) continue;

    redoHiddenNoteModify(b, notes[xI1]!, false);
    notes[xI1]!.hidden = false;
  }
  addUndo(ctx, b);
  sortAndPair(chart);
}

export function pobHiddenVisibleClick(chart: Chart, b: UndoChainBuilder, ctx: MoveContext): void {
  const notes: readonly Note[] = chart.notes;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    if (!notes[xI1]!.selected || notes[xI1]!.landmine || notes[xI1]!.ghost) continue;

    redoHiddenNoteModify(b, notes[xI1]!, !notes[xI1]!.hidden);
    notes[xI1]!.hidden = !notes[xI1]!.hidden;
  }
  addUndo(ctx, b);
  sortAndPair(chart);
}

export function setHiddenSelected(
  chart: Chart,
  mode: 'hide' | 'show' | 'toggle',
  b: UndoChainBuilder,
  ctx: MoveContext,
): void {
  if (mode === 'hide') pobHiddenClick(chart, b, ctx);
  else if (mode === 'show') pobVisibleClick(chart, b, ctx);
  else pobHiddenVisibleClick(chart, b, ctx);
}

export function pobLongClick(chart: Chart, b: UndoChainBuilder, ctx: MoveContext): void {
  if (chart.ntInput) return;
  const notes: readonly Note[] = chart.notes;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    if (!notes[xI1]!.selected || notes[xI1]!.ghost) continue;

    redoLongNoteModifyLongNote(b, notes[xI1]!, notes[xI1]!.vPosition, true);
    notes[xI1]!.longNote = true;
  }
  addUndo(ctx, b);
  sortAndPair(chart);
}

export function pobNormalClick(chart: Chart, b: UndoChainBuilder, ctx: MoveContext): void {
  const notes: readonly Note[] = chart.notes;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    if (!notes[xI1]!.selected || notes[xI1]!.ghost) continue;

    redoLongNoteModify(b, notes[xI1]!, notes[xI1]!.vPosition, 0);
    if (!chart.ntInput) {
      notes[xI1]!.longNote = false;
    } else {
      notes[xI1]!.length = 0;
    }
  }
  addUndo(ctx, b);
  sortAndPair(chart);
}

export function pobNormalLongClick(chart: Chart, b: UndoChainBuilder, ctx: MoveContext): void {
  if (chart.ntInput) return;
  const notes: readonly Note[] = chart.notes;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    if (!notes[xI1]!.selected || notes[xI1]!.ghost) continue;

    redoLongNoteModifyLongNote(b, notes[xI1]!, notes[xI1]!.vPosition, !notes[xI1]!.longNote);
    notes[xI1]!.longNote = !notes[xI1]!.longNote;
  }
  addUndo(ctx, b);
  sortAndPair(chart);
}
