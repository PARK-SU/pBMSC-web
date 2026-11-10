import type { Chart } from '../model/chart.ts';
import { isColumnNumeric } from '../model/column.ts';
import { cloneNote, emptyNote, type Note } from '../model/note.ts';
import { sortByVPositionInsertion } from '../model/sort.ts';
import { intDiv } from '../vb.ts';

const vbAnd = (a: boolean, b: boolean): boolean => a && b;

export function updatePairing(chart: Chart): void {
  const notes: readonly Note[] = chart.notes;
  const lnObj = chart.header.lnObj;
  const uBound = notes.length - 1;
  let i: number;
  let j: number;

  if (chart.ntInput) {
    for (i = 0; i <= uBound; i++) {
      notes[i]!.lnPair = 0;
      if (notes[i]!.length < 0) notes[i]!.length = 0;
      if (notes[i]!.errorType === 1) continue;
      notes[i]!.hasError = false;
      notes[i]!.errorType = 0;
    }

    for (i = 1; i <= uBound; i++) {
      if (notes[i]!.length !== 0) {
        for (j = i + 1; j <= uBound; j++) {
          if (notes[j]!.vPosition > notes[i]!.vPosition + notes[i]!.length) break;
          if (notes[j]!.columnIndex === notes[i]!.columnIndex) notes[j]!.hasError = true;
        }
      } else {
        for (j = i + 1; j <= uBound; j++) {
          if (notes[j]!.vPosition > notes[i]!.vPosition) break;
          if (notes[j]!.columnIndex === notes[i]!.columnIndex) notes[j]!.hasError = true;
        }

        if (intDiv(notes[i]!.value, 10000) === lnObj && !isColumnNumeric(notes[i]!.columnIndex)) {
          for (j = i - 1; j >= 1; j--) {
            if (notes[j]!.columnIndex !== notes[i]!.columnIndex) continue;
            if (notes[j]!.hidden) continue;

            if (notes[j]!.length !== 0 || intDiv(notes[j]!.value, 10000) === lnObj) {
              notes[i]!.hasError = true;
            } else {
              notes[i]!.lnPair = j;
              notes[j]!.lnPair = i;
            }
            break;
          }
          if (j === 0) notes[i]!.hasError = true;
        }
      }
    }
  } else {
    for (i = 0; i <= uBound; i++) {
      if (notes[i]!.errorType === 1) continue;
      notes[i]!.hasError = false;
      notes[i]!.errorType = 0;
      notes[i]!.lnPair = 0;
    }

    for (i = 1; i <= uBound; i++) {
      if (notes[i]!.longNote) {
        for (j = i - 1; j >= 1; j--) {
          if (notes[j]!.columnIndex !== notes[i]!.columnIndex) continue;
          if (notes[j]!.vPosition === notes[i]!.vPosition) {
            notes[i]!.hasError = true;
            break;
          } else if (notes[j]!.longNote && notes[j]!.lnPair === i) {
            notes[i]!.lnPair = j;
            break;
          } else {
            break;
          }
        }

        if (!notes[i]!.hasError && notes[i]!.lnPair === 0) {
          for (j = i + 1; j <= uBound; j++) {
            if (notes[j]!.columnIndex !== notes[i]!.columnIndex) continue;
            notes[i]!.lnPair = j;
            notes[j]!.lnPair = i;
            if (!notes[j]!.longNote && intDiv(notes[j]!.value, 10000) !== lnObj) {
              notes[j]!.hasError = true;
            }
            break;
          }

          if (j === uBound + 1) notes[i]!.hasError = true;
        }
      } else if (
        vbAnd(intDiv(notes[i]!.value, 10000) === lnObj, !isColumnNumeric(notes[i]!.columnIndex))
      ) {
        for (j = i - 1; j >= 1; j--) {
          if (notes[i]!.columnIndex !== notes[j]!.columnIndex) continue;
          if (notes[j]!.lnPair !== 0 && notes[j]!.lnPair !== i) notes[j]!.hasError = true;
          notes[i]!.lnPair = j;
          notes[j]!.lnPair = i;
          if (notes[i]!.vPosition === notes[j]!.vPosition) notes[i]!.hasError = true;
          if (intDiv(notes[j]!.value, 10000) === lnObj) notes[j]!.hasError = true;
          break;
        }

        if (j === 0) notes[i]!.hasError = true;
      } else {
        for (j = i - 1; j >= 1; j--) {
          if (notes[j]!.vPosition < notes[i]!.vPosition) break;
          if (notes[j]!.columnIndex !== notes[i]!.columnIndex) continue;
          notes[i]!.hasError = true;
          break;
        }
      }
    }
  }

}

export function convertBMSE2NT(chart: Chart, xIFrom = 1): void {
  if (xIFrom === 1) sortByVPositionInsertion(chart.notes);

  for (let i2 = xIFrom; i2 <= chart.notes.length - 1; i2++) chart.notes[i2]!.length = 0;

  let i = xIFrom;
  let xUbound = chart.notes.length - 1;

  while (i <= xUbound) {
    if (!chart.notes[i]!.longNote) {
      i += 1;
      continue;
    }

    for (let j = i + 1; j <= xUbound; j++) {
      if (chart.notes[j]!.columnIndex !== chart.notes[i]!.columnIndex) continue;

      if (chart.notes[j]!.longNote) {
        chart.notes[i]!.length = chart.notes[j]!.vPosition - chart.notes[i]!.vPosition;
        for (let j2 = j; j2 <= xUbound - 1; j2++) chart.notes[j2] = chart.notes[j2 + 1]!;
        xUbound -= 1;
        break;
      } else if (intDiv(chart.notes[j]!.value, 10000) === chart.header.lnObj) {
        break;
      }
    }

    i += 1;
  }

  chart.notes.length = xUbound + 1;

  for (i = xIFrom; i <= xUbound; i++) chart.notes[i]!.longNote = false;

  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
}

export function convertNT2BMSE(chart: Chart, xIFrom = 1): void {
  chart.notes = ntToBMSENotes(chart.notes, xIFrom);

  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
}

function ntToBMSENotes(notes: readonly Readonly<Note>[], xIFrom: number): Note[] {
  const xK: Note[] = [];
  for (let xI = 0; xI <= xIFrom - 1; xI++) xK.push(cloneNote(notes[xI]!));

  for (let xI1 = xIFrom; xI1 <= notes.length - 1; xI1++) {
    const note = notes[xI1]!;
    xK.push({
      ...emptyNote(),
      columnIndex: note.columnIndex,
      longNote: note.length > 0,
      landmine: note.landmine,
      value: note.value,
      vPosition: note.vPosition,
      selected: note.selected,
      hidden: note.hidden,
      ghost: note.ghost,
      comment: note.comment,
    });

    if (note.length > 0) {
      xK.push({
        ...emptyNote(),
        columnIndex: note.columnIndex,
        longNote: true,
        landmine: false,
        value: note.value,
        vPosition: note.vPosition + note.length,
        selected: note.selected,
        hidden: note.hidden,
        ghost: note.ghost,
        comment: note.comment,
      });
    }
  }
  return xK;
}
