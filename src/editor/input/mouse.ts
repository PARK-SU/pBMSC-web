import { maxId } from '../../core/bms/base.ts';
import {
  decreaseCurrentBMP,
  decreaseCurrentWAV,
  increaseCurrentBMP,
  increaseCurrentWAV,
} from '../../core/edit/session.ts';
import { isColumnSound } from '../../core/model/column.ts';
import { calculateGreatestVPosition } from '../../core/model/measure.ts';
import type { Note } from '../../core/model/note.ts';
import { intDiv } from '../../core/vb.ts';
import { isNoPoint, noPoint, type PanelPoint } from '../edit-state.ts';
import {
  beginPanelMousePan,
  getColumnAtX,
  noteRowToPanelHeight,
  onPanelMousePan,
  panelMouseWheel,
  setPanelFocus,
  snapToGrid,
  type PanelIndex,
} from '../view.ts';
import {
  draftGeometry,
  hitOptions,
  mouseButtons,
  mouseVPosition,
  onVScrollValueChanged,
  runInput,
  type InputContext,
  type InputDraft,
  type InputResult,
  type PanelMouseEvent,
} from './events.ts';
import {
  getClickedNote,
  panelYToVPositionSingle,
  timeSelectionLineAt,
  topNoteAt,
  type PanelGeometry,
} from './hit.ts';
import {
  modifierLongNoteActive,
  modifierMultiselectVisibleActive,
  type KeyModifiers,
} from './modifiers.ts';
import { deselectOrRemove } from './tools/remove.ts';
import {
  onDuplicateSelectedNotes,
  onSelectModeLeftClick,
  updateSelectedNotes,
  updateSelectionBox,
} from './tools/select.ts';
import { onTimeSelectClick, timeSelectDown } from './tools/timesel.ts';
import {
  fauxBrush,
  onWriteModeMouseMove,
  writeModeDownNT,
  writeModeUpBMSE,
} from './tools/write.ts';

export { abortDrag } from './drag-state.ts';
export {
  onHScrollValueChanged,
  onVScrollValueChanged,
  type InputContext,
  type InputResult,
  type PanelMouseEvent,
} from './events.ts';

export function pMainInMouseDown(ctx: InputContext, e: PanelMouseEvent): InputResult {
  return runInput(ctx, (d) => mouseDown(d, e));
}

export function pMainInMouseMove(ctx: InputContext, e: PanelMouseEvent): InputResult {
  return runInput(ctx, (d) => mouseMove(d, e));
}

export function pMainInMouseUp(ctx: InputContext, e: PanelMouseEvent): InputResult {
  return runInput(ctx, (d) => mouseUp(d, e));
}

export function refreshHover(
  ctx: InputContext,
  panel: PanelIndex,
  x: number,
  y: number,
  modifiers: KeyModifiers,
): InputResult {
  return runInput(ctx, (d) => {
    mouseMove(d, {
      panel,
      x,
      y,
      button: mouseButtons.none,
      clicks: 0,
      client: { x, y },
      modifiers,
    });
    d.status = true;
  });
}

export function pMainInMouseEnter(ctx: InputContext, panel: PanelIndex): InputResult {
  return runInput(ctx, (d) => {
    d.drag.spMouseOver = panel;
    if (d.drag.firstMouseEnter) {
      d.drag.firstMouseEnter = false;
      d.focusArea = panel;
      d.view = setPanelFocus(d.view, panel);
    }
  });
}

export function pMainInMouseLeave(ctx: InputContext, _panel: PanelIndex): InputResult {
  return runInput(ctx, (d) => {
    d.edit.kMouseOver = -1;
    d.drag.selectedNotes = [];
    d.edit.tempVPosition = -1;
    d.edit.selectedColumn = -1;
    d.redraw = true;
  });
}

