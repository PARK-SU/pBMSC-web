import type { ReadonlyChart } from '../core/model/chart.ts';
import { defaultColumns, type Column } from '../core/model/column.ts';
import {
  niA1,
  niB,
  niBGA,
  niBPM,
  niD1,
  niD2,
  niD3,
  niD4,
  niD5,
  niD6,
  niD7,
  niD8,
  niLAYER,
  niPOOR,
  niS3,
  niS4,
  niSCROLL,
  niSTOP,
} from '../core/model/constants.ts';
import { getMaxVPosition, measureAtDisplacement } from '../core/model/measure.ts';
import { cint, int, VbError } from '../core/vb.ts';

export type PanelIndex = 0 | 1 | 2;

export interface PanelState {
  readonly width: number;
  readonly hScroll: number;
  readonly vScroll: number;
}

export interface EditorView {
  readonly panels: readonly [PanelState, PanelState, PanelState];
  readonly focus: PanelIndex;
  readonly spLock: readonly [boolean, boolean, boolean];
  readonly spDiff: readonly [number, number, number];
  readonly showLSplit: boolean;
  readonly showRSplit: boolean;
  readonly columns: readonly Readonly<Column>[];
  readonly gColumns: number;
  readonly lastBgmColumn: number;
  readonly gSnap: boolean;
  readonly gShowGrid: boolean;
  readonly gShowSubGrid: boolean;
  readonly gShowBG: boolean;
  readonly gShowMeasureNumber: boolean;
  readonly gShowVerticalLine: boolean;
  readonly gShowMeasureBar: boolean;
  readonly gShowC: boolean;
  readonly gDivide: number;
  readonly gSub: number;
  readonly cgDivideValue: string;
  readonly cgSubValue: string;
  readonly gSlash: number;
  readonly disableVerticalMove: boolean;
  readonly gxHeight: number;
  readonly gxWidth: number;
  readonly gWheel: number;
  readonly gPgUpDn: number;
  readonly gDisplayBGAColumn: boolean;
  readonly gSCROLL: boolean;
  readonly gSTOP: boolean;
  readonly gBPM: boolean;
  readonly showFileName: boolean;
  readonly errorCheck: boolean;
}

export function createEditorView(
  columns: readonly Readonly<Column>[] = defaultColumns,
): EditorView {
  const view: EditorView = {
    panels: [
      { width: 0, hScroll: 0, vScroll: 0 },
      { width: 100, hScroll: 0, vScroll: 0 },
      { width: 0, hScroll: 0, vScroll: 0 },
    ],
    focus: 1,
    spLock: [false, false, false],
    spDiff: [0, 0, 0],
    showLSplit: false,
    showRSplit: false,
    columns,
    gColumns: niB + 32 - 1,
    lastBgmColumn: niB,
    gSnap: true,
    gShowGrid: true,
    gShowSubGrid: true,
    gShowBG: true,
    gShowMeasureNumber: true,
    gShowVerticalLine: true,
    gShowMeasureBar: true,
    gShowC: true,
    gDivide: 16,
    gSub: 4,
    cgDivideValue: '16',
    cgSubValue: '4',
    gSlash: 192,
    disableVerticalMove: false,
    gxHeight: 1,
    gxWidth: 1,
    gWheel: 96,
    gPgUpDn: 384,
    gDisplayBGAColumn: true,
    gSCROLL: true,
    gSTOP: true,
    gBPM: true,
    showFileName: false,
    errorCheck: true,
  };
  let shown = view.columns;
  for (const option of columnOptions) {
    shown = showColumns(shown, optionColumns[option], view[option]);
  }
  return setPlayer({ ...view, columns: shown }, 0);
}


export function getColumn(view: EditorView, iCol: number): Readonly<Column> {
  const column = view.columns[iCol < niB ? iCol : niB];
  if (column === undefined) throw new RangeError(`No column ${iCol}`);
  return column;
}

export function nLeft(view: EditorView, iCol: number): number {
  if (iCol < niB) return getColumn(view, iCol).left;
  const b = getColumn(view, niB);
  return b.left + (iCol - niB) * b.width;
}

export function getColumnWidth(view: EditorView, iCol: number): number {
  const column = getColumn(view, iCol);
  return column.isVisible ? column.width : 0;
}

export function nTitle(view: EditorView, iCol: number): string {
  if (iCol < niB) return getColumn(view, iCol).title;
  return getColumn(view, niB).title + String(iCol - niB + 1);
}

