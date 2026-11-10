import { c10to36, c10toId, MaxId36 } from '../../core/bms/base.ts';
import { isLabelMatch } from '../../core/edit/selection.ts';
import type { ReadonlyChart } from '../../core/model/chart.ts';
import { isColumnNumeric, isColumnSound } from '../../core/model/column.ts';
import { niBPM } from '../../core/model/constants.ts';
import type { Note } from '../../core/model/note.ts';
import { cint, toDotNetG15 } from '../../core/vb.ts';
import type { VisualSettings } from '../../settings/theme-loader.ts';
import {
  isNoPoint,
  modifierHiddenActive,
  modifierLandmineActive,
  modifierLongNoteActive,
  modifierMultiselectNoteActive,
  modifierMultiselectVisibleActive,
  type Interaction,
} from '../interaction.ts';
import {
  getColumn,
  getColumnWidth,
  horizontalPositionToDisplay,
  nLeft,
  noteRowToPanelHeight,
  type EditorView,
} from '../view.ts';
import {
  colorBlack,
  colorLightGray,
  colorRed,
  colorWhite,
  getBright,
  getDark,
  getLongBright,
  getLongDark,
} from './colors.ts';
import { checkLinearGradientPoints, drawHorizontalLine } from './gdi.ts';
import { getFileNameWithoutExtension, type LabelChart } from './labels.ts';
import { isNoteVisible, noteBorders, type NoteDrawer } from './notes.ts';
import type { Painter } from './paint.ts';
import type { PanelFrame, PanelScene } from './renderer.ts';

const single = Math.fround;

function item<T>(array: readonly T[], i: number, name: string): T {
  if (!(i >= 0 && i < array.length)) throw new RangeError(`${name}(${i}) is out of range`);
  return array[i] as T;
}


export function drawSelectionBox(painter: Painter, scene: PanelScene): void {
  const i = scene.interaction;
  if (i === undefined) return;
  const p = i.pMouseMove;
  const l = i.lastMouseDownLocation;
  if (i.tool !== 'select' || scene.panel !== scene.view.focus || isNoPoint(p) || isNoPoint(l)) {
    return;
  }
  painter.drawRectangle(
    scene.theme.visual.selBox,
    single(p.x > l.x ? l.x : p.x),
    single(p.y > l.y ? l.y : p.y),
    Math.abs(single(p.x - l.x)),
    Math.abs(single(p.y - l.y)),
  );
}


export interface NoteRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function getNoteRectangle(
  view: EditorView,
  kHeight: number,
  ntInput: boolean,
  note: Readonly<Note>,
  bAdjustLength: boolean,
  bAdjustUpper: boolean,
  xTHeight: number,
  xHS: number,
  xVS: number,
): NoteRect {
  const xDispX = horizontalPositionToDisplay(view, nLeft(view, note.columnIndex), xHS);
  const yHead = noteRowToPanelHeight(view, note.vPosition, xVS, xTHeight) - kHeight - 1;
  const yTail =
    noteRowToPanelHeight(view, note.vPosition + note.length, xVS, xTHeight) - kHeight - 1;
  const xDispY = !ntInput || (bAdjustLength && !bAdjustUpper) ? yHead : yTail;
  const xDispW = cint(single(single(getColumnWidth(view, note.columnIndex) * view.gxWidth) + 1));
  const xDispH = cint(
    !ntInput || bAdjustLength ? kHeight + 3 : note.length * view.gxHeight + kHeight + 3,
  );
  return { x: xDispX, y: xDispY, width: xDispW, height: xDispH };
}

export function drawMouseOver(
  painter: Painter,
  scene: PanelScene,
  frame: PanelFrame,
  notes: NoteDrawer,
): void {
  const { chart, view } = scene;
  const vo = scene.theme.visual;
  const i = scene.interaction!;
  const { xTHeight, xPanelHScroll: xHS, xPanelDisplacement: xVS } = frame;
  const hovered = item(chart.notes, i.kMouseOver, 'Notes');
  if (chart.ntInput) {
    if (!i.bAdjustLength) notes.drawNoteNT(hovered);
  } else {
    notes.drawNote(hovered);
  }

  const outline = (note: Readonly<Note>): NoteRect =>
    getNoteRectangle(
      view,
      vo.kHeight,
      chart.ntInput,
      note,
      i.bAdjustLength,
      i.bAdjustUpper,
      xTHeight,
      xHS,
      xVS,
    );
  const rect = outline(hovered);
  const pen = i.bAdjustLength ? vo.kMouseOverE : vo.kMouseOver;
  painter.drawRectangle(pen, rect.x, rect.y, rect.width - 1, rect.height - 1);

  if (modifierMultiselectVisibleActive(i.modifiers) || modifierMultiselectNoteActive(i.modifiers)) {
    const borders = noteBorders(view.gxHeight, vo.kHeight, xTHeight, xVS);
    for (const note of chart.notes) {
      if (
        isNoteVisible(note, borders) &&
        isLabelMatch(chart, note, i.kMouseOver, view.showFileName)
      ) {
        const nrect = outline(note);
        painter.drawRectangle(pen, nrect.x, nrect.y, nrect.width - 1, nrect.height - 1);
      }
    }
  }
}


