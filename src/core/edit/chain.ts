import type { ReadonlyChart } from '../model/chart.ts';
import { cloneNote, type Note } from '../model/note.ts';
import type { UndoChain, UndoCommand } from './commands.ts';

export { lastRedo } from './undo.ts';

export class UndoChainBuilder {
  private readonly undoPrepended: UndoCommand[] = [];
  private readonly redoAppended: UndoCommand[] = [];

  prependUndo(cmd: UndoCommand): void {
    this.undoPrepended.push(cmd);
  }

  appendRedo(cmd: UndoCommand): void {
    this.redoAppended.push(cmd);
  }

  undoHead(): UndoChain | null {
    return this.undoPrepended.length > 0 ? [...this.undoPrepended].reverse() : null;
  }

  redoHead(): UndoChain | null {
    return this.redoAppended.length > 0 ? [...this.redoAppended] : null;
  }

  redoTail(): UndoChain | null {
    const last = this.redoAppended.at(-1);
    return last === undefined ? null : [last];
  }
}

export function redoAddNote(b: UndoChainBuilder, note: Readonly<Note>): void {
  b.prependUndo({ op: 'removeNote', note: cloneNote(note) });
  b.appendRedo({ op: 'addNote', note: cloneNote(note) });
}

export function redoAddNoteSelected(b: UndoChainBuilder, notes: readonly Readonly<Note>[]): void {
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    if (!notes[xI1]!.selected) continue;

    redoAddNote(b, notes[xI1]!);
  }
}

export function redoAddNoteAll(b: UndoChainBuilder, notes: readonly Readonly<Note>[]): void {
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    b.appendRedo({ op: 'addNote', note: cloneNote(notes[xI1]!) });
  }
  b.prependUndo({ op: 'removeAllNotes' });
}

export function redoRemoveNote(b: UndoChainBuilder, xN: Readonly<Note>): void {
  b.prependUndo({ op: 'addNote', note: cloneNote(xN) });
  b.appendRedo({ op: 'removeNote', note: cloneNote(xN) });
}

export function redoRemoveNoteSelected(
  b: UndoChainBuilder,
  notes: readonly Readonly<Note>[],
): void {
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    if (!notes[xI1]!.selected || notes[xI1]!.ghost) continue;
    redoRemoveNote(b, notes[xI1]!);
  }
}

export function redoRemoveNoteAll(b: UndoChainBuilder, notes: readonly Readonly<Note>[]): void {
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    b.prependUndo({ op: 'addNote', note: cloneNote(notes[xI1]!) });
  }
  b.appendRedo({ op: 'removeAllNotes' });
}

export function redoChangeNote(
  b: UndoChainBuilder,
  note1: Readonly<Note>,
  note2: Readonly<Note>,
): void {
  b.prependUndo({ op: 'changeNote', note: cloneNote(note2), nNote: cloneNote(note1) });
  b.appendRedo({ op: 'changeNote', note: cloneNote(note1), nNote: cloneNote(note2) });
}

export function redoMoveNote(
  b: UndoChainBuilder,
  note: Readonly<Note>,
  nCol: number,
  nVPos: number,
): void {
  const noteAfterModification = cloneNote(note);
  noteAfterModification.columnIndex = nCol;
  noteAfterModification.vPosition = nVPos;
  b.prependUndo({
    op: 'moveNote',
    note: noteAfterModification,
    nColumnIndex: note.columnIndex,
    nVPosition: note.vPosition,
  });
  b.appendRedo({ op: 'moveNote', note: cloneNote(note), nColumnIndex: nCol, nVPosition: nVPos });
}

export function redoLongNoteModify(
  b: UndoChainBuilder,
  note: Readonly<Note>,
  nVPos: number,
  nLong: number,
): void {
  const n = cloneNote(note);
  n.vPosition = nVPos;
  n.length = nLong;

  b.prependUndo({
    op: 'longNoteModify',
    note: n,
    nVPosition: note.vPosition,
    nLongNote: note.length,
  });
  b.appendRedo({
    op: 'longNoteModify',
    note: cloneNote(note),
    nVPosition: nVPos,
    nLongNote: n.length,
  });
}

