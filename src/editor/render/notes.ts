import type { ReadonlyChart } from '../../core/model/chart.ts';
import { niB } from '../../core/model/constants.ts';
import type { Note } from '../../core/model/note.ts';
import { cint } from '../../core/vb.ts';
import type { VisualSettings } from '../../settings/theme-loader.ts';
import {
  getColumn,
  getColumnWidth,
  horizontalPositionToDisplay,
  nEnabled,
  nLeft,
  noteRowToPanelHeight,
  type EditorView,
} from '../view.ts';
import { noteStyle, type NoteStyle, type NoteStyleOptions } from './colors.ts';
import { checkLinearGradientPoints } from './gdi.ts';
import type { Painter } from './paint.ts';
import type { ErrorIcons, PanelFrame, PanelScene } from './renderer.ts';

const single = Math.fround;

export interface NoteBorders {
  readonly xUpperBorder: number;
  readonly xLowerBorder: number;
}

export function noteBorders(
  gxHeight: number,
  kHeight: number,
  xTHeight: number,
  xVS: number,
): NoteBorders {
  return {
    xUpperBorder: single(Math.abs(xVS) + single(xTHeight / gxHeight)),
    xLowerBorder: single(Math.abs(xVS) - single(kHeight / gxHeight)),
  };
}

export function isNoteVisible(note: Readonly<Note>, borders: NoteBorders): boolean {
  const { xUpperBorder, xLowerBorder } = borders;
  const aboveLower = note.vPosition >= xLowerBorder;
  const headBelow = note.vPosition <= xLowerBorder;
  const tailAbove = note.vPosition + note.length >= xLowerBorder;
  const intersectsNT = headBelow && tailAbove;
  const aboveUpper = note.vPosition > xUpperBorder;
  const noteInside = !aboveUpper && aboveLower;
  return noteInside || intersectsNT;
}

export interface SkippedNote {
  readonly error: unknown;
}

interface NoteContext {
  readonly painter: Painter;
  readonly chart: ReadonlyChart;
  readonly view: EditorView;
  readonly vo: Readonly<VisualSettings>;
  readonly options: NoteStyleOptions;
  readonly xHS: number;
  readonly xVS: number;
  readonly xHeight: number;
  readonly errorIcons: ErrorIcons | undefined;
  readonly body: { p1x: number; p1y: number; p2x: number; p2y: number };
}

function noteContext(painter: Painter, scene: PanelScene, frame: PanelFrame): NoteContext {
  const { chart, view } = scene;
  return {
    painter,
    chart,
    view,
    vo: scene.theme.visual,
    options: {
      showFileName: view.showFileName,
      errorCheck: view.errorCheck,
      overrides: scene.colorOverrides,
    },
    xHS: frame.xPanelHScroll,
    xVS: frame.xPanelDisplacement,
    xHeight: frame.xTHeight,
    errorIcons: scene.errorIcons,
    body: { p1x: 0, p1y: 0, p2x: 0, p2y: 0 },
  };
}

export interface NoteDrawer {
  drawNote(note: Readonly<Note>): void;
  drawNoteNT(note: Readonly<Note>): void;
}

export function createNoteDrawer(
  painter: Painter,
  scene: PanelScene,
  frame: PanelFrame,
): NoteDrawer {
  const context = noteContext(painter, scene, frame);
  return {
    drawNote: (note) => drawNote(context, note),
    drawNoteNT: (note) => drawNoteNT(context, note),
  };
}

export function drawNotes(
  painter: Painter,
  scene: PanelScene,
  frame: PanelFrame,
): SkippedNote | undefined {
  const { chart, view } = scene;
  const vo = scene.theme.visual;
  const context = noteContext(painter, scene, frame);
  const borders = noteBorders(view.gxHeight, vo.kHeight, frame.xTHeight, context.xVS);
  const reach = 13 + Math.max(0, -Math.min(vo.kLabelHShift, vo.kLabelHShiftL - 2));
  const xRightBorder = frame.xTWidth + reach;
  const { notes } = chart;
  let skipped: SkippedNote | undefined;
  for (let xI1 = 0; xI1 < notes.length; xI1++) {
    const note = notes[xI1]!;
    if (note.vPosition > borders.xUpperBorder) break;
    if (!isNoteVisible(note, borders)) continue;
    try {
      const x = horizontalPositionToDisplay(view, nLeft(view, note.columnIndex), context.xHS);
      if (x >= xRightBorder) continue;
      if (chart.ntInput) drawNoteNT(context, note);
      else drawNote(context, note);
    } catch (error) {
      skipped ??= { error };
    }
  }
  return skipped;
}

