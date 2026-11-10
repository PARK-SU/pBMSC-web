import {
  redoAddNote,
  redoLongNoteModify,
  redoMoveNote,
  UndoChainBuilder,
} from '../../../core/edit/chain.ts';
import { updatePairing } from '../../../core/edit/pairing.ts';
import { isLabelMatch } from '../../../core/edit/selection.ts';
import { isColumnSound } from '../../../core/model/column.ts';
import { cloneNote, emptyNote, type Note } from '../../../core/model/note.ts';
import { sortByVPositionInsertion } from '../../../core/model/sort.ts';
import { isNoteVisible, noteBorders } from '../../render/notes.ts';
import {
  columnArrayIndexToEnabledColumnIndex,
  enabledColumnIndexToColumnArrayIndex,
  getColumnAtX,
  nEnabled,
} from '../../view.ts';
import {
  calculateTotalPlayableNotes,
  draftAddUndo,
  hitOptions,
  mouseVPosition,
  type InputDraft,
  type PanelMouseEvent,
} from '../events.ts';
import {
  columnAtXRaw,
  firstNoteAt,
  intersectsWith,
  noteBoxRect,
  selectionBoxRect,
  type PanelGeometry,
} from '../hit.ts';
import {
  modifierCtrlOnlyActive,
  modifierMultiselectNoteActive,
  modifierMultiselectVisibleActive,
} from '../modifiers.ts';
import { doubleClickNoteIndex } from '../prompts.ts';

const maxVPositionBound = 191999;

function selectedNote(d: InputDraft, tempIndex: number): Readonly<Note> {
  const note = d.drag.selectedNotes[tempIndex];
  if (note === undefined) throw new RangeError(`SelectedNotes(${tempIndex}) is out of range`);
  return note;
}

function noteAt(d: InputDraft, i: number): Note {
  const note = d.chart.notes[i];
  if (note === undefined) throw new RangeError(`Notes(${i}) is out of range`);
  return note;
}

function tempMouseDownNote(notes: readonly Readonly<Note>[]): number {
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    if (notes[xI1]!.tempMouseDown) return xI1;
  }
  return 0;
}

export function onSelectModeLeftClick(
  d: InputDraft,
  e: PanelMouseEvent,
  noteIndex: number,
  xTHeight: number,
  xVS: number,
): void {
  const notes: readonly Note[] = d.chart.notes;
  const m = e.modifiers;
  if (noteIndex >= 0 && e.clicks === 2) {
    doubleClickNoteIndex(d, noteIndex);
    return;
  }
  d.chartChanged = true;

  if (noteIndex > 0) {
    d.drag.selectedNotes = [];
    notes[noteIndex]!.tempMouseDown = true;

    if (modifierCtrlOnlyActive(m)) {
      d.drag.ctrlPressed = true;
    } else if (modifierMultiselectVisibleActive(m)) {
      const borders = noteBorders(d.view.gxHeight, d.visual.kHeight, xTHeight, xVS);
      for (let xI1 = 0; xI1 <= notes.length - 1; xI1++) {
        const note = notes[xI1]!;
        if (
          isNoteVisible(note, borders) &&
          isLabelMatch(d.chart, note, noteIndex, d.view.showFileName)
        ) {
          note.selected = !note.selected;
        }
      }
    } else if (modifierMultiselectNoteActive(m)) {
      for (let xI1 = 0; xI1 <= notes.length - 1; xI1++) {
        const note = notes[xI1]!;
        if (
          isLabelMatch(d.chart, note, noteIndex, d.view.showFileName) &&
          isColumnSound(note.columnIndex)
        ) {
          note.selected = !note.selected;
        }
      }
    } else {
      if (!notes[noteIndex]!.selected) {
        for (let xI1 = 0; xI1 <= notes.length - 1; xI1++) {
          if (notes[xI1]!.selected) notes[xI1]!.selected = false;
        }
        notes[noteIndex]!.selected = true;
      }

      let selectedCount = 0;
      for (let xI1 = 0; xI1 <= notes.length - 1; xI1++) {
        if (notes[xI1]!.selected) selectedCount += 1;
      }

      d.drag.bAdjustSingle = selectedCount === 1;

      const selectedNotes = Array.from({ length: selectedCount + 1 }, emptyNote);
      selectedNotes[0] = cloneNote(notes[noteIndex]!);
      notes[noteIndex]!.tempIndex = 0;
      let idx = 1;

      for (let xI1 = 1; xI1 <= noteIndex - 1; xI1++) {
        if (notes[xI1]!.selected) {
          notes[xI1]!.tempIndex = idx;
          selectedNotes[idx] = cloneNote(notes[xI1]!);
          idx += 1;
        }
      }
      for (let xI1 = noteIndex + 1; xI1 <= notes.length - 1; xI1++) {
        if (notes[xI1]!.selected) {
          notes[xI1]!.tempIndex = idx;
          selectedNotes[idx] = cloneNote(notes[xI1]!);
          idx += 1;
        }
      }
      d.drag.selectedNotes = selectedNotes;
      d.drag.uAdded = false;
    }
  } else {
    d.drag.selectedNotes = [];
    d.edit.lastMouseDownLocation = { x: e.x, y: e.y };
    if (!m.ctrl) {
      for (let xI1 = 0; xI1 <= notes.length - 1; xI1++) {
        notes[xI1]!.selected = false;
        notes[xI1]!.tempSelected = false;
      }
    } else {
      for (let xI1 = 0; xI1 <= notes.length - 1; xI1++) {
        notes[xI1]!.tempSelected = notes[xI1]!.selected;
      }
    }
  }
}