export function pMainInMouseWheel(
  ctx: InputContext,
  _panel: PanelIndex,
  delta: number,
  modifiers: KeyModifiers,
): InputResult {
  return runInput(ctx, (d) => {
    d.edit.modifiers = modifiers;
    const s = d.session;
    const base62 = d.chart.base62;
    if (modifiers.shift) {
      if (modifiers.ctrl) {
        if (Math.sign(delta) === -1) increaseCurrentBMP(s, base62);
        else decreaseCurrentBMP(s);
      } else {
        if (Math.sign(delta) === -1) increaseCurrentWAV(s, base62);
        else decreaseCurrentWAV(s);
      }
      d.redraw = true;
    }

    if (d.edit.middleButtonClicked) {
      d.edit.middleButtonClicked = false;
      d.redraw = true;
    }

    const spMouseOver = d.drag.spMouseOver;
    const before = d.view;
    d.view = panelMouseWheel(d.chart, d.view, spMouseOver, delta, modifiers);
    if (d.view !== before) d.redraw = true;
    const value = d.view.panels[spMouseOver].vScroll;
    if (value !== before.panels[spMouseOver].vScroll) {
      const next = onVScrollValueChanged(d.edit, d.drag, before, spMouseOver, value);
      Object.assign(d.edit, next.edit);
      Object.assign(d.drag, next.drag);
    }
  });
}


export function mouseDown(d: InputDraft, e: PanelMouseEvent): void {
  d.edit.modifiers = e.modifiers;
  const s = d.session;

  d.drag.tempFirstMouseDown = d.options.firstClickDisabled && d.focusedPanel !== e.panel;

  d.view = setPanelFocus(d.view, e.panel);
  d.focusArea = e.panel;
  d.edit.lastMouseDownLocation = noPoint;
  d.drag.vsValue = draftGeometry(d, e.panel).xVS;

  if (d.chart.ntInput) {
    s.bAdjustUpper = false;
    s.bAdjustLength = false;
  }
  d.drag.ctrlPressed = false;
  d.drag.duplicatedSelectedNotes = false;

  if (d.edit.middleButtonClicked) {
    d.edit.middleButtonClicked = false;
    return;
  }

  const g = draftGeometry(d, d.view.focus);

  switch (e.button) {
    case mouseButtons.left: {
      if (d.drag.tempFirstMouseDown && d.edit.tool !== 'timeSelect') {
        d.redraw = true;
        break;
      }

      d.edit.kMouseOver = -1;

      const clicked = getClickedNote(
        d.chart,
        d.view,
        hitOptions(d),
        g,
        e.x,
        e.y,
        e.modifiers.shift,
      );
      if (clicked.adjust !== undefined) {
        s.bAdjustUpper = clicked.adjust.bAdjustUpper;
        s.bAdjustLength = clicked.adjust.bAdjustLength;
      }
      const noteIndex = clicked.index;

      panelPreviewNoteIndex(d, noteIndex);

      for (const note of d.chart.notes) note.tempMouseDown = false;
      d.chartChanged = true;

      handleCurrentModeOnClick(d, e, g, noteIndex);
      d.redraw = true;
      d.status = true;
      break;
    }

    case mouseButtons.middle:
      if (d.options.middleButtonMoveMethod === 1) {
        d.drag.temp = beginPanelMousePan(d.view, e.x, e.y);
      } else {
        d.edit.middleButtonLocation = e.client;
        d.edit.middleButtonClicked = true;
        d.drag.timerMiddle = true;
      }
      break;

    case mouseButtons.right:
      deselectOrRemove(d, e, g);
      break;
  }
}

function handleCurrentModeOnClick(
  d: InputDraft,
  e: PanelMouseEvent,
  g: PanelGeometry,
  noteIndex: number,
): void {
  if (d.edit.tool === 'select') {
    onSelectModeLeftClick(d, e, noteIndex, g.height, g.xVS);
  } else if (d.chart.ntInput && d.edit.tool === 'write') {
    writeModeDownNT(d, e, g, noteIndex);
  } else if (d.edit.tool === 'timeSelect') {
    timeSelectDown(d, e, g, noteIndex);
  }
}

function panelPreviewNoteIndex(d: InputDraft, noteIndex: number): void {
  const chart = d.chart;
  const stop = d.options.clickStopPreview;
  d.preview = { stop };
  if (noteIndex <= 0 || !d.options.previewOnClick) return;
  const note = chart.notes[noteIndex]!;
  if (!isColumnSound(note.columnIndex) || note.comment) return;
  let xIW = intDiv(note.value, 10000);
  if (xIW <= 0) xIW = 1;
  if (xIW > maxId(chart.base62)) xIW = maxId(chart.base62);
  if (chart.hWAV[xIW] !== '') d.preview = { stop, noteIndex, wavId: xIW };
}

