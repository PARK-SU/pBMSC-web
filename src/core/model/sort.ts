import { cint } from '../vb.ts';
import type { Note } from './note.ts';

export function sortByVPositionInsertion(notes: Note[]): void {
  const last = notes.length - 1;
  if (last <= 0) return;
  for (let xI1 = 2; xI1 <= last; xI1++) {
    const xNote = notes[xI1]!;
    for (let xI2 = xI1 - 1; xI2 >= 1; xI2--) {
      if (notes[xI2]!.vPosition > xNote.vPosition) {
        notes[xI2 + 1] = notes[xI2]!;
        if (xI2 === 1) {
          notes[xI2] = xNote;
          break;
        }
      } else {
        notes[xI2 + 1] = xNote;
        break;
      }
    }
  }
}

export function sortByVPositionQuick(notes: Note[], xMin: number, xMax: number): void {
  const sublists: [number, number][] = [[xMin, xMax]];
  for (let sublist = sublists.pop(); sublist !== undefined; sublist = sublists.pop()) {
    const [min, max] = sublist;
    if (min >= max) continue;
    const iLo = partition(notes, min, max);
    sublists.push([iLo + 1, max], [min, iLo - 1]);
  }
}

function partition(notes: Note[], xMin: number, xMax: number): number {
  const xI1 = cint((xMax + xMin) / 2);
  const xNote = notes[xI1]!;
  notes[xI1] = notes[xMin]!;

  let iLo = xMin;
  let iHi = xMax;
  for (;;) {
    while (
      notes[iHi]!.vPosition > xNote.vPosition ||
      (notes[iHi]!.vPosition === xNote.vPosition && notes[iHi]!.columnIndex > xNote.columnIndex)
    ) {
      iHi = iHi - 1;
      if (iHi <= iLo) break;
    }
    if (iHi <= iLo) {
      notes[iLo] = xNote;
      break;
    }

    notes[iLo] = notes[iHi]!;

    iLo = iLo + 1;
    while (notes[iLo]!.vPosition < xNote.vPosition) {
      iLo = iLo + 1;
      if (iLo >= iHi) break;
    }
    if (iLo >= iHi) {
      iLo = iHi;
      notes[iHi] = xNote;
      break;
    }

    notes[iHi] = notes[iLo]!;
  }
  return iLo;
}
