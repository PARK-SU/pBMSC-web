import { c10to36, c10toId } from '../../core/bms/base.ts';
import type { ReadonlyChart } from '../../core/model/chart.ts';
import { isColumnNumeric, isColumnSound } from '../../core/model/column.ts';
import type { Note } from '../../core/model/note.ts';
import { cint, intDiv, toDotNetG15, VbError } from '../../core/vb.ts';

export type LabelChart = Pick<ReadonlyChart, 'notes' | 'hWAV' | 'hBMP' | 'hCOM' | 'base62'>;

function item<T>(array: readonly T[], i: number, name: string): T {
  if (!(i >= 0 && i < array.length)) throw new RangeError(`${name}(${i}) is out of range`);
  return array[i] as T;
}

export function wordWrapConvert(s: string | undefined): string {
  if (s === undefined || s === '') return '';
  return s.replaceAll('\\n', '\r\n');
}

function hasIllegalCharacters(path: string): boolean {
  for (let i = 0; i < path.length; i++) {
    const c = path.charCodeAt(i);
    if (c < 0x20 || c === 0x22 || c === 0x3c || c === 0x3e || c === 0x7c) return true;
  }
  return false;
}

const isDirectorySeparator = (c: string): boolean => c === '\\' || c === '/';

function isDevice(path: string): boolean {
  if (path.length < 4) return false;
  const isExtended =
    path[0] === '\\' &&
    (path[1] === '\\' || path[1] === '?') &&
    path[2] === '?' &&
    path[3] === '\\';
  return (
    isExtended ||
    (isDirectorySeparator(path[0]!) &&
      isDirectorySeparator(path[1]!) &&
      (path[2] === '.' || path[2] === '?') &&
      isDirectorySeparator(path[3]!))
  );
}

export function getFileNameWithoutExtension(path: string): string {
  if (!isDevice(path) && hasIllegalCharacters(path)) throw new VbError('Argument');
  let name = path;
  for (let i = path.length - 1; i >= 0; i--) {
    const ch = path[i];
    if (ch === '\\' || ch === '/' || ch === ':') {
      name = path.slice(i + 1);
      break;
    }
  }
  const dot = name.lastIndexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}

export function getNoteLabel(
  sNote: Readonly<Note>,
  chart: LabelChart,
  showFileName: boolean,
): string {
  const xIC10 = cint(intDiv(sNote.value, 10000));
  if (sNote.comment) {
    if (sNote.lnPair > 0 && item(chart.notes, sNote.lnPair, 'Notes').vPosition > sNote.vPosition) {
      return '';
    }
    return wordWrapConvert(item(chart.hCOM, xIC10, 'hCOM'));
  }
  if (isColumnNumeric(sNote.columnIndex)) {
    return toDotNetG15(sNote.value / 10000);
  }
  if (showFileName && isColumnSound(sNote.columnIndex) && item(chart.hWAV, xIC10, 'hWAV') !== '') {
    return getFileNameWithoutExtension(item(chart.hWAV, xIC10, 'hWAV'));
  }
  if (showFileName && item(chart.hBMP, xIC10, 'hBMP') !== '') {
    return getFileNameWithoutExtension(item(chart.hBMP, xIC10, 'hBMP'));
  }
  if (sNote.landmine) return c10to36(xIC10);
  return c10toId(xIC10, chart.base62);
}