export function nEnabled(view: EditorView, iCol: number): boolean {
  const column = getColumn(view, iCol);
  return column.isVisible && column.isNoteCol && column.width !== 0;
}

export function lastDisplayedColumn(view: EditorView): number {
  return Math.max(view.gColumns, view.lastBgmColumn);
}

export function withChartColumns(
  view: EditorView,
  chart: Pick<ReadonlyChart, 'notes'>,
): EditorView {
  let lastBgmColumn = niB;
  for (const note of chart.notes) lastBgmColumn = Math.max(lastBgmColumn, note.columnIndex);
  return lastBgmColumn === view.lastBgmColumn ? view : updateColumnsX({ ...view, lastBgmColumn });
}

export function updateColumnsX(view: EditorView): EditorView {
  const columns = view.columns.map((column) => ({ ...column }));
  columns[0]!.left = 0;
  for (let xI1 = 1; xI1 < columns.length; xI1++) {
    const previous = columns[xI1 - 1]!;
    columns[xI1]!.left = previous.left + (previous.isVisible ? previous.width : 0);
  }
  const laidOut: EditorView = { ...view, columns };
  const maximum = hScrollMaximum(laidOut);
  return {
    ...laidOut,
    panels: mapPanels(laidOut.panels, (panel) =>
      panel.hScroll > maximum ? { ...panel, hScroll: maximum } : panel,
    ),
  };
}

export type ColumnOption = 'gBPM' | 'gSTOP' | 'gSCROLL' | 'gDisplayBGAColumn';

const columnOptions: readonly ColumnOption[] = ['gBPM', 'gSTOP', 'gSCROLL', 'gDisplayBGAColumn'];

const optionColumns: Readonly<Record<ColumnOption, readonly number[]>> = {
  gBPM: [niBPM],
  gSTOP: [niSTOP],
  gSCROLL: [niSCROLL],
  gDisplayBGAColumn: [niBGA, niLAYER, niPOOR, niS4],
};

const doubleColumns: readonly number[] = [niD1, niD2, niD3, niD4, niD5, niD6, niD7, niD8, niS3];

export function setColumnOption(
  view: EditorView,
  option: ColumnOption,
  value: boolean,
): EditorView {
  if (view[option] === value) return view;
  return updateColumnsX({
    ...view,
    [option]: value,
    columns: showColumns(view.columns, optionColumns[option], value),
  });
}

export function setPlayer(view: EditorView, player: number): EditorView {
  return updateColumnsX({
    ...view,
    columns: showColumns(view.columns, doubleColumns, player !== 0),
  });
}

function showColumns(
  columns: readonly Readonly<Column>[],
  indices: readonly number[],
  visible: boolean,
): readonly Readonly<Column>[] {
  return columns.map((column, i) =>
    indices.includes(i) ? { ...column, isVisible: visible } : column,
  );
}

export interface XKeyMode {
  readonly gXKeyMode: 'PMS' | 'DP' | 'SP';
  readonly player: number;
}

export function determineXKeyMode(view: EditorView, player: number): XKeyMode {
  if (getColumn(view, niA1).width === 0) {
    return { gXKeyMode: 'PMS', player: player === 0 ? 2 : player };
  }
  return { gXKeyMode: player !== 0 ? 'DP' : 'SP', player };
}

export function enabledColumnIndexToColumnArrayIndex(view: EditorView, cEnabled: number): number {
  for (let xI1 = 0; ; xI1++) {
    if (xI1 >= view.gColumns) break;
    if (!nEnabled(view, xI1)) cEnabled += 1;
    if (xI1 >= cEnabled) break;
  }
  return cEnabled;
}

export function columnArrayIndexToEnabledColumnIndex(view: EditorView, cReal: number): number {
  const xEnd = cReal - 1;
  for (let xI1 = 0; xI1 <= xEnd; xI1++) {
    if (!nEnabled(view, xI1)) cReal -= 1;
  }
  return cReal;
}


export function horizontalPositionToDisplay(
  view: EditorView,
  xHPosition: number,
  xHSVal: number,
): number {
  const g = view.gxWidth;
  return cint(Math.fround(Math.fround(xHPosition * g) - Math.fround(xHSVal * g)));
}

export function noteRowToPanelHeight(
  view: EditorView,
  xVPosition: number,
  xVSVal: number,
  xTHeight: number,
): number {
  return xTHeight - cint((xVPosition + xVSVal) * view.gxHeight) - 1;
}

