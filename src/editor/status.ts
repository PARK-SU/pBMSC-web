import { c10to36, c10toId } from '../core/bms/base.ts';
import { add3Zeros } from '../core/bms/decimal.ts';
import type { EditSession } from '../core/edit/session.ts';
import type { ReadonlyChart } from '../core/model/chart.ts';
import { measureAtDisplacement } from '../core/model/measure.ts';
import { timeFromVPosition, type TempoMap } from '../core/time/timing.ts';
import { cint, gcdDouble, intDiv, toDotNetFixed, toDotNetString } from '../core/vb.ts';
import { mouseMoveStatusPoint, type EditState } from './edit-state.ts';
import type { KeyModifiers } from './input/modifiers.ts';
import { getColumn, getColumnAtX, getMouseVPosition, nTitle, type EditorView } from './view.ts';

export type StatusColor = 'olive' | 'blue' | 'red' | 'green';

export interface StatusBarModel {
  readonly strip: 'main' | 'timeSelect';
  readonly selectionInfo: string;
  readonly column: string;
  readonly noteIndex: string;
  readonly measure: string;
  readonly gridResolution: string;
  readonly reducedResolution: string;
  readonly measureResolution: string;
  readonly absolutePosition: string;
  readonly time: string;
  readonly noteKind: { readonly text: string; readonly color: StatusColor };
  readonly error: string;
  readonly selStart: string;
  readonly selLength: string;
  readonly selHalf: string;
}

export const initialStatusBar: StatusBarModel = {
  strip: 'main',
  selectionInfo: '-',
  column: 'BPM',
  noteIndex: '01',
  measure: '000',
  gridResolution: '9.41176470588235 / 9999',
  reducedResolution: '9999 / 9999',
  measureResolution: '112.941176470588 / 9999',
  absolutePosition: '112.941176470588',
  time: '00:00:000',
  noteKind: { text: 'Length = 0', color: 'olive' },
  error: 'Error',
  selStart: '0',
  selLength: '0',
  selHalf: '0',
};

export interface StatusStrings {
  readonly note: string;
  readonly longNote: string;
  readonly hidden: string;
  readonly landmine: string;
  readonly comment: string;
  readonly approximate: string;
  readonly err: string;
  readonly errTechnical: string;
  readonly beats: string;
}

export const defaultStatusStrings: StatusStrings = {
  note: 'Note',
  longNote: 'LongNote',
  hidden: 'Hidden',
  landmine: 'Landmine',
  comment: 'Comment',
  approximate: 'Approx.',
  err: 'Error',
  errTechnical: 'Technical Error',
  beats: 'Beats',
};

export type StatusEditFields = Pick<
  EditState,
  'tool' | 'kMouseOver' | 'mouseMoveStatus' | 'selectedColumn' | 'tempVPosition' | 'tempLength'
>;

export interface StatusInput<E extends StatusEditFields> {
  readonly chart: ReadonlyChart;
  readonly view: EditorView;
  readonly edit: E;
  readonly session: Pick<EditSession, 'vSelStart' | 'vSelLength' | 'vSelHalf' | 'currentWav'>;
  readonly tempo: TempoMap;
  readonly panelHeight: number;
  readonly bmsGridLimit: number;
  readonly modifiers: Pick<KeyModifiers, 'ctrl' | 'shift'>;
  readonly strings: StatusStrings;
}

type PositionTexts = Pick<
  StatusBarModel,
  | 'gridResolution'
  | 'reducedResolution'
  | 'measureResolution'
  | 'absolutePosition'
  | 'time'
  | 'measure'
>;

function positionTexts(
  chart: ReadonlyChart,
  view: EditorView,
  tempo: TempoMap,
  bmsGridLimit: number,
  vPosition: number,
): PositionTexts {
  const xMeasure = measureAtDisplacement(chart, vPosition);
  const xMLength = chart.measureLength[xMeasure]!;
  const xVposMod = vPosition - chart.measureBottom[xMeasure]!;
  const xGCD = gcdDouble(xVposMod === 0 ? xMLength : xVposMod, xMLength, bmsGridLimit);

  const gridResolution =
    toDotNetString((xVposMod * view.gDivide) / 192) +
    ' / ' +
    toDotNetString((xMLength * view.gDivide) / 192) +
    '  ';
  const measureResolution = toDotNetString(xVposMod) + ' / ' + toDotNetString(xMLength) + '  ';
  const reducedResolution =
    String(cint(xVposMod / xGCD)) + ' / ' + String(cint(xMLength / xGCD)) + '  ';
  return {
    gridResolution,
    measureResolution,
    reducedResolution,
    absolutePosition: toDotNetString(vPosition) + '  ',
    time: toDotNetFixed(timeFromVPosition(tempo, vPosition), 4),
    measure: add3Zeros(xMeasure),
  };
}

function noteAt(chart: ReadonlyChart, i: number): ReadonlyChart['notes'][number] {
  const note = chart.notes[i];
  if (note === undefined) throw new RangeError(`Notes(${i}) is out of range`);
  return note;
}

