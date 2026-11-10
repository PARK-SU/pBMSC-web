import { MaxId62 } from '../../core/bms/base.ts';
import type { ReadonlyChart } from '../../core/model/chart.ts';
import { isColumnNumeric, type Column } from '../../core/model/column.ts';
import { niB } from '../../core/model/constants.ts';
import type { Note } from '../../core/model/note.ts';
import { cint, VbError } from '../../core/vb.ts';
import { getNoteLabel, type LabelChart } from './labels.ts';

const single = Math.fround;

export const colorRed = -65536;
export const colorBlack = -16777216;
export const colorWhite = -1;
export const colorLightGray = -2894893;

export const colorA = (argb: number): number => (argb >> 24) & 0xff;
export const colorR = (argb: number): number => (argb >> 16) & 0xff;
export const colorG = (argb: number): number => (argb >> 8) & 0xff;
export const colorB = (argb: number): number => argb & 0xff;

function checkByte(value: number): void {
  if (!(value >= 0 && value <= 255)) throw new VbError('Argument');
}

export function fromArgb(alpha: number, red: number, green: number, blue: number): number {
  checkByte(alpha);
  checkByte(red);
  checkByte(green);
  checkByte(blue);
  return (alpha << 24) | (red << 16) | (green << 8) | blue;
}

export function adjustBrightness(cStart: number, iPercent: number, iTransparency: number): number {
  if (colorA(cStart) === 0) return 0;
  const percent = single(iPercent);
  const keep = single(100 - Math.abs(percent));
  const lift = Math.abs(single((percent >= 0 ? -1 : 0) * percent)) * 2.55;
  const channel = (c: number): number => cint(single(c * keep) * 0.01 + lift);
  return fromArgb(
    cint(single(colorA(cStart) * single(iTransparency))),
    channel(colorR(cStart)),
    channel(colorG(cStart)),
    channel(colorB(cStart)),
  );
}

export function getColumnHighlightColor(col: number, factor = 2): number {
  const clamp = (x: number): number => cint(x > 255 ? 255 : x);
  return fromArgb(
    clamp(colorA(col) * factor),
    clamp(colorR(col) * factor),
    clamp(colorG(col) * factor),
    clamp(colorB(col) * factor),
  );
}

export function getBrightness(argb: number): number {
  const r = single(colorR(argb) / 255);
  const g = single(colorG(argb) / 255);
  const b = single(colorB(argb) / 255);
  let max = r;
  let min = r;
  if (g > max) max = g;
  if (b > max) max = b;
  if (g < min) min = g;
  if (b < min) min = b;
  return single(single(max + min) / 2);
}


function shade(c: number, iPercent: number): number {
  return adjustBrightness(c, iPercent, single(colorA(c) / 255));
}

function withOpacity(cache: number, opacity: number): number {
  return (cint(single(colorA(cache) * single(opacity))) << 24) | (cache & 0xffffff);
}

export function getBright(column: Pick<Column, 'cNote'>, opacity: number): number {
  return withOpacity(shade(column.cNote, 50), opacity);
}

export function getDark(column: Pick<Column, 'cNote'>, opacity: number): number {
  return withOpacity(shade(column.cNote, -25), opacity);
}

export function getLongBright(column: Pick<Column, 'cLNote'>, opacity: number): number {
  return withOpacity(shade(column.cLNote, 50), opacity);
}

export function getLongDark(column: Pick<Column, 'cLNote'>, opacity: number): number {
  return withOpacity(shade(column.cLNote, -25), opacity);
}


export interface NoteColors {
  bright: number;
  dark: number;
}

export function getColor(
  sNote: Readonly<Note>,
  column: Pick<Column, 'cNote'>,
  xAlpha: number,
  overrides?: readonly (number | undefined)[],
): NoteColors {
  const xICO = cint(sNote.value / 10000);
  if (sNote.landmine) return { bright: colorRed, dark: colorRed };
  if (!isColumnNumeric(sNote.columnIndex) && !(xICO >= 0 && xICO <= MaxId62)) {
    throw new RangeError(`COverridesColors(${xICO}) is out of range`);
  }
  const override = !isColumnNumeric(sNote.columnIndex) ? overrides?.[xICO] : undefined;
  if (override !== undefined) {
    const color = fromArgb(
      cint(single(colorA(override) * xAlpha)),
      colorR(override),
      colorG(override),
      colorB(override),
    );
    return { bright: color, dark: color };
  }
  return { bright: getBright(column, xAlpha), dark: getDark(column, xAlpha) };
}

export interface NoteVisual {
  kOpacity: number;
  kSelected: number;
}

export type NoteStyleChart = LabelChart & Pick<ReadonlyChart, 'ntInput'>;

export interface NoteStyleOptions {
  overrides?: readonly (number | undefined)[] | undefined;
  showFileName: boolean;
  errorCheck: boolean;
}

export interface NoteStyle {
  label: string;
  bright: number;
  dark: number;
  pen: number;
  text: number;
  lnBody: { bright: number; dark: number; pen: number } | undefined;
  selected: number | undefined;
  errorImage: 'ImageErrorR' | 'ImageError' | undefined;
}

export function noteStyle(
  sNote: Readonly<Note>,
  column: Pick<Column, 'cNote' | 'cText' | 'cLNote' | 'cLText'>,
  vo: Readonly<NoteVisual>,
  chart: NoteStyleChart,
  options: Readonly<NoteStyleOptions>,
): NoteStyle {
  let xAlpha = single(1);
  if (sNote.hidden) xAlpha = single(vo.kOpacity);
  if (sNote.ghost) xAlpha = single(xAlpha * single(0.1));

  const label = getNoteLabel(sNote, chart, options.showFileName);
  const { bright, dark } = getColor(sNote, column, xAlpha, options.overrides);

  const isLong = chart.ntInput ? sNote.length !== 0 : sNote.longNote;
  const drawsBody =
    sNote.columnIndex < niB && sNote.lnPair !== 0 && (!chart.ntInput || sNote.length === 0);
  let lnBody: NoteStyle['lnBody'];
  if (drawsBody) {
    const longBright = getLongBright(column, xAlpha);
    lnBody = { bright: longBright, dark: getLongDark(column, xAlpha), pen: longBright };
  }

  let errorImage: NoteStyle['errorImage'];
  if (options.errorCheck && sNote.hasError) {
    errorImage = sNote.errorType === 1 ? 'ImageErrorR' : 'ImageError';
  }

  return {
    label,
    bright,
    dark,
    pen: bright,
    text: isLong ? column.cLText : column.cText,
    lnBody,
    selected: sNote.selected ? vo.kSelected : undefined,
    errorImage,
  };
}