export function getMouseVPosition(
  chart: Pick<ReadonlyChart, 'measureBottom'>,
  view: EditorView,
  panelHeight: number,
  mouseY: number,
  snap = true,
): number {
  const panDisplacement = view.panels[view.focus].vScroll;
  const vpos = (panelHeight - panDisplacement * view.gxHeight - mouseY - 1) / view.gxHeight;
  return snap ? snapToGrid(chart, view, vpos) : vpos;
}

export function snapToGrid(
  chart: Pick<ReadonlyChart, 'measureBottom'>,
  view: EditorView,
  xVPos: number,
): number {
  const xOffset = chart.measureBottom[measureAtDisplacement(chart, xVPos)]!;
  const xRatio = 192 / view.gDivide;
  return int((xVPos - xOffset) / xRatio) * xRatio + xOffset;
}

export function getColumnAtX(view: EditorView, x: number, xHS: number): number {
  const mLeft = cint(Math.fround(Math.fround(x / view.gxWidth) + xHS));
  const lastColumn = lastDisplayedColumn(view);
  let xColumn = 0;
  if (mLeft >= 0) {
    for (let xI1 = 0; ; xI1++) {
      if (mLeft < nLeft(view, xI1 + 1) || xI1 >= lastColumn) {
        xColumn = xI1;
        break;
      }
    }
  }
  return enabledColumnIndexToColumnArrayIndex(
    view,
    columnArrayIndexToEnabledColumnIndex(view, xColumn),
  );
}


export interface ScrollRange {
  readonly minimum: number;
  readonly maximum: number;
  readonly largeChange: number;
  readonly userMaximum: number;
}

export type ScrollChart = Pick<
  ReadonlyChart,
  'greatestVPosition' | 'measureBottom' | 'measureLength'
>;

export function vScrollMinimum(chart: ScrollChart): number {
  const xMax = getMaxVPosition(chart);
  const xLimit = chart.greatestVPosition + 2000;
  return 0 - cint(xLimit > xMax ? xMax : xLimit);
}

export function vScrollRange(chart: ScrollChart, panelHeight: number): ScrollRange {
  const minimum = vScrollMinimum(chart);
  const xLargeChange = cint(panelHeight * 0.9);
  const maximum = xLargeChange - 1;
  return scrollRange(minimum, maximum, xLargeChange);
}

export function hScrollMaximum(view: EditorView): number {
  return nLeft(view, lastDisplayedColumn(view)) + getColumn(view, niB).width;
}

export function hScrollRange(view: EditorView, panelWidth: number): ScrollRange {
  const xLargeChange = cint(Math.fround(panelWidth / view.gxWidth));
  return scrollRange(0, hScrollMaximum(view), xLargeChange);
}

function scrollRange(minimum: number, maximum: number, xLargeChange: number): ScrollRange {
  const largeChange = Math.min(xLargeChange, maximum - minimum + 1);
  return { minimum, maximum, largeChange, userMaximum: maximum - largeChange + 1 };
}

export interface ModifierKeys {
  readonly ctrl: boolean;
  readonly shift: boolean;
}

const noModifierKeys: ModifierKeys = { ctrl: false, shift: false };

export function setPanelVScroll(
  chart: ScrollChart,
  view: EditorView,
  panel: PanelIndex,
  value: number,
  modifiers: ModifierKeys = noModifierKeys,
): EditorView {
  if (view.panels[panel].vScroll === value || modifiers.ctrl || modifiers.shift) return view;
  const minimum = vScrollMinimum(chart);
  const panelVScroll = view.panels.map((state) => state.vScroll);
  const spDiff = [...view.spDiff];
  const vScrollAt = (i: number): number => panelVScroll[i % 3]!;
  const diffAt = (i: number): number => spDiff[i % 3]!;

  const setValue = (iI: number, xValue: number): void => {
    if (panelVScroll[iI] === xValue) return;
    panelVScroll[iI] = xValue;
    vsValueChanged(iI);
  };
  const clamp = (xVS: number): number => (xVS > 0 ? 0 : xVS < minimum ? minimum : xVS);
  const vsValueChanged = (iI: number): void => {
    if (view.spLock[(iI + 1) % 3]) setValue((iI + 1) % 3, clamp(cint(vScrollAt(iI) + diffAt(iI))));
    if (view.spLock[(iI + 2) % 3]) {
      setValue((iI + 2) % 3, clamp(cint(vScrollAt(iI) - diffAt(iI + 2))));
    }
    spDiff[iI] = cint(vScrollAt(iI + 1) - vScrollAt(iI));
    spDiff[(iI + 2) % 3] = cint(vScrollAt(iI) - vScrollAt(iI + 2));
  };

  setValue(panel, value);
  return {
    ...view,
    panels: mapPanels(view.panels, (state, i) => ({ ...state, vScroll: panelVScroll[i]! })),
    spDiff: [spDiff[0]!, spDiff[1]!, spDiff[2]!],
  };
}

