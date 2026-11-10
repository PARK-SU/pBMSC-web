import type { Chart, EditorOptions, ReadonlyChart } from '../model/chart.ts';
import { isColumnNumeric } from '../model/column.ts';
import { cint, intDiv } from '../vb.ts';
import { c10toId, cIdto10, MaxId36, maxId } from './base.ts';
import {
  dotNetAlnumIgnoreCase,
  dotNetAny,
  dotNetEnd,
  dotNetIgnoreCase,
  dotNetSpace,
} from './dotnet-regex.ts';

export function setBase62(chart: Pick<Chart, 'base62' | 'header'>, xBase62: boolean): void {
  chart.base62 = xBase62;
  if (chart.header.lnObj > maxId(xBase62)) chart.header.lnObj = 0;
}

const ws = dotNetSpace;

const baseLine = new RegExp(`^${ws}*${dotNetIgnoreCase('#BASE')}${ws}+(36|62)${ws}*${dotNetEnd}`);

const commands = ['WAV', 'BMP', 'BPM', 'STOP', 'SCROLL', 'SPEED', 'EXWAV', 'EXBPM', 'BGA', '@BGA'];

const commandLine = new RegExp(
  `^(${ws}*#)(${commands.map(dotNetIgnoreCase).join('|')})(${dotNetAlnumIgnoreCase}{2})` +
    `(${ws}${dotNetAny}*)${dotNetEnd}`,
);

const bgaSource = new RegExp(`^(${ws}+)([0-9A-Za-z]{2})(${ws}${dotNetAny}*|)${dotNetEnd}`);

const lnObjLine = new RegExp(
  `^(${ws}*${dotNetIgnoreCase('#LNOBJ')}${ws}+)(${dotNetAlnumIgnoreCase}{1,2})(${ws}*)${dotNetEnd}`,
);

const channelLine = new RegExp(
  `^(${ws}*#[0-9]{3})([0-9A-Za-z]{2})(:)((?:[0-9A-Za-z]{2})*)(${ws}*)${dotNetEnd}`,
);

export function convertTextBase(
  xText: string,
  xFrom62: boolean,
  xTo62: boolean,
  options: Readonly<EditorOptions>,
  xMax: number,
): { text: string; max: number } {
  if (xText === '') return { text: xText, max: xMax };

  let xGreatest = xMax;
  const convertId = (xId: string): string => {
    const xValue = cIdto10(xId, xFrom62);
    if (xValue === 0) return xId;
    xGreatest = Math.max(xGreatest, xValue);
    return c10toId(xValue, xTo62);
  };
  const isIdChannel = (xChannel: string): boolean => {
    switch (xChannel) {
      case '01':
      case '04':
      case '06':
      case '07':
      case '0A':
      case 'SC':
      case 'SP':
        return true;
      case '08':
        return options.bpmx1296;
      case '09':
        return options.stopx1296;
    }
    return (
      xChannel.charAt(0) >= '1' &&
      xChannel.charAt(0) <= '6' &&
      xChannel.charAt(1) >= '1' &&
      xChannel.charAt(1) <= '9'
    );
  };

  const xParts = xText.split(/(\r\n|\r|\n)/);
  let xOut = '';
  for (let i = 0; i <= xParts.length - 1; i += 2) {
    let xLine = xParts[i]!;
    const xSeparator = i < xParts.length - 1 ? xParts[i + 1]! : '';
    if (baseLine.test(xLine)) continue;

    let m = commandLine.exec(xLine);
    if (m !== null) {
      const xCommand = m[2]!.toUpperCase();
      let xRest = m[4]!;
      if (xCommand === 'BGA' || xCommand === '@BGA') {
        const mSource = bgaSource.exec(xRest);
        if (mSource !== null) xRest = mSource[1]! + convertId(mSource[2]!) + mSource[3]!;
      }
      if (
        ((xCommand === 'BPM' || xCommand === 'EXBPM') && !options.bpmx1296) ||
        (xCommand === 'STOP' && !options.stopx1296)
      ) {
        xLine = m[1]! + m[2]! + m[3]! + xRest;
      } else {
        xLine = m[1]! + m[2]! + convertId(m[3]!) + xRest;
      }
    } else {
      m = lnObjLine.exec(xLine);
      if (m !== null) {
        xLine = m[1]! + convertId(m[2]!) + m[3]!;
      } else {
        m = channelLine.exec(xLine);
        if (m !== null && isIdChannel(m[2]!.toUpperCase())) {
          const xData = m[4]!;
          let xNew = '';
          for (let j = 0; j <= xData.length - 2; j += 2) {
            const xId = xData.substring(j, j + 2);
            xNew += xId === '00' ? xId : convertId(xId);
          }
          xLine = m[1]! + m[2]! + m[3]! + xNew + m[5]!;
        }
      }
    }
    xOut += xLine + xSeparator;
  }

  return { text: xOut, max: xGreatest };
}

