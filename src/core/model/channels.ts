import { c36to10 } from '../bms/base.ts';
import { add2Zeros } from '../bms/decimal.ts';
import { cintStr, hex, intDiv, integerTryParse, mid } from '../vb.ts';
import { getColumn } from './column.ts';
import {
  idflBPM,
  niA1,
  niA2,
  niA3,
  niA4,
  niA5,
  niA6,
  niA7,
  niA8,
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
  niSCROLL,
  niSTOP,
} from './constants.ts';
import type { Note } from './note.ts';

export const bmsChannelList: readonly string[] = [
  '01', '03', '04', '06', '07', '08', '09',
  '11', '12', '13', '14', '15', '16', '18', '19',
  '21', '22', '23', '24', '25', '26', '28', '29',
  '31', '32', '33', '34', '35', '36', '38', '39',
  '41', '42', '43', '44', '45', '46', '48', '49',
  '51', '52', '53', '54', '55', '56', '58', '59',
  '61', '62', '63', '64', '65', '66', '68', '69',
  'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D8', 'D9',
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E8', 'E9',
  'SC',
];

export function bmsChannelToColumn(i: string): number {
  switch (i) {
    case '01': return niB;
    case '03': case '08': return niBPM;
    case '09': return niSTOP;
    case 'SC': return niSCROLL;
    case '04': return niBGA;
    case '07': return niLAYER;
    case '06': return niPOOR;

    case '16': case '36': case '56': case '76': case 'D6': return niA1;
    case '11': case '31': case '51': case '71': case 'D1': return niA2;
    case '12': case '32': case '52': case '72': case 'D2': return niA3;
    case '13': case '33': case '53': case '73': case 'D3': return niA4;
    case '14': case '34': case '54': case '74': case 'D4': return niA5;
    case '15': case '35': case '55': case '75': case 'D5': return niA6;
    case '18': case '38': case '58': case '78': case 'D8': return niA7;
    case '19': case '39': case '59': case '79': case 'D9': return niA8;

    case '21': case '41': case '61': case '81': case 'E1': return niD1;
    case '22': case '42': case '62': case '82': case 'E2': return niD2;
    case '23': case '43': case '63': case '83': case 'E3': return niD3;
    case '24': case '44': case '64': case '84': case 'E4': return niD4;
    case '25': case '45': case '65': case '85': case 'E5': return niD5;
    case '28': case '48': case '68': case '88': case 'E8': return niD6;
    case '29': case '49': case '69': case '89': case 'E9': return niD7;
    case '26': case '46': case '66': case '86': case 'E6': return niD8;

    default: return 0;
  }
}

export function bmsEChannelToColumnIndex(i: string): number {
  const ivalue = cintStr(i);
  if (ivalue > 100) {
    return niB + ivalue - 101;
  } else if (ivalue < 100 && ivalue > 0) {
    return bmsChannelToColumn(mid(i, 2, 2));
  }
  return niB;
}

export function getBMSChannelBy(note: Readonly<Note>, bpmChannel08Now: boolean): string {
  const iCol = note.columnIndex;
  const xVal = note.value;
  let bmsBaseChannel = getColumn(iCol).identifier;

  if (
    iCol === niBPM &&
    (bpmChannel08Now || xVal / 10000 !== intDiv(xVal, 10000) || xVal >= 2560000 || xVal < 0)
  ) {
    bmsBaseChannel += idflBPM;
  }

  if (iCol === niSCROLL) return 'SC';

  if (iCol >= niA1 && iCol <= niA8) {
    if (note.longNote) return hex(bmsBaseChannel + 0x50 - 10);
    if (note.hidden) return hex(bmsBaseChannel + 0x30 - 10);
    if (note.landmine) return hex(bmsBaseChannel + 0xd0 - 10);
  }

  if (iCol >= niD1 && iCol <= niD8) {
    if (note.longNote) return hex(bmsBaseChannel + 0x60 - 20);
    if (note.hidden) return hex(bmsBaseChannel + 0x40 - 20);
    if (note.landmine) return hex(bmsBaseChannel + 0xe0 - 20);
  }

  return add2Zeros(bmsBaseChannel);
}

export function isChannelLongNote(i: string): boolean {
  const xI = integerTryParse(i);
  if (xI === undefined) return false;
  return xI >= 50 && xI < 90;
}

export function isChannelHidden(i: string): boolean {
  const xI = integerTryParse(i);
  if (xI === undefined) return false;
  return (xI >= 30 && xI < 50) || (xI >= 70 && xI < 90);
}

export function isChannelLandmine(i: string): boolean {
  const landmineStart = c36to10('D0');
  const landmineEnd = c36to10('EZ');
  const xI = c36to10(i);
  return xI > landmineStart && xI < landmineEnd;
}
