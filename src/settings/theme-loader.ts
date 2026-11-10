import type { Column } from '../core/model/column.ts';
import { niB } from '../core/model/constants.ts';
import { cdbl, cintStr, doubleParse, VbError } from '../core/vb.ts';
import { getAttribute, item, parseXml, type XmlElement } from './xml.ts';

export interface ThemeFont {
  name: string;
  size: number;
  style: number;
}

export const fontStyleBold = 1;
export const fontStyleItalic = 2;
export const fontStyleUnderline = 4;
export const fontStyleStrikeout = 8;

export interface VisualSettings {
  columnTitle: number;
  columnTitleFont: ThemeFont;
  bg: number;
  pGrid: number;
  pSub: number;
  pVLine: number;
  pMLine: number;
  pBGMWav: number;
  selBox: number;
  peCursor: number;
  peHalf: number;
  peDeltaMouseOver: number;
  peMouseOver: number;
  peSel: number;
  peBPM: number;
  peBPMFont: ThemeFont;
  middleDeltaRelease: number;
  kHeight: number;
  kFont: ThemeFont;
  kMFont: ThemeFont;
  kLabelVShift: number;
  kLabelHShift: number;
  kLabelHShiftL: number;
  kMouseOver: number;
  kMouseOverE: number;
  kSelected: number;
  kOpacity: number;
}

const argb = (unsigned: number): number =>
  unsigned > 0x7fffffff ? unsigned - 0x100000000 : unsigned;

export const defaultVisualSettings: Readonly<VisualSettings> = {
  columnTitle: argb(0xff00ff00),
  columnTitleFont: { name: 'Tahoma', size: 8.25, style: 0 },
  bg: argb(0xff000000),
  pGrid: 893008442,
  pSub: 1530542650,
  pVLine: -13158601,
  pMLine: 1599230546,
  pBGMWav: 851493056,
  selBox: -1056964609,
  peCursor: argb(0xc0ff8080),
  peHalf: argb(0x808080ff),
  peDeltaMouseOver: 5,
  peMouseOver: argb(0x80ff8080),
  peSel: 855605376,
  peBPM: 855605376,
  peBPMFont: { name: 'Verdana', size: 9, style: fontStyleBold },
  middleDeltaRelease: 10,
  kHeight: 10,
  kFont: { name: 'Verdana', size: 9, style: fontStyleBold },
  kMFont: { name: 'Verdana', size: 9, style: 0 },
  kLabelVShift: -2,
  kLabelHShift: 0,
  kLabelHShiftL: 2,
  kMouseOver: argb(0xff00ff00),
  kMouseOverE: -16711681,
  kSelected: argb(0xffff0000),
  kOpacity: 0.5,
};

export interface ThemeColumn {
  index: number;
  width?: number;
  title?: string;
  display?: boolean;
  noteColor?: number;
  textColor?: number;
  longNoteColor?: number;
  longTextColor?: number;
  bg?: number;
}

export interface Theme {
  columns: ThemeColumn[];
  visual: VisualSettings;
}

const formFont: Readonly<ThemeFont> = { name: 'Segoe UI', size: 9, style: 0 };

function cboolStr(s: string): boolean {
  const lower = s.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  return cdbl(s) !== 0;
}

function singleParse(s: string): number {
  const d = doubleParse(s);
  const f = Math.fround(d);
  if (Number.isFinite(d) && !Number.isFinite(f)) throw new VbError('Overflow');
  return f;
}