export function rekeyIdTable(
  xTable: readonly number[],
  xFrom62: boolean,
  xTo62: boolean,
): number[] {
  const xNew = new Array<number>(xTable.length).fill(0);
  xNew[0] = xTable[0]!;
  for (let i = 1; i <= Math.min(xTable.length - 1, maxId(xFrom62)); i++) {
    if (xTable[i] === 0) continue;
    const xKey = cIdto10(c10toId(i, xFrom62), xTo62);
    if (xKey <= xNew.length - 1) xNew[xKey] = xTable[i]!;
  }
  return xNew;
}

export function greatestIdInUse(
  chart: Pick<ReadonlyChart, 'header' | 'hWAV' | 'hBMP' | 'hCOM' | 'notes'>,
): number {
  let xMax = chart.header.lnObj;
  for (let i = chart.hWAV.length - 1; i >= 1; i--) {
    if (chart.hWAV[i] !== '') {
      xMax = Math.max(xMax, i);
      break;
    }
  }
  for (let i = chart.hBMP.length - 1; i >= 1; i--) {
    if (chart.hBMP[i] !== '') {
      xMax = Math.max(xMax, i);
      break;
    }
  }
  for (let i = chart.hCOM.length - 1; i >= 1; i--) {
    if ((chart.hCOM[i] ?? '') !== '') {
      xMax = Math.max(xMax, i);
      break;
    }
  }
  for (let i = 1; i <= chart.notes.length - 1; i++) {
    const note = chart.notes[i]!;
    if (note.landmine || isColumnNumeric(note.columnIndex)) continue;
    xMax = Math.max(xMax, cint(intDiv(note.value, 10000)));
  }
  return xMax;
}

export type ConvertChartBaseResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: 'BaseChangeWhileModifyingSection' }
  | { readonly ok: false; readonly error: 'Base36OverflowError'; readonly id: number };

export function convertChartBase(
  chart: Chart,
  options: Readonly<EditorOptions>,
  toBase62: boolean,
  sectionTabOpen: boolean,
): ConvertChartBaseResult {
  if (toBase62 === chart.base62) return { ok: true };

  if (chart.randomSource !== undefined || sectionTabOpen) {
    return { ok: false, error: 'BaseChangeWhileModifyingSection' };
  }

  let xMax = greatestIdInUse(chart);
  const expansion = convertTextBase(chart.expansion, chart.base62, toBase62, options, xMax);
  const xExpansion = expansion.text;
  xMax = expansion.max;
  let xSplitMax = 0;
  const xExpansionSplit: string[] = [];
  for (let i = 0; i <= chart.expansionSplit.length - 1; i++) {
    const split = convertTextBase(
      chart.expansionSplit[i]!,
      chart.base62,
      toBase62,
      options,
      xSplitMax,
    );
    xExpansionSplit.push(split.text);
    xSplitMax = split.max;
  }
  if (chart.ghostMode !== 0) xMax = Math.max(xMax, xSplitMax);
  if (!toBase62 && xMax > MaxId36) return { ok: false, error: 'Base36OverflowError', id: xMax };

  if (chart.expansion !== xExpansion) chart.expansion = xExpansion;
  chart.expansionSplit = [...xExpansionSplit];
  if (!options.bpmx1296) chart.hBPM = rekeyIdTable(chart.hBPM, chart.base62, toBase62);
  if (!options.stopx1296) chart.hSTOP = rekeyIdTable(chart.hSTOP, chart.base62, toBase62);
  setBase62(chart, toBase62);
  return { ok: true };
}
