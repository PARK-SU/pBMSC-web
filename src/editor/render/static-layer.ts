import { add3Zeros } from '../../core/bms/decimal.ts';
import { measureAtDisplacement, measureUpper } from '../../core/model/measure.ts';
import {
  getColumn,
  getColumnAtX,
  getColumnWidth,
  getMouseVPosition,
  lastDisplayedColumn,
  nLeft,
  nTitle,
  noteRowToPanelHeight,
} from '../view.ts';
import {
  colorA,
  colorBlack,
  colorWhite,
  getBrightness,
  getColumnHighlightColor,
} from './colors.ts';
import { drawHorizontalLine, drawVerticalLine } from './gdi.ts';
import type { Painter } from './paint.ts';
import type { PanelFrame, PanelScene } from './renderer.ts';

const single = Math.fround;

export function drawBg(painter: Painter, scene: PanelScene, frame: PanelFrame): void {
  const { bg } = scene.theme.visual;
  if (colorA(bg) !== 0xff) painter.fillRectangle(colorBlack, 0, 0, frame.xTWidth, frame.xTHeight);
  painter.fillRectangle(bg, 0, 0, frame.xTWidth, frame.xTHeight);
}

export function pointerHighlightColumn(scene: PanelScene, frame: PanelFrame): number | undefined {
  const mouse = scene.interaction?.mouseMoveStatus;
  if (mouse === undefined) return undefined;
  return getColumnAtX(scene.view, mouse.x, frame.xPanelHScroll);
}

export function pointerLineRow(scene: PanelScene, frame: PanelFrame): number | undefined {
  const mouse = scene.interaction?.mouseMoveStatus;
  if (mouse === undefined) return undefined;
  const { chart, view } = scene;
  const panHeight =
    scene.focusPanelHeight === undefined ? frame.xTHeight : Math.trunc(scene.focusPanelHeight);
  const vpos = getMouseVPosition(chart, view, panHeight, mouse.y, view.gSnap);
  return noteRowToPanelHeight(view, vpos, frame.xPanelDisplacement, frame.xTHeight);
}

export function drawBackgroundColor(painter: Painter, scene: PanelScene, frame: PanelFrame): void {
  const { view } = scene;
  if (!view.gShowBG) return;
  const g = view.gxWidth;
  const xHS = single(frame.xPanelHScroll * g);
  const highlighted = pointerHighlightColumn(scene, frame);
  for (let xI1 = 0; xI1 <= lastDisplayedColumn(view); xI1++) {
    if (single(single(single(nLeft(view, xI1 + 1) * g) - xHS) + 1) < 0) continue;
    const x = single(single(single(nLeft(view, xI1) * g) - xHS) + 1);
    if (x > frame.xTWidth) break;
    const width = getColumnWidth(view, xI1);
    const { cBG } = getColumn(view, xI1);
    if (getBrightness(cBG) !== 0 && width > 0) {
      const col = xI1 === highlighted ? getColumnHighlightColor(cBG) : cBG;
      painter.fillRectangle(col, x, 0, single(width * g), frame.xTHeight);
    }
  }
}

export function drawPanelLines(painter: Painter, scene: PanelScene, frame: PanelFrame): void {
  const { chart, view } = scene;
  const vo = scene.theme.visual;
  const { xTHeight, xTWidth, xPanelDisplacement: xVS } = frame;
  const g = view.gxWidth;
  const xHS = single(frame.xPanelHScroll * g);

  if (view.gShowVerticalLine) {
    painter.solid(vo.pVLine);
    for (let xI1 = 0; xI1 <= lastDisplayedColumn(view); xI1++) {
      const xpos = single(single(nLeft(view, xI1) * g) - xHS);
      if (single(xpos + 1) < 0) continue;
      if (single(xpos + 1) > xTWidth) break;
      if (getColumnWidth(view, xI1) > 0) drawVerticalLine(painter, xpos, 0, xTHeight);
    }
  }

  const xMeasureEnd = measureAtDisplacement(chart, frame.xVSu);
  const measureNumberColor = getColumn(view, 0).cText;
  for (let measure = measureAtDisplacement(chart, -xVS); measure <= xMeasureEnd; measure++) {
    if (view.gShowGrid) drawGridLines(painter, scene, frame, measure, view.gDivide, vo.pGrid);
    if (view.gShowSubGrid) drawGridLines(painter, scene, frame, measure, view.gSub, vo.pSub);

    const height = noteRowToPanelHeight(view, chart.measureBottom[measure]!, xVS, xTHeight);
    if (view.gShowMeasureBar) {
      painter.solid(vo.pMLine);
      drawHorizontalLine(painter, 0, xTWidth, height);
    }
    if (view.gShowMeasureNumber) {
      const kMFontHeight = painter.useFont(vo.kMFont).height;
      painter.drawString(
        '[' + add3Zeros(measure) + ']',
        vo.kMFont,
        measureNumberColor,
        single(-frame.xPanelHScroll * g),
        height - kMFontHeight,
      );
    }
  }

  const mouseLineHeight = pointerLineRow(scene, frame);
  if (mouseLineHeight !== undefined && mouseLineHeight >= 0 && mouseLineHeight < xTHeight) {
    painter.solid(colorWhite);
    drawHorizontalLine(painter, 0, xTWidth, mouseLineHeight);
  }
}

export function drawGridLines(
  painter: Painter,
  scene: PanelScene,
  frame: PanelFrame,
  measureIndex: number,
  divisions: number,
  pen: number,
): void {
  const { chart, view } = scene;
  const { xTHeight, xTWidth, xPanelDisplacement: xVS } = frame;
  const xUpper = measureUpper(chart, measureIndex);
  const xBottom = chart.measureBottom[measureIndex]!;
  const xDiff = 192 / divisions;

  const xLowest = -xVS - 1 / view.gxHeight;
  let line = xBottom < xLowest ? Math.floor((xLowest - xBottom) / xDiff) : 0;
  let xCurr = line === 0 ? xBottom : xBottom + line * xDiff;
  painter.solid(pen);
  while (xCurr < xUpper) {
    const height = noteRowToPanelHeight(view, xCurr, xVS, xTHeight);
    if (height < 0) break;
    if (height < xTHeight) drawHorizontalLine(painter, 0, xTWidth, height);
    line += 1;
    xCurr = xBottom + line * xDiff;
  }
}

export function drawColumnCaptions(painter: Painter, scene: PanelScene, frame: PanelFrame): void {
  const { view } = scene;
  if (!view.gShowC) return;
  const vo = scene.theme.visual;
  const g = view.gxWidth;
  const xHS = single(frame.xPanelHScroll * g);
  for (let xI1 = 0; xI1 <= lastDisplayedColumn(view); xI1++) {
    if (single(single(single(nLeft(view, xI1 + 1) * g) - xHS) + 1) < 0) continue;
    const x = single(single(nLeft(view, xI1) * g) - xHS);
    if (single(x + 1) > frame.xTWidth) break;
    if (getColumnWidth(view, xI1) > 0) {
      painter.drawString(nTitle(view, xI1), vo.columnTitleFont, vo.columnTitle, x, 0);
    }
  }
}
