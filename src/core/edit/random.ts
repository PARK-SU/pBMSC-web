import { maxId } from '../bms/base.ts';
import { openBMS } from '../bms/parse.ts';
import type { Chart } from '../model/chart.ts';
import { sortByVPositionInsertion } from '../model/sort.ts';
import { startsWithIgnoreCase, VbError, vbSplit } from '../vb.ts';
import { updatePairing } from './pairing.ts';

export function removeNote(chart: Chart, i: number, sortAndUpdatePairing = true): void {
  const uBound = chart.notes.length - 1;
  for (let xI2 = i + 1; xI2 <= uBound; xI2++) chart.notes[xI2 - 1] = chart.notes[xI2]!;
  chart.notes.length = uBound;
  if (sortAndUpdatePairing) {
    sortByVPositionInsertion(chart.notes);
    updatePairing(chart);
  }
}

export function removeGhostNotes(chart: Chart): void {
  let xI1 = 1;
  while (xI1 <= chart.notes.length - 1) {
    if (chart.notes[xI1]!.ghost) {
      removeNote(chart, xI1);
    } else {
      xI1 += 1;
    }
  }
}

export function removeCommentNotes(chart: Chart): void {
  let xI1 = 1;
  while (xI1 <= chart.notes.length - 1) {
    if (chart.notes[xI1]!.comment) {
      removeNote(chart, xI1);
    } else {
      xI1 += 1;
    }
  }
}

export function swapGhostNotes(chart: Chart): void {
  for (let xI1 = 1; xI1 <= chart.notes.length - 1; xI1++) {
    chart.notes[xI1]!.ghost = !chart.notes[xI1]!.ghost;
  }
}

export interface SaveWarningAnswer {
  readonly answer: 'yes' | 'no';
  readonly saveBMS: () => void;
}

export function expandDisplayGhostNotes(
  chart: Chart,
  xGhostMode = 0,
  saveWarning?: SaveWarningAnswer,
): void {
  switch (chart.ghostMode) {
    case 0:
      chart.ghostMode = xGhostMode;
      break;
    case 1:
      chart.ghostMode = 0;
      break;
    case 2:
      if (saveWarning === undefined) throw new Error('Ghost mode 2 needs the save warning answer');
      if (saveWarning.answer === 'no') return;
      saveWarning.saveBMS();
      swapGhostNotes(chart);
      chart.ghostMode = 0;
      break;
  }
  openBMS(chart, chart.expansionSplit[1]!, true);
}

export function expandModifyNotes(chart: Chart): void {
  if (chart.ghostMode === 2) swapGhostNotes(chart);
  removeGhostNotes(chart);
  chart.ghostMode = 2;
  openBMS(chart, chart.expansionSplit[1]!, true);
  swapGhostNotes(chart);
}

export function expandRemoveGhostNotes(chart: Chart): void {
  if (chart.ghostMode === 2) swapGhostNotes(chart);
  removeGhostNotes(chart);
  chart.ghostMode = 0;
}

function hCOMAt(chart: Chart, i: number): string | undefined {
  if (i < 0 || i >= chart.hCOM.length) throw new RangeError(`hCOM(${i}) is out of range`);
  return chart.hCOM[i];
}

export function addCommentLine(chart: Chart, xComment: string): void {
  for (let i = 1; i <= maxId(chart.base62); i++) {
    if (hCOMAt(chart, i) === undefined) {
      chart.hCOM[i] = xComment;
      chart.hCOMNum = i;
      break;
    }
  }
}

export function removeCommentLine(chart: Chart, xI: number): void {
  while ((hCOMAt(chart, xI) ?? '') !== '') {
    if (xI === chart.hCOM.length) {
      chart.hCOM[xI] = '';
      break;
    } else {
      chart.hCOM[xI] = hCOMAt(chart, xI + 1);
    }
    xI += 1;
  }
  chart.hCOMNum = xI - 1;
}


