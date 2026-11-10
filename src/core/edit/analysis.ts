import type { Chart } from '../model/chart.ts';
import {
  niB,
  niBPM,
  niSTOP,
  niSCROLL,
  niA1,
  niA5,
  niA8,
  niD1,
  niD4,
  niD8,
} from '../model/constants.ts';
import { cint, intDiv } from '../vb.ts';
import { buildTempoMap, timeFromVPosition } from '../time/timing.ts';
import { convertBMSE2NT, convertNT2BMSE } from './pairing.ts';
import { keyColumns, type KeyMode } from './transforms.ts';

export function checkTechnicalError(chart: Chart, mode: KeyMode, jackSpeed: number): void {
  const columns = keyColumns(mode),
    tempo = buildTempoMap(chart.notes);
  const time = (i: number): number => timeFromVPosition(tempo, chart.notes[i]!.vPosition);
  const playable = (i: number): boolean => {
    const n = chart.notes[i]!;
    return !(n.hidden || n.landmine || n.comment);
  };
  const mark = (i: number): void => {
    chart.notes[i]!.hasError = true;
    chart.notes[i]!.errorType = 1;
  };
  const longColumns = (position: number): number[] => {
    if (!chart.ntInput) convertBMSE2NT(chart);
    const result = chart.notes
      .filter(
        (n) =>
          n.length > 0 &&
          n.vPosition <= position &&
          position <= n.vPosition + n.length &&
          columns.includes(n.columnIndex),
      )
      .map((n) => n.columnIndex);
    if (!chart.ntInput) convertNT2BMSE(chart);
    return result;
  };
  for (const n of chart.notes.slice(1))
    if (n.errorType === 1) {
      n.hasError = false;
      n.errorType = 0;
    }
  if (mode === 'PMS') {
    for (let i = 1; i < chart.notes.length; i++) {
      if (!columns.includes(chart.notes[i]!.columnIndex) || !playable(i)) continue;
      const indices = [i],
        occupied = [columns.indexOf(chart.notes[i]!.columnIndex) + 1];
      for (let j = i - 1; j > 0; j--) {
        if (time(i) - time(j) > jackSpeed) break;
        if (!columns.includes(chart.notes[j]!.columnIndex) || !playable(j)) continue;
        indices.push(j);
        occupied.push(columns.indexOf(chart.notes[j]!.columnIndex) + 1);
      }
      occupied.push(...longColumns(chart.notes[i]!.vPosition).map((c) => columns.indexOf(c) + 1));
      occupied.sort((a, b) => a - b);
      let left = 0,
        right = 0;
      for (const column of occupied) {
        if (left === 0) {
          left = column;
          continue;
        }
        if (left + 2 < column && right === 0) right = column;
        else if (right !== 0 && right + 2 < column) for (const j of indices) mark(j);
      }
    }
  }
  if (mode === 'DP') {
    for (let i = 1; i < chart.notes.length; i++) {
      const column = chart.notes[i]!.columnIndex;
      if ((column !== niA1 && column !== niD8) || !playable(i)) continue;
      const near =
        column === niA1 ? [niA5, niA5 + 1, niA5 + 2, niA8] : [niD1, niD1 + 1, niD1 + 2, niD4];
      const full = column === niA1 ? keyColumns('SP').slice(1) : keyColumns('DP').slice(8, 15);
      let count = 0;
      for (let j = i - 1; j > 0; j--) {
        if (time(i) - time(j) > jackSpeed) break;
        if (near.includes(chart.notes[j]!.columnIndex) && playable(j)) count++;
      }
      for (let j = i + 1; j < chart.notes.length; j++) {
        if (time(j) - time(i) > jackSpeed) break;
        if (near.includes(chart.notes[j]!.columnIndex) && playable(j)) count++;
      }
      count += longColumns(chart.notes[i]!.vPosition).filter((c) => full.includes(c)).length;
      if (count > 0) mark(i);
    }
  }
  for (let i = 1; i < chart.notes.length; i++) {
    if (!playable(i)) continue;
    for (let j = i - 1; j > 0; j--) {
      if (chart.notes[j]!.vPosition === chart.notes[i]!.vPosition) continue;
      if (time(i) - time(j) > jackSpeed) break;
      if (
        columns.includes(chart.notes[i]!.columnIndex) &&
        chart.notes[j]!.columnIndex === chart.notes[i]!.columnIndex
      ) {
        mark(i);
        break;
      }
    }
  }
}