export function mouseMove(d: InputDraft, e: PanelMouseEvent): void {
  d.edit.modifiers = e.modifiers;
  d.edit.mouseMoveStatus = { x: e.x, y: e.y };

  const iI = e.panel;
  const g = draftGeometry(d, iI);
  const xWidth = d.panelSizes[iI].width;

  switch (e.button) {
    case mouseButtons.none:
      hover(d, e, g);
      break;

    case mouseButtons.left:
      leftDrag(d, e, g, xWidth);
      break;

    case mouseButtons.middle:
      if (d.options.middleButtonMoveMethod === 1) {
        const before = d.view;
        d.view = onPanelMousePan(
          d.chart,
          d.view,
          d.drag.temp,
          e.x,
          e.y,
          d.panelSizes[d.view.focus].width,
          e.modifiers,
        );
        const focus = before.focus;
        const value = d.view.panels[focus].vScroll;
        if (value !== before.panels[focus].vScroll) {
          const next = onVScrollValueChanged(d.edit, d.drag, before, focus, value);
          Object.assign(d.edit, next.edit);
          Object.assign(d.drag, next.drag);
        }
        if (d.view !== before) d.redraw = true;
      }
      break;
  }

  const col = getColumnAtX(d.view, e.x, g.xHS);
  const vps = mouseVPosition(d, d.view.gSnap);
  if (vps !== d.edit.lastStatusVPos || col !== d.edit.lastStatusColumn) {
    d.edit.lastStatusVPos = vps;
    d.edit.lastStatusColumn = col;
    d.status = true;
    d.redraw = true;
  }
}

function hover(d: InputDraft, e: PanelMouseEvent, g: PanelGeometry): void {
  if (d.edit.middleButtonClicked) return;
  const chart = d.chart;
  const s = d.session;
  const view = d.view;

  let xMouseRemainInSameRegion = false;
  const foundNoteIndex = topNoteAt(chart, view, hitOptions(d), g, e.x, e.y, 0);
  if (foundNoteIndex > -1) {
    xMouseRemainInSameRegion = foundNoteIndex === d.edit.kMouseOver;
    if (chart.ntInput) {
      const note = chart.notes[foundNoteIndex]!;
      const vy = noteRowToPanelHeight(view, note.vPosition + note.length, g.xVS, g.height);
      const longNote = modifierLongNoteActive(e.modifiers);
      const xbAdjustUpper = e.y <= vy && longNote;
      const xbAdjustLength = (e.y >= vy - d.visual.kHeight || xbAdjustUpper) && longNote;
      xMouseRemainInSameRegion =
        xMouseRemainInSameRegion &&
        xbAdjustUpper === s.bAdjustUpper &&
        xbAdjustLength === s.bAdjustLength;
      s.bAdjustUpper = xbAdjustUpper;
      s.bAdjustLength = xbAdjustLength;
    }
  }

  const xTempbTimeSelectionMode = d.edit.tool === 'timeSelect';

  if (d.edit.tool === 'select' || xTempbTimeSelectionMode) {
    if (xMouseRemainInSameRegion) return;
    const kMouseOver = d.edit.kMouseOver;
    const vSelMouseOverLine = d.edit.vSelMouseOverLine;
    if (d.edit.kMouseOver >= 0) d.edit.kMouseOver = -1;

    if (xTempbTimeSelectionMode) {
      d.edit.vSelMouseOverLine = timeSelectionLineAt(view, s, g, e.y, d.visual.peDeltaMouseOver);
    }

    d.edit.kMouseOver = foundNoteIndex;
    if (
      foundNoteIndex > -1 ||
      d.edit.kMouseOver !== kMouseOver ||
      d.edit.vSelMouseOverLine !== vSelMouseOverLine
    ) {
      d.redraw = true;
    }
  } else if (d.edit.tool === 'write') {
    d.edit.tempVPosition = panelYToVPositionSingle(view, g.height, g.xVS, e.y);
    if (view.gSnap) d.edit.tempVPosition = snapToGrid(chart, view, d.edit.tempVPosition);

    d.edit.selectedColumn = getColumnAtX(view, e.x, g.xHS);

    d.edit.tempLength = 0;
    if (foundNoteIndex > -1) d.edit.tempLength = chart.notes[foundNoteIndex]!.length;

    d.redraw = true;
  }
}

