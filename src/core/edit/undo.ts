import type { UndoChain } from './commands.ts';

export const undoRedoCount = 200;

export const noOperationChain: UndoChain = [{ op: 'noOperation' }];

export interface UndoStack {
  readonly sUndo: readonly (UndoChain | null)[];
  readonly sRedo: readonly (UndoChain | null)[];
  readonly sI: number;
}

export function clearUndo(): UndoStack {
  const sUndo = new Array<UndoChain | null>(undoRedoCount + 1).fill(null);
  const sRedo = new Array<UndoChain | null>(undoRedoCount + 1).fill(null);
  sUndo[0] = noOperationChain;
  sUndo[1] = noOperationChain;
  sRedo[0] = noOperationChain;
  sRedo[1] = noOperationChain;
  return { sUndo, sRedo, sI: 0 };
}

export function sIA(s: UndoStack): number {
  return s.sI > undoRedoCount - 1 ? 0 : s.sI + 1;
}

export function sIM(s: UndoStack): number {
  return s.sI < 1 ? undoRedoCount : s.sI - 1;
}

export function addUndo(
  s: UndoStack,
  sCUndo: UndoChain | null,
  sCRedo: UndoChain | null,
  overWrite = false,
): UndoStack {
  const undo = sCUndo !== null && sCUndo.length > 0 ? sCUndo : null;
  const redo = sCRedo !== null && sCRedo.length > 0 ? sCRedo : null;
  if (undo === null && redo === null) return s;
  const sI = overWrite ? s.sI : sIA(s);
  const sUndo = [...s.sUndo];
  const sRedo = [...s.sRedo];
  sUndo[sI] = undo;
  sRedo[sI] = redo;
  const next = sIA({ ...s, sI });
  sUndo[next] = noOperationChain;
  sRedo[next] = noOperationChain;
  return { sUndo, sRedo, sI };
}

function isNoOperation(chain: UndoChain | null): boolean {
  return chain === null || chain[0]?.op === 'noOperation';
}

export function canUndo(s: UndoStack): boolean {
  return !isNoOperation(undoChainAt(s));
}

export function canRedo(s: UndoStack): boolean {
  return !isNoOperation(redoChainAt(s));
}

export function undoChainAt(s: UndoStack): UndoChain | null {
  return s.sUndo[s.sI] ?? null;
}

export function redoChainAt(s: UndoStack): UndoChain | null {
  return s.sRedo[sIA(s)] ?? null;
}

export function lastRedo(s: UndoStack): UndoChain | null {
  return s.sRedo[s.sI] ?? null;
}

export function afterUndo(s: UndoStack): UndoStack {
  return { ...s, sI: sIM(s) };
}

export function afterRedo(s: UndoStack): UndoStack {
  return { ...s, sI: sIA(s) };
}
