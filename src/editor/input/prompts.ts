import { cIdto10 } from '../../core/bms/base.ts';
import {
  redoAddNote,
  redoRelabelNote,
  redoRemoveNote,
  UndoChainBuilder,
} from '../../core/edit/chain.ts';
import { updatePairing } from '../../core/edit/pairing.ts';
import { addCommentLine, swapGhostNotes } from '../../core/edit/random.ts';
import { isColumnNumeric } from '../../core/model/column.ts';
import { niBPM, niSCROLL, niSTOP } from '../../core/model/constants.ts';
import { calculateGreatestVPosition } from '../../core/model/measure.ts';
import { cloneNote, newNote, type Note } from '../../core/model/note.ts';
import { sortByVPositionInsertion } from '../../core/model/sort.ts';
import {
  cint,
  clng,
  doubleTryParse,
  mid,
  startsWithCulture,
  trimVB,
  ucase,
  VbError,
} from '../../core/vb.ts';
import {
  calculateTotalPlayableNotes,
  draftAddNote,
  draftAddUndo,
  runInput,
  type InputContext,
  type InputDraft,
  type InputResult,
} from './events.ts';

export type PromptMessage =
  'PromptEnterNumeric' | 'PromptEnterBPM' | 'PromptEnterSTOP' | 'PromptEnterSCROLL' | 'PromptEnter';

export type PromptRequest =
  | {
      readonly kind: 'writeNumeric';
      readonly mode: 'NT' | 'BMSE';
      readonly column: number;
      readonly vPosition: number;
      readonly hidden: boolean;
      readonly longNote: 0 | 1;
      readonly message: PromptMessage;
    }
  | {
      readonly kind: 'editNumeric';
      readonly noteIndex: number;
      readonly note: Readonly<Note>;
      readonly message: PromptMessage;
    }
  | {
      readonly kind: 'editLabel';
      readonly noteIndex: number;
      readonly note: Readonly<Note>;
      readonly base62: boolean;
    }
  | {
      readonly kind: 'editComment';
      readonly noteIndex: number;
      readonly note: Readonly<Note>;
      readonly commentIndex: number;
      readonly defaultText: string;
    };

export function promptMessage(request: PromptRequest): PromptMessage {
  return request.kind === 'writeNumeric' || request.kind === 'editNumeric'
    ? request.message
    : 'PromptEnter';
}

export function promptDefaultText(request: PromptRequest): string {
  return request.kind === 'editComment' ? request.defaultText : '';
}

export function numericPromptMessage(column: number): PromptMessage {
  let xMessage: PromptMessage = 'PromptEnterNumeric';
  if (column === niBPM) xMessage = 'PromptEnterBPM';
  if (column === niSTOP) xMessage = 'PromptEnterSTOP';
  if (column === niSCROLL) xMessage = 'PromptEnterSCROLL';
  return xMessage;
}

export type NumericAnswer =
  | { readonly kind: 'comment'; readonly text: string }
  | { readonly kind: 'value'; readonly value: number }
  | undefined;

export function numericPromptValue(valstr: string, column: number): number | undefined {
  const valstrDbl = doubleTryParse(valstr);
  if (valstrDbl === undefined) return undefined;
  const promptValue = clng(valstrDbl * 10000);
  if (!((column === niSCROLL && valstr === '0') || promptValue !== 0)) return undefined;
  return promptValue;
}

export function parseNumericAnswer(valstr: string, column: number): NumericAnswer {
  if (startsWithCulture(valstr, '-c ')) {
    if (valstr === '-c ') valstr += ' ';
    return { kind: 'comment', text: mid(valstr, 4) };
  }
  const value = numericPromptValue(valstr, column);
  return value === undefined ? undefined : { kind: 'value', value };
}

export function isBase36(str: string): boolean {
  return /^[A-Za-z0-9]+\n?$/.test(str);
}

export function parseLabelAnswer(answer: string, base62: boolean): number | 'invalid' | undefined {
  let xStr = trimVB(answer);
  if (!base62) xStr = ucase(xStr);
  if (xStr.length === 0) return undefined;
  if (isBase36(xStr) && !(xStr === '00' || xStr === '0')) return cIdto10(xStr, base62) * 10000;
  return 'invalid';
}

export const ghostNoteMessage =
  'To modify ghost notes, please select only one section from the expansion code.';

const headerBPMMinimum = 1;
const headerBPMMaximum = 655359999;

export function doubleClickNoteIndex(d: InputDraft, noteIndex: number): void {
  const chart = d.chart;
  const note = cloneNote(chart.notes[noteIndex]!);
  const noteColumn = note.columnIndex;

  if (chart.ghostMode === 1 && note.ghost) {
    swapGhostNotes(chart);
    chart.ghostMode = 2;
    d.chartChanged = true;
    return;
  }
  if (chart.ghostMode === 2 && note.ghost) {
    swapGhostNotes(chart);
    chart.ghostMode = 1;
    d.chartChanged = true;
    return;
  }
  if (note.ghost) {
    d.message = { kind: 'text', text: ghostNoteMessage };
    return;
  }

  if (note.comment) {
    const commentIndex = cint(note.value / 10000);
    if (commentIndex < 0 || commentIndex >= chart.hCOM.length) {
      throw new RangeError(`hCOM(${commentIndex}) is out of range`);
    }
    d.prompt = {
      kind: 'editComment',
      noteIndex,
      note,
      commentIndex,
      defaultText: chart.hCOM[commentIndex] ?? '',
    };
  } else if (isColumnNumeric(noteColumn)) {
    d.prompt = { kind: 'editNumeric', noteIndex, note, message: numericPromptMessage(noteColumn) };
  } else {
    d.prompt = { kind: 'editLabel', noteIndex, note, base62: chart.base62 && !note.landmine };
  }
}

