import { convertBMSE2NT, updatePairing } from '../edit/pairing.ts';
import {
  bmsChannelToColumn,
  isChannelHidden,
  isChannelLandmine,
  isChannelLongNote,
} from '../model/channels.ts';
import { createChart, defaultHeader, headerText, type Chart } from '../model/chart.ts';
import { niBPM } from '../model/constants.ts';
import { calculateGreatestVPosition, updateMeasureBottom } from '../model/measure.ts';
import { emptyNote } from '../model/note.ts';
import { sortByVPositionQuick } from '../model/sort.ts';
import {
  cdbl,
  cintStr,
  clng,
  convertToInt32Hex,
  doubleParse,
  endsWithCulture,
  integerParse,
  integerTryParse,
  len,
  mid,
  startsWithCulture,
  trim,
  VbError,
  vbReplace,
  vbSplit,
} from '../vb.ts';
import { c36to10, cIdto10, MaxId62 } from './base.ts';
import { setBase62 } from './base62.ts';
import { getDenominator } from './decimal.ts';
import { dotNetEnd, dotNetIgnoreCase, dotNetSpace } from './dotnet-regex.ts';
import { addToExpansion, isBase62BMS, swic, type ExpansionState } from './expansion.ts';
import { openBMSFunc } from './template.ts';

export interface OpenBMSHost {
  readTemplate(fileName: string): string;
}

const chPlayerItemCount = 3;
const chDifficultyItemCount = 6;

const baseLine = new RegExp(
  `^${dotNetIgnoreCase('#BASE')}${dotNetSpace}+(?:36|62)${dotNetSpace}*${dotNetEnd}`,
);

function at<T>(array: readonly T[], i: number, name: string): T {
  if (!(i >= 0 && i < array.length)) throw new RangeError(`${name}(${i}) is out of range`);
  return array[i]!;
}

function setTHBPM(value: number): void {
  if (!(value >= 1 && value <= 655359999)) throw new VbError('Argument');
}

function lBeatRefresh(chart: Pick<Chart, 'measureLength'>): void {
  for (let xILB = 0; xILB <= 999; xILB++) {
    const a = chart.measureLength[xILB]! / 192;
    const xxD = getDenominator(a);
    clng(a * xxD);
  }
}

export function initializeNewBMS(chart: Chart): void {
  const player = chart.header.player;
  chart.header = defaultHeader();
  chart.header.player = player === -1 ? 0 : player;
  setBase62(chart, false);
  chart.ghostMode = 0;
  chart.fileNameTemplate = '';
  chart.hCOM = new Array<string | undefined>(MaxId62 + 1).fill(undefined);
  chart.hCOMNum = 0;
  chart.expansion = '';
  chart.expansionSplit = ['', '', ''];
  chart.measureLength = new Array<number>(1000).fill(192);
  chart.measureBottom = Array.from({ length: 1000 }, (_, xI1) => xI1 * 192);
}

function initializeOpenBMS(chart: Chart): void {
  chart.header.player = 0;
}