export function redoLongNoteModifyLongNote(
  b: UndoChainBuilder,
  note: Readonly<Note>,
  nVPos: number,
  nLongB: boolean,
): void {
  const n = cloneNote(note);
  n.vPosition = nVPos;
  n.longNote = nLongB;

  b.prependUndo({
    op: 'longNoteModify',
    note: n,
    nVPosition: note.vPosition,
    nLongNote: note.length,
  });
  b.appendRedo({
    op: 'longNoteModify',
    note: cloneNote(note),
    nVPosition: nVPos,
    nLongNote: n.length,
  });
}

export function redoHiddenNoteModify(
  b: UndoChainBuilder,
  xN: Readonly<Note>,
  nHide: boolean,
): void {
  const noteAfterModification = cloneNote(xN);
  noteAfterModification.hidden = nHide;
  b.prependUndo({ op: 'hiddenNoteModify', note: noteAfterModification, nHidden: xN.hidden });
  b.appendRedo({ op: 'hiddenNoteModify', note: cloneNote(xN), nHidden: nHide });
}

export function redoRelabelNote(b: UndoChainBuilder, xN: Readonly<Note>, nVal: number): void {
  const noteAfterModification = cloneNote(xN);
  noteAfterModification.value = nVal;
  b.prependUndo({ op: 'relabelNote', note: noteAfterModification, nValue: xN.value });
  b.appendRedo({ op: 'relabelNote', note: cloneNote(xN), nValue: nVal });
}

const doubleEquals = (a: number, b: number): boolean =>
  a === b || (Number.isNaN(a) && Number.isNaN(b));

export function redoChangeMeasureLengthSelected(
  b: UndoChainBuilder,
  chart: Pick<ReadonlyChart, 'measureLength'>,
  beatSelection: readonly number[],
  nVal: number,
): void {
  const xIndices = [...beatSelection];
  if (xIndices.length === 0) return;

  const xmLen: number[] = [];
  const xUndo: { value: number; indices: number[] }[] = [];
  for (const xI1 of xIndices) {
    const xI = xmLen.findIndex((len) => doubleEquals(len, chart.measureLength[xI1]!));
    if (xI === -1) {
      xmLen.push(chart.measureLength[xI1]!);
      xUndo.push({ value: chart.measureLength[xI1]!, indices: [xI1] });
    } else {
      xUndo[xI]!.indices.push(xI1);
    }
  }
  for (let xI1 = xUndo.length - 1; xI1 >= 0; xI1--) {
    b.prependUndo({
      op: 'changeMeasureLength',
      value: xUndo[xI1]!.value,
      indices: [...xUndo[xI1]!.indices],
    });
  }

  b.appendRedo({ op: 'changeMeasureLength', value: nVal, indices: [...xIndices] });
}

export function redoChangeMeasure(
  b: UndoChainBuilder,
  measureLength0: readonly number[],
  measureLength1: readonly number[],
): void {
  b.prependUndo({ op: 'changeMeasure', measureLength: [...measureLength0] });
  b.appendRedo({ op: 'changeMeasure', measureLength: [...measureLength1] });
}

export function redoChangeTimeSelection(
  b: UndoChainBuilder,
  pStart: number,
  pLen: number,
  pHalf: number,
  nStart: number,
  nLen: number,
  nHalf: number,
  xSel: boolean,
): void {
  b.prependUndo({
    op: 'changeTimeSelection',
    selStart: pStart,
    selLength: pLen,
    selHalf: pHalf,
    selected: xSel,
  });
  b.appendRedo({
    op: 'changeTimeSelection',
    selStart: nStart,
    selLength: nLen,
    selHalf: nHalf,
    selected: xSel,
  });
}

export function redoNT(b: UndoChainBuilder, becomeNT: boolean, autoConvert: boolean): void {
  b.prependUndo({ op: 'nt', becomeNT: !becomeNT, autoConvert });
  b.appendRedo({ op: 'nt', becomeNT, autoConvert });
}

export function redoWavIncrease(b: UndoChainBuilder, wavinc: boolean): void {
  b.prependUndo({ op: 'wavAutoincFlag', checked: !wavinc });
  b.appendRedo({ op: 'wavAutoincFlag', checked: wavinc });
}