export function applyPrompt(
  ctx: InputContext,
  request: PromptRequest,
  answer: string,
): InputResult {
  return runInput(ctx, (d) => {
    switch (request.kind) {
      case 'writeNumeric':
        writeNumeric(d, request, answer);
        break;
      case 'editNumeric':
        editNumeric(d, request, answer);
        break;
      case 'editLabel':
        editLabel(d, request, answer);
        break;
      case 'editComment':
        editComment(d, request, answer);
        break;
    }
  });
}

function writeNumeric(
  d: InputDraft,
  request: Extract<PromptRequest, { kind: 'writeNumeric' }>,
  valstr: string,
): void {
  const chart = d.chart;
  const { column: xColumn, vPosition: xVPosition, mode } = request;
  const b = new UndoChainBuilder();
  const answer = parseNumericAnswer(valstr, xColumn);
  if (answer?.kind === 'comment') {
    for (let xI1 = 1; xI1 <= chart.notes.length - 1; xI1++) {
      const note = chart.notes[xI1]!;
      if (note.vPosition === xVPosition && note.columnIndex === xColumn) redoRemoveNote(b, note);
    }
    addCommentLine(chart, answer.text);
    d.chartChanged = true;

    const n = newNote(
      xColumn,
      xVPosition,
      chart.hCOMNum * 10000,
      0,
      request.hidden,
      false,
      false,
      false,
      true,
    );
    redoAddNote(b, n);
    draftAddNote(d, n);
    draftAddUndo(d, b.undoHead(), b.redoHead());
  } else if (answer?.kind === 'value') {
    for (let xI1 = 1; xI1 <= chart.notes.length - 1; xI1++) {
      const note = chart.notes[xI1]!;
      if (note.vPosition === xVPosition && note.columnIndex === xColumn) redoRemoveNote(b, note);
    }
    const longNote = mode === 'NT' ? 0 : request.longNote;
    const n = newNote(xColumn, xVPosition, answer.value, longNote, request.hidden);
    redoAddNote(b, n);
    draftAddNote(d, n);
    draftAddUndo(d, b.undoHead(), b.redoHead());
  }

  if (mode === 'NT') {
    d.edit.shouldDrawTempNote = true;
    sortByVPositionInsertion(chart.notes);
    updatePairing(chart);
    calculateTotalPlayableNotes(d);
    d.status = true;
  } else {
    calculateGreatestVPosition(chart);
  }
  d.chartChanged = true;
  d.redraw = true;
}

function editNumeric(
  d: InputDraft,
  request: Extract<PromptRequest, { kind: 'editNumeric' }>,
  valstr: string,
): void {
  const chart = d.chart;
  const { noteIndex, note } = request;
  const promptValue = numericPromptValue(valstr, note.columnIndex);
  if (promptValue !== undefined) {
    const b = new UndoChainBuilder();
    redoRelabelNote(b, note, promptValue);
    if (noteIndex === 0) {
      if (promptValue < headerBPMMinimum || promptValue > headerBPMMaximum) {
        throw new VbError('Argument');
      }
      if (chart.notes[0]!.value !== promptValue) {
        chart.notes[0]!.value = promptValue;
        if (d.doc.isSaved) d.doc.isSaved = false;
      }
    } else {
      chart.notes[noteIndex]!.value = promptValue;
    }
    d.chartChanged = true;
    draftAddUndo(d, b.undoHead(), b.redoHead());
  }
  d.redraw = true;
  d.status = true;
}

function editLabel(
  d: InputDraft,
  request: Extract<PromptRequest, { kind: 'editLabel' }>,
  answer: string,
): void {
  const value = parseLabelAnswer(answer, request.base62);
  if (value === 'invalid') {
    d.message = { kind: 'invalidLabel' };
  } else if (value !== undefined) {
    const b = new UndoChainBuilder();
    redoRelabelNote(b, request.note, value);
    d.chart.notes[request.noteIndex]!.value = value;
    d.chartChanged = true;
    draftAddUndo(d, b.undoHead(), b.redoHead());
  }
  d.redraw = true;
  d.status = true;
}

function editComment(
  d: InputDraft,
  request: Extract<PromptRequest, { kind: 'editComment' }>,
  answer: string,
): void {
  let valstr = answer;
  if (valstr === '') valstr = ' ';
  d.chart.hCOM[request.commentIndex] = valstr;
  d.chartChanged = true;
  d.redraw = true;
  d.status = true;
}
