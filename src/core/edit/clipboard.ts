import type { Chart, ReadonlyChart } from '../model/chart.ts';
import { bmsEChannelToColumnIndex } from '../model/channels.ts';
import {
  calculateGreatestVPosition,
  getMaxVPosition,
  measureAtDisplacement,
} from '../model/measure.ts';
import { emptyNote, type Note } from '../model/note.ts';
import { sortByVPositionInsertion } from '../model/sort.ts';
import {
  cboolStr,
  cdbl,
  cint,
  cintStr,
  clng,
  clngStr,
  len,
  mid,
  toDotNetString,
  trim,
} from '../vb.ts';
import { redoAddNoteSelected, redoRemoveNoteSelected, UndoChainBuilder } from './chain.ts';
import type { PerformContext } from './commands.ts';
import { removeNotes, type EditContext } from './ops.ts';
import { convertBMSE2NT, convertNT2BMSE, updatePairing } from './pairing.ts';
import type { ColumnPredicate } from './selection.ts';

export const clipboardHeader = 'iBMSC Clipboard Data';
export const clipboardHeaderNT = 'iBMSC Clipboard Data xNT';
export const bmseClipboardHeader = 'BMSE ClipBoard Object Data Format';

const vbAnd = (a: boolean, b: boolean): boolean => a && b;

const cintBoolText = (b: boolean): string => (b ? '-1' : '0');

export function copyNotes(chart: Chart, unselect = true): string {
  let xStrAll = chart.ntInput ? clipboardHeaderNT : clipboardHeader;
  const notes: readonly Note[] = chart.notes;
  let minMeasure = 999;

  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    const xMeasure = measureAtDisplacement(chart, notes[xI1]!.vPosition);
    if (vbAnd(notes[xI1]!.selected, xMeasure < minMeasure)) minMeasure = xMeasure;
  }
  minMeasure = chart.measureBottom[cint(minMeasure)]!;

  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    const note = notes[xI1]!;
    if (!note.selected) continue;
    const fourth = chart.ntInput ? toDotNetString(note.length) : cintBoolText(note.longNote);
    xStrAll +=
      '\r\n' +
      String(note.columnIndex) +
      ' ' +
      toDotNetString(note.vPosition - minMeasure) +
      ' ' +
      String(note.value) +
      ' ' +
      fourth +
      ' ' +
      cintBoolText(note.hidden) +
      ' ' +
      cintBoolText(note.landmine);
    note.selected = !unselect;
  }

  return xStrAll;
}

export function clipboardLines(text: string): string[] {
  return text.split(/\r\n|\n/);
}

export function pasteAnchor(
  chart: Pick<ReadonlyChart, 'measureBottom'>,
  panelVScroll: number,
): number {
  return anchorOf(chart, cint(panelVScroll));
}

function anchorOf(chart: Pick<ReadonlyChart, 'measureBottom'>, xVS: number): number {
  const xMeasure = measureAtDisplacement(chart, -xVS) + 1;
  const bottom = chart.measureBottom[xMeasure];
  if (bottom === undefined) throw new RangeError(`MeasureBottom(${xMeasure}) is out of range`);
  return bottom;
}

function itemAt(items: readonly string[], i: number): string {
  const item = items[i];
  if (item === undefined) throw new RangeError(`xStrSub(${i}) is out of range`);
  return item;
}

export interface ParsedClipboard {
  readonly format: 'iBMSC' | 'iBMSC-NT' | 'BMSE';
  readonly notes: Note[];
}

