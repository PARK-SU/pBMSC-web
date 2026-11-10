import {
  bmsChannelToColumn,
  isChannelHidden,
  isChannelLandmine,
  isChannelLongNote,
} from '../model/channels.ts';
import { niBPM } from '../model/constants.ts';
import { updateMeasureBottom } from '../model/measure.ts';
import { emptyNote, type Note } from '../model/note.ts';
import {
  cdbl,
  cintStr,
  clng,
  convertToInt32Hex,
  len,
  mid,
  startsWithCulture,
  trim,
  VbError,
  vbReplace,
  vbSplit,
} from '../vb.ts';
import { c36to10, cIdto10, MaxId62 } from './base.ts';
import { addToExpansion, isBase62BMS, swic, type ExpansionState } from './expansion.ts';

function measure(xMeasure: number): number {
  if (!(xMeasure >= 0 && xMeasure <= 999))
    throw new RangeError(`measure ${xMeasure} is out of range`);
  return xMeasure;
}

function times10000(xLong: number): number {
  const product = xLong * 10000;
  if (!(product >= -(2 ** 63) && product < 2 ** 63)) throw new VbError('Overflow');
  return product;
}

export function openBMSFunc(xStrAll: string): Note[] {
  xStrAll = vbReplace(vbReplace(vbReplace(xStrAll, '\n', '\r'), '\r\r', '\r'), '\r', '\r\n');

  const xStrLine = vbSplit(xStrAll, '\r\n');
  const xStrLine2: string[] = [];
  const state: ExpansionState = { xExpansion: '', xStack: 0 };

  const notes: Note[] = [emptyNote()];
  const mColumn = new Array<number>(1000).fill(0);
  const hBPM = new Array<number>(MaxId62 + 1).fill(0);
  const hSTOP = new Array<number>(MaxId62 + 1).fill(0);
  const hBMSCROLL = new Array<number>(MaxId62 + 1).fill(0);
  const xBase62 = isBase62BMS(xStrLine);
  const measureLength = new Array<number>(1000).fill(192);

  notes[0]!.columnIndex = niBPM;
  notes[0]!.vPosition = -1;
  notes[0]!.value = 1200000;

  for (const sLine of xStrLine) {
    const sLineTrim = trim(sLine);
    if (sLineTrim === '') continue;

    if (state.xStack > 0) {
      addToExpansion(state, sLine);
      continue;
    }

    if (startsWithCulture(sLineTrim, '#') && mid(sLineTrim, 5, 3) === '02:') {
      const xIndex = cintStr(mid(sLineTrim, 2, 3));
      const xRatio = cdbl(mid(sLineTrim, 8));
      measureLength[measure(xIndex)] = xRatio * 192;
      continue;
    } else if (swic(sLineTrim, '#BPM') && trim(mid(sLineTrim, len('#BPM') + 1, 1)) !== '') {
      hBPM[cIdto10(mid(sLineTrim, len('#BPM') + 1, 2), xBase62)] = clng(
        cdbl(mid(sLineTrim, len('#BPM') + 4)) * 10000,
      );
      continue;
    } else if (swic(sLineTrim, '#BPM')) {
      notes[0]!.value = times10000(clng(cdbl(trim(mid(sLineTrim, len('#BPM') + 1)))));
      continue;
    } else if (swic(sLineTrim, '#STOP')) {
      hSTOP[cIdto10(mid(sLineTrim, len('#STOP') + 1, 2), xBase62)] = clng(
        cdbl(mid(sLineTrim, len('#STOP') + 4)) * 10000,
      );
      continue;
    } else if (swic(sLineTrim, '#SCROLL')) {
      hBMSCROLL[cIdto10(mid(sLineTrim, len('#SCROLL') + 1, 2), xBase62)] = clng(
        cdbl(mid(sLineTrim, len('#SCROLL') + 4)) * 10000,
      );
      continue;
    }

    if (startsWithCulture(sLineTrim, '#') && mid(sLineTrim, 7, 1) === ':') {
      const xIdentifier = mid(sLineTrim, 5, 2);
      if (bmsChannelToColumn(xIdentifier) === 0) {
        state.xExpansion += sLine + '\r\n';
        continue;
      }
      xStrLine2.push(sLineTrim);
    } else {
      addToExpansion(state, sLine);
    }
  }

  const measureBottom = new Array<number>(1000).fill(0);
  updateMeasureBottom({ measureBottom, measureLength });

  for (const sLineTrim of xStrLine2) {
    if (!(startsWithCulture(sLineTrim, '#') && mid(sLineTrim, 7, 1) === ':')) continue;

    const xMeasure = cintStr(mid(sLineTrim, 2, 3));
    const channel = mid(sLineTrim, 5, 2);
    if (bmsChannelToColumn(channel) === 0) continue;

    if (channel === '01') mColumn[measure(xMeasure)] = mColumn[xMeasure]! + 1;
    for (let xI1 = 8; xI1 <= len(sLineTrim) - 1; xI1 += 2) {
      const xK = mid(sLineTrim, xI1, 2);
      if (xK === '00') continue;

      const note = emptyNote();
      notes.push(note);
      note.columnIndex =
        bmsChannelToColumn(channel) +
        (channel === '01' ? 1 : 0) * (mColumn[measure(xMeasure)]! - 1);
      note.longNote = isChannelLongNote(channel);
      note.hidden = isChannelHidden(channel);
      note.landmine = isChannelLandmine(channel);
      note.selected = false;
      note.vPosition =
        measureBottom[xMeasure]! +
        (measureLength[xMeasure]! * (xI1 / 2 - 4)) / ((len(sLineTrim) - 7) / 2);
      note.value = (note.landmine ? c36to10(xK) : cIdto10(xK, xBase62)) * 10000;

      if (channel === '03') note.value = convertToInt32Hex(xK) * 10000;
      if (channel === '08') note.value = hBPM[cIdto10(xK, xBase62)]!;
      if (channel === '09') note.value = hSTOP[cIdto10(xK, xBase62)]!;
      if (channel === 'SC') note.value = hBMSCROLL[cIdto10(xK, xBase62)]!;
    }
  }

  return notes;
}
