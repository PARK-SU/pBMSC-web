import { convertNT2BMSE, updatePairing } from '../edit/pairing.ts';
import { removeCommentNotes, removeGhostNotes, swapGhostNotes } from '../edit/random.ts';
import { bmsChannelList, getBMSChannelBy, isChannelLandmine } from '../model/channels.ts';
import type { Chart, EditorOptions, ReadonlyChart } from '../model/chart.ts';
import { niB } from '../model/constants.ts';
import { calculateGreatestVPosition, measureAtDisplacement } from '../model/measure.ts';
import { cloneNote, cloneNotes, emptyNote, type Note } from '../model/note.ts';
import { sortByVPositionInsertion } from '../model/sort.ts';
import { cint, gcdDouble, hex, intDiv, len, mid, VbError, vbReplace, vbSplit } from '../vb.ts';
import { c10to36, c10toId, cIdto10, MaxId36, maxId } from './base.ts';
import { greatestIdInUse } from './base62.ts';
import { add3Zeros, writeDecimalWithDot } from './decimal.ts';
import { extractExpansion, swic } from './expansion.ts';

const headerField = '*---------------------- HEADER FIELD';
const expansionField = '*---------------------- EXPANSION FIELD';
const editorExpansionField = '*---------------------- EDITOR EXPANSION FIELD';
const mainDataField = '*---------------------- MAIN DATA FIELD';
const randomDataField = '*---------------------- RANDOM DATA FIELD';

export type SaveWarning =
  | { readonly message: 'NoteOverlapError' }
  | {
      readonly message: 'BPMOverflowError' | 'STOPOverflowError' | 'SCROLLOverflowError';
      readonly count: number;
      readonly limit: number;
    }
  | { readonly message: 'Base36OverflowError'; readonly id: number };

export interface SaveResult {
  text: string;
  warnings: SaveWarning[];
}

export interface TrackState {
  hasOverlapping: boolean;
  xprevNotes: Note[];
}

export function saveBMS(
  chart: Chart,
  options: Readonly<EditorOptions>,
  xRandom = false,
  warnings: SaveWarning[] = [],
): SaveResult {
  const text = saveBMSInto(warnings, chart, options, xRandom);
  return { text, warnings };
}

