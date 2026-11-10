import type { Chart } from '../model/chart.ts';
import { isColumnSound } from '../model/column.ts';
import {
  niA1,
  niA2,
  niA3,
  niA4,
  niA5,
  niA6,
  niA7,
  niA8,
  niD1,
  niD2,
  niD3,
  niD4,
  niD5,
  niD6,
  niD7,
  niD8,
  niB,
} from '../model/constants.ts';
import { cloneNote } from '../model/note.ts';
import { int } from '../vb.ts';
import { buildTempoMap, timeFromVPosition } from '../time/timing.ts';
import {
  UndoChainBuilder,
  redoAddNote,
  redoAddNoteAll,
  redoRemoveNoteAll,
  redoMoveNote,
  redoLongNoteModify,
  redoRemoveNoteSelected,
} from './chain.ts';
import { addNote, removeNotes, type EditContext } from './ops.ts';
import { convertBMSE2NT, convertNT2BMSE, updatePairing } from './pairing.ts';
import { sortByVPositionInsertion, sortByVPositionQuick } from '../model/sort.ts';

export type KeyMode = 'SP' | 'DP' | 'PMS';
export function keyColumns(mode: KeyMode): number[] {
  return mode === 'PMS'
    ? [niA2, niA3, niA4, niA5, niA6, niD2, niD3, niD4, niD5]
    : mode === 'DP'
      ? [
          niA1,
          niA2,
          niA3,
          niA4,
          niA5,
          niA6,
          niA7,
          niA8,
          niD1,
          niD2,
          niD3,
          niD4,
          niD5,
          niD6,
          niD7,
          niD8,
        ]
      : [niA1, niA2, niA3, niA4, niA5, niA6, niA7, niA8];
}
function selectedColumns(chart: Chart, mode: KeyMode): number[] {
  let lo = niB,
    hi = 0;
  for (const n of chart.notes.slice(1))
    if (n.selected) {
      lo = Math.min(lo, n.columnIndex);
      hi = Math.max(hi, n.columnIndex);
    }
  return keyColumns(mode).filter((c) => c >= lo && c <= hi);
}
function finish(chart: Chart, ctx: EditContext, b: UndoChainBuilder): void {
  ctx.addUndo(b.undoHead(), b.redoHead());
  updatePairing(chart);
}
function move(chart: Chart, index: number, column: number, b: UndoChainBuilder): void {
  const n = chart.notes[index]!;
  redoMoveNote(b, n, column, n.vPosition);
  n.columnIndex = column;
}
export function mirrorNotes(chart: Chart, mode: KeyMode, ctx: EditContext): void {
  const columns = selectedColumns(chart, mode);
  if (columns.length <= 1) return;
  const b = new UndoChainBuilder();
  for (let i = 1; i < chart.notes.length; i++) {
    const n = chart.notes[i]!;
    if (!n.selected || n.ghost) continue;
    const at = columns.indexOf(n.columnIndex);
    move(chart, i, at < 0 ? n.columnIndex : columns[columns.length - at - 1]!, b);
  }
  finish(chart, ctx, b);
}
export function flipNotes(chart: Chart, mode: KeyMode, ctx: EditContext): void {
  if (mode !== 'DP') return;
  const columns = keyColumns(mode),
    target = [
      niD8,
      niD1,
      niD2,
      niD3,
      niD4,
      niD5,
      niD6,
      niD7,
      niA2,
      niA3,
      niA4,
      niA5,
      niA6,
      niA7,
      niA8,
      niA1,
    ],
    b = new UndoChainBuilder();
  for (let i = 1; i < chart.notes.length; i++) {
    const n = chart.notes[i]!,
      at = columns.indexOf(n.columnIndex);
    if (n.selected && !n.ghost) move(chart, i, at < 0 ? n.columnIndex : target[at]!, b);
  }
  finish(chart, ctx, b);
}
export function shuffle<T>(items: T[], random: () => number = Math.random): void {
  for (let i = items.length; i >= 2; i -= 2) {
    const j = int(i * random()),
      value = items[i - 1]!;
    items[i - 1] = items[j]!;
    items[j] = value;
  }
}
export function randomNotes(
  chart: Chart,
  mode: KeyMode,
  kind: 'random' | 'rRandom' | 'sRandom' | 'hRandom',
  ctx: EditContext,
  random: () => number = Math.random,
): void {
  const columns = selectedColumns(chart, mode);
  if (columns.length <= 1) return;
  const shuffled = [...columns],
    b = new UndoChainBuilder();
  if (kind === 'random' || kind === 'rRandom') {
    if (kind === 'random') shuffle(shuffled, random);
    else {
      const rotation = int(shuffled.length * random()),
        direction = int(2 * random()) * 2 - 1;
      for (let i = 0; i < shuffled.length; i++)
        shuffled[i] = columns[(i * direction + rotation + shuffled.length) % shuffled.length]!;
    }
    for (let i = 1; i < chart.notes.length; i++) {
      const n = chart.notes[i]!,
        at = columns.indexOf(n.columnIndex);
      if (n.selected && !n.ghost) move(chart, i, at < 0 ? n.columnIndex : shuffled[at]!, b);
    }
  } else {
    let i = 1,
      previousCount = 0;
    const eligible = (at: number): boolean => {
      const n = chart.notes[at]!;
      return (
        n.selected && !n.ghost && n.columnIndex >= columns[0]! && n.columnIndex <= columns.at(-1)!
      );
    };
    while (i < chart.notes.length) {
      if (!eligible(i)) {
        i++;
        continue;
      }
      const position = chart.notes[i]!.vPosition,
        group: number[] = [];
      while (i < chart.notes.length && chart.notes[i]!.vPosition === position) {
        if (eligible(i)) group.push(i);
        i++;
      }
      if (kind === 'sRandom' || previousCount === 0) shuffle(shuffled, random);
      else {
        const used = shuffled.slice(0, previousCount),
          unused = shuffled.slice(previousCount);
        shuffle(used, random);
        shuffle(unused, random);
        shuffled.splice(0, shuffled.length, ...unused, ...used);
      }
      for (let j = 0; j < group.length; j++) {
        if (j >= shuffled.length) throw new RangeError('Too many simultaneous selected notes');
        move(chart, group[j]!, shuffled[j]!, b);
      }
      previousCount = group.length;
    }
  }
  finish(chart, ctx, b);
}
export function sortNotes(chart: Chart, mode: KeyMode, jackSpeed: number, ctx: EditContext): void {
  const columns = keyColumns(mode),
    tempo = buildTempoMap(chart.notes),
    b = new UndoChainBuilder();
  let i = 1,
    nextBgm = niB;
  const eligible = (at: number): boolean => {
    const n = chart.notes[at]!;
    return n.selected && !n.ghost && isColumnSound(n.columnIndex);
  };
  while (i < chart.notes.length) {
    if (!eligible(i)) {
      i++;
      continue;
    }
    const time = timeFromVPosition(tempo, chart.notes[i]!.vPosition),
      group: number[] = [];
    while (
      i < chart.notes.length &&
      Math.abs(timeFromVPosition(tempo, chart.notes[i]!.vPosition) - time) <= jackSpeed
    ) {
      if (eligible(i)) group.push(i);
      i++;
    }
    while (columns.length < group.length) columns.push(nextBgm++);
    group.sort((a, b) => chart.notes[a]!.value - chart.notes[b]!.value);
    for (let j = 0; j < group.length; j++) move(chart, group[j]!, columns[j]!, b);
  }
  ctx.addUndo(b.undoHead(), b.redoHead());
  sortByVPositionQuick(chart.notes, 0, chart.notes.length - 1);
  updatePairing(chart);
}
export function autoLongNotes(
  chart: Chart,
  mode: KeyMode,
  byColumn: boolean,
  gap: number,
  ctx: EditContext,
): void {
  const b = new UndoChainBuilder();
  if (!chart.ntInput) {
    redoRemoveNoteAll(b, chart.notes);
    convertBMSE2NT(chart);
    redoAddNoteAll(b, chart.notes);
  }
  const columns = keyColumns(mode),
    previous = new Map<number, number>();
  let previousGroup: number[] = [];
  let i = 1;
  const changeLength = (index: number, length: number): void => {
    const n = chart.notes[index]!;
    redoLongNoteModify(b, n, n.vPosition, length);
    n.length = length;
  };
  while (i < chart.notes.length) {
    const n = chart.notes[i]!;
    if (!n.selected || n.ghost || (byColumn && !columns.includes(n.columnIndex))) {
      i++;
      continue;
    }
    if (byColumn) {
      const before = previous.get(n.columnIndex);
      if (before !== undefined)
        changeLength(
          before,
          Math.max(n.vPosition - chart.notes[before]!.vPosition - (gap * 192) / 4, 0),
        );
      previous.set(n.columnIndex, i++);
    } else {
      const position = n.vPosition,
        group: number[] = [];
      for (let j = i; j < chart.notes.length && chart.notes[j]!.vPosition === position; j++)
        if (chart.notes[j]!.selected) group.push(j);
      const occupied = group.map((j) => chart.notes[j]!.columnIndex);
      for (const j of previousGroup)
        changeLength(
          j,
          Math.max(
            position -
              chart.notes[j]!.vPosition -
              (occupied.includes(chart.notes[j]!.columnIndex) ? (gap * 192) / 4 : 0),
            0,
          ),
        );
      previousGroup = [...group];
      i = group.at(-1)! + 1;
    }
  }
  if (!chart.ntInput) {
    redoRemoveNoteAll(b, chart.notes);
    convertNT2BMSE(chart);
    redoAddNoteAll(b, chart.notes);
  }
  ctx.addUndo(b.undoHead(), b.redoHead());
  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
}
export function lnObjToNT(chart: Chart, ctx: EditContext): void {
  if (!chart.ntInput) return;
  const b = new UndoChainBuilder();
  for (let i = 1; i < chart.notes.length; i++) {
    const n = chart.notes[i]!;
    if (!n.selected || n.ghost || chart.header.lnObj !== n.value / 10000 || n.lnPair === 0) {
      n.selected = false;
      continue;
    }
    const head = chart.notes[n.lnPair]!;
    redoLongNoteModify(b, head, head.vPosition, n.vPosition - head.vPosition);
    head.length = n.vPosition - head.vPosition;
  }
  redoRemoveNoteSelected(b, chart.notes);
  removeNotes(chart, ctx);
  ctx.addUndo(b.undoHead(), b.redoHead());
  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
}
export function ntToLNObj(chart: Chart, ctx: EditContext): void {
  if (!chart.ntInput || chart.header.lnObj === 0) return;
  const b = new UndoChainBuilder();
  const count = chart.notes.length;
  for (let i = 1; i < count; i++) {
    const n = chart.notes[i]!;
    if (!n.selected || n.ghost || n.length === 0) continue;
    const position = n.vPosition + n.length;
    redoLongNoteModify(b, n, n.vPosition, 0);
    n.length = 0;
    const tail = cloneNote(n);
    tail.vPosition = position;
    tail.value = chart.header.lnObj * 10000;
    redoAddNote(b, tail);
    addNote(chart, tail, ctx);
  }
  ctx.addUndo(b.undoHead(), b.redoHead());
  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
}