export interface OpExpandState {
  readonly tExpansionTextSplit: readonly string[];
  readonly currSelection: number;
  readonly rangeL: number;
  readonly rangeU: number;
  readonly xStack: number;
}

function swic(str: string, strHash: string): boolean {
  return startsWithIgnoreCase(str, strHash);
}

export function newOpExpand(expansionText: string): OpExpandState {
  return {
    tExpansionTextSplit: vbSplit(expansionText, '\r\n'),
    currSelection: -1,
    rangeL: -1,
    rangeU: -1,
    xStack: 0,
  };
}

export function expandLoad(chart: Chart): OpExpandState | 'ErrorEmpty' {
  if (chart.expansion === '') return 'ErrorEmpty';
  chart.expansionSplit = ['', '-', ''];
  return newOpExpand(chart.expansion);
}

export interface SelectSectionResult {
  readonly state: OpExpandState;
  readonly expansionSplit: string[];
  readonly message: 'ErrorNoLineSelected' | 'ErrorNotDetected' | undefined;
}

export class SelectSectionOverflowError extends VbError {
  readonly result: SelectSectionResult;

  constructor(result: SelectSectionResult) {
    super('Overflow');
    this.result = result;
  }
}

export function selectSection(
  state: OpExpandState,
  expansionSplit: readonly string[],
): SelectSectionResult {
  const lines = state.tExpansionTextSplit;
  const currSelection = state.currSelection;
  let { rangeL, rangeU, xStack } = state;
  const item = (i: number): string => {
    const line = lines[i];
    if (line === undefined) throw new VbError('Argument');
    return line;
  };
  const fail = (message: 'ErrorNoLineSelected' | 'ErrorNotDetected'): SelectSectionResult => {
    const next = [...expansionSplit];
    next[1] = '-';
    return { state: { ...state, rangeL, rangeU, xStack }, expansionSplit: next, message };
  };

  if (currSelection === -1) return fail('ErrorNoLineSelected');

  for (let L = currSelection; L >= 0; L--) {
    if (swic(item(L), '#ENDIF') && L !== currSelection) xStack += 1;

    if (swic(item(L), '#IF')) {
      if (xStack > 0) {
        xStack -= 1;
      } else {
        rangeL = L + 1;
        break;
      }
    }
  }
  for (let U = currSelection; U <= lines.length - 1; U++) {
    if (swic(item(U), '#IF') && U !== currSelection) xStack += 1;

    if (swic(item(U), '#ENDIF')) {
      if (xStack > 0) {
        xStack -= 1;
      } else {
        rangeU = U - 1;
        break;
      }
    }
  }

  if (rangeL === -1 || rangeU === -1) return fail('ErrorNotDetected');

  const expansionSplit0 = lines.slice(0, rangeL).join('\r\n');
  if (rangeU - rangeL + 1 < 0) {
    const next = [...expansionSplit];
    next[0] = expansionSplit0;
    throw new SelectSectionOverflowError({
      state: { ...state, rangeL, rangeU, xStack },
      expansionSplit: next,
      message: undefined,
    });
  }
  const expansionSplit1 = lines.slice(rangeL, rangeU + 1).join('\r\n');
  const expansionSplit2 = lines.slice(rangeU + 1).join('\r\n');

  return {
    state: { ...state, rangeL, rangeU, xStack },
    expansionSplit: [expansionSplit0, expansionSplit1, expansionSplit2],
    message: undefined,
  };
}

export function bDisplayGhostAllClick(
  expansionText: string,
  expansionSplit: readonly string[],
): string[] {
  let expansionSplit1 = '';
  for (const xStrLine of expansionText.split('\r')) {
    if (xStrLine !== '' && !swic(xStrLine, '#RANDOM') && !swic(xStrLine, '#IF')) {
      expansionSplit1 += xStrLine + '\r\n';
    }
  }
  const next = [...expansionSplit];
  next[1] = expansionSplit1;
  return next;
}