export function setPanelHScroll(view: EditorView, panel: PanelIndex, value: number): EditorView {
  if (view.panels[panel].hScroll === value) return view;
  return withPanel(view, panel, { hScroll: value });
}

export function setSpLock(view: EditorView, panel: PanelIndex, value: boolean): EditorView {
  if (view.spLock[panel] === value) return view;
  const spLock: [boolean, boolean, boolean] = [...view.spLock];
  spLock[panel] = value;
  if (!value) return { ...view, spLock };
  const vScrollAt = (i: number): number => view.panels[(i % 3) as PanelIndex].vScroll;
  const spDiff: [number, number, number] = [...view.spDiff];
  spDiff[panel] = cint(vScrollAt(panel + 1) - vScrollAt(panel));
  spDiff[(panel + 2) % 3] = cint(vScrollAt(panel) - vScrollAt(panel + 2));
  return { ...view, spLock, spDiff };
}

export function setPanelFocus(view: EditorView, panel: PanelIndex): EditorView {
  return view.focus === panel ? view : { ...view, focus: panel };
}

export function setPanelWidth(view: EditorView, panel: PanelIndex, width: number): EditorView {
  return withPanel(view, panel, { width: width < 0 ? 0 : width });
}

export function pMainInResize(view: EditorView, panel: PanelIndex, panelWidth: number): EditorView {
  const { userMaximum } = hScrollRange(view, panelWidth);
  const { hScroll } = view.panels[panel];
  return hScroll > userMaximum ? withPanel(view, panel, { hScroll: userMaximum }) : view;
}


export const zoomMinimum = 0.25;
export const zoomMaximum = 99;
export const zoomIncrement = 0.25;
export const zoomTrackBarMinimum = 1;
export const zoomTrackBarMaximum = 20;

export function zoomTrackBarValue(zoom: number): number {
  return cint(zoom * 4 < zoomTrackBarMaximum ? zoom * 4 : zoomTrackBarMaximum);
}

export function stepZoom(zoom: number, direction: 1 | -1): number {
  const xZoom = zoom + direction * zoomIncrement;
  return direction > 0 ? Math.min(xZoom, zoomMaximum) : Math.max(xZoom, zoomMinimum);
}

function constrainZoom(zoom: number): number {
  return Math.fround(Math.min(Math.max(zoom, zoomMinimum), zoomMaximum));
}

export function setGxHeight(view: EditorView, zoom: number): EditorView {
  const gxHeight = constrainZoom(zoom);
  return gxHeight === view.gxHeight ? view : { ...view, gxHeight };
}

export function setGxWidth(
  view: EditorView,
  zoom: number,
  panelWidths: readonly [number, number, number],
): EditorView {
  const gxWidth = constrainZoom(zoom);
  if (gxWidth === view.gxWidth) return view;
  let next: EditorView = { ...view, gxWidth };
  for (const panel of [1, 0, 2] as const) next = pMainInResize(next, panel, panelWidths[panel]);
  return next;
}


export const gridDivisionMinimum = 1;
export const gridDivisionMaximum = 1920;

export function setCGDivideValue(view: EditorView, value: number | string): EditorView {
  const xValue = numericUpDownValue(view.cgDivideValue, value);
  if (xValue === undefined) return view;
  return { ...view, cgDivideValue: decimalText(xValue), gDivide: cintDecimal(xValue) };
}

export function setCGSubValue(view: EditorView, value: number | string): EditorView {
  const xValue = numericUpDownValue(view.cgSubValue, value);
  if (xValue === undefined) return view;
  return { ...view, cgSubValue: decimalText(xValue), gSub: cintDecimal(xValue) };
}

export interface GridKeyModifiers extends ModifierKeys {
  readonly alt: boolean;
}