function saveBMSInto(
  warnings: SaveWarning[],
  chart: Chart,
  options: Readonly<EditorOptions>,
  xRandom: boolean,
): string {
  let xGreatestId = 0;
  if (!xRandom && !chart.base62) xGreatestId = greatestIdInUse(chart);
  calculateGreatestVPosition(chart);
  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
  const xLastMeasure = measureAtDisplacement(chart, chart.greatestVPosition) + 1;
  const xStrMeasure: string[] = [];

  const xNTInput = chart.ntInput;
  if (chart.ghostMode === 2) swapGhostNotes(chart);
  let xNotesBackup = cloneNotes(chart.notes);

  if (xNTInput) {
    chart.ntInput = false;
    convertNT2BMSE(chart);
  }

  if (!xRandom) {
    chart.hBPM = [0];
    chart.hSTOP = [0];
    chart.hBMSCROLL = [0];
  }

  const tracks: TrackState = { hasOverlapping: false, xprevNotes: [] };

  removeGhostNotes(chart);
  removeCommentNotes(chart);

  const bpmChannel08Now = options.bpmChannel08 && !xRandom && chart.randomSource === undefined;
  const noteMeasures = chart.notes.map((n) => measureAtDisplacement(chart, n.vPosition));
  for (let measureIndex = 0; measureIndex <= xLastMeasure; measureIndex++) {
    let xStr = '\r\n';

    const measureLength = measureLengthAt(chart, measureIndex);
    const consistentDecimalStr = writeDecimalWithDot(measureLength / 192);

    if (measureLength !== 192) {
      xStr += '#' + add3Zeros(measureIndex) + '02:' + consistentDecimalStr + '\r\n';
    }

    const { lowerLimit, upperLimit } = getMeasureLimits(
      chart,
      measureIndex,
      (i) => noteMeasures[i]!,
    );

    if (upperLimit - lowerLimit === 0 && tracks.xprevNotes.length === 0) {
      xStrMeasure.push(xStr);
      continue;
    }

    const notesInMeasure: Readonly<Note>[] = [...tracks.xprevNotes];
    for (let i = lowerLimit; i <= upperLimit - 1; i++) notesInMeasure.push(chart.notes[i]!);

    let greatestColumn = 0;
    for (const tempNote of notesInMeasure) {
      greatestColumn = Math.max(tempNote.columnIndex, greatestColumn);
    }

    tracks.xprevNotes = [];
    xStr += generateBackgroundTracks(
      chart,
      options,
      measureIndex,
      tracks,
      notesInMeasure,
      greatestColumn,
    );
    xStr += generateKeyTracks(
      chart,
      options,
      measureIndex,
      tracks,
      notesInMeasure,
      bpmChannel08Now,
    );
    xStrMeasure.push(xStr);
  }

  if (tracks.hasOverlapping) warnings.push({ message: 'NoteOverlapError' });
  const bpmLimit = options.bpmx1296 ? maxId(chart.base62) : 255;
  if (chart.hBPM.length - 1 > bpmLimit) {
    warnings.push({ message: 'BPMOverflowError', count: chart.hBPM.length - 1, limit: bpmLimit });
  }
  const stopLimit = options.stopx1296 ? maxId(chart.base62) : 255;
  if (chart.hSTOP.length - 1 > stopLimit) {
    warnings.push({
      message: 'STOPOverflowError',
      count: chart.hSTOP.length - 1,
      limit: stopLimit,
    });
  }
  const scrollLimit = maxId(chart.base62);
  if (chart.hBMSCROLL.length - 1 > scrollLimit) {
    warnings.push({
      message: 'SCROLLOverflowError',
      count: chart.hBMSCROLL.length - 1,
      limit: scrollLimit,
    });
  }
  if (xGreatestId > MaxId36) warnings.push({ message: 'Base36OverflowError', id: xGreatestId });

  if (xRandom) {
    return chart.expansion + '\r\n' + xStrMeasure.join('') + '\r\n' + randomDataField;
  }

  let ghostModeTemp = -1;
  if (chart.ghostMode !== 0) {
    ghostModeTemp = chart.ghostMode;
    chart.ghostMode = 0;
    chart.expansion = '';
    const xKBackUpG = cloneNotes(xNotesBackup);
    const xStrCompare = vbSplit(
      vbReplace(
        vbReplace(
          vbReplace(saveBMSInto(warnings, chart, options, false), '\n', '\r'),
          '\r\r',
          '\r',
        ),
        '\r',
        '\r\n',
      ),
      '\r\n',
    );

    chart.notes = cloneNotes(xKBackUpG);
    if (xNTInput) convertNT2BMSE(chart);
    swapGhostNotes(chart);
    removeGhostNotes(chart);
    removeCommentNotes(chart);
    chart.expansion = extractExpansion(chart.expansionSplit[1]!);
    const xStrExpGhostNotes = saveBMSInto(warnings, chart, options, true);
    chart.ghostMode = ghostModeTemp;

    let expansionSplit1 = '';
    for (const xStrLine of xStrExpGhostNotes.split('\r\n')) {
      if (
        (!xStrCompare.includes(xStrLine) && xStrLine !== randomDataField) ||
        swic(xStrLine, '#RANDOM') ||
        swic(xStrLine, '#IF') ||
        swic(xStrLine, '#ENDIF')
      ) {
        expansionSplit1 += xStrLine + '\r\n';
      }
    }
    chart.expansionSplit[1] = expansionSplit1;
    chart.expansion = chart.expansionSplit.join('\r\n');
    xNotesBackup = cloneNotes(xKBackUpG);
  }
  let xStrExp = '\r\n' + expansionField + '\r\n' + chart.expansion + '\r\n' + '\r\n';
  if (chart.expansion === '') xStrExp = '';

  let xStrEditorCommentNotes = '';
  chart.notes = cloneNotes(xNotesBackup);
  if (xNTInput) convertNT2BMSE(chart);
  for (let xI1 = 1; xI1 <= chart.notes.length - 1; xI1++) {
    chart.notes[xI1]!.comment = !chart.notes[xI1]!.comment;
  }
  removeCommentNotes(chart);
  if (chart.notes.length - 1 > 0) {
    const expansionTextTemp = chart.expansion;
    chart.expansion = '';
    if (ghostModeTemp !== -1) chart.ghostMode = 0;
    xStrEditorCommentNotes = saveBMSInto(warnings, chart, options, true)
      .replaceAll(randomDataField, '')
      .replaceAll('\r\n\r\n', '\r\n')
      .replaceAll('#', '#ECMD');
    if (ghostModeTemp !== -1) chart.ghostMode = ghostModeTemp;
    for (let i = 1; i <= chart.hCOM.length - 1; i++) {
      const xComment = chart.hCOM[i];
      if (xComment !== undefined) {
        xStrEditorCommentNotes += '\r\n' + '#ECOM' + c10toId(i, chart.base62) + ' ' + xComment;
      }
    }
    chart.expansion = expansionTextTemp;
  }
  let xStrEditorTemplate = '';
  if (chart.fileNameTemplate !== '') xStrEditorTemplate = '#TEMPLATE ' + chart.fileNameTemplate;
  let xStrEditor =
    '\r\n' +
    editorExpansionField +
    '\r\n' +
    xStrEditorCommentNotes +
    '\r\n' +
    xStrEditorTemplate +
    '\r\n' +
    '\r\n';
  if (xStrEditorCommentNotes === '' && xStrEditorTemplate === '') xStrEditor = '';

  const xStrMain = mainDataField + '\r\n' + '\r\n' + xStrMeasure.join('') + '\r\n';

  chart.notes = cloneNotes(xNotesBackup);
  if (xNTInput) chart.ntInput = true;

  if (chart.ghostMode === 2) swapGhostNotes(chart);

  let xStrHeader = generateHeaderMeta(chart);
  xStrHeader += generateHeaderIndexedData(chart, options);

  return xStrHeader + '\r\n' + xStrExp + '\r\n' + xStrEditor + '\r\n' + xStrMain;
}

