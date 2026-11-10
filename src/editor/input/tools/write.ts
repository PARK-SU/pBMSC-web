import { MaxId36 } from '../../../core/bms/base.ts';
import {
  redoAddNote,
  redoLongNoteModify,
  redoRemoveNote,
  UndoChainBuilder,
} from '../../../core/edit/chain.ts';
import { updatePairing } from '../../../core/edit/pairing.ts';
import { increaseCurrentWAV } from '../../../core/edit/session.ts';
import { lastRedo } from '../../../core/edit/undo.ts';
import { isColumnImage, isColumnNumeric, isColumnSound } from '../../../core/model/column.ts';
import { calculateGreatestVPosition, getMaxVPosition } from '../../../core/model/measure.ts';
import { cloneNote, emptyNote, newNote, newNoteBMSE, type Note } from '../../../core/model/note.ts';
import { sortByVPositionInsertion } from '../../../core/model/sort.ts';
import { VbError } from '../../../core/vb.ts';
import { getColumnAtX, snapToGrid } from '../../view.ts';
import {
  calculateTotalPlayableNotes,
  draftAddNote,
  draftAddUndo,
  draftTbUndoClick,
  mouseButtons,
  mouseVPosition,
  type InputDraft,
  type PanelMouseEvent,
} from '../events.ts';
import { panelYToVPositionDouble, type PanelGeometry } from '../hit.ts';
import {
  modifierHiddenActive,
  modifierLandmineActive,
  modifierLongNoteActive,
} from '../modifiers.ts';
import { numericPromptMessage } from '../prompts.ts';

const landmineMaxValue = MaxId36 * 10000;

export function writeModeDownNT(
  d: InputDraft,
  e: PanelMouseEvent,
  g: PanelGeometry,
  noteIndex: number,
): void {
  const chart = d.chart;
  const notes: readonly Note[] = chart.notes;
  const s = d.session;
  d.edit.tempVPosition = -1;
  d.edit.selectedColumn = -1;
  d.edit.shouldDrawTempNote = false;

  const xVPosition = mouseVPosition(d, d.view.gSnap);

  if (xVPosition < 0 || xVPosition >= getMaxVPosition(chart)) return;

  const xColumn = getColumnAtX(d.view, e.x, g.xHS);

  for (let xI2 = notes.length - 1; xI2 >= 1; xI2--) {
    if (notes[xI2]!.vPosition === xVPosition && notes[xI2]!.columnIndex === xColumn) {
      noteIndex = xI2;
      break;
    }
  }

  const hidden = modifierHiddenActive(e.modifiers);

  if (noteIndex > 0) {
    const note = notes[noteIndex]!;
    d.drag.selectedNotes = [cloneNote(note)];
    note.tempIndex = 0;
    note.tempMouseDown = true;
    note.length = xVPosition - note.vPosition;

    s.bAdjustUpper = true;

    const b = new UndoChainBuilder();
    redoLongNoteModify(b, d.drag.selectedNotes[0]!, note.vPosition, note.length);
    draftAddUndo(d, b.undoHead(), b.redoHead());
  } else if (isColumnNumeric(xColumn)) {
    d.prompt = {
      kind: 'writeNumeric',
      mode: 'NT',
      column: xColumn,
      vPosition: xVPosition,
      hidden,
      longNote: 0,
      message: numericPromptMessage(xColumn),
    };
    return;
  } else if (isColumnSound(xColumn)) {
    let xLbl = (s.currentWav + 1) * 10000;

    const landmine = modifierLandmineActive(e.modifiers);
    if (landmine && xLbl > landmineMaxValue) xLbl = landmineMaxValue;

    const n: Note = {
      ...emptyNote(),
      vPosition: xVPosition,
      columnIndex: xColumn,
      value: xLbl,
      hidden,
      landmine,
      tempMouseDown: true,
    };
    chart.notes.push(n);

    const snapshot = cloneNote(n);
    snapshot.lnPair = -1;
    d.drag.selectedNotes = [snapshot];

    if (s.wavIncrease) increaseCurrentWAV(s, chart.base62);

    d.drag.uAdded = false;

    const b = new UndoChainBuilder();
    redoAddNote(b, n);
    draftAddUndo(d, b.undoHead(), b.redoHead());
  } else {
    const xLbl = (s.currentBmp + 1) * 10000;

    const n: Note = {
      ...emptyNote(),
      vPosition: xVPosition,
      columnIndex: xColumn,
      value: xLbl,
      hidden: false,
      landmine: false,
      tempMouseDown: true,
    };
    chart.notes.push(n);

    const snapshot = cloneNote(n);
    snapshot.lnPair = -1;
    d.drag.selectedNotes = [snapshot];

    d.drag.uAdded = false;

    const b = new UndoChainBuilder();
    redoAddNote(b, n);
    draftAddUndo(d, b.undoHead(), b.redoHead());
  }

  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
  calculateTotalPlayableNotes(d);
  d.chartChanged = true;
}