function loadAttribute<T>(
  element: XmlElement,
  attribute: string,
  convert: (s: string) => T,
): T | undefined {
  const s = getAttribute(element, attribute);
  if (s.length === 0) return undefined;
  try {
    return convert(s);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Theme: <${element.name}> ${attribute}="${s}": ${reason}`, { cause: error });
  }
}

function loadElementValue(
  element: XmlElement | undefined,
  current: number,
  convert: (s: string) => number,
): number {
  if (element === undefined) return current;
  return loadAttribute(element, 'Value', convert) ?? current;
}

function loadElementFont(element: XmlElement | undefined, current: ThemeFont): ThemeFont {
  if (element === undefined) return current;
  const name = loadAttribute(element, 'Name', (s) => s) ?? formFont.name;
  const size = loadAttribute(element, 'Size', cintStr) ?? formFont.size;
  const style = loadAttribute(element, 'Style', cintStr) ?? formFont.style;
  if (size <= 0) throw new Error(`Theme: <${element.name}> Size="${size}": ArgumentException`);
  return { name, size, style };
}

function loadColumn(n: XmlElement): ThemeColumn | undefined {
  const index = loadAttribute(n, 'Index', cintStr) ?? -1;
  if (index < 0 || index > niB) return undefined;

  const column: ThemeColumn = { index };
  const width = loadAttribute(n, 'Width', cintStr);
  if (width !== undefined) column.width = width;
  const title = loadAttribute(n, 'Title', (s) => s);
  if (title !== undefined) column.title = title;
  const display = loadAttribute(n, 'Display', cboolStr);
  if (display !== undefined) column.display = display;
  const noteColor = loadAttribute(n, 'NoteColor', cintStr);
  if (noteColor !== undefined) column.noteColor = noteColor;
  const textColor = loadAttribute(n, 'TextColor', cintStr);
  if (textColor !== undefined) column.textColor = textColor;
  const longNoteColor = loadAttribute(n, 'LongNoteColor', cintStr);
  if (longNoteColor !== undefined) column.longNoteColor = longNoteColor;
  const longTextColor = loadAttribute(n, 'LongTextColor', cintStr);
  if (longTextColor !== undefined) column.longTextColor = longTextColor;
  const bg = loadAttribute(n, 'BG', cintStr);
  if (bg !== undefined) column.bg = bg;
  return column;
}

function loadVisualSettings(e: XmlElement, v: VisualSettings): void {
  const at = (name: string) => item(e, name);
  v.columnTitle = loadElementValue(at('ColumnTitle'), v.columnTitle, cintStr);
  v.columnTitleFont = loadElementFont(at('ColumnTitleFont'), v.columnTitleFont);
  v.bg = loadElementValue(at('Bg'), v.bg, cintStr);
  v.pGrid = loadElementValue(at('Grid'), v.pGrid, cintStr);
  v.pSub = loadElementValue(at('Sub'), v.pSub, cintStr);
  v.pVLine = loadElementValue(at('VLine'), v.pVLine, cintStr);
  v.pMLine = loadElementValue(at('MLine'), v.pMLine, cintStr);
  v.pBGMWav = loadElementValue(at('BGMWav'), v.pBGMWav, cintStr);
  v.selBox = loadElementValue(at('SelBox'), v.selBox, cintStr);
  v.peCursor = loadElementValue(at('TSCursor'), v.peCursor, cintStr);
  v.peHalf = loadElementValue(at('TSHalf'), v.peHalf, cintStr);
  v.peDeltaMouseOver = loadElementValue(at('TSDeltaMouseOver'), v.peDeltaMouseOver, cintStr);
  v.peMouseOver = loadElementValue(at('TSMouseOver'), v.peMouseOver, cintStr);
  v.peSel = loadElementValue(at('TSSel'), v.peSel, cintStr);
  v.peBPM = loadElementValue(at('TSBPM'), v.peBPM, cintStr);
  v.peBPMFont = loadElementFont(at('TSBPMFont'), v.peBPMFont);
  v.middleDeltaRelease = loadElementValue(at('MiddleDeltaRelease'), v.middleDeltaRelease, cintStr);
  v.kHeight = loadElementValue(at('kHeight'), v.kHeight, cintStr);
  v.kFont = loadElementFont(at('kFont'), v.kFont);
  v.kMFont = loadElementFont(at('kMFont'), v.kMFont);
  v.kLabelVShift = loadElementValue(at('kLabelVShift'), v.kLabelVShift, cintStr);
  v.kLabelHShift = loadElementValue(at('kLabelHShift'), v.kLabelHShift, cintStr);
  v.kLabelHShiftL = loadElementValue(at('kLabelHShiftL'), v.kLabelHShiftL, cintStr);
  v.kMouseOver = loadElementValue(at('kMouseOver'), v.kMouseOver, cintStr);
  v.kMouseOverE = loadElementValue(at('kMouseOverE'), v.kMouseOverE, cintStr);
  v.kSelected = loadElementValue(at('kSelected'), v.kSelected, cintStr);
  v.kOpacity = loadElementValue(at('kOpacity'), v.kOpacity, singleParse);
}

export function parseThemeXml(text: string): Theme {
  const root = parseXml(text);
  const visual: VisualSettings = {
    ...defaultVisualSettings,
    columnTitleFont: { ...defaultVisualSettings.columnTitleFont },
    peBPMFont: { ...defaultVisualSettings.peBPMFont },
    kFont: { ...defaultVisualSettings.kFont },
    kMFont: { ...defaultVisualSettings.kMFont },
  };
  const theme: Theme = { columns: [], visual };
  if (root.name !== 'iBMSC') return theme;

  const eColumns = item(root, 'Columns');
  if (eColumns !== undefined) {
    for (const node of eColumns.children) {
      if (node.type !== 'element') {
        throw new Error(`Theme: <Columns> contains a ${node.type} node (InvalidCastException)`);
      }
      const column = loadColumn(node);
      if (column !== undefined) theme.columns.push(column);
    }
  }

  const eVisualSettings = item(root, 'VisualSettings');
  if (eVisualSettings !== undefined) loadVisualSettings(eVisualSettings, visual);
  return theme;
}

export function applyThemeColumns(
  columns: readonly Readonly<Column>[],
  theme: Pick<Theme, 'columns'>,
): Column[] {
  const result = columns.map((column) => ({ ...column }));
  for (const t of theme.columns) {
    const column = result[t.index];
    if (column === undefined) continue;
    if (t.width !== undefined) column.width = t.width;
    if (t.title !== undefined) column.title = t.title;
    if (t.display !== undefined) column.isVisible = t.display;
    if (t.noteColor !== undefined) column.cNote = t.noteColor;
    if (t.textColor !== undefined) column.cText = t.textColor;
    if (t.longNoteColor !== undefined) column.cLNote = t.longNoteColor;
    if (t.longTextColor !== undefined) column.cLText = t.longTextColor;
    if (t.bg !== undefined) column.cBG = t.bg;
  }
  return result;
}

export function decodeThemeFile(bytes: Uint8Array): string {
  let label = 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) label = 'utf-16le';
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) label = 'utf-16be';
  return new TextDecoder(label, { fatal: true }).decode(bytes);
}

export const themeNames = [
  'BMSE.Theme.xml',
  'BMSEmdk.Theme.xml',
  'BMSEmdkp.Theme.xml',
  'Forme.Theme.xml',
  'IIDX.Theme.xml',
  'MyO2_4K.Theme.xml',
  'O2Mania.Theme.xml',
  'Pomu.Theme.xml',
] as const;

export type ThemeName = (typeof themeNames)[number];

export const defaultThemeName: ThemeName = 'BMSE.Theme.xml';

export function argbToCss(argb: number, alphaScale = 1): string {
  const a = (argb >>> 24) & 0xff;
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  const alpha = Number(((a / 255) * alphaScale).toFixed(3));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function fontSizePx(font: Readonly<ThemeFont>): number {
  return (font.size * 96) / 72;
}

const msGothicJapanese = '\u{FF2D}\u{FF33} \u{30B4}\u{30B7}\u{30C3}\u{30AF}';
const msGothicStack = `"MS Gothic", "${msGothicJapanese}", Osaka-Mono, "Noto Sans Mono CJK JP", monospace`;

const fontFamilies: ReadonlyMap<string, string> = new Map([
  ['tahoma', 'Tahoma, Verdana, "Segoe UI", sans-serif'],
  ['verdana', 'Verdana, Tahoma, "Segoe UI", sans-serif'],
  ['consolas', 'Consolas, Menlo, "DejaVu Sans Mono", "Courier New", monospace'],
  ['segoe ui', '"Segoe UI", Tahoma, system-ui, sans-serif'],
  ['ms gothic', msGothicStack],
  [msGothicJapanese.toLowerCase(), msGothicStack],
  ['migu 1vs', '"Migu 1VS", sans-serif'],
]);

export function cssFont(font: Readonly<ThemeFont>): string {
  const family =
    fontFamilies.get(font.name.toLowerCase()) ??
    `"${font.name.replace(/["\\]/g, '\\$&')}", sans-serif`;
  const italic = (font.style & fontStyleItalic) !== 0 ? 'italic ' : '';
  const bold = (font.style & fontStyleBold) !== 0 ? 'bold ' : '';
  return `${italic}${bold}${Number(fontSizePx(font).toFixed(3))}px ${family}`;
}