function measureLengthAt(chart: Pick<ReadonlyChart, 'measureLength'>, i: number): number {
  const length = chart.measureLength[i];
  if (length === undefined) throw new RangeError(`MeasureLength(${i}) is out of range`);
  return length;
}

function hexId(n: number): string {
  return mid('0' + hex(n), len(hex(n)));
}

function newSlots(n: number): string[] {
  const upperBound = cint(n) - 1;
  if (upperBound < -1) throw new VbError('Overflow');
  return new Array<string>(upperBound + 1).fill('00');
}

export function generateHeaderMeta(
  chart: Pick<ReadonlyChart, 'header' | 'notes' | 'base62'>,
): string {
  const h = chart.header;
  let xStrHeader = '\r\n' + headerField + '\r\n' + '\r\n';
  xStrHeader += '#PLAYER ' + String(h.player + 1) + '\r\n';
  xStrHeader += '#GENRE ' + h.genre + '\r\n';
  xStrHeader += '#TITLE ' + h.title + '\r\n';
  xStrHeader += '#ARTIST ' + h.artist + '\r\n';
  xStrHeader += '#BPM ' + writeDecimalWithDot(chart.notes[0]!.value / 10000) + '\r\n';
  xStrHeader += '#PLAYLEVEL ' + h.playLevel + '\r\n';
  xStrHeader += '#RANK ' + String(h.rank) + '\r\n';
  xStrHeader += '\r\n';
  if (h.subTitle !== '') xStrHeader += '#SUBTITLE ' + h.subTitle + '\r\n';
  if (h.subArtist !== '') xStrHeader += '#SUBARTIST ' + h.subArtist + '\r\n';
  if (h.stageFile !== '') xStrHeader += '#STAGEFILE ' + h.stageFile + '\r\n';
  if (h.banner !== '') xStrHeader += '#BANNER ' + h.banner + '\r\n';
  if (h.backBMP !== '') xStrHeader += '#BACKBMP ' + h.backBMP + '\r\n';
  xStrHeader += '\r\n';
  if (h.difficulty > 0) xStrHeader += '#DIFFICULTY ' + String(h.difficulty) + '\r\n';
  if (h.exRank !== '') xStrHeader += '#DEFEXRANK ' + h.exRank + '\r\n';
  if (h.total !== '') xStrHeader += '#TOTAL ' + h.total + '\r\n';
  if (h.comment !== '') xStrHeader += '#COMMENT "' + h.comment + '"' + '\r\n';
  if (chart.base62) xStrHeader += '#BASE 62' + '\r\n';
  if (h.lnObj > 0) {
    xStrHeader += '#LNOBJ ' + c10toId(h.lnObj, chart.base62) + '\r\n';
  } else {
    xStrHeader += '#LNTYPE 1' + '\r\n';
  }
  xStrHeader += '\r\n';
  return xStrHeader;
}