export function onWriteModeMouseMove(d: InputDraft): void {
  if (d.drag.selectedNotes.length === 0) return;
  const chart = d.chart;
  const notes: readonly Note[] = chart.notes;
  const s = d.session;

  let xITemp = 0;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    if (notes[xI1]!.tempMouseDown) {
      xITemp = xI1;
      break;
    }
  }

  const mouse = mouseVPosition(d, d.view.gSnap);

  const note = notes[xITemp]!;
  if (s.bAdjustUpper && mouse < note.vPosition) {
    s.bAdjustUpper = false;
    note.vPosition += note.length;
    note.length *= -1;
  } else if (!s.bAdjustUpper && mouse > note.vPosition + note.length) {
    s.bAdjustUpper = true;
    note.vPosition += note.length;
    note.length *= -1;
  }

  if (s.bAdjustUpper) {
    note.length = mouse - note.vPosition;
  } else {
    note.length = note.vPosition + note.length - mouse;
    note.vPosition = mouse;
  }

  if (note.vPosition < 0) {
    note.length += note.vPosition;
    note.vPosition = 0;
  }
  if (note.vPosition + note.length >= getMaxVPosition(chart)) {
    note.length = getMaxVPosition(chart) - 1 - note.vPosition;
  }

  const b = new UndoChainBuilder();
  if (d.drag.selectedNotes[0]!.lnPair === -1) {
    redoAddNote(b, note);
  } else {
    redoLongNoteModify(b, d.drag.selectedNotes[0]!, note.vPosition, note.length);
  }
  draftAddUndo(d, b.undoHead(), b.redoHead(), true);

  d.edit.selectedColumn = note.columnIndex;
  d.edit.tempVPosition = mouse;
  d.edit.tempLength = note.length;

  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
  calculateTotalPlayableNotes(d);
  d.chartChanged = true;
}

export function writeModeUpBMSE(d: InputDraft, e: PanelMouseEvent): void {
  const chart = d.chart;
  const notes: readonly Note[] = chart.notes;
  const view = d.view;
  const panel = e.panel;

  let xVPosition = panelYToVPositionDouble(view, panel, d.panelSizes[panel].height, e.y);
  if (view.gSnap) xVPosition = snapToGrid(chart, view, xVPosition);

  const xColumn = getColumnAtX(view, e.x, view.panels[panel].hScroll);

  if (e.button !== mouseButtons.left) return;

  const hiddenNote = modifierHiddenActive(e.modifiers);
  const longNote = modifierLongNoteActive(e.modifiers) ? 1 : 0;
  const landmine = modifierLandmineActive(e.modifiers);
  const b = new UndoChainBuilder();

  if (isColumnNumeric(xColumn)) {
    d.prompt = {
      kind: 'writeNumeric',
      mode: 'BMSE',
      column: xColumn,
      vPosition: xVPosition,
      hidden: hiddenNote,
      longNote,
      message: numericPromptMessage(xColumn),
    };
  } else if (isColumnSound(xColumn)) {
    let xValue = (d.session.currentWav + 1) * 10000;
    if (landmine && xValue > landmineMaxValue) xValue = landmineMaxValue;

    for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
      if (notes[xI1]!.vPosition === xVPosition && notes[xI1]!.columnIndex === xColumn) {
        redoRemoveNote(b, notes[xI1]!);
      }
    }

    const n = newNote(xColumn, xVPosition, xValue, longNote, hiddenNote, true, landmine);

    redoAddNote(b, n);
    draftAddNote(d, n);

    draftAddUndo(d, b.undoHead(), b.redoTail());
  } else {
    const xValue = (d.session.currentBmp + 1) * 10000;

    for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
      if (notes[xI1]!.vPosition === xVPosition && notes[xI1]!.columnIndex === xColumn) {
        redoRemoveNote(b, notes[xI1]!);
      }
    }

    const n = newNote(xColumn, xVPosition, xValue, longNote, false, true, false);

    redoAddNote(b, n);
    draftAddNote(d, n);

    draftAddUndo(d, b.undoHead(), b.redoTail());
  }
}

export function fauxBrush(d: InputDraft): boolean {
  const selectedNotes = d.drag.selectedNotes;
  if (!(selectedNotes.length === 1 && isColumnImage(selectedNotes[0]!.columnIndex))) return false;

  const redo = lastRedo(d.doc.undo);
  const head = redo?.[0];
  if (head === undefined) throw new VbError('NullReference');
  if (head.op !== 'addNote') throw new VbError('InvalidCast');
  const vLen = head.note.length;
  const vPosStart = head.note.vPosition;
  const xColumn = head.note.columnIndex;

  if (vLen === 0) return false;

  draftTbUndoClick(d);

  const bmp = d.bmpSelection;
  const b = new UndoChainBuilder();

  if (bmp.length === 0) throw new VbError('Argument');
  let n = newNoteBMSE(xColumn, vPosStart, (bmp[0]! + 1) * 10000, false, false, true, false);
  redoAddNote(b, n);
  draftAddNote(d, n);

  for (let xI = 1; xI <= bmp.length - 1; xI++) {
    n = newNoteBMSE(
      xColumn,
      vPosStart + (vLen * xI) / (bmp.length - 1),
      (bmp[xI]! + 1) * 10000,
      false,
      false,
      true,
      false,
    );
    redoAddNote(b, n);
    draftAddNote(d, n);
  }
  draftAddUndo(d, b.undoHead(), b.redoHead());

  if (!d.edit.shouldDrawTempNote) d.edit.shouldDrawTempNote = true;

  calculateGreatestVPosition(d.chart);
  d.redraw = true;
  d.drag.selectedNotes = [];
  d.chartChanged = true;
  return true;
}