export function poStatusRefresh<E extends StatusEditFields>(
  prev: StatusBarModel,
  input: StatusInput<E>,
): { readonly status: StatusBarModel; readonly edit: E } {
  const { chart, view, edit, tempo, bmsGridLimit, strings } = input;
  const strip: StatusBarModel['strip'] = edit.tool === 'timeSelect' ? 'timeSelect' : 'main';
  const base: StatusBarModel = prev.strip === strip ? prev : { ...prev, strip };
  const times = (a: number, b: number): string =>
    toDotNetString(timeFromVPosition(tempo, a) - timeFromVPosition(tempo, b));

  if (edit.tool === 'select') {
    const xI1 = edit.kMouseOver;
    if (xI1 < 0) {
      const mouse = mouseMoveStatusPoint(edit);
      const tempVPosition = getMouseVPosition(chart, view, input.panelHeight, mouse.y, view.gSnap);
      const selectedColumn = getColumnAtX(view, mouse.x, view.panels[view.focus].hScroll);
      const status: StatusBarModel = {
        ...base,
        ...positionTexts(chart, view, tempo, bmsGridLimit, tempVPosition),
        column: nTitle(view, selectedColumn),
        noteIndex: '',
        noteKind: { text: '', color: base.noteKind.color },
        error: '',
      };
      return { status, edit: { ...edit, tempVPosition, selectedColumn } };
    }
    if (xI1 > chart.notes.length - 1) return { status: base, edit };

    const note = noteAt(chart, xI1);
    const positions = positionTexts(chart, view, tempo, bmsGridLimit, note.vPosition);
    const numericText = toDotNetString(note.value / 10000);
    const labelText = note.landmine
      ? c10to36(intDiv(note.value, 10000))
      : c10toId(intDiv(note.value, 10000), chart.base62);
    const noteIndex = getColumn(view, note.columnIndex).isNumeric ? numericText : labelText;

    let noteKind: StatusBarModel['noteKind'];
    if (note.length > 0) {
      noteKind = {
        color: 'olive',
        text:
          `${strings.longNote} ${toDotNetString((note.length / 192) * 4)} ${strings.beats} ` +
          `(${times(note.vPosition + note.length, note.vPosition)}s)`,
      };
    } else if (note.lnPair !== 0) {
      const pair = noteAt(chart, note.lnPair);
      const beats = (Math.abs(note.vPosition - pair.vPosition) / 192) * 4;
      const seconds = Math.abs(
        timeFromVPosition(tempo, pair.vPosition) - timeFromVPosition(tempo, note.vPosition),
      );
      noteKind = {
        color: 'olive',
        text: `${strings.longNote} ${toDotNetString(beats)} ${strings.beats} (${toDotNetString(seconds)}s)`,
      };
    } else if (note.longNote) {
      noteKind = { color: 'olive', text: strings.longNote };
    } else if (note.hidden) {
      noteKind = { color: 'blue', text: strings.hidden };
    } else if (note.landmine) {
      noteKind = { color: 'red', text: strings.landmine };
    } else if (note.comment) {
      noteKind = { color: 'green', text: strings.comment };
    } else {
      noteKind = { color: 'olive', text: strings.note };
    }

    let error = base.error;
    if (note.hasError) {
      if (note.errorType === 0) error = strings.err;
      else if (note.errorType === 1) error = strings.errTechnical;
    } else {
      error = '';
    }

    const status: StatusBarModel = {
      ...base,
      ...positions,
      column: nTitle(view, note.columnIndex),
      noteIndex,
      noteKind,
      error,
    };
    return { status, edit };
  }

  if (edit.tool === 'write') {
    if (edit.selectedColumn < 0) return { status: base, edit };

    const { ctrl, shift } = input.modifiers;
    const positions = positionTexts(chart, view, tempo, bmsGridLimit, edit.tempVPosition);
    const wavId = input.session.currentWav + 1;
    const noteIndex = shift && ctrl ? c10to36(wavId) : c10toId(wavId, chart.base62);

    let noteKind = base.noteKind;
    if (edit.tempLength > 0) {
      noteKind = {
        color: 'olive',
        text:
          `${strings.longNote} ${toDotNetString((edit.tempLength / 192) * 4)} ${strings.beats} ` +
          `(${strings.approximate} ${times(edit.tempVPosition + edit.tempLength, edit.tempVPosition)}s)`,
      };
    } else if (ctrl && shift) {
      noteKind = { color: 'red', text: strings.landmine };
    } else if (shift && !chart.ntInput) {
      noteKind = { color: 'olive', text: strings.longNote };
    } else if (ctrl) {
      noteKind = { color: 'blue', text: strings.hidden };
    }

    const status: StatusBarModel = {
      ...base,
      ...positions,
      column: nTitle(view, edit.selectedColumn),
      noteIndex,
      noteKind,
    };
    return { status, edit };
  }

  const status: StatusBarModel = {
    ...base,
    selStart: toDotNetString(input.session.vSelStart),
    selLength: toDotNetString(input.session.vSelLength),
    selHalf: toDotNetString(input.session.vSelHalf),
  };
  return { status, edit };
}