export function generateHeaderIndexedData(
  chart: Pick<ReadonlyChart, 'hWAV' | 'hBMP' | 'hBPM' | 'hSTOP' | 'hBMSCROLL' | 'base62'>,
  options: Readonly<EditorOptions>,
): string {
  let xStrHeader = '';

  for (let i = 1; i <= chart.hWAV.length - 1; i++) {
    if (chart.hWAV[i] !== '') {
      xStrHeader += '#WAV' + c10toId(i, chart.base62) + ' ' + chart.hWAV[i]! + '\r\n';
    }
  }
  for (let i = 1; i <= chart.hBMP.length - 1; i++) {
    if (chart.hBMP[i] !== '') {
      xStrHeader += '#BMP' + c10toId(i, chart.base62) + ' ' + chart.hBMP[i]! + '\r\n';
    }
  }
  for (let i = 1; i <= Math.min(chart.hBPM.length - 1, maxId(chart.base62)); i++) {
    xStrHeader +=
      '#BPM' +
      (options.bpmx1296 ? c10toId(i, chart.base62) : hexId(i)) +
      ' ' +
      writeDecimalWithDot(chart.hBPM[i]! / 10000) +
      '\r\n';
  }
  for (let i = 1; i <= Math.min(chart.hSTOP.length - 1, maxId(chart.base62)); i++) {
    xStrHeader +=
      '#STOP' +
      (options.stopx1296 ? c10toId(i, chart.base62) : hexId(i)) +
      ' ' +
      writeDecimalWithDot(chart.hSTOP[i]! / 10000) +
      '\r\n';
  }
  for (let i = 1; i <= Math.min(chart.hBMSCROLL.length - 1, maxId(chart.base62)); i++) {
    xStrHeader +=
      '#SCROLL' +
      c10toId(i, chart.base62) +
      ' ' +
      writeDecimalWithDot(chart.hBMSCROLL[i]! / 10000) +
      '\r\n';
  }

  return xStrHeader;
}

export function getMeasureLimits(
  chart: Pick<ReadonlyChart, 'notes' | 'measureBottom'>,
  measureIndex: number,
  measureOf = (i: number): number => measureAtDisplacement(chart, chart.notes[i]!.vPosition),
): { lowerLimit: number; upperLimit: number } {
  const noteCount = chart.notes.length - 1;
  let lowerLimit = 0;

  for (let i = 1; i <= noteCount; i++) {
    if (measureOf(i) >= measureIndex) {
      lowerLimit = i;
      break;
    }
  }

  let upperLimit = 0;

  for (let i = lowerLimit; i <= noteCount; i++) {
    if (measureOf(i) > measureIndex) {
      upperLimit = i;
      break;
    }
  }

  if (upperLimit < lowerLimit) upperLimit = noteCount + 1;
  return { lowerLimit, upperLimit };
}