function noteColumnWidth(view: EditorView, sNote: Readonly<Note>): number {
  let xColumnWidth = getColumnWidth(view, sNote.columnIndex);
  if (sNote.comment) {
    for (let i = 1; i <= 4; i++) xColumnWidth += getColumnWidth(view, sNote.columnIndex + i);
  }
  return xColumnWidth;
}

function noteAt(chart: ReadonlyChart, i: number): Readonly<Note> {
  const note = chart.notes[i];
  if (note === undefined) throw new RangeError(`Notes(${i}) is out of range`);
  return note;
}

interface ErrorIconPlacement {
  readonly image: CanvasImageSource;
  readonly x: number;
  readonly y: number;
}

const errorIconSize = 24;

function errorIconAt(
  c: NoteContext,
  style: NoteStyle,
  xnLeft: number,
  xColumnWidth: number,
  y: number,
): ErrorIconPlacement | undefined {
  if (style.errorImage === undefined || c.errorIcons === undefined) return undefined;
  const image =
    style.errorImage === 'ImageErrorR' ? c.errorIcons.imageErrorR : c.errorIcons.imageError;
  const center = horizontalPositionToDisplay(c.view, cint(xnLeft + xColumnWidth / 2), c.xHS);
  return {
    image,
    x: cint(center - 12),
    y: cint(y - c.vo.kHeight / 2 - 12),
  };
}

function drawNote(c: NoteContext, sNote: Readonly<Note>): void {
  const { painter, view, vo, xHS, xVS, xHeight } = c;
  if (!nEnabled(view, sNote.columnIndex)) return;
  const style = noteStyle(sNote, getColumn(view, sNote.columnIndex), vo, c.chart, c.options);
  const kHeight = vo.kHeight;
  const g = view.gxWidth;
  const xnLeft = nLeft(view, sNote.columnIndex);
  const xColumnWidth = noteColumnWidth(view, sNote);

  const x = horizontalPositionToDisplay(view, xnLeft, xHS);
  const y = noteRowToPanelHeight(view, sNote.vPosition, xVS, xHeight);
  const p1y = y - kHeight - 10;
  const p2x = horizontalPositionToDisplay(view, xnLeft + xColumnWidth, xHS);
  const p2y = y + 10;
  checkLinearGradientPoints(x, p1y, p2x, p2y);
  const xLength = cint(sNote.length * view.gxHeight);
  const pair =
    sNote.columnIndex < niB && sNote.lnPair !== 0 ? preparePairedLNBody(c, sNote) : undefined;
  const errorIcon = errorIconAt(c, style, xnLeft, xColumnWidth, y);

  painter.gradientRectangle(
    x,
    p1y,
    p2x,
    p2y,
    style.bright,
    style.dark,
    x + 2,
    y - kHeight + 1,
    single(single(xColumnWidth * g) - 3),
    kHeight - 1,
  );
  painter.drawRectangle(
    style.pen,
    x + 1,
    y - kHeight,
    single(single(xColumnWidth * g) - 2),
    kHeight,
  );
  painter.drawString(
    style.label,
    vo.kFont,
    style.text,
    x + vo.kLabelHShift,
    y - kHeight + vo.kLabelVShift - (sNote.comment ? xLength : 0),
  );

  if (pair !== undefined) drawPairedLNBody(c, sNote, pair, style);

  if (errorIcon !== undefined) {
    painter.drawImage(errorIcon.image, errorIcon.x, errorIcon.y, errorIconSize, errorIconSize);
  }

  if (style.selected !== undefined) {
    painter.drawRectangle(
      style.selected,
      x,
      y - kHeight - 1,
      single(xColumnWidth * g),
      kHeight + 2,
    );
  }
}

function preparePairedLNBody(c: NoteContext, sNote: Readonly<Note>): Readonly<Note> {
  const { view, xHS, xVS, xHeight, body } = c;
  const pair = noteAt(c.chart, sNote.lnPair);
  const xnLeft = nLeft(view, sNote.columnIndex);
  const xColumnWidth = getColumnWidth(view, sNote.columnIndex);
  body.p1x = horizontalPositionToDisplay(view, cint(xnLeft - 0.5 * xColumnWidth), xHS);
  body.p1y = noteRowToPanelHeight(view, pair.vPosition, xVS, xHeight);
  body.p2x = horizontalPositionToDisplay(view, cint(xnLeft + 1.5 * xColumnWidth), xHS);
  body.p2y = noteRowToPanelHeight(view, sNote.vPosition, xVS, xHeight) + c.vo.kHeight;
  checkLinearGradientPoints(body.p1x, body.p1y, body.p2x, body.p2y);
  return pair;
}

