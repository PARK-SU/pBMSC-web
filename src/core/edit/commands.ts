import type { Chart, ReadonlyChart } from '../model/chart.ts';
import { calculateGreatestVPosition, updateMeasureBottom } from '../model/measure.ts';
import { cloneNote, equalsBMSE, equalsNT, type Note } from '../model/note.ts';
import { sortByVPositionInsertion } from '../model/sort.ts';
import { VbError } from '../vb.ts';
import { convertBMSE2NT, convertNT2BMSE, updatePairing } from './pairing.ts';
import { decreaseCurrentWAV, increaseCurrentWAV, type EditSession } from './session.ts';

export const opVoid = 0;
export const opAddNote = 1;
export const opRemoveNote = 2;
export const opChangeNote = 3;
export const opMoveNote = 4;
export const opLongNoteModify = 5;
export const opHiddenNoteModify = 6;
export const opRelabelNote = 7;
export const opRemoveAllNotes = 15;
export const opChangeMeasureLength = 16;
export const opChangeTimeSelection = 17;
export const opNT = 18;
export const opWavAutoincFlag = 20;
export const opChangeMeasure = 21;
export const opConversionState = 22;
export const opNoOperation = 255;

export interface ConversionSnapshot {
  readonly wav: readonly string[];
  readonly bmp: readonly string[];
  readonly notes: readonly Readonly<Note>[];
  readonly lnObj: number;
  readonly base62: boolean;
  readonly expansion: string;
  readonly stageFile: string;
  readonly banner: string;
  readonly backBMP: string;
}

export type UndoCommand =
  | { readonly op: 'void' }
  | { readonly op: 'addNote'; readonly note: Readonly<Note> }
  | { readonly op: 'removeNote'; readonly note: Readonly<Note> }
  | { readonly op: 'changeNote'; readonly note: Readonly<Note>; readonly nNote: Readonly<Note> }
  | {
      readonly op: 'moveNote';
      readonly note: Readonly<Note>;
      readonly nColumnIndex: number;
      readonly nVPosition: number;
    }
  | {
      readonly op: 'longNoteModify';
      readonly note: Readonly<Note>;
      readonly nVPosition: number;
      readonly nLongNote: number;
    }
  | { readonly op: 'hiddenNoteModify'; readonly note: Readonly<Note>; readonly nHidden: boolean }
  | { readonly op: 'relabelNote'; readonly note: Readonly<Note>; readonly nValue: number }
  | { readonly op: 'removeAllNotes' }
  | {
      readonly op: 'changeMeasureLength';
      readonly value: number;
      readonly indices: readonly number[];
    }
  | {
      readonly op: 'changeTimeSelection';
      readonly selStart: number;
      readonly selLength: number;
      readonly selHalf: number;
      readonly selected: boolean;
    }
  | { readonly op: 'nt'; readonly becomeNT: boolean; readonly autoConvert: boolean }
  | { readonly op: 'wavAutoincFlag'; readonly checked: boolean }
  | { readonly op: 'changeMeasure'; readonly measureLength: readonly number[] }
  | { readonly op: 'conversionState'; readonly state: ConversionSnapshot }
  | { readonly op: 'noOperation' };

export type UndoChain = readonly UndoCommand[];

export interface PerformContext {
  readonly session: EditSession;
  nEnabled(iCol: number): boolean;
  calculateTotalPlayableNotes?(chart: Chart): void;
  applyConversionState?(chart: Chart, state: ConversionSnapshot): void;
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
}

export function ofType(cmd: UndoCommand): number {
  switch (cmd.op) {
    case 'void':
      return opVoid;
    case 'addNote':
      return opAddNote;
    case 'removeNote':
      return opRemoveNote;
    case 'changeNote':
      return opChangeNote;
    case 'moveNote':
      return opMoveNote;
    case 'longNoteModify':
      return opLongNoteModify;
    case 'hiddenNoteModify':
      return opHiddenNoteModify;
    case 'relabelNote':
      return opRelabelNote;
    case 'removeAllNotes':
      return opRemoveAllNotes;
    case 'changeMeasureLength':
      return opChangeMeasureLength;
    case 'changeTimeSelection':
      return opChangeTimeSelection;
    case 'nt':
      return opNT;
    case 'wavAutoincFlag':
      return opWavAutoincFlag;
    case 'changeMeasure':
      return opChangeMeasure;
    case 'conversionState':
      return opConversionState;
    case 'noOperation':
      return opNoOperation;
    default:
      return assertNever(cmd);
  }
}

const vbAnd = (a: boolean, b: boolean): boolean => a && b;

export function findNoteIndex(
  chart: Pick<ReadonlyChart, 'notes' | 'ntInput'>,
  note: Readonly<Note>,
): number {
  let xI1: number;
  if (chart.ntInput) {
    for (xI1 = 1; xI1 <= chart.notes.length - 1; xI1++) {
      if (equalsNT(chart.notes[xI1]!, note)) return xI1;
    }
  } else {
    for (xI1 = 1; xI1 <= chart.notes.length - 1; xI1++) {
      if (equalsBMSE(chart.notes[xI1]!, note)) return xI1;
    }
  }
  return xI1;
}

