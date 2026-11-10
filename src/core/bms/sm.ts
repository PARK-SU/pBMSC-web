import { convertBMSE2NT, updatePairing } from '../edit/pairing.ts';
import { headerText, type Chart } from '../model/chart.ts';
import { niA1, niA2, niA3, niA4, niBPM } from '../model/constants.ts';
import { calculateGreatestVPosition } from '../model/measure.ts';
import { emptyNote } from '../model/note.ts';
import { sortByVPositionQuick } from '../model/sort.ts';
import {
  cdbl,
  cint,
  clngStr,
  endsWithCulture,
  instr,
  intDiv,
  len,
  mid,
  startsWithCulture,
  trim,
  ucase,
  VbError,
} from '../vb.ts';
import { MaxId62 } from './base.ts';
import { initializeNewBMS } from './parse.ts';

export type ChooseSMChart = (xDiff: readonly string[]) => number | undefined;

const smColumns = [niA1, niA2, niA3, niA4] as const;

export function openSM(chart: Chart, xStrAll: string, chooseChart: ChooseSMChart): boolean {

  let xStrLine = xStrAll.split('\r\n');
  for (let xI1 = 0; xI1 <= xStrLine.length - 1; xI1++) {
    const sLine = xStrLine[xI1]!;
    if (sLine.includes('//')) xStrLine[xI1] = mid(sLine, 1, instr(sLine, '//') - 1);
  }

  xStrAll = xStrLine.join('');
  xStrLine = xStrAll.split(';');

  let iDiff = 0;
  let iCurrentDiff = 0;
  const xTempSplit = xStrAll.split('#NOTES:');
  if (xTempSplit.length > 2) {
    const xTempStr: string[] = [];
    for (let xI1 = 1; xI1 <= xTempSplit.length - 1; xI1++) {
      let xPart = xTempSplit[xI1]!;
      xPart = mid(xPart, instr(xPart, ':') + 1);
      xPart = trim(mid(xPart, instr(xPart, ':') + 1));
      let xEntry = mid(xPart, 1, instr(xPart, ':') - 1);
      xPart = trim(mid(xPart, instr(xPart, ':') + 1));
      xEntry += ' : ' + mid(xPart, 1, instr(xPart, ':') - 1);
      xTempStr.push(xEntry);
    }

    const xResult = chooseChart(xTempStr);
    if (xResult === undefined) return true;
    iDiff = xResult;
  }

  chart.notes = [emptyNote()];
  chart.mColumn = new Array<number>(1000).fill(0);
  chart.hWAV = new Array<string>(MaxId62 + 1).fill('');
  chart.hBMP = new Array<string>(MaxId62 + 1).fill('');
  chart.hBPM = new Array<number>(MaxId62 + 1).fill(0);
  chart.hSTOP = new Array<number>(MaxId62 + 1).fill(0);
  chart.hBMSCROLL = new Array<number>(MaxId62 + 1).fill(0);
  initializeNewBMS(chart);

  const xSentinel = chart.notes[0]!;
  xSentinel.columnIndex = niBPM;
  xSentinel.vPosition = -1;
  xSentinel.value = 1200000;

  for (const sL of xStrLine) {
    const xUpper = ucase(sL);
    if (startsWithCulture(xUpper, '#TITLE:')) {
      chart.header.title = headerText(mid(sL, len('#TITLE:') + 1));
    } else if (startsWithCulture(xUpper, '#SUBTITLE:')) {
      if (!endsWithCulture(xUpper, '#SUBTITLE:')) {
        chart.header.title = headerText(chart.header.title + ' ' + mid(sL, len('#SUBTITLE:') + 1));
      }
    } else if (startsWithCulture(xUpper, '#ARTIST:')) {
      chart.header.artist = headerText(mid(sL, len('#ARTIST:') + 1));
    } else if (startsWithCulture(xUpper, '#GENRE:')) {
      chart.header.genre = headerText(mid(sL, len('#GENRE:') + 1));
    } else if (startsWithCulture(xUpper, '#BPMS:')) {
      const xLine = mid(sL, len('#BPMS:') + 1);
      const xItem = xLine.split(',');

      for (let xI1 = 0; xI1 <= xItem.length - 1; xI1++) {
        const xBPMChange = xItem[xI1]!;
        const xVal1 = cdbl(mid(xBPMChange, 1, instr(xBPMChange, '=') - 1));
        const xVal2 = clngStr(mid(xBPMChange, instr(xBPMChange, '=') + 1));

        if (xVal1 !== 0) {
          const xNote = emptyNote();
          chart.notes.push(xNote);
          xNote.columnIndex = niBPM;
          xNote.vPosition = xVal1 * 48;
          xNote.value = longTimes10000(xVal2);
        } else {
          chart.notes[0]!.value = longTimes10000(xVal2);
        }
      }
    } else if (startsWithCulture(xUpper, '#NOTES:')) {
      if (iCurrentDiff !== iDiff) {
        iCurrentDiff += 1;
        continue;
      }

      iCurrentDiff += 1;
      const xLine = mid(sL, len('#NOTES:') + 1);
      const xItem = xLine.split(':');
      for (let xI1 = 0; xI1 <= xItem.length - 1; xI1++) xItem[xI1] = trim(xItem[xI1]!);

      if (xItem.length !== 6) continue;

      chart.header.playLevel = headerText(xItem[3]!);

      const xM = xItem[5]!.split(',');
      for (let xI1 = 0; xI1 <= xM.length - 1; xI1++) xM[xI1] = trim(xM[xI1]!);

      for (let xI1 = 0; xI1 <= xM.length - 1; xI1++) {
        const xMeasure = xM[xI1]!;
        for (let xI2 = 0; xI2 <= len(xMeasure) - 1; xI2 += 4) {
          for (let xI3 = 0; xI3 <= 3; xI3++) {
            const xChar = chars(xMeasure, xI2 + xI3);
            if (xChar === '0') continue;

            const xNote = emptyNote();
            chart.notes.push(xNote);
            xNote.columnIndex = smColumns[xI3]!;
            xNote.longNote = xChar === '2' || xChar === '3';
            xNote.vPosition = cint(
              intDiv(intDiv(192, intDiv(len(xMeasure), 4)) * xI2, 4) + xI1 * 192,
            );
            xNote.value = 10000;
          }
        }
      }
    }
  }

  if (chart.ntInput) convertBMSE2NT(chart);


  const xBPM = chart.notes[0]!.value / 10000;
  if (xBPM < 0.0001 || xBPM > 65535.9999) throw new VbError('Argument');

  sortByVPositionQuick(chart.notes, 0, chart.notes.length - 1);
  updatePairing(chart);
  calculateGreatestVPosition(chart);
  return false;
}

function chars(s: string, i: number): string {
  if (i >= s.length) throw new RangeError('Index was outside the bounds of the array.');
  return s.charAt(i);
}

function longTimes10000(xLong: number): number {
  const xProduct = xLong * 10000;
  if (!(xProduct >= -(2 ** 63) && xProduct < 2 ** 63)) throw new VbError('Overflow');
  return xProduct;
}