function drawPairedLNBody(
  c: NoteContext,
  sNote: Readonly<Note>,
  pair: Readonly<Note>,
  style: NoteStyle,
): void {
  const { painter, view, xHS, xVS, xHeight, body } = c;
  const lnBody = style.lnBody!;
  const kHeight = c.vo.kHeight;
  const g = view.gxWidth;

  const xX = horizontalPositionToDisplay(view, nLeft(view, pair.columnIndex), xHS);
  let xWidth = single(getColumnWidth(view, pair.columnIndex) * g);
  if (sNote.comment) {
    for (let i = 1; i <= 4; i++) {
      xWidth = single(xWidth + single(getColumnWidth(view, pair.columnIndex + i) * g));
    }
  }
  const yPair = noteRowToPanelHeight(view, pair.vPosition, xVS, xHeight);
  const yNote = noteRowToPanelHeight(view, sNote.vPosition, xVS, xHeight);
  painter.gradientRectangle(
    body.p1x,
    body.p1y,
    body.p2x,
    body.p2y,
    lnBody.bright,
    lnBody.dark,
    xX + 3,
    yPair + 1,
    single(xWidth - 5),
    yNote - yPair - kHeight - 1,
  );
  painter.drawRectangle(lnBody.pen, xX + 2, yPair, single(xWidth - 4), yNote - yPair - kHeight);
}

function drawNoteNT(c: NoteContext, sNote: Readonly<Note>): void {
  const { painter, view, vo, xHS, xVS, xHeight } = c;
  if (!nEnabled(view, sNote.columnIndex)) return;
  const style = noteStyle(sNote, getColumn(view, sNote.columnIndex), vo, c.chart, c.options);
  const kHeight = vo.kHeight;
  const g = view.gxWidth;
  const xnLeft = nLeft(view, sNote.columnIndex);
  const xColumnWidth = noteColumnWidth(view, sNote);

  const x = horizontalPositionToDisplay(view, xnLeft, xHS);
  const y = noteRowToPanelHeight(view, sNote.vPosition, xVS, xHeight);
  const yTail = noteRowToPanelHeight(view, sNote.vPosition + sNote.length, xVS, xHeight);
  let p1x: number;
  let p1y: number;
  let p2x: number;
  let p2y: number;
  if (sNote.length === 0) {
    p1x = x;
    p1y = y - kHeight - 10;
    p2x = horizontalPositionToDisplay(view, xnLeft + xColumnWidth, xHS);
    p2y = y + 10;
  } else {
    p1x = horizontalPositionToDisplay(view, cint(xnLeft - 0.5 * xColumnWidth), xHS);
    p1y = yTail - kHeight;
    p2x = horizontalPositionToDisplay(view, cint(xnLeft + 1.5 * xColumnWidth), xHS);
    p2y = y;
  }
  checkLinearGradientPoints(p1x, p1y, p2x, p2y);
  const xLength = cint(sNote.length * view.gxHeight);
  const pair =
    sNote.columnIndex < niB && sNote.length === 0 && sNote.lnPair !== 0
      ? preparePairedLNBody(c, sNote)
      : undefined;
  const errorIcon = errorIconAt(c, style, xnLeft, xColumnWidth, y);

  painter.gradientRectangle(
    p1x,
    p1y,
    p2x,
    p2y,
    style.bright,
    style.dark,
    x + 1,
    yTail - kHeight + 1,
    single(single(xColumnWidth * g) - 1),
    xLength + kHeight - 1,
  );
  painter.drawRectangle(
    style.pen,
    x + 1,
    yTail - kHeight,
    single(single(xColumnWidth * g) - 3),
    xLength + kHeight,
  );
  painter.drawString(
    style.label,
    vo.kFont,
    style.text,
    x + vo.kLabelHShiftL - 2,
    y - kHeight + vo.kLabelVShift - (sNote.comment ? xLength : 0),
  );

  if (pair !== undefined) drawPairedLNBody(c, sNote, pair, style);

  if (style.selected !== undefined) {
    painter.drawRectangle(
      style.selected,
      x,
      yTail - kHeight - 1,
      single(xColumnWidth * g),
      xLength + kHeight + 2,
    );
  }

  if (errorIcon !== undefined) {
    painter.drawImage(errorIcon.image, errorIcon.x, errorIcon.y, errorIconSize, errorIconSize);
  }
}