export interface TempNoteStyle {
  readonly text: string;
  readonly bright: number;
  readonly dark: number;
  readonly pen: number;
  readonly textColor: number;
}

export function tempNoteStyle(
  chart: Pick<LabelChart, 'hWAV' | 'hBMP' | 'base62'> & Pick<ReadonlyChart, 'ntInput'>,
  view: EditorView,
  vo: Readonly<Pick<VisualSettings, 'kOpacity'>>,
  interaction: Interaction,
): TempNoteStyle {
  const m = interaction.modifiers;
  const selectedColumn = interaction.selectedColumn;
  let xText: string;
  if (isColumnNumeric(selectedColumn)) {
    xText = getColumn(view, selectedColumn).title;
  } else if (isColumnSound(selectedColumn)) {
    let xValue = interaction.currentWav + 1;
    const xLandmine = modifierLandmineActive(m);
    if (xLandmine) xValue = Math.min(xValue, MaxId36);
    if (view.showFileName && item(chart.hWAV, xValue, 'hWAV') !== '') {
      xText = getFileNameWithoutExtension(item(chart.hWAV, xValue, 'hWAV'));
    } else {
      xText = xLandmine ? c10to36(xValue) : c10toId(xValue, chart.base62);
    }
  } else {
    const xValue = interaction.currentBmp + 1;
    if (view.showFileName && item(chart.hBMP, xValue, 'hBMP') !== '') {
      xText = getFileNameWithoutExtension(item(chart.hBMP, xValue, 'hBMP'));
    } else {
      xText = c10toId(xValue, chart.base62);
    }
  }

  let xAlpha = single(1);
  if (modifierHiddenActive(m)) xAlpha = single(vo.kOpacity);

  const column = getColumn(view, selectedColumn);
  let pen: number;
  let bright: number;
  let dark: number;
  let textColor: number;
  if (chart.ntInput || !modifierLongNoteActive(m)) {
    pen = getBright(column, xAlpha);
    bright = getBright(column, xAlpha);
    dark = getDark(column, xAlpha);
    textColor = column.cText;
  } else {
    pen = getLongBright(column, xAlpha);
    bright = getLongBright(column, xAlpha);
    dark = getLongDark(column, xAlpha);
    textColor = column.cLText;
  }
  if (modifierLandmineActive(m)) {
    bright = colorRed;
    dark = colorRed;
  }
  return { text: xText, bright, dark, pen, textColor };
}

export function drawTempNote(painter: Painter, scene: PanelScene, frame: PanelFrame): void {
  const { chart, view } = scene;
  const vo = scene.theme.visual;
  const i = scene.interaction!;
  const { xTHeight, xPanelHScroll: xHS, xPanelDisplacement: xVS } = frame;
  const style = tempNoteStyle(chart, view, vo, i);
  const col = i.selectedColumn;
  const kHeight = vo.kHeight;
  const g = view.gxWidth;

  const x = horizontalPositionToDisplay(view, nLeft(view, col), xHS);
  const y = noteRowToPanelHeight(view, i.tempVPosition, xVS, xTHeight);
  const p2x = horizontalPositionToDisplay(view, nLeft(view, col) + getColumnWidth(view, col), xHS);
  checkLinearGradientPoints(x, y - kHeight - 10, p2x, y + 10);
  const width = getColumnWidth(view, col);

  painter.gradientRectangle(
    x,
    y - kHeight - 10,
    p2x,
    y + 10,
    style.bright,
    style.dark,
    x + 2,
    y - kHeight + 1,
    single(single(width * g) - 3),
    kHeight - 1,
  );
  painter.drawRectangle(style.pen, x + 1, y - kHeight, single(single(width * g) - 2), kHeight);
  painter.drawString(
    style.text,
    vo.kFont,
    style.textColor,
    x + vo.kLabelHShiftL - 2,
    y - kHeight + vo.kLabelVShift,
  );
}


export interface TimeSelectionBpms {
  readonly start: number;
  readonly half: number;
  readonly end: number;
}

export function timeSelectionBpms(
  notes: readonly Readonly<Note>[],
  vSelStart: number,
  vSelLength: number,
  vSelHalf: number,
): TimeSelectionBpms {
  let start = item(notes, 0, 'Notes').value;
  let half = start;
  let end = start;
  for (let xI1 = 1; xI1 < notes.length; xI1++) {
    const note = notes[xI1]!;
    if (note.columnIndex === niBPM) {
      if (note.vPosition <= vSelStart) start = note.value;
      if (note.vPosition <= vSelStart + vSelHalf) half = note.value;
      if (note.vPosition <= vSelStart + vSelLength) end = note.value;
    }
    if (note.vPosition > vSelStart + vSelLength) break;
  }
  return { start, half, end };
}