export function performCommand(
  chart: Chart,
  chain: UndoChain,
  ctx: PerformContext,
  doc?: { isSaved: boolean },
): void {
  const session = ctx.session;
  for (let xI2 = 1; xI2 <= chart.notes.length - 1; xI2++) chart.notes[xI2]!.selected = false;
  session.beatSelection = [];

  for (const sCmd of chain) {
    switch (sCmd.op) {
      case 'addNote':
        chart.notes.push(cloneNote(sCmd.note));

        if (session.wavIncrease) increaseCurrentWAV(session, chart.base62);
        break;

      case 'removeNote': {
        const xI2 = findNoteIndex(chart, sCmd.note);

        if (xI2 < chart.notes.length) {
          for (let xI3 = xI2 + 1; xI3 <= chart.notes.length - 1; xI3++) {
            chart.notes[xI3 - 1] = chart.notes[xI3]!;
          }
          chart.notes.length -= 1;
        }

        if (session.wavIncrease) decreaseCurrentWAV(session);
        break;
      }

      case 'changeNote': {
        const xI2 = findNoteIndex(chart, sCmd.note);
        if (xI2 < chart.notes.length) chart.notes[xI2] = cloneNote(sCmd.note);
        break;
      }

      case 'moveNote': {
        const xI2 = findNoteIndex(chart, sCmd.note);

        if (xI2 < chart.notes.length) {
          const note = chart.notes[xI2]!;
          note.columnIndex = sCmd.nColumnIndex;
          note.vPosition = sCmd.nVPosition;
          note.selected = vbAnd(sCmd.note.selected, ctx.nEnabled(note.columnIndex));
        }
        break;
      }

      case 'longNoteModify': {
        const xI2 = findNoteIndex(chart, sCmd.note);

        if (xI2 < chart.notes.length) {
          const note = chart.notes[xI2]!;
          if (chart.ntInput) {
            note.vPosition = sCmd.nVPosition;
            note.length = sCmd.nLongNote;
          } else {
            note.longNote = sCmd.nLongNote !== 0;
          }
          note.selected = vbAnd(sCmd.note.selected, ctx.nEnabled(note.columnIndex));
        }
        break;
      }

      case 'hiddenNoteModify': {
        const xI2 = findNoteIndex(chart, sCmd.note);

        if (xI2 < chart.notes.length) {
          chart.notes[xI2]!.hidden = sCmd.nHidden;
          chart.notes[xI2]!.selected = vbAnd(
            sCmd.note.selected,
            ctx.nEnabled(chart.notes[xI2]!.columnIndex),
          );
        }
        break;
      }

      case 'relabelNote': {
        const xI2 = findNoteIndex(chart, sCmd.note);

        if (xI2 < chart.notes.length) {
          chart.notes[xI2]!.value = sCmd.nValue;
          chart.notes[xI2]!.selected = vbAnd(
            sCmd.note.selected,
            ctx.nEnabled(chart.notes[xI2]!.columnIndex),
          );
        }
        break;
      }

      case 'removeAllNotes':
        chart.notes.length = 1;
        break;

      case 'changeMeasureLength':
        for (const xM of sCmd.indices) {
          chart.measureLength[xM] = sCmd.value;
          if (!session.beatSelection.includes(xM)) {
            session.beatSelection = [...session.beatSelection, xM].sort((a, b) => a - b);
          }
        }
        updateMeasureBottom(chart);
        break;

      case 'changeMeasure':
        for (let xIM = 0; xIM <= sCmd.measureLength.length - 1; xIM++) {
          chart.measureLength[xIM] = sCmd.measureLength[xIM]!;
        }
        updateMeasureBottom(chart);
        break;

      case 'changeTimeSelection':
        session.vSelStart = sCmd.selStart;
        session.vSelLength = sCmd.selLength;
        session.vSelHalf = sCmd.selHalf;
        if (sCmd.selected) {
          const xSelLo = session.vSelStart + (session.vSelLength < 0 ? session.vSelLength : 0);
          const xSelHi = session.vSelStart + (session.vSelLength > 0 ? session.vSelLength : 0);
          for (let xI2 = 1; xI2 <= chart.notes.length - 1; xI2++) {
            const note = chart.notes[xI2]!;
            note.selected =
              note.vPosition >= xSelLo && note.vPosition < xSelHi && ctx.nEnabled(note.columnIndex);
          }
        }
        break;

      case 'nt':
        chart.ntInput = sCmd.becomeNT;

        session.bAdjustLength = false;
        session.bAdjustUpper = false;

        if (sCmd.autoConvert) {
          if (chart.ntInput) {
            convertBMSE2NT(chart);
          } else {
            convertNT2BMSE(chart);
          }
          ctx.calculateTotalPlayableNotes?.(chart);
        }
        break;

      case 'wavAutoincFlag':
        session.wavIncrease = sCmd.checked;
        break;

      case 'conversionState':
        if (ctx.applyConversionState === undefined) throw new VbError('NotImplemented');
        ctx.applyConversionState(chart, sCmd.state);
        break;

      case 'void':
        break;

      case 'noOperation':
        break;

      default:
        assertNever(sCmd);
    }
  }

  if (doc?.isSaved === true) doc.isSaved = false;

  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
  ctx.calculateTotalPlayableNotes?.(chart);
  calculateGreatestVPosition(chart);
}
