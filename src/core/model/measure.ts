import { cint, VbError } from '../vb.ts';
import type { Chart, ReadonlyChart } from './chart.ts';
import type { Note } from './note.ts';

export function measureUpper(
  chart: Pick<ReadonlyChart, 'measureBottom' | 'measureLength'>,
  idx: number,
): number {
  return chart.measureBottom[idx]! + chart.measureLength[idx]!;
}

export function updateMeasureBottom(chart: Pick<Chart, 'measureBottom' | 'measureLength'>): void {
  chart.measureBottom[0] = 0;
  for (let xI1 = 0; xI1 <= 998; xI1++) {
    chart.measureBottom[xI1 + 1] = chart.measureBottom[xI1]! + chart.measureLength[xI1]!;
  }
}

export function measureAtDisplacement(
  chart: Pick<ReadonlyChart, 'measureBottom'>,
  xVPos: number,
): number {
  let xI1: number;
  for (xI1 = 1; xI1 <= 999; xI1++) {
    if (xVPos < chart.measureBottom[xI1]!) break;
  }
  return xI1 - 1;
}

export function getMaxVPosition(
  chart: Pick<ReadonlyChart, 'measureBottom' | 'measureLength'>,
): number {
  return measureUpper(chart, 999);
}

export function calculateGreatestVPosition(
  chart: Pick<Chart, 'notes' | 'ntInput' | 'greatestVPosition' | 'measureBottom' | 'measureLength'>,
): void {
  chart.greatestVPosition = 0;
  const notes: readonly Readonly<Note>[] = chart.notes;
  if (chart.ntInput) {
    for (let xI1 = notes.length - 1; xI1 >= 0; xI1--) {
      const note = notes[xI1]!;
      if (note.vPosition + note.length > chart.greatestVPosition) {
        chart.greatestVPosition = note.vPosition + note.length;
      }
    }
  } else {
    for (let xI1 = notes.length - 1; xI1 >= 0; xI1--) {
      const note = notes[xI1]!;
      if (note.vPosition > chart.greatestVPosition) chart.greatestVPosition = note.vPosition;
    }
  }

  const xMax = getMaxVPosition(chart);
  const xI2 = cint(chart.greatestVPosition + 2000 > xMax ? xMax : chart.greatestVPosition + 2000);
  if (xI2 === -2147483648) throw new VbError('Overflow');
}
