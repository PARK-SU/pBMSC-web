import { c36to10, cIdto10 } from '../bms/base.ts';
import type { Chart } from '../model/chart.ts';
import { isColumnNumeric } from '../model/column.ts';
import type { Note } from '../model/note.ts';
import { UndoChainBuilder, redoRelabelNote, redoRemoveNote } from './chain.ts';
import { removeNote, type EditContext } from './ops.ts';
import { sortByVPositionInsertion } from '../model/sort.ts';
import { updatePairing } from './pairing.ts';

export interface FindQuery {
  readonly range: readonly boolean[];
  readonly measureFrom: number;
  readonly measureTo: number;
  readonly labelFrom: string;
  readonly labelTo: string;
  readonly valueFrom: number;
  readonly valueTo: number;
  readonly columns: readonly number[];
}

const range = (a: boolean | undefined, b: boolean | undefined, value: boolean): boolean =>
  (!a && !!b && value) || (!!a && !b && !value) || (!!a && !!b);

export function findNotes(
  chart: Chart,
  query: FindQuery,
  operation: 'select' | 'unselect' | 'previous' | 'next',
  position: number,
  enabled: (column: number) => boolean,
): number | undefined {
  const oldSelection = chart.notes.map((n) => n.selected);
  const navigation = operation === 'previous' || operation === 'next';
  if (navigation) for (let i = 1; i < chart.notes.length; i++) chart.notes[i]!.selected = false;
  const match = (n: Readonly<Note>, i: number): boolean => {
    const r = query.range;
    return (
      ((r[0] && oldSelection[i]) || (r[1] && !oldSelection[i])) === true &&
      enabled(n.columnIndex) &&
      range(r[2], r[3], chart.ntInput ? n.length !== 0 : n.longNote) &&
      range(r[5], r[4], n.hidden) &&
      range(r[6], r[7], n.hasError) &&
      range(r[8], r[9], n.comment)
    );
  };
  const inBounds = (n: Readonly<Note>): boolean => {
    const min = isColumnNumeric(n.columnIndex)
      ? query.valueFrom
      : (n.landmine ? c36to10(query.labelFrom) : cIdto10(query.labelFrom, chart.base62)) * 10000;
    const max = isColumnNumeric(n.columnIndex)
      ? query.valueTo
      : (n.landmine ? c36to10(query.labelTo) : cIdto10(query.labelTo, chart.base62)) * 10000;
    return (
      n.vPosition >= chart.measureBottom[query.measureFrom]! &&
      n.vPosition < chart.measureBottom[query.measureTo]! + chart.measureLength[query.measureTo]! &&
      n.value >= min &&
      n.value <= max &&
      query.columns.includes(n.columnIndex - 1)
    );
  };
  const indices = Array.from({ length: chart.notes.length - 1 }, (_, i) => i + 1);
  if (operation === 'previous') indices.reverse();
  for (const i of indices) {
    const n = chart.notes[i]!;
    if (!match(n, i)) continue;
    if (navigation) {
      if (
        !inBounds(n) ||
        !(operation === 'previous' ? n.vPosition < position : n.vPosition > position)
      )
        continue;
      n.selected = true;
      return n.vPosition;
    }
    if (operation === 'select') n.selected = inBounds(n);
    else if (inBounds(n)) n.selected = false;
  }
  return undefined;
}

export function replaceNotes(
  chart: Chart,
  query: FindQuery,
  operation: 'delete' | 'label' | 'value',
  replacement: string | number,
  ctx: EditContext,
): void {
  const b = new UndoChainBuilder(),
    r = query.range;
  let i = 1;
  while (i < chart.notes.length) {
    const n = chart.notes[i]!,
      numeric = isColumnNumeric(n.columnIndex);
    const from = numeric
      ? query.valueFrom
      : (n.landmine ? c36to10(query.labelFrom) : cIdto10(query.labelFrom, chart.base62)) * 10000;
    const to = numeric
      ? query.valueTo
      : (n.landmine ? c36to10(query.labelTo) : cIdto10(query.labelTo, chart.base62)) * 10000;
    const matches =
      !n.ghost &&
      ((r[0] && n.selected) || (r[1] && !n.selected)) &&
      ctx.nEnabled(n.columnIndex) &&
      range(r[2], r[3], chart.ntInput ? n.length !== 0 : n.longNote) &&
      range(r[5], r[4], n.hidden) &&
      range(r[6], r[7], n.hasError) &&
      range(r[8], r[9], n.comment) &&
      n.vPosition >= chart.measureBottom[query.measureFrom]! &&
      n.vPosition < chart.measureBottom[query.measureTo]! + chart.measureLength[query.measureTo]! &&
      n.value >= from &&
      n.value <= to &&
      query.columns.includes(n.columnIndex - 1);
    if (matches && operation === 'delete') {
      redoRemoveNote(b, n);
      removeNote(chart, i, false, ctx.session);
      continue;
    }
    if (matches && ((operation === 'label' && !numeric) || (operation === 'value' && numeric))) {
      const value =
        operation === 'value'
          ? Number(replacement)
          : (n.landmine
              ? c36to10(String(replacement))
              : cIdto10(String(replacement), chart.base62)) * 10000;
      redoRelabelNote(b, n, value);
      n.value = value;
    }
    i++;
  }
  ctx.addUndo(b.undoHead(), b.redoHead());
  if (operation === 'delete') {
    sortByVPositionInsertion(chart.notes);
    updatePairing(chart);
    ctx.calculateTotalPlayableNotes?.(chart);
  }
}
