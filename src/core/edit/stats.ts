import type { ReadonlyChart } from '../model/chart.ts';
import { niA1, niD8 } from '../model/constants.ts';
import type { Note } from '../model/note.ts';
import { timeFromVPosition, type TempoMap } from '../time/timing.ts';
import {
  cint,
  doubleTryParseFloatInvariant,
  intDiv,
  mathRoundDigits,
  toDotNetFormat,
  toDotNetString,
} from '../vb.ts';

export function isPlayableNote(note: Readonly<Note>, lnObj: number): boolean {
  return (
    note.columnIndex >= niA1 &&
    note.columnIndex <= niD8 &&
    !(note.hidden || note.landmine || intDiv(note.value, 10000) === lnObj || note.comment)
  );
}

export function isSelectedLongNoteTail(notes: readonly Readonly<Note>[], xI: number): boolean {
  const note = notes[xI]!;
  const xPair = note.lnPair;
  return (
    note.longNote &&
    xPair > 0 &&
    xPair <= notes.length - 1 &&
    notes[xPair]!.vPosition < note.vPosition &&
    notes[xPair]!.selected
  );
}

export type PlayableChart = Pick<ReadonlyChart, 'notes' | 'ntInput' | 'header'>;

export function countPlayableNotes(chart: PlayableChart, selectedOnly: boolean): number {
  const notes = chart.notes;
  let xIAll = 0;
  let xILong = 0;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    const note = notes[xI1]!;
    if ((selectedOnly && !note.selected) || !isPlayableNote(note, chart.header.lnObj)) continue;
    if (!note.longNote) {
      xIAll += 1;
    } else if (chart.ntInput) {
      continue;
    } else if (selectedOnly) {
      if (!isSelectedLongNoteTail(notes, xI1)) xIAll += 1;
    } else {
      xILong += 1;
    }
  }
  return xIAll + cint(xILong / 2);
}

export interface TotalOptions {
  readonly totalOption: number;
  readonly totalMultiplier: number;
  readonly totalGlobalMultiplier: number;
  readonly totalDecimal: number;
  readonly totalDisplayValue: boolean;
  readonly totalAutofill: boolean;
}

export const defaultTotalOptions: TotalOptions = {
  totalOption: 0,
  totalMultiplier: 0.25,
  totalGlobalMultiplier: 1,
  totalDecimal: 0,
  totalDisplayValue: true,
  totalAutofill: false,
};

export function recommendedTotal(count: number, options: TotalOptions): number {
  switch (options.totalOption) {
    case 0:
      return ((count * 7.605) / (0.01 * count + 6.5)) * options.totalGlobalMultiplier;
    case 1:
      return (
        (count < 400
          ? 200 + count / 5
          : count < 600
            ? 280 + (count - 400) / 2.5
            : 360 + (count - 600) / 5) * options.totalGlobalMultiplier
      );
    case 2:
      return count * options.totalMultiplier * options.totalGlobalMultiplier;
    default:
      return 0;
  }
}

export interface PlayableNotesInfo {
  readonly count: number;
  readonly totalValue: number;
  readonly statisticsText: string;
  readonly totalValueText: string;
  readonly autofillTotal: string | undefined;
}

export function calculateTotalPlayableNotes(
  chart: PlayableChart,
  options: TotalOptions,
  recommendedTotalLabel: string,
  modifyTotal = true,
): PlayableNotesInfo {
  const xIAll = countPlayableNotes(chart, false);
  const totalValue = recommendedTotal(xIAll, options);
  const rounded = toDotNetString(mathRoundDigits(totalValue, options.totalDecimal));
  const totalValueText = options.totalDisplayValue ? recommendedTotalLabel + ': ' + rounded : '';
  return {
    count: xIAll,
    totalValue,
    statisticsText: String(xIAll),
    totalValueText,
    autofillTotal: modifyTotal && options.totalAutofill ? rounded : undefined,
  };
}

export function selectionInfo(chart: PlayableChart, tempo: TempoMap): string {
  const notes = chart.notes;
  const xNotes = countPlayableNotes(chart, false);
  const xSelected = countPlayableNotes(chart, true);

  let xRate = '-';
  let xRecovery = '-';
  if (xNotes > 0) {
    const xTotal = doubleTryParseFloatInvariant(chart.header.total);
    if (xTotal !== undefined) {
      xRate = toDotNetFormat(xTotal / xNotes, '0.000');
      xRecovery = toDotNetFormat((xTotal / xNotes) * xSelected, '0.0') + '%';
    }
  }

  let xFirst = Number.MAX_VALUE;
  let xLast = -Number.MAX_VALUE;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    const note = notes[xI1]!;
    if (
      note.selected &&
      isPlayableNote(note, chart.header.lnObj) &&
      !(!chart.ntInput && isSelectedLongNoteTail(notes, xI1))
    ) {
      xFirst = Math.min(xFirst, note.vPosition);
      xLast = Math.max(xLast, note.vPosition);
    }
  }
  let xDensity = '-';
  if (xLast > xFirst) {
    const xSeconds = timeFromVPosition(tempo, xLast) - timeFromVPosition(tempo, xFirst);
    if (xSeconds > 0) xDensity = toDotNetFormat(xSelected / xSeconds, '0.0') + '/s';
  }

  return `${xRate} | ${xSelected} | ${xRecovery} | ${xDensity}`;
}
