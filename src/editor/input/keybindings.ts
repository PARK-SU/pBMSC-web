import { maxId } from '../../core/bms/base.ts';
import { UndoChainBuilder } from '../../core/edit/chain.ts';
import { mnDeleteClick, tbCopyClick, tbCutClick, tbPasteClick } from '../../core/edit/clipboard.ts';
import { assertNever } from '../../core/edit/commands.ts';
import { tbRedoClick } from '../../core/edit/document.ts';
import {
  moveSelectedNotesHorizontal,
  moveSelectedNotesVertical,
  moveToBGM,
  moveToColumn,
  pobLongClick,
  pobNormalClick,
  pobNormalLongClick,
  type ColumnMap,
} from '../../core/edit/move.ts';
import type { EditContext } from '../../core/edit/ops.ts';
import {
  selectAll,
  selectAllTimeSelection,
  selectAllWithHoveredNoteLabel,
  tabBetweenNotes,
  type NoteSelectionBounds,
  type ScrollTarget,
} from '../../core/edit/selection.ts';
import { decreaseCurrentWAV, increaseCurrentWAV } from '../../core/edit/session.ts';
import { moveToTemplatePosition, pastePattern } from '../../core/edit/template.ts';
import { addOrRemoveMeasureLine, insertOrRemoveSpace } from '../../core/edit/time-selection.ts';
import { autoLongNotes } from '../../core/edit/transforms.ts';
import { checkTechnicalError } from '../../core/edit/analysis.ts';
import { isColumnSound } from '../../core/model/column.ts';
import type { Note } from '../../core/model/note.ts';
import { intDiv } from '../../core/vb.ts';
import {
  columnArrayIndexToEnabledColumnIndex,
  determineXKeyMode,
  enabledColumnIndexToColumnArrayIndex,
  gridDivisionKey,
  nEnabled,
  panelScrollKeyValue,
  scrollPanelToNote,
  setCGDivideValue,
  setColumnOption,
  setGxHeight,
  stepZoom,
  type ColumnOption,
  type EditorView,
  type ScrollKey,
} from '../view.ts';
import {
  draftAddUndo,
  draftSetVScroll,
  draftTbUndoClick,
  isEnabled,
  performContext,
  runInput,
  type InputContext,
  type InputDraft,
  type InputResult,
} from './events.ts';
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
} from '../../core/model/constants.ts';
import { comboString, type KeyCombo } from './keyboard.ts';
import type { KeyModifiers } from './modifiers.ts';
import { tbNTInputClick, tbPostEffectsClick, tbSelectClick, tbWriteClick } from './toolbar.ts';


export const kbCategorySP = 1;
export const kbCategoryPMS = 2;
export const kbCategoryDP = 3;
export const kbCategoryBGM = 4;
export const kbCategoryAllMod = 10;
export const kbCategoryHidden = 0;
export const kbCategoryMisc = -1;

export const kbCategory: readonly number[] = [
  kbCategoryPMS,
  kbCategoryDP,
  kbCategorySP,
  kbCategoryBGM,
  kbCategoryAllMod,
  kbCategoryHidden,
  kbCategoryMisc,
];

export type KeybindingOp =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 100
  | 101
  | 102
  | 103
  | 104
  | 105
  | 106
  | 107
  | 108
  | 109
  | 110
  | 111
  | 112
  | 113
  | 114
  | 115
  | 116
  | 117
  | 118
  | 200
  | 201
  | 202
  | 203
  | 204
  | 205
  | 206
  | 207
  | 208
  | 209
  | 210
  | 211
  | 212
  | 213
  | 214
  | 215
  | 216
  | 217
  | 218
  | 219
  | 220;

export interface Keybinding {
  readonly opVar: KeybindingOp;
  readonly opName: string;
  readonly description: string;
  readonly combo: readonly string[];
  readonly category: number;
}

function keybinding(
  opVar: KeybindingOp,
  opName: string,
  description: string,
  combo: readonly string[],
  category: number = kbCategoryMisc,
): Keybinding {
  return Object.freeze({ opVar, opName, description, combo: Object.freeze([...combo]), category });
}

