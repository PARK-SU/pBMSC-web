import { validateSelection } from '../../../core/edit/selection.ts';
import type { EditSession } from '../../../core/edit/session.ts';
import type { Chart } from '../../../core/model/chart.ts';
import { getMaxVPosition } from '../../../core/model/measure.ts';
import type { Note } from '../../../core/model/note.ts';
import { snapToGrid } from '../../view.ts';
import { hitOptions, isEnabled, type InputDraft, type PanelMouseEvent } from '../events.ts';
import {
  panelYToVPositionSingle,
  timeSelectionLineAt,
  topNoteAt,
  type PanelGeometry,
} from '../hit.ts';
import { modifierLongNoteActive } from '../modifiers.ts';

export function validateTimeSelection(d: InputDraft): void {
  const s = d.session;
  const sel = validateSelection(
    { start: s.vSelStart, length: s.vSelLength, half: s.vSelHalf },
    getMaxVPosition(d.chart),
  );
  s.vSelStart = sel.start;
  s.vSelLength = sel.length;
  s.vSelHalf = sel.half;
}

export function timeSelectDown(
  d: InputDraft,
  e: PanelMouseEvent,
  g: PanelGeometry,
  noteIndex: number,
): void {
  const chart = d.chart;
  const view = d.view;
  const s = d.session;
  const snap = (v: number): number => snapToGrid(chart, view, v);

  const xL1 =
    noteIndex >= 0
      ? chart.notes[noteIndex]!.vPosition
      : panelYToVPositionSingle(view, g.height, g.xVS, e.y);

  d.drag.vSelAdjust = modifierLongNoteActive(e.modifiers);

  d.edit.vSelMouseOverLine = timeSelectionLineAt(view, s, g, e.y, d.visual.peDeltaMouseOver);
  const line = d.edit.vSelMouseOverLine;

  if (!d.drag.vSelAdjust || line !== 0) {
    const snapIf = view.gSnap && noteIndex <= 0;
    if (line === 1) {
      const xV = snapIf ? snap(xL1) : xL1;
      s.vSelLength += s.vSelStart - xV;
      s.vSelHalf += s.vSelStart - xV;
      s.vSelStart = xV;
    } else if (line === 2) {
      s.vSelHalf = xL1;
      if (snapIf) s.vSelHalf = snap(s.vSelHalf);
      s.vSelHalf -= s.vSelStart;
    } else if (line === 3) {
      s.vSelLength = xL1;
      if (snapIf) s.vSelLength = snap(s.vSelLength);
      s.vSelLength -= s.vSelStart;
    } else {
      s.vSelLength = 0;
      s.vSelStart = xL1;
      if (snapIf) s.vSelStart = snap(s.vSelStart);
    }
    validateTimeSelection(d);
  } else {
    s.vSelLength = xL1;
    if (view.gSnap && noteIndex <= 0 && !e.modifiers.ctrl) s.vSelLength = snap(s.vSelLength);
    s.vSelLength -= s.vSelStart;
  }

  selectByTimeRange(chart, s, isEnabled(d));
  d.chartChanged = true;
}

export function onTimeSelectClick(d: InputDraft, e: PanelMouseEvent, g: PanelGeometry): void {
  const chart = d.chart;
  const notes: readonly Note[] = chart.notes;
  const view = d.view;
  const s = d.session;
  const ctrl = e.modifiers.ctrl;
  const snap = (v: number): number => snapToGrid(chart, view, v);
  const line = d.edit.vSelMouseOverLine;

  const xITemp = topNoteAt(chart, view, hitOptions(d), g, e.x, e.y, 0);
  const yV = (): number => panelYToVPositionSingle(view, g.height, g.xVS, e.y);

  if (!d.drag.vSelAdjust || line !== 0) {
    const snap3 = view.gSnap && xITemp <= 0 && !ctrl;
    if (line === 1) {
      let xV = yV();
      if (xITemp >= 0) xV = notes[xITemp]!.vPosition;
      if (snap3) xV = snap(xV);
      s.vSelLength += s.vSelStart - xV;
      s.vSelHalf += s.vSelStart - xV;
      s.vSelStart = xV;
    } else if (line === 2) {
      s.vSelHalf = yV();
      if (xITemp >= 0) s.vSelHalf = notes[xITemp]!.vPosition;
      if (snap3) s.vSelHalf = snap(s.vSelHalf);
      s.vSelHalf -= s.vSelStart;
    } else if (line === 3) {
      s.vSelLength = yV();
      if (xITemp >= 0) s.vSelLength = notes[xITemp]!.vPosition;
      if (snap3) s.vSelLength = snap(s.vSelLength);
      s.vSelLength -= s.vSelStart;
    } else {
      if (xITemp >= 0) {
        s.vSelLength = notes[xITemp]!.vPosition;
      } else {
        s.vSelLength = yV();
        if (view.gSnap && !ctrl) s.vSelLength = snap(s.vSelLength);
      }
      s.vSelLength -= s.vSelStart;
      s.vSelHalf = s.vSelLength / 2;
    }
    validateTimeSelection(d);
  } else {
    s.vSelLength = yV();
    if (view.gSnap && !ctrl) s.vSelLength = snap(s.vSelLength);
    if (xITemp >= 0) s.vSelLength = notes[xITemp]!.vPosition;
    s.vSelLength -= s.vSelStart;
    validateTimeSelection(d);
  }

  selectByTimeRange(chart, s, isEnabled(d));
  d.chartChanged = true;
}

export function selectByTimeRange(
  chart: Chart,
  s: Pick<EditSession, 'vSelStart' | 'vSelLength'>,
  isColumnEnabled: (iCol: number) => boolean,
): void {
  const notes: readonly Note[] = chart.notes;
  if (s.vSelLength > 0) {
    const xVLower = s.vSelLength > 0 ? s.vSelStart : s.vSelStart + s.vSelLength;
    const xVUpper = s.vSelLength < 0 ? s.vSelStart : s.vSelStart + s.vSelLength;
    if (chart.ntInput) {
      for (let xI2 = 1; xI2 <= notes.length - 1; xI2++) {
        const note = notes[xI2]!;
        note.selected =
          note.vPosition < xVUpper &&
          note.vPosition + note.length >= xVLower &&
          isColumnEnabled(note.columnIndex);
      }
    } else {
      for (let xI2 = 1; xI2 <= notes.length - 1; xI2++) {
        const note = notes[xI2]!;
        note.selected =
          note.vPosition >= xVLower &&
          note.vPosition < xVUpper &&
          isColumnEnabled(note.columnIndex);
      }
    }
  } else {
    for (let xI2 = 1; xI2 <= notes.length - 1; xI2++) notes[xI2]!.selected = false;
  }
}