export function updateSelectedNotes(d: InputDraft, e: PanelMouseEvent, g: PanelGeometry): void {
  const chart = d.chart;
  const notes: readonly Note[] = chart.notes;
  const s = d.session;

  const xITemp = tempMouseDownNote(notes);
  const mouse = mouseVPosition(d, d.view.gSnap);

  if (s.bAdjustLength && d.drag.bAdjustSingle) {
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
  }

  const foundNoteIndex = firstNoteAt(chart, d.view, hitOptions(d), g, e.x, e.y);
  const temp = notes[xITemp]!;

  if (!s.bAdjustLength) {
    onSelectModeMoveNotes(d, e, g.xHS, xITemp);
  } else if (s.bAdjustUpper) {
    let dVPosition = mouse - temp.vPosition - temp.length;
    if (foundNoteIndex > -1 && foundNoteIndex !== xITemp) {
      dVPosition = notes[foundNoteIndex]!.vPosition - temp.vPosition - temp.length;
    }
    onAdjustUpperEnd(d, dVPosition);
  } else {
    let dVPosition = mouse - temp.vPosition;
    if (foundNoteIndex > -1 && foundNoteIndex !== xITemp) {
      dVPosition = notes[foundNoteIndex]!.vPosition - temp.vPosition;
    }
    onAdjustLowerEnd(d, dVPosition);
  }

  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
  calculateTotalPlayableNotes(d);
  d.chartChanged = true;
}

export function onSelectModeMoveNotes(
  d: InputDraft,
  e: PanelMouseEvent,
  xHS: number,
  xITemp: number,
): void {
  const view = d.view;
  const notes: readonly Note[] = d.chart.notes;
  const temp = noteAt(d, xITemp);
  if (temp.ghost) return;
  let mouse = mouseVPosition(d, view.gSnap);
  if (view.disableVerticalMove) mouse = selectedNote(d, 0).vPosition;
  const dVPosition = mouse - temp.vPosition;

  const mouseColumn = columnArrayIndexToEnabledColumnIndex(view, columnAtXRaw(view, e.x, xHS));
  const dColumn = mouseColumn - columnArrayIndexToEnabledColumnIndex(view, temp.columnIndex);

  let mLeft = 0;
  let mVPosition = 0;
  let muVPosition = maxVPositionBound;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    const note = notes[xI1]!;
    if (!note.selected) continue;
    const xColumn = columnArrayIndexToEnabledColumnIndex(view, note.columnIndex) + dColumn;
    mLeft = xColumn < mLeft ? xColumn : mLeft;
    mVPosition =
      note.vPosition + dVPosition < mVPosition ? note.vPosition + dVPosition : mVPosition;
    const ntLength = d.chart.ntInput ? note.length : 0;
    muVPosition =
      note.vPosition + ntLength + dVPosition > muVPosition
        ? note.vPosition + ntLength + dVPosition
        : muVPosition;
  }
  muVPosition -= maxVPositionBound;

  const b = new UndoChainBuilder();
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    const note = notes[xI1]!;
    if (!note.selected || note.ghost) continue;

    const xCol = enabledColumnIndexToColumnArrayIndex(
      view,
      columnArrayIndexToEnabledColumnIndex(view, note.columnIndex) + dColumn - mLeft,
    );
    const xVPos = note.vPosition + dVPosition - mVPosition - muVPosition;
    redoMoveNote(b, selectedNote(d, note.tempIndex), xCol, xVPos);

    note.columnIndex = xCol;
    note.vPosition = xVPos;
  }

  draftAddUndo(d, b.undoHead(), b.redoHead(), d.drag.uAdded);
  if (!d.drag.uAdded) d.drag.uAdded = true;
}