const hidden = '*HIDDEN*';

export const keybindingsInit: readonly Keybinding[] = Object.freeze([
  keybinding(0, 'Move to A2', 'Move note to 1P Lane 1', ['D1', 'NumPad1'], kbCategorySP),
  keybinding(1, 'Move to A3', 'Move note to 1P Lane 2', ['D2', 'NumPad2'], kbCategorySP),
  keybinding(2, 'Move to A4', 'Move note to 1P Lane 3', ['D3', 'NumPad3'], kbCategorySP),
  keybinding(3, 'Move to A5', 'Move note to 1P Lane 4', ['D4', 'NumPad4'], kbCategorySP),
  keybinding(4, 'Move to A6', 'Move note to 1P Lane 5', ['D5', 'NumPad5'], kbCategorySP),
  keybinding(5, 'Move to A7', 'Move note to 1P Lane 6', ['D6', 'NumPad6'], kbCategorySP),
  keybinding(6, 'Move to A8', 'Move note to 1P Lane 7', ['D7', 'NumPad7'], kbCategorySP),
  keybinding(7, 'Move to A1', 'Move note to 1P Scratch Lane', ['D8', 'NumPad8'], kbCategorySP),
  keybinding(10, 'Move to D1', 'Move note to 2P Lane 1', ['Q', 'Ctrl+D1', 'NumPad1'], kbCategoryDP),
  keybinding(11, 'Move to D2', 'Move note to 2P Lane 2', ['W', 'Ctrl+D2', 'NumPad2'], kbCategoryDP),
  keybinding(12, 'Move to D3', 'Move note to 2P Lane 3', ['E', 'Ctrl+D3', 'NumPad3'], kbCategoryDP),
  keybinding(13, 'Move to D4', 'Move note to 2P Lane 4', ['R', 'Ctrl+D4', 'NumPad4'], kbCategoryDP),
  keybinding(14, 'Move to D5', 'Move note to 2P Lane 5', ['T', 'Ctrl+D5', 'NumPad5'], kbCategoryDP),
  keybinding(15, 'Move to D6', 'Move note to 2P Lane 6', ['Y', 'Ctrl+D6', 'NumPad6'], kbCategoryDP),
  keybinding(16, 'Move to D7', 'Move note to 2P Lane 7', ['U', 'Ctrl+D7', 'NumPad7'], kbCategoryDP),
  keybinding(
    17,
    'Move to D8',
    'Move note to 2P Scratch Lane',
    ['I', 'Ctrl+D8', 'NumPad8'],
    kbCategoryDP,
  ),
  keybinding(20, 'Move to P1', 'Move note to PMS Lane 1', ['D1', 'NumPad1'], kbCategoryPMS),
  keybinding(21, 'Move to P2', 'Move note to PMS Lane 2', ['D2', 'NumPad2'], kbCategoryPMS),
  keybinding(22, 'Move to P3', 'Move note to PMS Lane 3', ['D3', 'NumPad3'], kbCategoryPMS),
  keybinding(23, 'Move to P4', 'Move note to PMS Lane 4', ['D4', 'NumPad4'], kbCategoryPMS),
  keybinding(24, 'Move to P5', 'Move note to PMS Lane 5', ['D5', 'NumPad5'], kbCategoryPMS),
  keybinding(25, 'Move to P6', 'Move note to PMS Lane 6', ['D6', 'NumPad6'], kbCategoryPMS),
  keybinding(26, 'Move to P7', 'Move note to PMS Lane 7', ['D7', 'NumPad7'], kbCategoryPMS),
  keybinding(27, 'Move to P8', 'Move note to PMS Lane 8', ['D8', 'NumPad8'], kbCategoryPMS),
  keybinding(28, 'Move to P9', 'Move note to PMS Lane 9', ['D9', 'NumPad9'], kbCategoryPMS),
  keybinding(100, 'Move to BGM', 'Move note to BGM Lane', ['D0', 'NumPad0'], kbCategoryBGM),
  keybinding(101, 'Move to Template Position', 'Move note to Template Position if available', [
    'P',
  ]),
  keybinding(102, 'Disable Vertical Moves', 'Disable vertical moves', ['D']),
  keybinding(103, 'Snap to Grid', 'Snap to grid', ['G']),
  keybinding(104, 'Convert to Long Note', '\u{2192} Long Note', ['L']),
  keybinding(105, 'Convert to Short Note', '\u{2192} Short Note', ['S']),
  keybinding(106, 'Convert between Long and Short Note', 'Long Note \u{2194} Short Note', ['']),
  keybinding(107, 'Auto Long Note (By VPosition)', 'Auto Long Note (By VPosition)', ['']),
  keybinding(108, 'Auto Long Note (By Column)', 'Auto Long Note (By Column)', ['']),
  keybinding(
    109,
    'Check Technical Error',
    'Check for technical errors such as impossible scratches in DP or impossible chords in PMS',
    ['Ctrl+Alt+E'],
  ),
  keybinding(110, 'Select Expansion Section', 'Select #IF sections in the Expansion field', [
    'Ctrl+Alt+R',
  ]),
  keybinding(111, 'Undo', '', ['Ctrl+Z']),
  keybinding(112, 'Redo', '', ['Ctrl+Y', 'Ctrl+Alt+Z']),
  keybinding(113, 'Cut', '', ['Ctrl+X']),
  keybinding(114, 'Copy', '', ['Ctrl+C']),
  keybinding(115, 'Paste', '', ['Ctrl+V']),
  keybinding(
    116,
    'Paste Pattern',
    'Apply pattern of the notes on the clipboard to the highlighted notes.',
    ['Ctrl+Shift+V'],
  ),
  keybinding(117, 'Select All', '', ['Ctrl+A']),
  keybinding(118, 'Select All with Hovered Note Label', '', ['Ctrl+Shift+A']),
  keybinding(200, 'Move Note Up', hidden, ['Up'], kbCategoryAllMod),
  keybinding(201, 'Move Note Down', hidden, ['Down'], kbCategoryAllMod),
  keybinding(202, 'Move Note Left', hidden, ['Left'], kbCategoryAllMod),
  keybinding(203, 'Move Note Right', hidden, ['Right'], kbCategoryAllMod),
  keybinding(204, 'Insert Space/Define Measure', hidden, ['Insert'], kbCategoryAllMod),
  keybinding(205, 'Delete', hidden, ['Delete'], kbCategoryAllMod),
  keybinding(206, 'Home', hidden, ['Home'], kbCategoryAllMod),
  keybinding(207, 'End', hidden, ['End'], kbCategoryAllMod),
  keybinding(208, 'PageUp', hidden, ['PageUp'], kbCategoryAllMod),
  keybinding(209, 'PageDown', hidden, ['PageDown'], kbCategoryAllMod),
  keybinding(210, 'Next', hidden, ['Next'], kbCategoryAllMod),
  keybinding(211, 'TabBetweenFiles', hidden, ['Tab'], kbCategoryAllMod),
  keybinding(212, 'TabBetweenNotes', hidden, ['Capital'], kbCategoryAllMod),
  keybinding(213, 'Decrease Division', hidden, ['Oemcomma'], kbCategoryAllMod),
  keybinding(214, 'Increase Division', hidden, ['OemPeriod'], kbCategoryAllMod),
  keybinding(215, 'Set CGDivision', hidden, ['OemQuestion'], kbCategoryHidden),
  keybinding(216, 'Decrease CGHeight', hidden, ['OemMinus'], kbCategoryHidden),
  keybinding(217, 'Increase CGHeight', hidden, ['Oemplus'], kbCategoryHidden),
  keybinding(218, 'DecreaseCurrentWav', hidden, ['Subtract'], kbCategoryHidden),
  keybinding(219, 'IncreaseCurrentWav', hidden, ['Add'], kbCategoryHidden),
  keybinding(220, 'TBPreviewHighlighted_Click', '*EXPERIMENTAL*', ['Shift+F4'], kbCategoryHidden),
]);