export function parseClipboard(
  text: string,
  chart: Pick<ReadonlyChart, 'measureBottom' | 'measureLength'>,
  panelVScroll: number,
  isEnabled: ColumnPredicate,
  xSelected = true,
): ParsedClipboard | undefined {
  const xStrLine = clipboardLines(text);
  const xVS = cint(panelVScroll);
  const notes: Note[] = [];

  if (xStrLine[0] === clipboardHeader || xStrLine[0] === clipboardHeaderNT) {
    const nt = xStrLine[0] === clipboardHeaderNT;
    for (let xI1 = 1; xI1 <= xStrLine.length - 1; xI1++) {
      const line = xStrLine[xI1]!;
      if (trim(line) === '') continue;
      const xStrSub = line.split(' ');
      const xTempVP = cdbl(itemAt(xStrSub, 1)) + anchorOf(chart, xVS);
      if (vbAnd(vbAnd(xStrSub.length - 1 === 5, xTempVP >= 0), xTempVP < getMaxVPosition(chart))) {
        const note = emptyNote();
        note.columnIndex = cintStr(xStrSub[0]!);
        note.vPosition = xTempVP;
        note.value = clngStr(xStrSub[2]!);
        if (nt) {
          note.length = cdbl(xStrSub[3]!);
        } else {
          note.longNote = cboolStr(xStrSub[3]!);
        }
        note.hidden = cboolStr(xStrSub[4]!);
        note.landmine = cboolStr(xStrSub[5]!);
        note.selected = xSelected;
        notes.push(note);
      }
    }
    return { format: nt ? 'iBMSC-NT' : 'iBMSC', notes };
  }

  if (xStrLine[0] === bmseClipboardHeader) {
    for (let xI1 = 1; xI1 <= xStrLine.length - 1; xI1++) {
      const line = xStrLine[xI1]!;
      if (trim(line) === '') continue;
      const posStr = mid(line, 5, 7);
      const vPos = cdbl(posStr) + anchorOf(chart, xVS);
      const bmsIdent = mid(line, 1, 3);
      const lineCol = bmsEChannelToColumnIndex(bmsIdent);
      const value = cdbl(mid(line, 12)) * 10000;
      const attribute = mid(line, 4, 1);

      const validCol = vbAnd(len(line) > 11, lineCol > 0);
      const inRange = vbAnd(vPos >= 0, vPos < getMaxVPosition(chart));
      if (validCol && inRange) {
        const note = emptyNote();
        note.columnIndex = lineCol;
        note.vPosition = vPos;
        note.value = clng(value);
        note.longNote = attribute === '2';
        note.hidden = attribute === '1';
        note.selected = vbAnd(xSelected, isEnabled(note.columnIndex));
        notes.push(note);
      }
    }
    return { format: 'BMSE', notes };
  }

  return undefined;
}

export function addNotesFromClipboard(
  chart: Chart,
  text: string,
  panelVScroll: number,
  ctx: Pick<PerformContext, 'nEnabled' | 'calculateTotalPlayableNotes'>,
  xSelected = true,
  sortAndUpdatePairing = true,
): void {
  const parsed = parseClipboard(text, chart, panelVScroll, (iCol) => ctx.nEnabled(iCol), xSelected);

  for (let xI1 = 0; xI1 <= chart.notes.length - 1; xI1++) chart.notes[xI1]!.selected = false;

  const noteLen = chart.notes.length;
  if (parsed !== undefined) {
    chart.notes.push(...parsed.notes);
    if (parsed.format === 'iBMSC-NT') {
      if (!chart.ntInput) convertNT2BMSE(chart, noteLen);
    } else if (chart.ntInput) {
      convertBMSE2NT(chart, noteLen);
    }
  }

  if (sortAndUpdatePairing) {
    sortByVPositionInsertion(chart.notes);
    updatePairing(chart);
  }
  ctx.calculateTotalPlayableNotes?.(chart);
}

export function tbCutClick(
  chart: Chart,
  ctx: EditContext,
): { readonly text: string; readonly kMouseOverReset: boolean } {
  const b = new UndoChainBuilder();
  redoRemoveNoteSelected(b, chart.notes);

  const text = copyNotes(chart, false);
  const kMouseOverReset = removeNotes(chart, ctx, false);
  ctx.addUndo(b.undoHead(), b.redoHead());

  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
  ctx.calculateTotalPlayableNotes?.(chart);
  calculateGreatestVPosition(chart);
  return { text, kMouseOverReset };
}

export function tbCopyClick(chart: Chart): string {
  return copyNotes(chart);
}

export function tbPasteClick(
  chart: Chart,
  text: string,
  panelVScroll: number,
  ctx: EditContext,
): void {
  addNotesFromClipboard(chart, text, panelVScroll, ctx);

  const b = new UndoChainBuilder();
  redoAddNoteSelected(b, chart.notes);
  ctx.addUndo(b.undoHead(), b.redoHead());

  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
  ctx.calculateTotalPlayableNotes?.(chart);
  calculateGreatestVPosition(chart);
}

export function mnDeleteClick(chart: Chart, ctx: EditContext): boolean {
  const b = new UndoChainBuilder();
  redoRemoveNoteSelected(b, chart.notes);
  const kMouseOverReset = removeNotes(chart, ctx, true);

  ctx.addUndo(b.undoHead(), b.redoHead());
  calculateGreatestVPosition(chart);
  ctx.calculateTotalPlayableNotes?.(chart);
  return kMouseOverReset;
}