export function onAdjustUpperEnd(d: InputDraft, dVPosition: number): void {
  const notes: readonly Note[] = d.chart.notes;
  let minLength = 0;
  let maxHeight = maxVPositionBound;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    const note = notes[xI1]!;
    if (!note.selected || note.ghost) continue;
    if (note.length + dVPosition < minLength) minLength = note.length + dVPosition;
    if (note.length + note.vPosition + dVPosition > maxHeight) {
      maxHeight = note.length + note.vPosition + dVPosition;
    }
  }
  maxHeight -= maxVPositionBound;

  const b = new UndoChainBuilder();
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    const note = notes[xI1]!;
    if (!note.selected || note.ghost) continue;

    const xLen = note.length + dVPosition - minLength - maxHeight;
    redoLongNoteModify(b, selectedNote(d, note.tempIndex), note.vPosition, xLen);

    note.length = xLen;
  }

  if (dVPosition - minLength - maxHeight !== 0) {
    draftAddUndo(d, b.undoHead(), b.redoHead(), d.drag.uAdded);
    if (!d.drag.uAdded) d.drag.uAdded = true;
  }
}

export function onAdjustLowerEnd(d: InputDraft, dVPosition: number): void {
  const notes: readonly Note[] = d.chart.notes;
  let minLength = 0;
  let minVPosition = 0;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    const note = notes[xI1]!;
    if (note.selected && note.length - dVPosition < minLength) {
      minLength = note.length - dVPosition;
    }
    if (note.selected && note.vPosition + dVPosition < minVPosition) {
      minVPosition = note.vPosition + dVPosition;
    }
  }

  const b = new UndoChainBuilder();
  for (let xI1 = 0; xI1 <= notes.length - 1; xI1++) {
    const note = notes[xI1]!;
    if (!note.selected || note.ghost) continue;

    const xVPos = note.vPosition + dVPosition + minLength - minVPosition;
    const xLen = note.length - dVPosition - minLength + minVPosition;
    redoLongNoteModify(b, selectedNote(d, note.tempIndex), xVPos, xLen);

    note.vPosition = xVPos;
    note.length = xLen;
  }

  if (dVPosition + minLength - minVPosition !== 0) {
    draftAddUndo(d, b.undoHead(), b.redoHead(), d.drag.uAdded);
    if (!d.drag.uAdded) d.drag.uAdded = true;
  }
}