export function laneOfOp(op: KeybindingOp): number | undefined {
  return laneColumns[op];
}

const laneColumns: Partial<Record<KeybindingOp, number>> = {
  0: niA2,
  1: niA3,
  2: niA4,
  3: niA5,
  4: niA6,
  5: niA7,
  6: niA8,
  7: niA1,
  10: niD1,
  11: niD2,
  12: niD3,
  13: niD4,
  14: niD5,
  15: niD6,
  16: niD7,
  17: niD8,
  20: niA2,
  21: niA3,
  22: niA4,
  23: niA5,
  24: niA6,
  25: niD2,
  26: niD3,
  27: niD4,
  28: niD5,
};


export type SelectionBounds = NoteSelectionBounds;

export function selectionBounds(notes: readonly Readonly<Note>[]): SelectionBounds {
  for (let xI = 1; xI <= notes.length - 1; xI++) {
    if (notes[xI]!.selected) {
      let lastSelectedNote = 0;
      for (let xI2 = notes.length - 1; xI2 >= xI; xI2--) {
        if (notes[xI2]!.selected) {
          lastSelectedNote = xI2;
          break;
        }
      }
      return { hasSelectedNotes: true, firstSelectedNote: xI, lastSelectedNote };
    }
  }
  return { hasSelectedNotes: false, firstSelectedNote: 0, lastSelectedNote: 0 };
}

