import type { Chart, EditorOptions } from '../model/chart.ts';
import { isColumnSound, isColumnImage } from '../model/column.ts';
import { cloneNote } from '../model/note.ts';
import { c10toId, cIdto10, MaxId36, MaxId62 } from '../bms/base.ts';
import { convertTextBase } from '../bms/base62.ts';
import { intDiv } from '../vb.ts';
import { updatePairing } from './pairing.ts';
import type { ConversionSnapshot } from './commands.ts';
import type { EditContext } from './ops.ts';

const definitions = /^([ \t]*#)(WAV|BMP|BGA|@BGA)([0-9A-Za-z]{2})([ \t]+)([^\r\n]*)/gim;
const tracks = /^([ \t]*#[0-9]{3})([0-9A-Za-z]{2})(:[ \t]*)((?:[0-9A-Za-z]{2})+)([ \t\r]*)$/gm;
const lnObjects = /^([ \t]*#LNOBJ[ \t]+)([0-9A-Za-z]{1,2})([ \t\r]*)$/gim;
const isBga = (command: string): boolean =>
  command.toUpperCase() === 'BGA' || command.toUpperCase() === '@BGA';
const trackKind = (channel: string): number =>
  /^(04|06|07)$/i.test(channel) ? 2 : /^(01|[1-8][1-9])$/.test(channel) ? 1 : 0;
export interface ConversionOptions {
  clearUnused: boolean;
  sort: boolean;
  byFilename: boolean;
  useOldFormat: boolean;
}
export function captureConversionState(chart: Chart): ConversionSnapshot {
  return {
    wav: [...chart.hWAV],
    bmp: [...chart.hBMP],
    notes: chart.notes.map(cloneNote),
    lnObj: chart.header.lnObj,
    base62: chart.base62,
    expansion: chart.expansion,
    stageFile: chart.header.stageFile,
    banner: chart.header.banner,
    backBMP: chart.header.backBMP,
  };
}
export function applyConversionState(chart: Chart, state: ConversionSnapshot): void {
  chart.hWAV = [...state.wav];
  chart.hBMP = [...state.bmp];
  chart.notes = state.notes.map(cloneNote);
  chart.header.lnObj = state.lnObj;
  chart.base62 = state.base62;
  chart.expansion = state.expansion;
  chart.header.stageFile = state.stageFile;
  chart.header.banner = state.banner;
  chart.header.backBMP = state.backBMP;
  updatePairing(chart);
}
export function runBmsConversion(
  chart: Chart,
  options: ConversionOptions,
  writer: Readonly<EditorOptions>,
  ctx: EditContext,
): void {
  if (chart.ghostMode !== 0 || chart.randomSource !== undefined)
    throw new Error('Finish RANDOM section editing and remove ghosts before conversion.');
  const before = captureConversionState(chart),
    usedWav = new Set([0]),
    usedBmp = new Set([0]),
    usedBga = new Set([0]);
  for (const n of chart.notes) {
    if (n.comment || n.landmine) continue;
    const id = intDiv(n.value, 10000);
    if (isColumnSound(n.columnIndex)) usedWav.add(id);
    if (isColumnImage(n.columnIndex)) {
      usedBmp.add(id);
      usedBga.add(id);
    }
  }
  if (chart.header.lnObj > 0) usedWav.add(chart.header.lnObj);
  for (const match of chart.expansion.matchAll(tracks)) {
    const kind = trackKind(match[2]!);
    for (let i = 0; i < match[4]!.length; i += 2) {
      const id = cIdto10(match[4]!.slice(i, i + 2), chart.base62);
      if (id === 0) continue;
      if (kind === 1) usedWav.add(id);
      if (kind === 2) {
        usedBmp.add(id);
        usedBga.add(id);
      }
    }
  }
  for (const m of chart.expansion.matchAll(lnObjects)) usedWav.add(cIdto10(m[2]!, chart.base62));
  for (const m of chart.expansion.matchAll(definitions))
    if (isBga(m[2]!) && usedBga.has(cIdto10(m[3]!, chart.base62))) {
      const source = /^([0-9A-Za-z]{2})(?:[ \t]|$)/.exec(m[5]!);
      if (source) usedBmp.add(cIdto10(source[1]!, chart.base62));
    }
  if (options.clearUnused) {
    for (let i = 1; i < chart.hWAV.length; i++) {
      if (!usedWav.has(i) && chart.hWAV[i]) chart.hWAV[i] = '';
      if (!usedBmp.has(i) && chart.hBMP[i]) chart.hBMP[i] = '';
    }
    chart.expansion = chart.expansion.replace(
      definitions,
      (all: string, _prefix: string, command: string, id: string) =>
        (isBga(command) ? usedBga : command.toUpperCase() === 'WAV' ? usedWav : usedBmp).has(
          cIdto10(id, chart.base62),
        )
          ? all
          : '',
    );
  }
  if (options.sort) {
    const wavNames = [...chart.hWAV],
      bmpNames = [...chart.hBMP],
      wavIds = new Set(usedWav),
      bmpIds = new Set([...usedBmp, ...usedBga]);
    for (let i = 1; i < wavNames.length; i++) {
      if (wavNames[i]) wavIds.add(i);
      if (bmpNames[i]) bmpIds.add(i);
    }
    for (const m of chart.expansion.matchAll(definitions)) {
      const id = cIdto10(m[3]!, chart.base62);
      if (m[2]!.toUpperCase() === 'WAV') {
        wavIds.add(id);
        if (!wavNames[id]) wavNames[id] = m[5]!;
      } else {
        bmpIds.add(id);
        if (!isBga(m[2]!) && !bmpNames[id]) bmpNames[id] = m[5]!;
      }
    }
    wavIds.delete(0);
    bmpIds.delete(0);
    const other = chart.expansion.replace(
      /^[ \t]*#(?:WAV|BMP|BGA|@BGA|LNOBJ|[0-9]{3}(?:01|04|06|07|[1-8][1-9]))[^\r\n]*/gim,
      '',
    );
    let maxOther = convertTextBase(other, chart.base62, chart.base62, writer, 0).max;
    for (let i = MaxId36 + 1; i < chart.hCOM.length; i++) if (chart.hCOM[i]) maxOther = i;
    for (const n of chart.notes)
      if (n.comment) maxOther = Math.max(maxOther, intDiv(n.value, 10000));
    const target =
      options.useOldFormat &&
      maxOther <= MaxId36 &&
      wavIds.size <= MaxId36 &&
      bmpIds.size <= MaxId36
        ? false
        : chart.base62;
    const useHex = options.useOldFormat && wavIds.size <= 255 && bmpIds.size <= 255;
    const map = (ids: Set<number>, names: readonly string[]): number[] => {
      const ordered = [...ids].sort((a, b) =>
        options.byFilename
          ? (names[a] ?? '') < (names[b] ?? '')
            ? -1
            : (names[a] ?? '') > (names[b] ?? '')
              ? 1
              : a - b
          : a - b,
      );
      const result = Array.from({ length: MaxId62 + 1 }, (_, i) => i);
      for (let i = 0; i < ordered.length; i++)
        result[ordered[i]!] = useHex
          ? cIdto10((i + 1).toString(16).toUpperCase().padStart(2, '0'), target)
          : i + 1;
      return result;
    };
    const wavMap = map(wavIds, wavNames),
      bmpMap = map(bmpIds, bmpNames);
    const reorder = (table: readonly string[], mapping: readonly number[]): string[] => {
      const result = new Array<string>(table.length).fill('');
      result[0] = table[0]!;
      for (let i = 1; i < table.length; i++) if (table[i]) result[mapping[i]!] = table[i]!;
      return result;
    };
    chart.hWAV = reorder(chart.hWAV, wavMap);
    chart.hBMP = reorder(chart.hBMP, bmpMap);
    for (const n of chart.notes) {
      if (n.comment || n.landmine) continue;
      const id = intDiv(n.value, 10000);
      if (isColumnSound(n.columnIndex)) n.value = wavMap[id]! * 10000 + (n.value % 10000);
      if (isColumnImage(n.columnIndex)) n.value = bmpMap[id]! * 10000 + (n.value % 10000);
    }
    chart.header.lnObj = wavMap[chart.header.lnObj]!;
    const encode = (id: number): string => (id === 0 ? '00' : c10toId(id, chart.base62));
    chart.expansion = chart.expansion.replace(
      definitions,
      (_all: string, prefix: string, command: string, id: string, space: string, value: string) => {
        const mapping: readonly number[] = command.toUpperCase() === 'WAV' ? wavMap : bmpMap;
        if (isBga(command))
          value = value.replace(
            /^([0-9A-Za-z]{2})([ \t]|$)/,
            (_s: string, source: string, end: string) =>
              encode(bmpMap[cIdto10(source, chart.base62)]!) + end,
          );
        return prefix + command + encode(mapping[cIdto10(id, chart.base62)]!) + space + value;
      },
    );
    chart.expansion = chart.expansion.replace(
      lnObjects,
      (_all: string, prefix: string, id: string, end: string) =>
        prefix + encode(wavMap[cIdto10(id, chart.base62)]!) + end,
    );
    chart.expansion = chart.expansion.replace(
      tracks,
      (all: string, prefix: string, channel: string, colon: string, data: string, end: string) => {
        const kind = trackKind(channel);
        if (kind === 0) return all;
        const mapping: readonly number[] = kind === 1 ? wavMap : bmpMap;
        let result = '';
        for (let i = 0; i < data.length; i += 2)
          result += encode(mapping[cIdto10(data.slice(i, i + 2), chart.base62)]!);
        return prefix + channel + colon + result + end;
      },
    );
    if (target !== chart.base62) {
      chart.expansion = convertTextBase(chart.expansion, chart.base62, target, writer, 0).text;
      chart.base62 = target;
    }
  }
  const after = captureConversionState(chart);
  if (JSON.stringify(before) !== JSON.stringify(after))
    ctx.addUndo(
      [{ op: 'conversionState', state: before }],
      [{ op: 'conversionState', state: after }],
    );
  updatePairing(chart);
}
