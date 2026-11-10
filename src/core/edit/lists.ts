import { maxId } from '../bms/base.ts';
import type { Chart } from '../model/chart.ts';
import { isColumnNumeric, isColumnSound } from '../model/column.ts';
import { intDiv } from '../vb.ts';
import { redoRelabelNote, UndoChainBuilder } from './chain.ts';
import type { ChartDocument } from './document.ts';
import type { EditContext } from './ops.ts';

export type ResourceKind = 'wav' | 'bmp';
const tableKey = (kind: ResourceKind) => (kind === 'wav' ? 'hWAV' : 'hBMP');

export function addResources(
  doc: ChartDocument,
  kind: ResourceKind,
  selected: readonly number[],
  paths: readonly string[],
): number[] {
  if (selected.length === 0 || paths.length === 0) return [...selected];
  const key = tableKey(kind);
  const indices = [...selected];
  const end = maxId(doc.chart.base62) - 1;
  let next = indices.at(-1)! + 1;
  while (indices.length < paths.length && next <= end) {
    while (next <= end && doc.chart[key][next + 1] !== '') next++;
    if (next <= end) indices.push(next++);
  }
  const count = Math.min(indices.length, paths.length);
  for (let i = 0; i < count; i++) {
    doc.chart[key][indices[i]! + 1] = paths[i]!.split(/[\\/]/).at(-1)!;
  }
  doc.isSaved = false;
  return indices.slice(0, count);
}

export function removeResources(
  doc: ChartDocument,
  kind: ResourceKind,
  selected: readonly number[],
): void {
  for (const index of selected) doc.chart[tableKey(kind)][index + 1] = '';
  doc.isSaved = false;
}

export function renameResource(
  doc: ChartDocument,
  kind: ResourceKind,
  index: number,
  name: string,
): void {
  if (doc.chart[tableKey(kind)][index + 1] === name) return;
  doc.chart[tableKey(kind)][index + 1] = name;
  doc.isSaved = false;
}

export function moveResources(
  chart: Chart,
  kind: ResourceKind,
  selected: readonly number[],
  direction: -1 | 1,
  changeLabel: boolean,
  ctx: EditContext,
): number[] {
  if (selected.length === 0) return [];
  const indices = [...selected];
  const key = tableKey(kind);
  const count = maxId(chart.base62);
  const b = new UndoChainBuilder();
  let start = direction === -1 ? 0 : count - 1;
  while (start >= 0 && start < count && indices.includes(start)) start -= direction;
  for (let i = start; i >= 0 && i < count; i -= direction) {
    const at = indices.indexOf(i);
    if (at === -1) continue;
    const other = i + direction;
    const old = chart[key][i + 1]!;
    chart[key][i + 1] = chart[key][other + 1]!;
    chart[key][other + 1] = old;
    if (changeLabel) {
      for (let j = 1; j < chart.notes.length; j++) {
        const note = chart.notes[j]!;
        if (kind === 'wav' ? !isColumnSound(note.columnIndex) : isColumnNumeric(note.columnIndex))
          continue;
        const id = intDiv(note.value, 10000);
        const value =
          id === i + 1 ? (other + 1) * 10000 : id === other + 1 ? (i + 1) * 10000 : undefined;
        if (value === undefined) continue;
        redoRelabelNote(b, note, value);
        note.value = value;
      }
    }
    indices[at] = other;
  }
  ctx.addUndo(b.undoHead(), b.redoHead());
  return indices.sort((a, b) => a - b);
}

export function duplicateWavs(doc: ChartDocument, selected: readonly number[]): number[] {
  if (selected.length === 0) throw new RangeError('No selected WAV');
  const values: string[] = [];
  for (let i = 0; i < selected.length; i++) {
    if (i > 0) for (let gap = 1; gap < selected[i]! - selected[i - 1]!; gap++) values.push('');
    values.push(doc.chart.hWAV[selected[i]! + 1]!, doc.chart.hWAV[selected[i]! + 1]!);
  }
  const first = selected[0]!;
  const last = Math.min(maxId(doc.chart.base62) - 1, first + values.length - 1);
  for (let i = first; i <= last; i++) doc.chart.hWAV[i + 1] = values[i - first]!;
  doc.isSaved = false;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}
