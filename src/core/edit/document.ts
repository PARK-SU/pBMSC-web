import type { Chart } from '../model/chart.ts';
import { performCommand, type PerformContext, type UndoChain } from './commands.ts';
import {
  addUndo,
  afterRedo,
  afterUndo,
  canRedo,
  canUndo,
  clearUndo,
  redoChainAt,
  undoChainAt,
  type UndoStack,
} from './undo.ts';

export interface ChartDocument {
  chart: Chart;
  undo: UndoStack;
  isSaved: boolean;
}

export function createDocument(chart: Chart, isSaved: boolean): ChartDocument {
  return { chart, undo: clearUndo(), isSaved };
}

export function documentAddUndo(
  doc: ChartDocument,
  sCUndo: UndoChain | null,
  sCRedo: UndoChain | null,
  overWrite = false,
): void {
  const undo = addUndo(doc.undo, sCUndo, sCRedo, overWrite);
  if (undo === doc.undo) return;
  if (doc.isSaved) doc.isSaved = false;
  doc.undo = undo;
}

export function tbUndoClick(doc: ChartDocument, ctx: PerformContext): boolean {
  if (!canUndo(doc.undo)) return false;
  performCommand(doc.chart, undoChainAt(doc.undo)!, ctx, doc);
  doc.undo = afterUndo(doc.undo);
  return true;
}

export function tbRedoClick(doc: ChartDocument, ctx: PerformContext): boolean {
  if (!canRedo(doc.undo)) return false;
  performCommand(doc.chart, redoChainAt(doc.undo)!, ctx, doc);
  doc.undo = afterRedo(doc.undo);
  return true;
}
