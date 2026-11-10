import type { PerformContext, UndoChain } from '../../core/edit/commands.ts';
import { applyConversionState } from '../../core/edit/conversion.ts';
import { documentAddUndo, tbUndoClick, type ChartDocument } from '../../core/edit/document.ts';
import { addNote, removeNote } from '../../core/edit/ops.ts';
import type { EditSession } from '../../core/edit/session.ts';
import type { Chart } from '../../core/model/chart.ts';
import type { Note } from '../../core/model/note.ts';
import { VbError } from '../../core/vb.ts';
import type { VisualSettings } from '../../settings/theme-loader.ts';
import { isNoPoint, mouseMoveStatusPoint, type EditState, type PanelPoint } from '../edit-state.ts';
import {
  getMouseVPosition,
  hScrollRange,
  nEnabled,
  setPanelHScroll,
  setPanelVScroll,
  type EditorView,
  type PanelIndex,
} from '../view.ts';
import type { DragState } from './drag-state.ts';
import { panelGeometry, type HitOptions, type PanelGeometry } from './hit.ts';
import type { KeyModifiers } from './modifiers.ts';
import type { PromptRequest } from './prompts.ts';

const single = Math.fround;


export const mouseButtons = {
  none: 0,
  left: 0x100000,
  right: 0x200000,
  middle: 0x400000,
  xButton1: 0x800000,
  xButton2: 0x1000000,
} as const;

export type MouseButtonsFlags = number;

export interface PanelMouseEvent {
  readonly panel: PanelIndex;
  readonly x: number;
  readonly y: number;
  readonly button: MouseButtonsFlags;
  readonly clicks: 0 | 1 | 2;
  readonly client: PanelPoint;
  readonly modifiers: KeyModifiers;
}

export function buttonsFromDom(buttons: number): MouseButtonsFlags {
  let flags = 0;
  if ((buttons & 1) !== 0) flags += mouseButtons.left;
  if ((buttons & 2) !== 0) flags += mouseButtons.right;
  if ((buttons & 4) !== 0) flags += mouseButtons.middle;
  if ((buttons & 8) !== 0) flags += mouseButtons.xButton1;
  if ((buttons & 16) !== 0) flags += mouseButtons.xButton2;
  return flags;
}

export function buttonFromDom(button: number): MouseButtonsFlags {
  switch (button) {
    case 0:
      return mouseButtons.left;
    case 1:
      return mouseButtons.middle;
    case 2:
      return mouseButtons.right;
    case 3:
      return mouseButtons.xButton1;
    case 4:
      return mouseButtons.xButton2;
    default:
      return mouseButtons.none;
  }
}

export function clicksFromDetail(detail: number): 1 | 2 {
  return detail > 0 && detail % 2 === 0 ? 2 : 1;
}


export interface ToolOptions {
  readonly middleButtonMoveMethod: 0 | 1;
  readonly autoFocusMouseEnter: boolean;
  readonly firstClickDisabled: boolean;
  readonly previewOnClick: boolean;
  readonly clickStopPreview: boolean;
  readonly templateSnapToVPosition?: boolean;
  readonly pastePatternToVPosition?: boolean;
  readonly lnGap?: number;
  readonly jackBPM?: number;
  readonly jackTH?: number;
}

export const defaultToolOptions: ToolOptions = {
  middleButtonMoveMethod: 0,
  autoFocusMouseEnter: false,
  firstClickDisabled: true,
  previewOnClick: true,
  clickStopPreview: true,
  templateSnapToVPosition: false,
  pastePatternToVPosition: false,
};

export type ToolVisual = Pick<
  VisualSettings,
  'kHeight' | 'peDeltaMouseOver' | 'middleDeltaRelease'
> & { readonly touchTolerance?: number };

export interface PanelSize {
  readonly width: number;
  readonly height: number;
}

export interface InputContext {
  readonly doc: ChartDocument;
  readonly session: EditSession;
  readonly view: EditorView;
  readonly edit: EditState;
  readonly drag: DragState;
  readonly options: ToolOptions;
  readonly visual: ToolVisual;
  readonly panelSizes: readonly [PanelSize, PanelSize, PanelSize];
  readonly focusedPanel: PanelIndex | null;
  readonly bmpSelection?: readonly number[];
  readonly calculateTotalPlayableNotes?: (chart: Chart) => void;
}