export function openBMS(
  chart: Chart,
  xStrAll: string,
  xGhost = false,
  xComment = false,
  host?: OpenBMSHost,
): void {

  xStrAll = vbReplace(vbReplace(vbReplace(xStrAll, '\n', '\r'), '\r\r', '\r'), '\r', '\r\n');

  const xStrLine = vbSplit(xStrAll, '\r\n');
  let xStrLine2: string[] = [];
  const state: ExpansionState = { xExpansion: '', xStack: 0 };
  let xEditorExpansion = '';
  let nNotes = 1;

  if (xGhost) {
    nNotes = chart.notes.length;
  } else if (xComment) {
    nNotes = chart.notes.length;
    chart.mColumn = new Array<number>(1000).fill(0);
  } else {
    chart.notes = [emptyNote()];
    chart.notesTemplate = [emptyNote()];
    chart.mColumn = new Array<number>(1000).fill(0);
    chart.hWAV = new Array<string>(MaxId62 + 1).fill('');
    chart.hBMP = new Array<string>(MaxId62 + 1).fill('');
    chart.hBPM = new Array<number>(MaxId62 + 1).fill(0);
    chart.hSTOP = new Array<number>(MaxId62 + 1).fill(0);
    chart.hBMSCROLL = new Array<number>(MaxId62 + 1).fill(0);
    initializeNewBMS(chart);
    initializeOpenBMS(chart);
    setBase62(chart, isBase62BMS(xStrLine));

    chart.notes[0]!.columnIndex = niBPM;
    chart.notes[0]!.vPosition = -1;
    chart.notes[0]!.value = 1200000;
  }

  for (const sLine of xStrLine) {
    if (xComment) {
      xStrLine2 = xStrLine.slice();
      break;
    }

    const sLineTrim = trim(sLine);
    if (sLineTrim === '') continue;

    if (state.xStack > 0) {
      addToExpansion(state, sLine);
      continue;
    }
    if (!xGhost && !xComment) {
      if (startsWithCulture(sLineTrim, '#') && mid(sLineTrim, 5, 3) === '02:') {
        const xIndex = integerParse(mid(sLineTrim, 2, 3));
        const xRatio = doubleParse(mid(sLineTrim, 8));
        at(chart.measureLength, xIndex, 'MeasureLength');
        chart.measureLength[xIndex] = xRatio * 192;
        continue;
      } else if (chart.base62 && baseLine.test(sLineTrim)) {
        continue;
      } else if (swic(sLineTrim, '#WAV')) {
        const i = cIdto10(mid(sLineTrim, len('#WAV') + 1, 2), chart.base62);
        if (i === 0) {
          addToExpansion(state, sLine);
        } else {
          chart.hWAV[i] = mid(sLineTrim, len('#WAV') + 4);
        }
        continue;
      } else if (swic(sLineTrim, '#BMP')) {
        const i = cIdto10(mid(sLineTrim, len('#BMP') + 1, 2), chart.base62);
        if (i === 0) {
          addToExpansion(state, sLine);
        } else {
          chart.hBMP[i] = mid(sLineTrim, len('#BMP') + 4);
        }
        continue;
      } else if (swic(sLineTrim, '#BPM') && trim(mid(sLineTrim, len('#BPM') + 1, 1)) !== '') {
        chart.hBPM[cIdto10(mid(sLineTrim, len('#BPM') + 1, 2), chart.base62)] = clng(
          cdbl(mid(sLineTrim, len('#BPM') + 4)) * 10000,
        );
        continue;
      } else if (swic(sLineTrim, '#STOP')) {
        chart.hSTOP[cIdto10(mid(sLineTrim, len('#STOP') + 1, 2), chart.base62)] = clng(
          cdbl(mid(sLineTrim, len('#STOP') + 4)) * 10000,
        );
        continue;
      } else if (swic(sLineTrim, '#SCROLL')) {
        chart.hBMSCROLL[cIdto10(mid(sLineTrim, len('#SCROLL') + 1, 2), chart.base62)] = clng(
          cdbl(mid(sLineTrim, len('#SCROLL') + 4)) * 10000,
        );
        continue;
      } else if (swic(sLineTrim, '#TITLE')) {
        chart.header.title = headerText(trim(mid(sLineTrim, len('#TITLE') + 1)));
        continue;
      } else if (swic(sLineTrim, '#ARTIST')) {
        chart.header.artist = headerText(trim(mid(sLineTrim, len('#ARTIST') + 1)));
        continue;
      } else if (swic(sLineTrim, '#GENRE')) {
        chart.header.genre = headerText(trim(mid(sLineTrim, len('#GENRE') + 1)));
        continue;
      } else if (swic(sLineTrim, '#BPM')) {
        chart.notes[0]!.value = clng(cdbl(trim(mid(sLineTrim, len('#BPM') + 1))) * 10000);
        setTHBPM(chart.notes[0]!.value);
        continue;
      } else if (swic(sLineTrim, '#PLAYER')) {
        const xInt = cintStr(trim(mid(sLineTrim, len('#PLAYER') + 1)));
        if (xInt >= 1 && xInt <= 4) {
          if (xInt - 1 >= chPlayerItemCount) throw new VbError('Argument');
          chart.header.player = xInt - 1;
        }
        continue;
      } else if (swic(sLineTrim, '#RANK')) {
        const xInt = cintStr(trim(mid(sLineTrim, len('#RANK') + 1)));
        if (xInt >= 0 && xInt <= 4) chart.header.rank = xInt;
        continue;
      } else if (swic(sLineTrim, '#PLAYLEVEL')) {
        chart.header.playLevel = headerText(trim(mid(sLineTrim, len('#PLAYLEVEL') + 1)));
        continue;
      } else if (swic(sLineTrim, '#SUBTITLE')) {
        chart.header.subTitle = headerText(trim(mid(sLineTrim, len('#SUBTITLE') + 1)));
        continue;
      } else if (swic(sLineTrim, '#SUBARTIST')) {
        chart.header.subArtist = headerText(trim(mid(sLineTrim, len('#SUBARTIST') + 1)));
        continue;
      } else if (swic(sLineTrim, '#STAGEFILE')) {
        chart.header.stageFile = headerText(trim(mid(sLineTrim, len('#STAGEFILE') + 1)));
        continue;
      } else if (swic(sLineTrim, '#BANNER')) {
        chart.header.banner = headerText(trim(mid(sLineTrim, len('#BANNER') + 1)));
        continue;
      } else if (swic(sLineTrim, '#BACKBMP')) {
        chart.header.backBMP = headerText(trim(mid(sLineTrim, len('#BACKBMP') + 1)));
        continue;
      } else if (swic(sLineTrim, '#DIFFICULTY')) {
        const xIndex = integerTryParse(trim(mid(sLineTrim, len('#DIFFICULTY') + 1)));
        if (xIndex !== undefined && xIndex >= -1 && xIndex < chDifficultyItemCount) {
          chart.header.difficulty = xIndex;
        }
        continue;
      } else if (swic(sLineTrim, '#DEFEXRANK')) {
        chart.header.exRank = headerText(trim(mid(sLineTrim, len('#DEFEXRANK') + 1)));
        continue;
      } else if (swic(sLineTrim, '#TOTAL')) {
        chart.header.total = headerText(trim(mid(sLineTrim, len('#TOTAL') + 1)));
        continue;
      } else if (swic(sLineTrim, '#COMMENT')) {
        let xStr = trim(mid(sLineTrim, len('#COMMENT') + 1));
        if (startsWithCulture(xStr, '"')) xStr = mid(xStr, 2);
        if (endsWithCulture(xStr, '"')) xStr = mid(xStr, 1, len(xStr) - 1);
        chart.header.comment = headerText(xStr);
        continue;
      } else if (swic(sLineTrim, '#LNTYPE')) {
        if (integerParse(trim(mid(sLineTrim, len('#LNTYPE') + 1))) === 1) chart.header.lnObj = 0;
        continue;
      } else if (swic(sLineTrim, '#LNOBJ')) {
        chart.header.lnObj = cIdto10(trim(mid(sLineTrim, len('#LNOBJ') + 1)), chart.base62);
        continue;
      } else if (swic(sLineTrim, '#ECMD')) {
        xEditorExpansion += sLineTrim.replaceAll('#ECMD', '#') + '\r\n';
        continue;
      } else if (swic(sLineTrim, '#ECOM')) {
        const xComVal = cIdto10(mid(sLineTrim, len('#ECOM') + 1, 2), chart.base62);
        chart.hCOM[xComVal] = mid(sLineTrim, len('#ECOM') + 4);
        if (xComVal > chart.hCOMNum) chart.hCOMNum = xComVal;
        continue;
      } else if (swic(sLineTrim, '#TEMPLATE')) {
        chart.fileNameTemplate = mid(sLineTrim, len('#TEMPLATE') + 2);
        if (host === undefined) throw new VbError('IO');
        chart.notesTemplate = openBMSFunc(host.readTemplate(chart.fileNameTemplate));
        continue;
      }
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

  updateMeasureBottom(chart);
  lBeatRefresh(chart);

  for (const sLineTrim of xStrLine2) {
    if (!(startsWithCulture(sLineTrim, '#') && mid(sLineTrim, 7, 1) === ':')) continue;

    const xMeasure = cintStr(mid(sLineTrim, 2, 3));
    const channel = mid(sLineTrim, 5, 2);

    if (channel === '01') chart.mColumn[xMeasure] = at(chart.mColumn, xMeasure, 'mColumn') + 1;
    for (let xI1 = 8; xI1 <= len(sLineTrim) - 1; xI1 += 2) {
      const xK = mid(sLineTrim, xI1, 2);
      if (xK === '00') continue;

      chart.notes.push(emptyNote());
      const note = chart.notes[chart.notes.length - 1]!;
      note.columnIndex =
        bmsChannelToColumn(channel) +
        (channel === '01' ? 1 : 0) * (at(chart.mColumn, xMeasure, 'mColumn') - 1);
      note.longNote = isChannelLongNote(channel);
      note.hidden = isChannelHidden(channel);
      note.landmine = isChannelLandmine(channel);
      note.selected = false;
      note.vPosition =
        at(chart.measureBottom, xMeasure, 'MeasureBottom') +
        (at(chart.measureLength, xMeasure, 'MeasureLength') * (xI1 / 2 - 4)) /
          ((len(sLineTrim) - 7) / 2);
      note.value = (note.landmine ? c36to10(xK) : cIdto10(xK, chart.base62)) * 10000;
      note.ghost = xGhost;
      note.comment = xComment;

      if (channel === '03') note.value = convertToInt32Hex(xK) * 10000;
      if (channel === '08') note.value = at(chart.hBPM, cIdto10(xK, chart.base62), 'hBPM');
      if (channel === '09') note.value = at(chart.hSTOP, cIdto10(xK, chart.base62), 'hSTOP');
      if (channel === 'SC') {
        note.value = at(chart.hBMSCROLL, cIdto10(xK, chart.base62), 'hBMSCROLL');
      }
    }
  }

  if (xEditorExpansion !== '') openBMS(chart, xEditorExpansion, false, true);

  if (xGhost || xComment) {
    if (xGhost && chart.ntInput) convertBMSE2NT(chart, nNotes);
  } else {
    if (chart.ntInput) convertBMSE2NT(chart);

    chart.expansion = state.xExpansion;

    sortByVPositionQuick(chart.notes, 0, chart.notes.length - 1);
    updatePairing(chart);
    calculateGreatestVPosition(chart);
  }
}

export type ParseBMSResult = { ok: true; chart: Chart } | { ok: false; error: unknown };

export function parseBMS(
  text: string,
  init?: { ntInput?: boolean; host?: OpenBMSHost },
): ParseBMSResult {
  try {
    const chart = createChart();
    if (init?.ntInput !== undefined) chart.ntInput = init.ntInput;
    openBMS(chart, text, false, false, init?.host);
    return { ok: true, chart };
  } catch (error) {
    return { ok: false, error };
  }
}