export function resolveKeybinding(
  table: readonly Keybinding[],
  combo: KeyCombo,
  gXKeyMode: 'SP' | 'DP' | 'PMS',
  hasSelectedNotes: boolean,
): Keybinding | undefined {
  for (const p of kbCategory) {
    if (p === kbCategorySP && !hasSelectedNotes) continue;
    if (p === kbCategoryPMS && (!hasSelectedNotes || gXKeyMode !== 'PMS')) continue;
    if (p === kbCategoryDP && (!hasSelectedNotes || gXKeyMode !== 'DP')) continue;

    for (const keybind of table) {
      if (keybind.category !== p) continue;
      let keyComboString = comboString(combo);
      if (p === kbCategorySP || p === kbCategoryPMS || p === kbCategoryDP || p === kbCategoryBGM) {
        keyComboString = keyComboString.replaceAll('Shift+', '');
      }
      if (p === kbCategoryAllMod) keyComboString = combo.name;
      if (keybind.combo.includes(keyComboString)) return keybind;
    }
  }
  return undefined;
}


export type ClipboardOp = 'cut' | 'copy' | 'paste';

export interface KeyClipboard {
  readonly write: (text: string) => void;
  readonly read: () => string;
}

export interface KeyContext extends InputContext {
  readonly clipboard?: KeyClipboard;
  readonly confirmPattern?: (clipboardCount: number, selectionCount: number) => boolean;
}

export interface KeyResult extends InputResult {
  readonly hover: boolean;
  readonly preventDefault: boolean;
}

export function dispatchKeybinding(
  ctx: KeyContext,
  kb: Keybinding | undefined,
  combo: KeyCombo,
): KeyResult {
  let postSteps = false;
  const result = runInput(ctx, (d) => {
    postSteps = pMainInPreviewKeyDown(d, ctx, kb, combo);
  });
  return { ...result, hover: postSteps, preventDefault: keyPreventsDefault(kb, combo) };
}

const unboundDefaultKeys: readonly string[] = ['Space', 'Back', 'OemQuestion', 'Oem7'];

function keyPreventsDefault(kb: Keybinding | undefined, combo: KeyCombo): boolean {
  if (kb === undefined) return unboundDefaultKeys.includes(combo.name);
  switch (kb.opVar) {
    case 113:
    case 114:
    case 115:
    case 211:
      return false;
    default:
      return true;
  }
}

