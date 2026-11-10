import type { Chart } from '../model/chart.ts';
import { cloneNote, type Note } from '../model/note.ts';
import { cint, VbError } from '../vb.ts';
import {
  redoAddNoteAll,
  redoLongNoteModify,
  redoMoveNote,
  redoRemoveNoteAll,
  UndoChainBuilder,
} from './chain.ts';
import { parseClipboard } from './clipboard.ts';
import type { EditContext } from './ops.ts';
import { convertBMSE2NT, convertNT2BMSE, updatePairing } from './pairing.ts';

export function findNoteTemplatePosition(
  chart: Pick<Chart, 'notesTemplate'>,
  note: Readonly<Note>,
): { column: number; position: number } | undefined {
  let difference = 192 * 999;
  let target: { column: number; position: number } | undefined;
  for (let i = 1; i < chart.notesTemplate.length; i++) {
    const n = chart.notesTemplate[i]!;
    if (n.value !== note.value) continue;
    const next = Math.abs(n.vPosition - note.vPosition);
    if (next >= difference) return target ?? { column: 0, position: 0 };
    difference = next;
    target = { column: n.columnIndex, position: n.vPosition };
  }
  return target;
}

export function moveToTemplatePosition(chart: Chart, toPosition: boolean, ctx: EditContext): void {
  const b = new UndoChainBuilder();
  for (let i = 1; i < chart.notes.length; i++) {
    const n = chart.notes[i]!;
    if (!n.selected || n.ghost) continue;
    const target = findNoteTemplatePosition(chart, n);
    if (target === undefined) continue;
    const position = cint(toPosition ? target.position : n.vPosition);
    redoMoveNote(b, n, target.column, position);
    n.columnIndex = target.column;
    n.vPosition = position;
  }
  ctx.addUndo(b.undoHead(), b.redoHead());
  updatePairing(chart);
  ctx.calculateTotalPlayableNotes?.(chart);
}

export function getNotesFromClipboard(
  chart: Chart,
  text: string,
  scroll: number,
  ctx: EditContext,
): Note[] | undefined {
  const parsed = parseClipboard(text, chart, scroll, (column) => ctx.nEnabled(column), false);
  if (parsed === undefined) return undefined;
  if (parsed.format === 'iBMSC-NT') return parsed.notes;
  const includeExisting = parsed.format === 'BMSE' && chart.ntInput;
  const scratch: Chart = {
    ...chart,
    notes: [
      cloneNote(chart.notes[0]!),
      ...(includeExisting ? chart.notes.slice(1).map(cloneNote) : []),
      ...parsed.notes,
    ],
  };
  updatePairing(scratch);
  if (scratch.ntInput) {
    convertBMSE2NT(scratch);
    ctx.calculateTotalPlayableNotes?.(scratch);
  }
  return scratch.notes.slice(1).map(cloneNote);
}

export function pastePattern(
  chart: Chart,
  text: string,
  scroll: number,
  toPosition: boolean,
  ctx: EditContext,
  confirmCount: (clipboard: number, selection: number) => boolean,
): boolean | undefined {
  const b = new UndoChainBuilder();
  const wasNT = chart.ntInput;
  if (!wasNT) {
    chart.ntInput = true;
    redoRemoveNoteAll(b, chart.notes);
    convertBMSE2NT(chart);
    ctx.calculateTotalPlayableNotes?.(chart);
    redoAddNoteAll(b, chart.notes);
  }
  const notes = getNotesFromClipboard(chart, text, scroll, ctx);
  if (notes === undefined) {
    if (!wasNT) {
      convertNT2BMSE(chart);
      ctx.calculateTotalPlayableNotes?.(chart);
    }
    return undefined;
  }
  const count = chart.notes.filter((n) => n.selected).length;
  if (notes.length !== count && !confirmCount(notes.length, count)) return false;
  let at = -1;
  for (let i = 1; i < chart.notes.length; i++) {
    const n = chart.notes[i]!;
    if (!n.selected || n.ghost) continue;
    if (notes.length === 0) throw new VbError('DivideByZero');
    at = (at + 1) % notes.length;
    const pattern = notes[at]!;
    const position = toPosition ? pattern.vPosition : n.vPosition;
    redoMoveNote(b, n, pattern.columnIndex, position);
    n.columnIndex = pattern.columnIndex;
    n.vPosition = position;
    redoLongNoteModify(b, n, n.vPosition, pattern.length);
    n.length = pattern.length;
  }
  if (!wasNT) {
    chart.ntInput = false;
    redoRemoveNoteAll(b, chart.notes);
    convertNT2BMSE(chart);
    ctx.calculateTotalPlayableNotes?.(chart);
    redoAddNoteAll(b, chart.notes);
  }
  ctx.addUndo(b.undoHead(), b.redoHead());
  updatePairing(chart);
  return true;
}