export function gridDivisionKey(
  view: EditorView,
  increase: boolean,
  modifiers: GridKeyModifiers,
): EditorView {
  const modif = modifiers.shift ? 3 : 2;
  const sub = modifiers.alt;
  const value = parseDecimal(sub ? view.cgSubValue : view.cgDivideValue);
  const setValue = (xValue: VbDecimal): EditorView =>
    sub ? setCGSubValue(view, decimalText(xValue)) : setCGDivideValue(view, decimalText(xValue));
  if (!increase) {
    if (!modifiers.ctrl) {
      if (cintDecimal(value) / modif >= gridDivisionMinimum) {
        return setValue(divideDecimal(value, modif));
      }
    } else {
      const xValue = addDecimal(value, -1);
      if (compareDecimal(xValue, gridDivisionMinimum) >= 0) return setValue(xValue);
    }
  } else if (!modifiers.ctrl) {
    const xValue = multiplyDecimal(value, modif);
    if (compareDecimal(xValue, gridDivisionMaximum) <= 0) return setValue(xValue);
  } else {
    const xValue = addDecimal(value, 1);
    if (compareDecimal(xValue, gridDivisionMaximum) <= 0) return setValue(xValue);
  }
  return view;
}

function numericUpDownValue(current: string, value: number | string): VbDecimal | undefined {
  const xValue = parseDecimal(String(value));
  if (compareDecimals(xValue, parseDecimal(current)) === 0) return undefined;
  if (
    compareDecimal(xValue, gridDivisionMinimum) < 0 ||
    compareDecimal(xValue, gridDivisionMaximum) > 0
  ) {
    throw new VbError('Argument');
  }
  return xValue;
}

interface VbDecimal {
  readonly m: bigint;
  readonly s: number;
}

const decimalMaxMantissa = (1n << 96n) - 1n;

function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

function parseDecimal(text: string): VbDecimal {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (match === null) throw new VbError('Format');
  const fraction = match[3] ?? '';
  const m = BigInt(match[2]! + fraction);
  return fitDecimal(match[1] === '-' ? -m : m, fraction.length);
}

function decimalText(d: VbDecimal): string {
  const sign = d.m < 0n ? '-' : '';
  let digits = (d.m < 0n ? -d.m : d.m).toString();
  if (d.s > 0) {
    digits = digits.padStart(d.s + 1, '0');
    digits = `${digits.slice(0, -d.s)}.${digits.slice(-d.s)}`;
  }
  return sign + digits;
}

function roundHalfEven(a: bigint, b: bigint): bigint {
  const magnitude = a < 0n ? -a : a;
  let q = magnitude / b;
  const twice = (magnitude % b) * 2n;
  if (twice > b || (twice === b && q % 2n === 1n)) q += 1n;
  return a < 0n ? -q : q;
}

function fitDecimal(m: bigint, s: number): VbDecimal {
  for (let n = s > 28 ? s - 28 : 0; ; n++) {
    const xM = n === 0 ? m : roundHalfEven(m, pow10(n));
    if (xM <= decimalMaxMantissa && xM >= -decimalMaxMantissa) return { m: xM, s: s - n };
  }
}

function addDecimal(d: VbDecimal, n: number): VbDecimal {
  return fitDecimal(d.m + BigInt(n) * pow10(d.s), d.s);
}

function multiplyDecimal(d: VbDecimal, n: number): VbDecimal {
  return fitDecimal(d.m * BigInt(n), d.s);
}

function divideDecimal(d: VbDecimal, n: number): VbDecimal {
  const divisor = BigInt(n);
  if (d.m % divisor === 0n) return { m: d.m / divisor, s: d.s };
  let m = d.m;
  let s = d.s;
  while (m % divisor !== 0n && s < 28) {
    const magnitude = ((m < 0n ? -m : m) * 10n) / divisor;
    if (magnitude > decimalMaxMantissa) break;
    m *= 10n;
    s += 1;
  }
  let { m: q, s: scale } = fitDecimal(roundHalfEven(m, divisor), s);
  while (scale > 0 && q % 10n === 0n) {
    q /= 10n;
    scale -= 1;
  }
  return { m: q, s: scale };
}

function compareDecimals(a: VbDecimal, b: VbDecimal): number {
  const x = a.m * pow10(b.s);
  const y = b.m * pow10(a.s);
  return x < y ? -1 : x > y ? 1 : 0;
}