export const statisticsColumns = [
  'Short',
  'Long',
  'LNOBJ',
  'Hidden',
  'Landmines',
  'Errors',
  'Total',
] as const;
export const statisticsRows = [
  'SCROLL',
  'BPM',
  'STOP',
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
  'A6',
  'A7',
  'A8',
  'D1',
  'D2',
  'D3',
  'D4',
  'D5',
  'D6',
  'D7',
  'D8',
  'A',
  'D',
  'BGA',
  'BGM',
  'Notes',
  'Total',
] as const;
export interface ChartStatistics {
  data: number[][];
  wav: { id: number; assigned: boolean; count: number }[];
}
export function advancedStatistics(chart: Chart): ChartStatistics {
  const data = Array.from({ length: 25 }, () => new Array<number>(7).fill(0)),
    usage = new Array<number>(chart.hWAV.length).fill(0);
  const lanes = keyColumns('DP');
  let toggle = true;
  const addUsage = (id: number): void => {
    if (id < 0 || id >= usage.length) throw new RangeError(`WAV id ${id}`);
    usage[id]!++;
  };
  for (const n of chart.notes.slice(1)) {
    const lane = lanes.indexOf(n.columnIndex),
      row =
        n.columnIndex === niSCROLL
          ? 0
          : n.columnIndex === niBPM
            ? 1
            : n.columnIndex === niSTOP
              ? 2
              : lane >= 0
                ? lane + 3
                : n.columnIndex >= niB
                  ? 22
                  : 21;
    const id = cint(n.value / 10000);
    const end = intDiv(n.value, 10000) === chart.header.lnObj;
    if (!(n.longNote || n.hidden || n.landmine || end || n.comment)) {
      data[row]![0]!++;
      if (lane >= 0 || n.columnIndex >= niB) addUsage(id);
    }
    if (chart.ntInput) {
      if (n.length !== 0) data[row]![1]!++;
    } else if (n.longNote) {
      if (toggle) {
        data[row]![1]!++;
        addUsage(id);
      }
      toggle = !toggle;
    }
    if (end) data[row]![2]!++;
    if (n.hidden) data[row]![3]!++;
    if (n.landmine) data[row]![4]!++;
    if (n.hasError) data[row]![5]!++;
  }
  for (let r = 0; r < 24; r++)
    for (let c = 0; c < 6; c++) {
      data[r]![6]! += data[r]![c]!;
      if (r === 19 || r === 20) continue;
      data[24]![c]! += data[r]![c]!;
      if (r >= 3 && r <= 18) {
        data[r <= 10 ? 19 : 20]![c]! += data[r]![c]!;
        data[23]![c]! += data[r]![c]!;
      }
    }
  data[24]![6] = chart.notes.length - 1;
  return {
    data,
    wav: usage.flatMap((count, id) =>
      count || chart.hWAV[id] ? [{ id, assigned: !!chart.hWAV[id], count }] : [],
    ),
  };
}
export function legacyStatistics(chart: Chart): number[][] {
  const data = Array.from({ length: 7 }, () => new Array<number>(6).fill(0));
  let toggle = true;
  for (const n of chart.notes.slice(1)) {
    const row =
      n.columnIndex === niBPM
        ? 0
        : n.columnIndex === niSTOP
          ? 1
          : n.columnIndex >= niA1 && n.columnIndex <= niA8
            ? 2
            : n.columnIndex >= niD1 && n.columnIndex <= niD8
              ? 3
              : n.columnIndex >= niB
                ? 4
                : 5;
    const unit = chart.ntInput && n.length !== 0 ? 2 : 1;
    if (chart.ntInput ? n.length === 0 : !n.longNote) data[row]![0]!++;
    if (chart.ntInput && n.length !== 0) data[row]![1]! += 2;
    else if (!chart.ntInput && n.longNote) {
      if (toggle) data[row]![1]!++;
      toggle = !toggle;
    }
    if (intDiv(n.value, 10000) === chart.header.lnObj) data[row]![2]! += unit;
    if (n.hidden) data[row]![3]! += unit;
    if (n.hasError) data[row]![4]! += unit;
    data[row]![5]! += unit;
  }
  return data;
}