function pMainInPreviewKeyDown(
  d: InputDraft,
  ctx: KeyContext,
  kb: Keybinding | undefined,
  combo: KeyCombo,
): boolean {
  const chart = d.chart;
  d.edit.modifiers = { ctrl: combo.ctrl, shift: combo.shift, alt: combo.alt };
  d.drag.selectedNotes = [];
  const bounds = selectionBounds(chart.notes);
  if (kb === undefined) return true;

  const op = kb.opVar;
  switch (op) {
    case 0:
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
    case 10:
    case 11:
    case 12:
    case 13:
    case 14:
    case 15:
    case 16:
    case 17:
    case 20:
    case 21:
    case 22:
    case 23:
    case 24:
    case 25:
    case 26:
    case 27:
    case 28: {
      d.chartChanged = true;
      const r = moveToColumn(chart, laneOfOp(op)!, combo.shift, newChain(), editContext(d));
      if (r.previewIndex !== undefined) panelPreviewNoteIndex(d, r.previewIndex);
      d.redraw = true;
      break;
    }
    case 100: {
      d.chartChanged = true;
      const r = moveToBGM(chart, combo.shift, newChain(), editContext(d));
      if (r.previewIndex !== undefined) panelPreviewNoteIndex(d, r.previewIndex);
      d.redraw = true;
      break;
    }
    case 101:
      moveToTemplatePosition(chart, ctx.options.templateSnapToVPosition ?? false, editContext(d));
      d.chartChanged = true;
      d.redraw = true;
      break;
    case 102:
      d.view = { ...d.view, disableVerticalMove: !d.view.disableVerticalMove };
      break;
    case 103:
      d.view = { ...d.view, gSnap: !d.view.gSnap };
      d.redraw = true;
      break;
    case 104:
      if (chart.ntInput) break;
      d.chartChanged = true;
      pobLongClick(chart, newChain(), editContext(d));
      d.redraw = true;
      break;
    case 105:
      d.chartChanged = true;
      pobNormalClick(chart, newChain(), editContext(d));
      d.redraw = true;
      break;
    case 106:
      if (chart.ntInput) break;
      d.chartChanged = true;
      pobNormalLongClick(chart, newChain(), editContext(d));
      d.redraw = true;
      break;
    case 107:
    case 108:
      autoLongNotes(
        chart,
        determineXKeyMode(d.view, chart.header.player).gXKeyMode,
        op === 108,
        ctx.options.lnGap ?? 16,
        editContext(d),
      );
      d.chartChanged = true;
      d.redraw = true;
      break;
    case 109:
      checkTechnicalError(
        chart,
        determineXKeyMode(d.view, chart.header.player).gXKeyMode,
        240 / (ctx.options.jackBPM ?? 255) / (ctx.options.jackTH ?? 16),
      );
      d.chartChanged = true;
      d.redraw = true;
      break;
    case 110:
      break;
    case 111:
      draftTbUndoClick(d);
      break;
    case 112:
      draftTbRedoClick(d);
      break;
    case 113:
      if (ctx.clipboard !== undefined) clipboardOp(d, 'cut', ctx.clipboard);
      break;
    case 114:
      if (ctx.clipboard !== undefined) clipboardOp(d, 'copy', ctx.clipboard);
      break;
    case 115:
      if (ctx.clipboard !== undefined) clipboardOp(d, 'paste', ctx.clipboard);
      break;
    case 116:
      if (ctx.clipboard !== undefined) {
        pastePattern(
          chart,
          ctx.clipboard.read(),
          d.view.panels[d.view.focus].vScroll,
          ctx.options.pastePatternToVPosition ?? false,
          editContext(d),
          (a, b) => ctx.confirmPattern?.(a, b) ?? false,
        );
        d.chartChanged = true;
        d.redraw = true;
      }
      break;
    case 117:
      mnSelectAll(d);
      break;
    case 118:
      if (d.edit.kMouseOver !== -1) {
        d.chartChanged = true;
        selectAllWithHoveredNoteLabel(chart, d.edit.kMouseOver, d.view.showFileName);
        d.redraw = true;
      }
      break;
    case 200:
    case 201: {
      d.chartChanged = true;
      const direction = op === 200 ? 1 : -1;
      const targets = moveSelectedNotesVertical(
        chart,
        direction,
        d.view.gDivide,
        combo.ctrl,
        newChain(),
        editContext(d),
      );
      for (const t of targets) scrollToNote(d, t);
      d.redraw = true;
      break;
    }
    case 202:
    case 203: {
      d.chartChanged = true;
      const view = d.view;
      const columns: ColumnMap = {
        toEnabled: (column) => columnArrayIndexToEnabledColumnIndex(view, column),
        toColumn: (enabledIndex) => enabledColumnIndexToColumnArrayIndex(view, enabledIndex),
      };
      const direction = op === 202 ? -1 : 1;
      const targets = moveSelectedNotesHorizontal(
        chart,
        direction,
        columns,
        newChain(),
        editContext(d),
      );
      for (const t of targets) scrollToNote(d, t);
      d.redraw = true;
      break;
    }
    case 204:
      if (d.edit.tool === 'timeSelect') {
        if (!combo.ctrl && !combo.shift) addOrRemoveMeasureLine(chart, editContext(d));
        else
          insertOrRemoveSpace(
            chart,
            combo.ctrl && combo.shift ? 'both' : combo.ctrl ? 'measure' : 'notes',
            editContext(d),
          );
        d.chartChanged = true;
        d.redraw = true;
        d.status = true;
      }
      break;
    case 205:
      mnDelete(d);
      break;
    case 206:
      scrollKey(d, 'Home', combo);
      break;
    case 207:
      scrollKey(d, 'End', combo);
      break;
    case 208:
      scrollKey(d, 'PageUp', combo);
      break;
    case 209:
    case 210:
      scrollKey(d, 'PageDown', combo);
      break;
    case 211:
      return false;
    case 212: {
      d.chartChanged = true;
      d.redraw = true;
      const vScroll = d.view.panels[d.view.focus].vScroll;
      scrollToNote(d, tabBetweenNotes(chart, bounds, combo.shift, vScroll).scrollTo);
      break;
    }
    case 213:
    case 214:
      setGridView(d, gridDivisionKey(d.view, op === 214, combo));
      break;
    case 215:
      setGridView(d, setCGDivideValue(d.view, d.view.gSlash));
      break;
    case 216:
    case 217:
      setGridView(d, setGxHeight(d.view, stepZoom(d.view.gxHeight, op === 216 ? -1 : 1)));
      break;
    case 218:
      decreaseCurrentWAV(d.session);
      break;
    case 219:
      increaseCurrentWAV(d.session, chart.base62);
      break;
    case 220:
      break;
    default:
      return assertNever(op);
  }
  return true;
}