function compareDecimal(d: VbDecimal, n: number): number {
  return compareDecimals(d, { m: BigInt(n), s: 0 });
}

function cintDecimal(d: VbDecimal): number {
  return Number(roundHalfEven(d.m, pow10(d.s)));
}


export function panelMouseWheel(
  chart: ScrollChart,
  view: EditorView,
  panel: PanelIndex,
  delta: number,
  modifiers: ModifierKeys,
): EditorView {
  if (modifiers.shift) return view;
  if (modifiers.ctrl) {
    const dv = cint(zoomTrackBarValue(view.gxHeight) + delta / 120);
    const xTrackBar = Math.min(zoomTrackBarMaximum, Math.max(zoomTrackBarMinimum, dv));
    return setGxHeight(view, xTrackBar / 4);
  }
  let xI1 = cint(view.panels[panel].vScroll - Math.sign(delta) * view.gWheel);
  if (xI1 > 0) xI1 = 0;
  const minimum = vScrollMinimum(chart);
  if (xI1 < minimum) xI1 = minimum;
  return setPanelVScroll(chart, view, panel, xI1);
}

export type ScrollKey = 'Home' | 'End' | 'PageUp' | 'PageDown';

export function panelScrollKey(
  chart: ScrollChart,
  view: EditorView,
  key: ScrollKey,
  modifiers: ModifierKeys = noModifierKeys,
): EditorView {
  return setPanelVScroll(chart, view, view.focus, panelScrollKeyValue(chart, view, key), modifiers);
}

export function panelScrollKeyValue(chart: ScrollChart, view: EditorView, key: ScrollKey): number {
  const minimum = vScrollMinimum(chart);
  const value = view.panels[view.focus].vScroll;
  switch (key) {
    case 'Home':
      return 0;
    case 'End':
      return minimum;
    case 'PageUp':
      return cint(value - view.gPgUpDn > minimum ? value - view.gPgUpDn : minimum);
    case 'PageDown':
      return cint(value + view.gPgUpDn < 0 ? value + view.gPgUpDn : 0);
  }
}

export function scrollPanelToNote(
  view: EditorView,
  panelHeight: number,
  xVPos: number,
  xLength = 0,
): EditorView {
  const vScroll = view.panels[view.focus].vScroll;
  const visible = Math.fround(panelHeight / view.gxHeight) * 0.95;
  if (-vScroll > xVPos) {
    return withPanel(view, view.focus, { vScroll: 0 - xVPos });
  }
  if (-vScroll + visible < xVPos + xLength) {
    return withPanel(view, view.focus, { vScroll: -xVPos + visible - xLength });
  }
  return view;
}

export interface PanStart {
  readonly tempX: number;
  readonly tempY: number;
  readonly tempV: number;
  readonly tempH: number;
}

export function beginPanelMousePan(view: EditorView, x: number, y: number): PanStart {
  const { vScroll, hScroll } = view.panels[view.focus];
  return { tempX: x, tempY: y, tempV: cint(vScroll), tempH: hScroll };
}

export function onPanelMousePan(
  chart: ScrollChart,
  view: EditorView,
  start: PanStart,
  x: number,
  y: number,
  panelWidth: number,
  modifiers: ModifierKeys = noModifierKeys,
): EditorView {
  let xI1 = cint(Math.fround(start.tempV + Math.fround((start.tempY - y) / view.gxHeight)));
  let xI2 = cint(Math.fround(start.tempH + Math.fround((start.tempX - x) / view.gxWidth)));
  if (xI1 > 0) xI1 = 0;
  if (xI2 < 0) xI2 = 0;

  const minimum = vScrollMinimum(chart);
  if (xI1 < minimum) xI1 = minimum;
  const next = setPanelVScroll(chart, view, view.focus, xI1, modifiers);

  const { userMaximum } = hScrollRange(next, panelWidth);
  if (xI2 > userMaximum) xI2 = userMaximum;
  return setPanelHScroll(next, next.focus, xI2);
}


function mapPanels(
  panels: EditorView['panels'],
  f: (panel: PanelState, index: PanelIndex) => PanelState,
): EditorView['panels'] {
  return [f(panels[0], 0), f(panels[1], 1), f(panels[2], 2)];
}

function withPanel(view: EditorView, panel: PanelIndex, change: Partial<PanelState>): EditorView {
  return {
    ...view,
    panels: mapPanels(view.panels, (state, i) => (i === panel ? { ...state, ...change } : state)),
  };
}