export type InputMessage =
  | { readonly kind: 'invalidLabel' }
  | { readonly kind: 'text'; readonly text: string };

export interface PreviewRequest {
  readonly stop: boolean;
  readonly noteIndex?: number;
  readonly wavId?: number;
}

export interface InputResult {
  readonly view: EditorView;
  readonly edit: EditState;
  readonly drag: DragState;
  readonly chartChanged: boolean;
  readonly redraw: boolean;
  readonly status: boolean;
  readonly focusArea?: PanelIndex;
  readonly prompt?: PromptRequest;
  readonly message?: InputMessage;
  readonly preview?: PreviewRequest;
  readonly error?: unknown;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export interface InputDraft {
  readonly doc: ChartDocument;
  readonly chart: Chart;
  readonly session: EditSession;
  view: EditorView;
  readonly edit: Mutable<EditState>;
  readonly drag: Mutable<DragState>;
  readonly options: ToolOptions;
  readonly visual: ToolVisual;
  readonly panelSizes: readonly [PanelSize, PanelSize, PanelSize];
  readonly focusedPanel: PanelIndex | null;
  readonly bmpSelection: readonly number[];
  readonly calculateTotalPlayableNotesHook: ((chart: Chart) => void) | undefined;
  chartChanged: boolean;
  redraw: boolean;
  status: boolean;
  focusArea: PanelIndex | undefined;
  prompt: PromptRequest | undefined;
  message: InputMessage | undefined;
  preview: PreviewRequest | undefined;
}

export function beginInput(ctx: InputContext): InputDraft {
  const currentBmp = ctx.session.currentBmp;
  return {
    doc: ctx.doc,
    chart: ctx.doc.chart,
    session: ctx.session,
    view: ctx.view,
    edit: { ...ctx.edit },
    drag: { ...ctx.drag },
    options: ctx.options,
    visual: ctx.visual,
    panelSizes: ctx.panelSizes,
    focusedPanel: ctx.focusedPanel,
    bmpSelection: ctx.bmpSelection ?? (currentBmp < 0 ? [] : [currentBmp]),
    calculateTotalPlayableNotesHook: ctx.calculateTotalPlayableNotes,
    chartChanged: false,
    redraw: false,
    status: false,
    focusArea: undefined,
    prompt: undefined,
    message: undefined,
    preview: undefined,
  };
}

export function endInput(d: InputDraft, error?: unknown): InputResult {
  return {
    view: d.view,
    edit: { ...d.edit },
    drag: { ...d.drag },
    chartChanged: d.chartChanged,
    redraw: d.redraw,
    status: d.status,
    ...(d.focusArea !== undefined ? { focusArea: d.focusArea } : {}),
    ...(d.prompt !== undefined ? { prompt: d.prompt } : {}),
    ...(d.message !== undefined ? { message: d.message } : {}),
    ...(d.preview !== undefined ? { preview: d.preview } : {}),
    ...(error !== undefined ? { error } : {}),
  };
}

export function runInput(ctx: InputContext, handler: (d: InputDraft) => void): InputResult {
  const d = beginInput(ctx);
  try {
    handler(d);
  } catch (error) {
    if (error instanceof VbError || error instanceof RangeError) return endInput(d, error);
    throw error;
  }
  return endInput(d);
}


export function hitOptions(d: InputDraft): HitOptions {
  return {
    kHeight: d.visual.kHeight,
    ntInput: d.chart.ntInput,
    touchTolerance: d.visual.touchTolerance ?? 0,
  };
}

export function draftGeometry(d: InputDraft, panel: PanelIndex): PanelGeometry {
  return panelGeometry(d.view, panel, d.panelSizes[panel].height);
}

export function mouseVPosition(d: InputDraft, snap: boolean): number {
  return getMouseVPosition(
    d.chart,
    d.view,
    d.panelSizes[d.view.focus].height,
    mouseMoveStatusPoint(d.edit).y,
    snap,
  );
}

export function isEnabled(d: InputDraft): (iCol: number) => boolean {
  const view = d.view;
  return (iCol) => nEnabled(view, iCol);
}

export function draftAddUndo(
  d: InputDraft,
  sCUndo: UndoChain | null,
  sCRedo: UndoChain | null,
  overWrite = false,
): void {
  const before = d.doc.undo;
  documentAddUndo(d.doc, sCUndo, sCRedo, overWrite);
  if (d.doc.undo !== before) d.chartChanged = true;
}

export function draftRemoveNote(d: InputDraft, i: number, sortAndUpdatePairing = true): void {
  d.edit.kMouseOver = -1;
  removeNote(d.chart, i, sortAndUpdatePairing, d.session);
  d.chartChanged = true;
}

export function draftAddNote(d: InputDraft, note: Readonly<Note>, overWrite = true): void {
  if (addNote(d.chart, note, performContext(d), overWrite)) d.edit.kMouseOver = -1;
  d.chartChanged = true;
}

export function draftTbUndoClick(d: InputDraft): void {
  d.edit.kMouseOver = -1;
  d.drag.selectedNotes = [];
  if (tbUndoClick(d.doc, performContext(d))) {
    d.chartChanged = true;
    d.redraw = true;
    d.status = true;
  }
}

export function calculateTotalPlayableNotes(d: InputDraft): void {
  d.calculateTotalPlayableNotesHook?.(d.chart);
}

export function performContext(d: InputDraft): PerformContext {
  const hook = d.calculateTotalPlayableNotesHook;
  return {
    session: d.session,
    applyConversionState,
    nEnabled: isEnabled(d),
    ...(hook !== undefined ? { calculateTotalPlayableNotes: hook } : {}),
  };
}

export function onVScrollValueChanged(
  edit: EditState,
  drag: DragState,
  view: EditorView,
  panel: PanelIndex,
  value: number,
): { edit: EditState; drag: DragState } {
  let { lastMouseDownLocation } = edit;
  if (panel === view.focus && !isNoPoint(lastMouseDownLocation) && drag.vsValue !== -1) {
    lastMouseDownLocation = {
      x: lastMouseDownLocation.x,
      y: single(lastMouseDownLocation.y + single((drag.vsValue - value) * view.gxHeight)),
    };
  }
  return { edit: { ...edit, lastMouseDownLocation }, drag: { ...drag, vsValue: value } };
}

export function onHScrollValueChanged(
  edit: EditState,
  drag: DragState,
  view: EditorView,
  _panel: PanelIndex,
  value: number,
): { edit: EditState; drag: DragState } {
  let { lastMouseDownLocation } = edit;
  if (!isNoPoint(lastMouseDownLocation) && drag.hsValue !== -1) {
    lastMouseDownLocation = {
      x: single(lastMouseDownLocation.x + single((drag.hsValue - value) * view.gxWidth)),
      y: lastMouseDownLocation.y,
    };
  }
  return { edit: { ...edit, lastMouseDownLocation }, drag: { ...drag, hsValue: value } };
}

export function draftSetVScroll(
  d: InputDraft,
  panel: PanelIndex,
  value: number,
  modifiers: KeyModifiers,
): void {
  if (d.view.panels[panel].vScroll === value || modifiers.ctrl || modifiers.shift) return;
  const next = onVScrollValueChanged(d.edit, d.drag, d.view, panel, value);
  d.view = setPanelVScroll(d.chart, d.view, panel, value, modifiers);
  Object.assign(d.edit, next.edit);
  Object.assign(d.drag, next.drag);
  d.redraw = true;
}

export function draftSetHScroll(d: InputDraft, panel: PanelIndex, value: number): void {
  if (d.view.panels[panel].hScroll === value) return;
  const next = onHScrollValueChanged(d.edit, d.drag, d.view, panel, value);
  d.view = setPanelHScroll(d.view, panel, value);
  Object.assign(d.edit, next.edit);
  Object.assign(d.drag, next.drag);
  d.redraw = true;
}

export function hScrollUserMaximum(d: InputDraft, panel: PanelIndex): number {
  return hScrollRange(d.view, d.panelSizes[panel].width).userMaximum;
}