export function generateKeyTracks(
  chart: Pick<Chart, 'measureLength' | 'measureBottom' | 'hBPM' | 'hSTOP' | 'hBMSCROLL' | 'base62'>,
  options: Readonly<EditorOptions>,
  measureIndex: number,
  state: TrackState,
  notesInMeasure: readonly Readonly<Note>[],
  bpmChannel08Now: boolean,
): string {
  let ret = '';

  for (const currentBMSChannel of bmsChannelList) {
    const relativeMeasurePos: number[] = [];
    const noteStrings: string[] = [];
    const channelNotes: Readonly<Note>[] = [];

    if (currentBMSChannel === '01') continue;

    for (let noteIndex = 0; noteIndex <= notesInMeasure.length - 1; noteIndex++) {
      const currentNote = notesInMeasure[noteIndex]!;
      if (getBMSChannelBy(currentNote, bpmChannel08Now) !== currentBMSChannel) continue;

      channelNotes.push(currentNote);
      let position =
        currentNote.vPosition -
        chart.measureBottom[measureAtDisplacement(chart, currentNote.vPosition)]!;
      if (position < 0) position = 0;
      relativeMeasurePos.push(position);

      if (currentBMSChannel === '03') {
        noteStrings.push(hexId(intDiv(currentNote.value, 10000)));
      } else if (currentBMSChannel === '08') {
        let bpmIndex: number;
        for (bpmIndex = 1; bpmIndex <= chart.hBPM.length - 1; bpmIndex++) {
          if (currentNote.value === chart.hBPM[bpmIndex]) break;
        }
        if (bpmIndex > chart.hBPM.length - 1) chart.hBPM = [...chart.hBPM, currentNote.value];
        noteStrings.push(options.bpmx1296 ? c10toId(bpmIndex, chart.base62) : hexId(bpmIndex));
      } else if (currentBMSChannel === '09') {
        let stopIndex: number;
        for (stopIndex = 1; stopIndex <= chart.hSTOP.length - 1; stopIndex++) {
          if (currentNote.value === chart.hSTOP[stopIndex]) break;
        }
        if (stopIndex > chart.hSTOP.length - 1) chart.hSTOP = [...chart.hSTOP, currentNote.value];
        noteStrings.push(options.stopx1296 ? c10toId(stopIndex, chart.base62) : hexId(stopIndex));
      } else if (currentBMSChannel === 'SC') {
        let scrollIndex: number;
        for (scrollIndex = 1; scrollIndex <= chart.hBMSCROLL.length - 1; scrollIndex++) {
          if (currentNote.value === chart.hBMSCROLL[scrollIndex]) break;
        }
        if (scrollIndex > chart.hBMSCROLL.length - 1) {
          chart.hBMSCROLL = [...chart.hBMSCROLL, currentNote.value];
        }
        noteStrings.push(c10toId(scrollIndex, chart.base62));
      } else if (isChannelLandmine(currentBMSChannel)) {
        noteStrings.push(c10to36(intDiv(currentNote.value, 10000)));
      } else {
        noteStrings.push(c10toId(intDiv(currentNote.value, 10000), chart.base62));
      }
    }

    if (relativeMeasurePos.length === 0) continue;

    const measureLength = measureLengthAt(chart, measureIndex);
    let xGCD = measureLength;
    for (const position of relativeMeasurePos) {
      if (position > 0) xGCD = gcdDouble(xGCD, position, options.bmsGridLimit);
    }

    const xStrKey = newSlots(measureLength / xGCD);

    for (let i = 0; i <= relativeMeasurePos.length - 1; i++) {
      const slot = cint(relativeMeasurePos[i]! / xGCD);
      if (slot > xStrKey.length - 1) {
        const carried = cloneNote(channelNotes[i]!);
        carried.vPosition = chart.measureBottom[measureIndex]!;
        state.xprevNotes.push(carried);
        continue;
      }
      if (xStrKey[slot] !== '00') state.hasOverlapping = true;
      xStrKey[slot] = noteStrings[i]!;
    }

    ret += '#' + add3Zeros(measureIndex) + currentBMSChannel + ':' + xStrKey.join('') + '\r\n';
  }

  return ret;
}

export function generateBackgroundTracks(
  chart: Pick<ReadonlyChart, 'measureLength' | 'measureBottom' | 'base62'>,
  options: Readonly<EditorOptions>,
  measureIndex: number,
  state: TrackState,
  notesInMeasure: readonly Readonly<Note>[],
  greatestColumn: number,
): string {
  let ret = '';

  for (let colIndex = niB; colIndex <= greatestColumn; colIndex++) {
    const relativeNotePositions: number[] = [];
    const noteStrings: string[] = [];

    for (const note of notesInMeasure) {
      if (note.columnIndex !== colIndex) continue;
      let position =
        note.vPosition - chart.measureBottom[measureAtDisplacement(chart, note.vPosition)]!;
      if (position < 0) position = 0;
      relativeNotePositions.push(position);
      noteStrings.push(c10toId(intDiv(note.value, 10000), chart.base62));
    }

    const measureLength = measureLengthAt(chart, measureIndex);
    let xGCD = measureLength;
    for (const position of relativeNotePositions) {
      if (position > 0) xGCD = gcdDouble(xGCD, position, options.bmsGridLimit);
    }

    const xStrKey = newSlots(measureLength / xGCD);

    for (let i = 0; i <= relativeNotePositions.length - 1; i++) {
      const slot = cint(relativeNotePositions[i]! / xGCD);
      if (slot > xStrKey.length - 1) {
        state.xprevNotes.push({
          ...emptyNote(),
          columnIndex: colIndex,
          vPosition: chart.measureBottom[measureIndex]!,
          value: cIdto10(noteStrings[i]!, chart.base62) * 10000,
        });
        continue;
      }
      if (xStrKey[slot] !== '00') state.hasOverlapping = true;
      xStrKey[slot] = noteStrings[i]!;
    }

    ret += '#' + add3Zeros(measureIndex) + '01:' + xStrKey.join('') + '\r\n';
  }

  return ret;
}