export function onDuplicateSelectedNotes(
  d: InputDraft,
  e: PanelMouseEvent,
  g: PanelGeometry,
): void {
  const chart = d.chart;
  const view = d.view;
  const notes: readonly Note[] = chart.notes;

  let tempNoteIndex = 1;
  while (tempNoteIndex <= notes.length - 1 && !notes[tempNoteIndex]!.tempMouseDown) {
    tempNoteIndex += 1;
  }

  let mouse = mouseVPosition(d, view.gSnap);
  if (view.disableVerticalMove) mouse = noteAt(d, tempNoteIndex).vPosition;

  const dVPosition = mouse - noteAt(d, tempNoteIndex).vPosition;

  const currCol = columnArrayIndexToEnabledColumnIndex(view, getColumnAtX(view, e.x, g.xHS));
  const noteCol = columnArrayIndexToEnabledColumnIndex(view, notes[tempNoteIndex]!.columnIndex);
  const colChange = currCol - noteCol;

  let dstColumn = 0;
  let mVPosition = 0;
  let muVPosition = maxVPositionBound;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    const note = notes[xI1]!;
    if (!note.selected || note.ghost) continue;

    const xColumn = columnArrayIndexToEnabledColumnIndex(view, note.columnIndex) + colChange;
    if (xColumn < dstColumn) dstColumn = xColumn;

    if (note.vPosition + dVPosition < mVPosition) mVPosition = note.vPosition + dVPosition;

    const ntLength = chart.ntInput ? note.length : 0;
    if (note.vPosition + ntLength + dVPosition > muVPosition) {
      muVPosition = note.vPosition + ntLength + dVPosition;
    }
  }
  muVPosition -= maxVPositionBound;

  if (
    !d.drag.duplicatedSelectedNotes &&
    colChange - dstColumn === 0 &&
    dVPosition - mVPosition - muVPosition === 0
  ) {
    return;
  }

  if (!d.drag.duplicatedSelectedNotes) {
    duplicateSelectedNotes(
      d,
      tempNoteIndex,
      dVPosition,
      colChange,
      dstColumn,
      mVPosition,
      muVPosition,
    );
    d.drag.duplicatedSelectedNotes = true;
  } else {
    const b = new UndoChainBuilder();
    for (let i = 1; i <= notes.length - 1; i++) {
      const note = notes[i]!;
      if (!note.selected) continue;

      note.columnIndex = enabledColumnIndexToColumnArrayIndex(
        view,
        columnArrayIndexToEnabledColumnIndex(view, note.columnIndex) + colChange - dstColumn,
      );
      note.vPosition = note.vPosition + dVPosition - mVPosition - muVPosition;
      redoAddNote(b, note);
    }

    draftAddUndo(d, b.undoHead(), b.redoHead(), true);
  }

  sortByVPositionInsertion(chart.notes);
  updatePairing(chart);
  calculateTotalPlayableNotes(d);
  d.chartChanged = true;
}

export function duplicateSelectedNotes(
  d: InputDraft,
  tempNoteIndex: number,
  dVPosition: number,
  dColumn: number,
  mLeft: number,
  mVPosition: number,
  muVPosition: number,
): void {
  const view = d.view;
  const notes: readonly Note[] = d.chart.notes;
  const b = new UndoChainBuilder();

  notes[tempNoteIndex]!.selected = true;

  const xTempNotes: Note[] = [];
  for (let i = 1; i <= notes.length - 1; i++) {
    const note = notes[i]!;
    if (!note.selected) continue;

    const copy = cloneNote(note);
    copy.columnIndex = enabledColumnIndexToColumnArrayIndex(
      view,
      columnArrayIndexToEnabledColumnIndex(view, note.columnIndex) + dColumn - mLeft,
    );
    copy.vPosition = note.vPosition + dVPosition - mVPosition - muVPosition;
    redoAddNote(b, copy);
    xTempNotes.push(copy);

    note.selected = false;
  }
  notes[tempNoteIndex]!.tempMouseDown = false;

  d.chart.notes.push(...xTempNotes);

  draftAddUndo(d, b.undoHead(), b.redoHead());
}

export function updateSelectionBox(d: InputDraft, g: PanelGeometry): void {
  const view = d.view;
  const notes: readonly Note[] = d.chart.notes;
  const selectionBox = selectionBoxRect(d.edit.lastMouseDownLocation, d.edit.pMouseMove);
  const o = hitOptions(d);

  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    const note = notes[xI1]!;
    const noteRect = noteBoxRect(view, o, g, note);
    if (intersectsWith(noteRect, selectionBox)) {
      note.selected = !note.tempSelected && nEnabled(view, note.columnIndex);
    } else {
      note.selected = note.tempSelected && nEnabled(view, note.columnIndex);
    }
  }
  d.chartChanged = true;
}