function newChain(): UndoChainBuilder {
  return new UndoChainBuilder();
}

function editContext(d: InputDraft): EditContext {
  return {
    ...performContext(d),
    addUndo: (undo, redo, overWrite) => draftAddUndo(d, undo, redo, overWrite),
  };
}

function setGridView(d: InputDraft, view: EditorView): void {
  if (view === d.view) return;
  d.view = view;
  d.redraw = true;
}

function scrollToNote(d: InputDraft, target: ScrollTarget): void {
  const height = d.panelSizes[d.view.focus].height;
  d.view = scrollPanelToNote(d.view, height, target.vPosition, target.length);
}

function scrollKey(d: InputDraft, key: ScrollKey, modifiers: KeyModifiers): void {
  draftSetVScroll(d, d.view.focus, panelScrollKeyValue(d.chart, d.view, key), modifiers);
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

function draftTbRedoClick(d: InputDraft): void {
  d.edit.kMouseOver = -1;
  d.drag.selectedNotes = [];
  if (tbRedoClick(d.doc, performContext(d))) {
    d.chartChanged = true;
    d.redraw = true;
    d.status = true;
  }
}

function mnSelectAll(d: InputDraft): void {
  if (d.focusedPanel === null) return;
  d.chartChanged = true;
  selectAll(d.chart, isEnabled(d));
  if (d.edit.tool === 'timeSelect') {
    const s = d.session;
    const sel = selectAllTimeSelection(d.chart, {
      start: s.vSelStart,
      length: s.vSelLength,
      half: s.vSelHalf,
    });
    s.vSelStart = sel.start;
    s.vSelLength = sel.length;
  }
  d.redraw = true;
  d.status = true;
}

function mnDelete(d: InputDraft): void {
  if (d.focusedPanel === null) return;
  d.chartChanged = true;
  if (mnDeleteClick(d.chart, editContext(d))) d.edit.kMouseOver = -1;
  d.redraw = true;
  d.status = true;
}

function clipboardOp(d: InputDraft, op: ClipboardOp, clipboard: KeyClipboard): void {
  const chart = d.chart;
  d.chartChanged = true;
  switch (op) {
    case 'cut': {
      const { text, kMouseOverReset } = tbCutClick(chart, editContext(d));
      if (kMouseOverReset) d.edit.kMouseOver = -1;
      clipboard.write(text);
      break;
    }
    case 'copy':
      clipboard.write(tbCopyClick(chart));
      break;
    case 'paste':
      tbPasteClick(chart, clipboard.read(), d.view.panels[d.view.focus].vScroll, editContext(d));
      break;
    default:
      assertNever(op);
  }
  d.redraw = true;
  d.status = true;
}

export function runClipboardOp(
  ctx: InputContext,
  op: ClipboardOp,
  clipboard: KeyClipboard,
): InputResult {
  return runInput(ctx, (d) => clipboardOp(d, op, clipboard));
}

export function runMnSelectAll(ctx: InputContext): InputResult {
  return runInput(ctx, mnSelectAll);
}

export function runMnDelete(ctx: InputContext): InputResult {
  return runInput(ctx, mnDelete);
}


export type MenuShortcutItem =
  | 'mnNew'
  | 'mnOpen'
  | 'mnOpenTemplate'
  | 'mnSave'
  | 'mnSaveAs'
  | 'mnExport'
  | 'mnClose'
  | 'mnOpenR0'
  | 'mnOpenR1'
  | 'mnOpenR2'
  | 'mnOpenR3'
  | 'mnOpenR4'
  | 'mnGotoMeasure'
  | 'mnFind'
  | 'mnStatistics'
  | 'mnStatisticsAdvanced'
  | 'mnTimeSelect'
  | 'mnSelect'
  | 'mnWrite'
  | 'mnSLSplitter'
  | 'mnSRSplitter'
  | 'CGBPM'
  | 'CGSTOP'
  | 'CGSCROLL'
  | 'CGBLP'
  | 'mnNTInput'
  | 'mnPOptions'
  | 'mnGOptions'
  | 'mnKOptions'
  | 'mnVOptions'
  | 'mnVCOptions'
  | 'POBModify'
  | 'mnPlayB'
  | 'mnPlay'
  | 'mnStop';

export interface MenuShortcut {
  readonly item: MenuShortcutItem;
  readonly combo: string;
}

export const menuShortcuts: readonly MenuShortcut[] = Object.freeze(
  (
    [
      ['mnNew', 'Ctrl+N'],
      ['mnOpen', 'Ctrl+O'],
      ['mnOpenTemplate', 'Ctrl+Alt+O'],
      ['mnSave', 'Ctrl+S'],
      ['mnSaveAs', 'Ctrl+Alt+S'],
      ['mnExport', 'Ctrl+Shift+E'],
      ['mnClose', 'Ctrl+W'],
      ['mnOpenR0', 'Alt+D1'],
      ['mnOpenR1', 'Alt+D2'],
      ['mnOpenR2', 'Alt+D3'],
      ['mnOpenR3', 'Alt+D4'],
      ['mnOpenR4', 'Alt+D5'],
      ['mnGotoMeasure', 'Ctrl+G'],
      ['mnFind', 'Ctrl+F'],
      ['mnStatistics', 'Ctrl+T'],
      ['mnStatisticsAdvanced', 'Ctrl+Shift+T'],
      ['mnTimeSelect', 'F1'],
      ['mnSelect', 'F2'],
      ['mnWrite', 'F3'],
      ['mnSLSplitter', 'Alt+Left'],
      ['mnSRSplitter', 'Alt+Right'],
      ['CGBPM', 'Alt+B'],
      ['CGSTOP', 'Alt+S'],
      ['CGSCROLL', 'Alt+R'],
      ['CGBLP', 'Alt+G'],
      ['mnNTInput', 'F8'],
      ['mnPOptions', 'F9'],
      ['mnGOptions', 'F10'],
      ['mnKOptions', 'Shift+F10'],
      ['mnVOptions', 'F12'],
      ['mnVCOptions', 'Shift+F12'],
      ['POBModify', 'Shift+F2'],
      ['mnPlayB', 'F5'],
      ['mnPlay', 'F6'],
      ['mnStop', 'F7'],
    ] as const
  ).map(([item, combo]) => Object.freeze({ item, combo })),
);

export function resolveMenuShortcut(combo: KeyCombo): MenuShortcutItem | undefined {
  const keyComboString = comboString(combo);
  return menuShortcuts.find((m) => m.combo === keyComboString)?.item;
}

export function dispatchMenuShortcut(ctx: InputContext, item: MenuShortcutItem): InputResult {
  switch (item) {
    case 'mnTimeSelect':
      return tbPostEffectsClick(ctx);
    case 'mnSelect':
      return tbSelectClick(ctx);
    case 'mnWrite':
      return tbWriteClick(ctx);
    case 'mnNTInput':
      return tbNTInputClick(ctx, !ctx.doc.chart.ntInput);
    case 'mnSLSplitter':
      return runInput(ctx, (d) => {
        d.view = { ...d.view, showLSplit: !d.view.showLSplit };
        d.redraw = true;
      });
    case 'mnSRSplitter':
      return runInput(ctx, (d) => {
        d.view = { ...d.view, showRSplit: !d.view.showRSplit };
        d.redraw = true;
      });
    case 'CGBPM':
      return runInput(ctx, (d) => columnOptionChanged(d, 'gBPM'));
    case 'CGSTOP':
      return runInput(ctx, (d) => columnOptionChanged(d, 'gSTOP'));
    case 'CGSCROLL':
      return runInput(ctx, (d) => columnOptionChanged(d, 'gSCROLL'));
    case 'CGBLP':
      return runInput(ctx, (d) => columnOptionChanged(d, 'gDisplayBGAColumn'));
    case 'mnOpen':
    case 'mnSave':
    case 'mnSaveAs':
      return runInput(ctx, () => undefined);
    case 'mnNew':
    case 'mnClose':
    case 'mnGotoMeasure':
    case 'POBModify':
      return runInput(ctx, () => undefined);
    case 'mnPlayB':
    case 'mnPlay':
    case 'mnStop':
      return runInput(ctx, () => undefined);
    case 'mnOpenTemplate':
    case 'mnExport':
    case 'mnOpenR0':
    case 'mnOpenR1':
    case 'mnOpenR2':
    case 'mnOpenR3':
    case 'mnOpenR4':
      return runInput(ctx, () => undefined);
    case 'mnFind':
    case 'mnStatistics':
    case 'mnStatisticsAdvanced':
      return runInput(ctx, () => undefined);
    case 'mnPOptions':
    case 'mnGOptions':
    case 'mnKOptions':
    case 'mnVOptions':
    case 'mnVCOptions':
      return runInput(ctx, () => undefined);
    default:
      return assertNever(item);
  }
}

function columnOptionChanged(d: InputDraft, option: ColumnOption): void {
  d.view = setColumnOption(d.view, option, !d.view[option]);
  d.chartChanged = true;
  const notes: readonly Note[] = d.chart.notes;
  for (let xI1 = 1; xI1 <= notes.length - 1; xI1++) {
    const enabled = nEnabled(d.view, notes[xI1]!.columnIndex);
    notes[xI1]!.selected = notes[xI1]!.selected && enabled;
  }
  d.redraw = true;
}
