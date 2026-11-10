import type { ReadonlyChart } from '../../core/model/chart.ts';
import type { Note } from '../../core/model/note.ts';
import { cint } from '../../core/vb.ts';
import type { PanelPoint, TimeSelectionLine } from '../edit-state.ts';
import {
  getColumnWidth,
  horizontalPositionToDisplay,
  nLeft,
  noteRowToPanelHeight,
  type EditorView,
  type PanelIndex,
} from '../view.ts';

const single = Math.fround;

export interface PanelGeometry {
  readonly height: number;
  readonly xVS: number;
  readonly xHS: number;
}

export function panelGeometry(view: EditorView, panel: PanelIndex, height: number): PanelGeometry {
  const { vScroll, hScroll } = view.panels[panel];
  return { height, xVS: cint(vScroll), xHS: hScroll };
}

export interface HitOptions {
  readonly kHeight: number;
  readonly ntInput: boolean;
  readonly touchTolerance?: number;
}

export function mouseInNote(
  view: EditorView,
  o: HitOptions,
  g: PanelGeometry,
  x: number,
  y: number,
  note: Readonly<Note>,
): boolean {
  const left = nLeft(view, note.columnIndex);
  return (
    x >= horizontalPositionToDisplay(view, left, g.xHS) + 1 &&
    x <=
      horizontalPositionToDisplay(view, left + getColumnWidth(view, note.columnIndex), g.xHS) - 1 &&
    y >=
      noteRowToPanelHeight(view, note.vPosition + (o.ntInput ? note.length : 0), g.xVS, g.height) -
        o.kHeight -
        (o.touchTolerance ?? 0) &&
    y <= noteRowToPanelHeight(view, note.vPosition, g.xVS, g.height) + (o.touchTolerance ?? 0)
  );
}

export function topNoteAt(
  chart: Pick<ReadonlyChart, 'notes'>,
  view: EditorView,
  o: HitOptions,
  g: PanelGeometry,
  x: number,
  y: number,
  lowest: 0 | 1,
): number {
  for (let i = chart.notes.length - 1; i >= lowest; i--) {
    if (mouseInNote(view, o, g, x, y, chart.notes[i]!)) return i;
  }
  return -1;
}

export function firstNoteAt(
  chart: Pick<ReadonlyChart, 'notes'>,
  view: EditorView,
  o: HitOptions,
  g: PanelGeometry,
  x: number,
  y: number,
): number {
  for (let i = 1; i <= chart.notes.length - 1; i++) {
    if (mouseInNote(view, o, g, x, y, chart.notes[i]!)) return i;
  }
  return -1;
}

export interface ClickedNote {
  readonly index: number;
  readonly adjust?: { readonly bAdjustUpper: boolean; readonly bAdjustLength: boolean };
}

export function getClickedNote(
  chart: Pick<ReadonlyChart, 'notes'>,
  view: EditorView,
  o: HitOptions,
  g: PanelGeometry,
  x: number,
  y: number,
  shift: boolean,
): ClickedNote {
  const index = topNoteAt(chart, view, o, g, x, y, 0);
  if (index < 0 || !(o.ntInput && shift)) return { index };
  const note = chart.notes[index]!;
  const bAdjustUpper =
    y <= noteRowToPanelHeight(view, note.vPosition + note.length, g.xVS, g.height);
  const bAdjustLength =
    y >= noteRowToPanelHeight(view, note.vPosition, g.xVS, g.height) - o.kHeight || bAdjustUpper;
  return { index, adjust: { bAdjustUpper, bAdjustLength } };
}

export function panelYToVPositionSingle(
  view: EditorView,
  height: number,
  xVS: number,
  y: number,
): number {
  const g = view.gxHeight;
  return single(single(single(single(height - single(xVS * g)) - y) - 1) / g);
}

export function panelYToVPositionDouble(
  view: EditorView,
  panel: PanelIndex,
  height: number,
  y: number,
): number {
  const g = view.gxHeight;
  return (height - view.panels[panel].vScroll * g - y - 1) / g;
}

export interface TimeSelectionLines {
  readonly vSelStart: number;
  readonly vSelLength: number;
  readonly vSelHalf: number;
}

export function timeSelectionLineAt(
  view: EditorView,
  sel: TimeSelectionLines,
  g: PanelGeometry,
  y: number,
  delta: number,
): TimeSelectionLine {
  const row = (v: number): number => noteRowToPanelHeight(view, v, g.xVS, g.height);
  if (Math.abs(y - row(sel.vSelStart + sel.vSelLength)) <= delta) return 3;
  if (Math.abs(y - row(sel.vSelStart + sel.vSelHalf)) <= delta) return 2;
  if (Math.abs(y - row(sel.vSelStart)) <= delta) return 1;
  return 0;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function intersectsWith(a: Rect, b: Rect): boolean {
  return b.x < a.x + a.width && a.x < b.x + b.width && b.y < a.y + a.height && a.y < b.y + b.height;
}

export function selectionBoxRect(anchor: PanelPoint, current: PanelPoint): Rect {
  return {
    x: cint(current.x > anchor.x ? anchor.x : current.x),
    y: cint(current.y > anchor.y ? anchor.y : current.y),
    width: cint(Math.abs(single(current.x - anchor.x))),
    height: cint(Math.abs(single(current.y - anchor.y))),
  };
}

export function noteBoxRect(
  view: EditorView,
  o: HitOptions,
  g: PanelGeometry,
  note: Readonly<Note>,
): Rect {
  const ntLength = o.ntInput ? note.length : 0;
  return {
    x: horizontalPositionToDisplay(view, nLeft(view, note.columnIndex), g.xHS) + 1,
    y: noteRowToPanelHeight(view, note.vPosition + ntLength, g.xVS, g.height) - o.kHeight,
    width: cint(single(single(getColumnWidth(view, note.columnIndex) * view.gxWidth) - 2)),
    height: o.kHeight + cint(ntLength * view.gxHeight),
  };
}

export function columnAtXRaw(view: EditorView, x: number, xHS: number): number {
  const mLeft = cint(single(single(x / view.gxWidth) + xHS));
  if (mLeft < 0) return 0;
  for (let xI1 = 0; ; xI1++) {
    if (mLeft < nLeft(view, xI1 + 1) || xI1 >= view.gColumns) return xI1;
  }
}