function leftDrag(d: InputDraft, e: PanelMouseEvent, g: PanelGeometry, xWidth: number): void {
  if (d.drag.tempFirstMouseDown && d.edit.tool !== 'timeSelect') return;

  let tempX = 0;
  let tempY = 0;
  const xHeight = g.height;
  if (e.x < 0 || e.x > xWidth || e.y < 0 || e.y > xHeight) {
    if (e.x < 0) tempX = e.x;
    if (e.x > xWidth) tempX = e.x - xWidth;
    if (e.y < 0) tempY = e.y;
    if (e.y > xHeight) tempY = e.y - xHeight;
    d.drag.timer1 = true;
  } else {
    d.drag.timer1 = false;
  }
  d.drag.temp = { ...d.drag.temp, tempX, tempY };

  if (d.edit.tool === 'select') {
    d.edit.pMouseMove = { x: e.x, y: e.y };

    if (!isNoPoint(d.edit.lastMouseDownLocation)) {
      updateSelectionBox(d, g);
    } else if (d.drag.selectedNotes.length !== 0) {
      updateSelectedNotes(d, e, g);
    } else if (d.drag.ctrlPressed) {
      onDuplicateSelectedNotes(d, e, g);
    }
  } else if (d.edit.tool === 'write') {
    if (d.chart.ntInput) {
      onWriteModeMouseMove(d);
    } else {
      d.edit.tempVPosition = panelYToVPositionSingle(d.view, g.height, g.xVS, e.y);
      if (d.view.gSnap) d.edit.tempVPosition = snapToGrid(d.chart, d.view, d.edit.tempVPosition);
      d.edit.selectedColumn = getColumnAtX(d.view, e.x, g.xHS);
    }
  } else {
    onTimeSelectClick(d, e, g);
  }
}

export function mouseUp(d: InputDraft, e: PanelMouseEvent): void {
  d.edit.modifiers = e.modifiers;
  d.drag.temp = { tempX: 0, tempY: 0, tempV: 0, tempH: 0 };
  d.drag.vsValue = -1;
  d.drag.hsValue = -1;
  d.drag.timer1 = false;

  if (fauxBrush(d)) return;

  d.drag.selectedNotes = [];

  if (
    d.edit.middleButtonClicked &&
    e.button === mouseButtons.middle &&
    releaseDistanceSquared(d.edit.middleButtonLocation, e.client) >= d.visual.middleDeltaRelease
  ) {
    d.edit.middleButtonClicked = false;
  }

  if (d.edit.tool === 'select') {
    d.edit.lastMouseDownLocation = noPoint;
    d.edit.pMouseMove = noPoint;

    if (
      d.drag.ctrlPressed &&
      !d.drag.duplicatedSelectedNotes &&
      !modifierMultiselectVisibleActive(e.modifiers)
    ) {
      const notes: readonly Note[] = d.chart.notes;
      for (let i = 1; i <= notes.length - 1; i++) {
        if (notes[i]!.tempMouseDown) {
          notes[i]!.selected = !notes[i]!.selected;
          d.chartChanged = true;
          break;
        }
      }
    }

    d.drag.ctrlPressed = false;
    d.drag.duplicatedSelectedNotes = false;
  } else if (d.edit.tool === 'write') {
    if (!d.chart.ntInput && !d.drag.tempFirstMouseDown) writeModeUpBMSE(d, e);

    if (!d.edit.shouldDrawTempNote) d.edit.shouldDrawTempNote = true;
    d.edit.tempVPosition = -1;
    d.edit.selectedColumn = -1;
  }
  calculateGreatestVPosition(d.chart);
  d.redraw = true;
}

function releaseDistanceSquared(origin: PanelPoint, cursor: PanelPoint): number {
  return (origin.x - cursor.x) ** 2 + (origin.y - cursor.y) ** 2;
}