export interface TimeSelectionRows {
  readonly fillY: number;
  readonly fillHeight: number;
  readonly startRow: number;
  readonly halfRow: number;
  readonly endRow: number;
}

export function timeSelectionRows(
  view: EditorView,
  i: Pick<Interaction, 'vSelStart' | 'vSelLength' | 'vSelHalf'>,
  xVS: number,
  xTHeight: number,
): TimeSelectionRows {
  const row = (v: number): number => noteRowToPanelHeight(view, v, xVS, xTHeight);
  const { vSelStart, vSelLength, vSelHalf } = i;
  return {
    fillY: row(vSelStart + (vSelLength > 0 ? vSelLength : 0)) + (vSelLength !== 0 ? 1 : 0),
    fillHeight: cint(Math.abs(vSelLength) * view.gxHeight),
    startRow: row(vSelStart),
    halfRow: row(vSelStart + vSelHalf),
    endRow: row(vSelStart + vSelLength),
  };
}

export function drawTimeSelection(painter: Painter, scene: PanelScene, frame: PanelFrame): void {
  const { chart, view } = scene;
  const vo = scene.theme.visual;
  const i = scene.interaction!;
  const { xTHeight, xTWidth, xPanelHScroll: xHS, xPanelDisplacement: xVS } = frame;
  const bpms = timeSelectionBpms(chart.notes, i.vSelStart, i.vSelLength, i.vSelHalf);
  const rows = timeSelectionRows(view, i, xVS, xTHeight);

  painter.fillRectangle(vo.peSel, 0, rows.fillY, xTWidth, rows.fillHeight);
  painter.solid(vo.peCursor);
  drawHorizontalLine(painter, 0, xTWidth, rows.endRow);
  painter.solid(vo.peHalf);
  drawHorizontalLine(painter, 0, xTWidth, rows.halfRow);

  const x = single((-xHS + nLeft(view, niBPM)) * view.gxWidth);
  const fontHeight = painter.useFont(vo.peBPMFont).height;
  const text = (value: number): string => toDotNetG15(value / 10000);
  painter.drawString(text(bpms.start), vo.peBPMFont, vo.peBPM, x, rows.startRow - fontHeight + 3);
  painter.drawString(text(bpms.half), vo.peBPMFont, vo.peBPM, x, rows.halfRow - fontHeight + 3);
  painter.drawString(text(bpms.end), vo.peBPMFont, vo.peBPM, x, rows.endRow - fontHeight + 3);

  const line =
    i.vSelMouseOverLine === 1
      ? rows.startRow
      : i.vSelMouseOverLine === 2
        ? rows.halfRow
        : i.vSelMouseOverLine === 3
          ? rows.endRow
          : undefined;
  if (line !== undefined) painter.drawRectangle(vo.peMouseOver, 0, line - 1, xTWidth - 1, 2);
}


export interface ClickAndScrollShape {
  readonly initX: number;
  readonly initY: number;
  readonly currX: number;
  readonly currY: number;
  readonly triangle?: readonly (readonly [number, number])[];
}

export function clickAndScrollShape(
  initX: number,
  initY: number,
  currX: number,
  currY: number,
): ClickAndScrollShape {
  const xInitX = single(initX);
  const xInitY = single(initY);
  const xCurrX = single(currX);
  const xCurrY = single(currY);
  const xAngle = Math.atan2(single(xCurrY - xInitY), single(xCurrX - xInitX));
  const shape = { initX: xInitX, initY: xInitY, currX: xCurrX, currY: xCurrY };
  if (xInitX === xCurrX && xInitY === xCurrY) return shape;
  return {
    ...shape,
    triangle: [
      [xCurrX, xCurrY],
      [
        single(Math.cos(xAngle + Math.PI / 2) * 10 + xInitX),
        single(Math.sin(xAngle + Math.PI / 2) * 10 + xInitY),
      ],
      [
        single(Math.cos(xAngle - Math.PI / 2) * 10 + xInitX),
        single(Math.sin(xAngle - Math.PI / 2) * 10 + xInitY),
      ],
    ],
  };
}

export function drawClickAndScroll(painter: Painter, scene: PanelScene): void {
  const i = scene.interaction!;
  const origin = scene.clientOrigin ?? { x: 0, y: 0 };
  const shape = clickAndScrollShape(
    i.middleButtonLocation.x - origin.x,
    i.middleButtonLocation.y - origin.y,
    i.cursorPosition.x - origin.x,
    i.cursorPosition.y - origin.y,
  );
  if (shape.triangle !== undefined) {
    painter.fillPolygonAA(shape.triangle, {
      x0: shape.initX,
      y0: shape.initY,
      x1: shape.currX,
      y1: shape.currY,
      from: 0,
      to: colorWhite,
    });
  }
  painter.fillCircleAA(colorLightGray, shape.initX, shape.initY, 10);
  painter.drawCircleAA(colorBlack, shape.initX, shape.initY, 8);
}
