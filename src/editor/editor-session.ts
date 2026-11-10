import { c10toId } from '../core/bms/base.ts';
import { saveBMS, type SaveWarning } from '../core/bms/serialize.ts';
import { UndoChainBuilder } from '../core/edit/chain.ts';
import { createDocument, tbRedoClick, type ChartDocument } from '../core/edit/document.ts';
import {
  pobHiddenClick,
  pobHiddenVisibleClick,
  pobLongClick,
  pobNormalClick,
  pobNormalLongClick,
  pobVisibleClick,
  type MoveContext,
} from '../core/edit/move.ts';
import { createEditSession, type EditSession } from '../core/edit/session.ts';
import { pastePattern } from '../core/edit/template.ts';
import {
  calculateTotalPlayableNotes,
  defaultTotalOptions,
  selectionInfo,
  type PlayableNotesInfo,
  type TotalOptions,
} from '../core/edit/stats.ts';
import { defaultEditorOptions, type Chart, type EditorOptions } from '../core/model/chart.ts';
import { encodeText, type TextEncodingName } from '../core/text/encoding.ts';
import { buildTempoMap, type TempoMap } from '../core/time/timing.ts';
import { VbError } from '../core/vb.ts';
import { defaultVisualSettings } from '../settings/theme-loader.ts';
import { createEditState, type EditState, type EditTool, type PanelPoint } from './edit-state.ts';
import { createDragState, type DragState } from './input/drag-state.ts';
import {
  defaultToolOptions,
  draftAddUndo,
  draftSetHScroll,
  draftSetVScroll,
  draftTbUndoClick,
  performContext,
  runInput,
  type InputContext,
  type InputMessage,
  type InputResult,
  type PanelMouseEvent,
  type PanelSize,
  type ToolOptions,
  type ToolVisual,
} from './input/events.ts';
import { comboString, type KeyCombo } from './input/keyboard.ts';
import {
  dispatchKeybinding,
  dispatchMenuShortcut,
  keybindingsInit,
  resolveKeybinding,
  resolveMenuShortcut,
  runClipboardOp,
  runMnDelete,
  runMnSelectAll,
  selectionBounds,
  type ClipboardOp,
  type KeyClipboard,
  type MenuShortcutItem,
} from './input/keybindings.ts';
import type { KeyModifiers } from './input/modifiers.ts';
import {
  pMainInMouseDown,
  pMainInMouseEnter,
  pMainInMouseLeave,
  pMainInMouseMove,
  pMainInMouseUp,
  pMainInMouseWheel,
  refreshHover,
} from './input/mouse.ts';
import { applyPrompt, type PromptRequest } from './input/prompts.ts';
import { runPanelAction, type PanelAction } from './input/panels.ts';
import { runFeature, type FeatureAction } from './input/features.ts';
import { timer1Tick, timerMiddleTick } from './input/scroll.ts';
import { setTool, tbNTInputClick, tbWavIncreaseClick } from './input/toolbar.ts';
import type { Interaction } from './interaction.ts';
import {
  defaultStatusStrings,
  initialStatusBar,
  poStatusRefresh,
  type StatusBarModel,
  type StatusStrings,
} from './status.ts';
import {
  determineXKeyMode,
  hScrollRange,
  setPlayer,
  vScrollRange,
  withChartColumns,
  type EditorView,
  type PanelIndex,
} from './view.ts';

export interface PromptAnswer {
  readonly answer: string | null;
}

export interface EditorSessionHost {
  readonly log?: (line: string) => void;
  readonly focusArea?: (panel: PanelIndex) => void;
  readonly prompt?: (request: PromptRequest) => PromptAnswer | undefined;
  readonly confirmPattern?: (clipboardCount: number, selectionCount: number) => boolean;
  readonly message?: (message: InputMessage) => void;
  readonly error?: (error: unknown) => void;
  readonly kept?: (result: InputResult) => void;
}

export const convertMenuItems = [
  'POBHidden',
  'POBVisible',
  'POBHiddenVisible',
  'POBLong',
  'POBShort',
  'POBLongShort',
] as const;
export type ConvertMenuItem = (typeof convertMenuItems)[number];

export type SaveOutcome =
  | { readonly kind: 'saved'; readonly bytes: Uint8Array; readonly warnings: SaveWarning[] }
  | { readonly kind: 'disabled' }
  | { readonly kind: 'failed'; readonly warnings: SaveWarning[]; readonly error: unknown };

export interface EditorSessionInit {
  readonly chart: Chart;
  readonly view: EditorView;
  readonly panelSizes: readonly [PanelSize, PanelSize, PanelSize];
  readonly toolOptions?: ToolOptions;
  readonly visual?: ToolVisual;
  readonly editorOptions?: EditorOptions;
  readonly encoding?: TextEncodingName;
  readonly totalOptions?: TotalOptions;
  readonly statusStrings?: StatusStrings;
  readonly recommendedTotalLabel?: string;
  readonly host?: EditorSessionHost;
}

const modifierKeyNames: readonly string[] = ['ShiftKey', 'ControlKey', 'Menu'];

function isDesktopException(error: unknown): boolean {
  return error instanceof VbError || error instanceof RangeError;
}

export class EditorSession {
  doc: ChartDocument;
  readonly session: EditSession = createEditSession();
  view: EditorView;
  edit: EditState = createEditState();
  drag: DragState = createDragState();
  options: ToolOptions;
  keybindings = keybindingsInit;
  visual: ToolVisual;
  readonly panelSizes: [PanelSize, PanelSize, PanelSize];
  focus: PanelIndex | null = null;
  lwav: number[] = [0];
  lbmp: number[] = [0];
  status: StatusBarModel = initialStatusBar;
  statusStrings: StatusStrings;
  totalInfo: PlayableNotesInfo;
  gXKeyMode: 'SP' | 'DP' | 'PMS' = 'SP';
  editorOptions: EditorOptions;
  encoding: TextEncodingName;
  totalOptions: TotalOptions;
  readonly recommendedTotalLabel: string;
  pendingPrompt: { readonly request: PromptRequest; readonly rest: InputResult } | undefined;
  private readonly host: EditorSessionHost;
  private tempo: TempoMap | undefined;

  constructor(init: EditorSessionInit) {
    this.doc = createDocument(init.chart, true);
    this.view = withChartColumns(init.view, init.chart);
    this.panelSizes = [...init.panelSizes];
    this.options = init.toolOptions ?? defaultToolOptions;
    this.visual = init.visual ?? {
      kHeight: defaultVisualSettings.kHeight,
      peDeltaMouseOver: defaultVisualSettings.peDeltaMouseOver,
      middleDeltaRelease: defaultVisualSettings.middleDeltaRelease,
    };
    this.editorOptions = init.editorOptions ?? defaultEditorOptions;
    this.encoding = init.encoding ?? 'SJIS';
    this.totalOptions = init.totalOptions ?? defaultTotalOptions;
    this.statusStrings = init.statusStrings ?? defaultStatusStrings;
    this.recommendedTotalLabel = init.recommendedTotalLabel ?? 'Recommended #TOTAL';
    this.host = init.host ?? {};
    this.totalInfo = this.playableNotes(init.chart);
  }

  get chart(): Chart {
    return this.doc.chart;
  }

  openDocument(chart: Chart): void {
    this.activateDocument(createDocument(chart, true));
  }

  activateDocument(doc: ChartDocument): void {
    this.doc = doc;
    const chart = doc.chart;
    this.tempo = undefined;
    this.edit = { ...this.edit, kMouseOver: -1 };
    this.drag = createDragState();
    this.setWavSelection([0]);
    this.setBmpSelection([0]);
    this.totalInfo = this.playableNotes(chart);
    this.view = setPlayer(this.view, chart.header.player);
    this.refreshPanelAll();
    this.refreshStatus();
  }

  panelAction(action: PanelAction): string | undefined {
    const result = runPanelAction(this.ctx(), action);
    if (action.kind === 'resource' && result.resourceSelection !== undefined) {
      if (action.resource === 'wav') this.setWavSelection(result.resourceSelection);
      else this.setBmpSelection(result.resourceSelection);
    }
    this.keep(result.input);
    return result.clipboard;
  }

  featureAction(action: FeatureAction): void {
    this.keep(runFeature(this.ctx(), action));
  }

  private playableNotes(chart: Chart): PlayableNotesInfo {
    return calculateTotalPlayableNotes(chart, this.totalOptions, this.recommendedTotalLabel);
  }

  private readonly calculateTotal = (chart: Chart): void => {
    const info = this.playableNotes(chart);
    this.totalInfo = info;
    if (info.autofillTotal !== undefined && info.autofillTotal !== chart.header.total) {
      chart.header.total = info.autofillTotal;
      if (this.doc.isSaved) this.doc.isSaved = false;
    }
  };

  ctx(focusedPanel: PanelIndex | null = this.focus): InputContext {
    this.syncLists();
    return {
      doc: this.doc,
      session: this.session,
      view: this.view,
      edit: this.edit,
      drag: this.drag,
      options: this.options,
      visual: this.visual,
      panelSizes: this.panelSizes,
      focusedPanel,
      bmpSelection: this.lbmp,
      calculateTotalPlayableNotes: this.calculateTotal,
    };
  }

  private syncLists(): void {
    if ((this.lwav[0] ?? -1) !== this.session.currentWav) {
      this.lwav = this.session.currentWav < 0 ? [] : [this.session.currentWav];
    }
    if ((this.lbmp[0] ?? -1) !== this.session.currentBmp) {
      this.lbmp = this.session.currentBmp < 0 ? [] : [this.session.currentBmp];
    }
  }

  setWavSelection(indices: readonly number[]): void {
    this.lwav = [...new Set(indices)].sort((a, b) => a - b);
    this.session.currentWav = this.lwav[0] ?? -1;
  }

  setBmpSelection(indices: readonly number[]): void {
    this.lbmp = [...new Set(indices)].sort((a, b) => a - b);
    this.session.currentBmp = this.lbmp[0] ?? -1;
  }

  lwavClick(): void {
    if (this.edit.tool !== 'write') return;
    const noteIndex = c10toId(this.session.currentWav + 1, this.chart.base62);
    if (noteIndex !== this.status.noteIndex) this.status = { ...this.status, noteIndex };
  }


  keep(result: InputResult): boolean {
    this.view = result.view;
    this.edit = result.edit;
    this.drag = result.drag;
    this.syncLists();
    if (result.chartChanged || result.redraw) this.tempo = undefined;
    if (result.focusArea !== undefined) {
      this.focus = result.focusArea;
      this.host.focusArea?.(result.focusArea);
    }
    this.host.kept?.(result);
    if (result.prompt === undefined) return this.finish(result);
    const answered = this.host.prompt?.(result.prompt);
    if (answered === undefined) {
      this.pendingPrompt = { request: result.prompt, rest: result };
      return false;
    }
    const failed = this.keep(applyPrompt(this.ctx(), result.prompt, answered.answer ?? ''));
    return this.finish(result) || failed;
  }

  answerPrompt(answer: string | null): boolean {
    const pending = this.pendingPrompt;
    if (pending === undefined) return false;
    this.pendingPrompt = undefined;
    const failed = this.keep(applyPrompt(this.ctx(), pending.request, answer ?? ''));
    return this.finish(pending.rest) || failed;
  }

  private finish(result: InputResult): boolean {
    let failed = false;
    if (result.message !== undefined) this.host.message?.(result.message);
    if (result.error !== undefined) {
      this.host.error?.(result.error);
      failed = true;
    }
    if (result.status) this.refreshStatus();
    if (result.redraw) this.refreshPanelAll();
    return failed;
  }

  private tempoMap(): TempoMap {
    this.tempo ??= buildTempoMap(this.chart.notes);
    return this.tempo;
  }

  chartChanged(): void {
    this.tempo = undefined;
    this.view = withChartColumns(this.view, this.chart);
  }

  refreshStatus(modifiers: KeyModifiers = this.edit.modifiers): void {
    try {
      const r = poStatusRefresh(this.status, {
        chart: this.chart,
        view: this.view,
        edit: this.edit,
        session: this.session,
        tempo: this.tempoMap(),
        panelHeight: this.panelSizes[this.view.focus].height,
        bmsGridLimit: this.editorOptions.bmsGridLimit,
        modifiers,
        strings: this.statusStrings,
      });
      this.status = r.status;
      this.edit = r.edit;
    } catch (error) {
      if (!isDesktopException(error)) throw error;
      this.host.error?.(error);
    }
  }

  refreshPanelAll(): void {
    const chart = this.chart;
    this.view = withChartColumns(this.view, chart);
    const mode = determineXKeyMode(this.view, chart.header.player);
    this.gXKeyMode = mode.gXKeyMode;
    if (mode.player !== chart.header.player) {
      chart.header.player = mode.player;
      this.view = setPlayer(this.view, mode.player);
    }
    const info = selectionInfo(chart, this.tempoMap());
    if (info !== this.status.selectionInfo) this.status = { ...this.status, selectionInfo: info };
  }

  interaction(cursor: PanelPoint | undefined): Interaction {
    const { edit, session } = this;
    return {
      tool: edit.tool,
      mouseMoveStatus: edit.mouseMoveStatus,
      modifiers: edit.modifiers,
      kMouseOver: edit.kMouseOver,
      bAdjustLength: session.bAdjustLength,
      bAdjustUpper: session.bAdjustUpper,
      lastMouseDownLocation: edit.lastMouseDownLocation,
      pMouseMove: edit.pMouseMove,
      shouldDrawTempNote: edit.shouldDrawTempNote,
      selectedColumn: edit.selectedColumn,
      tempVPosition: edit.tempVPosition,
      tempLength: edit.tempLength,
      vSelStart: session.vSelStart,
      vSelLength: session.vSelLength,
      vSelHalf: session.vSelHalf,
      vSelMouseOverLine: edit.vSelMouseOverLine,
      middleButtonClicked: edit.middleButtonClicked,
      middleButtonLocation: edit.middleButtonLocation,
      cursorPosition:
        cursor === undefined
          ? edit.middleButtonLocation
          : { x: Math.floor(cursor.x), y: Math.floor(cursor.y) },
      currentWav: session.currentWav,
      currentBmp: session.currentBmp,
    };
  }


  mouseEnter(panel: PanelIndex): boolean {
    return this.keep(pMainInMouseEnter(this.ctx(), panel));
  }

  mouseLeave(panel: PanelIndex): boolean {
    return this.keep(pMainInMouseLeave(this.ctx(), panel));
  }

  mouseMove(e: PanelMouseEvent): boolean {
    return this.keep(pMainInMouseMove(this.ctx(), e));
  }

  mouseDown(e: PanelMouseEvent): boolean {
    return this.keep(pMainInMouseDown(this.ctx(), e));
  }

  mouseUp(e: PanelMouseEvent): boolean {
    return this.keep(pMainInMouseUp(this.ctx(), e));
  }

  mouseWheel(panel: PanelIndex, delta: number, modifiers: KeyModifiers): boolean {
    return this.keep(pMainInMouseWheel(this.ctx(), panel, delta, modifiers));
  }

  scrollBar(
    bar: 'v' | 'h',
    panel: PanelIndex,
    value: number,
    modifiers: KeyModifiers,
    maximum?: number,
  ): boolean {
    const size = this.panelSizes[panel];
    return this.keep(
      runInput(this.ctx(), (d) => {
        const range =
          bar === 'v' ? vScrollRange(d.chart, size.height) : hScrollRange(d.view, size.width);
        if (value < range.minimum || value > (maximum ?? range.maximum)) {
          throw new VbError('Argument');
        }
        if (bar === 'v') draftSetVScroll(d, panel, value, modifiers);
        else draftSetHScroll(d, panel, value);
      }),
    );
  }

  tickTimer1(modifiers: KeyModifiers): boolean {
    if (!this.drag.timer1) return false;
    this.keep(timer1Tick(this.ctx(), modifiers));
    return true;
  }

  tickTimerMiddle(cursor: PanelPoint, modifiers: KeyModifiers): boolean {
    if (!this.drag.timerMiddle) return false;
    this.keep(timerMiddleTick(this.ctx(), cursor, modifiers));
    return true;
  }


  keyDown(key: {
    readonly name: string;
    readonly modifiers: KeyModifiers;
    readonly focus: PanelIndex | null;
    readonly clipboard?: KeyClipboard;
    readonly hover?: { readonly panel: PanelIndex; readonly x: number; readonly y: number };
  }): void {
    const combo: KeyCombo = { ...key.modifiers, name: key.name };
    const text = comboString(combo);
    this.focus = key.focus;
    if (key.focus !== null) {
      this.host.log?.(`previewKeyDown ${key.focus} ${text}`);
      if (modifierKeyNames.includes(key.name)) {
        this.modifierKeyDown(key.modifiers);
      } else {
        const outcome = this.previewKeyDown(key.focus, combo, key);
        if (outcome.failed) return;
      }
    }
    if (this.processCmdKey(combo)) {
      this.host.log?.(`processCmdKey ${text} handled`);
      return;
    }
    this.host.log?.(`processCmdKey ${text}`);
    this.host.log?.(`formKeyDown ${text}`);
  }

  modifierKeyDown(modifiers: KeyModifiers): void {
    this.edit = { ...this.edit, modifiers };
    this.refreshPanelAll();
    this.refreshStatus(modifiers);
  }

  previewKeyDown(
    panel: PanelIndex,
    combo: KeyCombo,
    options: {
      readonly clipboard?: KeyClipboard;
      readonly hover?: { readonly panel: PanelIndex; readonly x: number; readonly y: number };
    } = {},
  ): { readonly preventDefault: boolean; readonly failed: boolean } {
    const chart = this.chart;
    const kb = resolveKeybinding(
      this.keybindings,
      combo,
      determineXKeyMode(this.view, chart.header.player).gXKeyMode,
      selectionBounds(chart.notes).hasSelectedNotes,
    );
    const ctx = this.ctx(panel);
    const r = dispatchKeybinding(
      {
        ...ctx,
        ...(options.clipboard === undefined ? {} : { clipboard: options.clipboard }),
        confirmPattern: (a, b) => this.host.confirmPattern?.(a, b) ?? false,
      },
      kb,
      combo,
    );
    const preventDefault = r.preventDefault;
    if (this.keep(r)) return { preventDefault, failed: true };
    if (!r.hover) return { preventDefault, failed: false };
    const modifiers: KeyModifiers = { ctrl: combo.ctrl, shift: combo.shift, alt: combo.alt };
    const hover = options.hover;
    if (hover === undefined) {
      this.refreshStatus(modifiers);
      return { preventDefault, failed: false };
    }
    const failed = this.keep(refreshHover(this.ctx(), hover.panel, hover.x, hover.y, modifiers));
    return { preventDefault, failed };
  }

  processCmdKey(combo: KeyCombo): boolean {
    const item = resolveMenuShortcut(combo);
    if (item === undefined) return false;
    return !this.menuShortcut(item);
  }

  menuShortcut(item: MenuShortcutItem): boolean {
    return this.keep(dispatchMenuShortcut(this.ctx(), item));
  }

  keyUp(modifiers: KeyModifiers): void {
    this.edit = { ...this.edit, modifiers };
    this.refreshPanelAll();
    this.refreshStatus(modifiers);
  }


  setTool(tool: EditTool): boolean {
    return this.keep(setTool(this.ctx(), tool));
  }

  tbNTInputClick(checked: boolean): boolean {
    return this.keep(tbNTInputClick(this.ctx(), checked));
  }

  tbWavIncreaseClick(): boolean {
    return this.keep(tbWavIncreaseClick(this.ctx()));
  }

  undo(): boolean {
    return this.keep(runInput(this.ctx(), draftTbUndoClick));
  }

  redo(): boolean {
    return this.keep(
      runInput(this.ctx(), (d) => {
        d.edit.kMouseOver = -1;
        d.drag.selectedNotes = [];
        if (tbRedoClick(d.doc, performContext(d))) {
          d.chartChanged = true;
          d.redraw = true;
          d.status = true;
        }
      }),
    );
  }

  convertMenuItem(item: ConvertMenuItem): boolean {
    if (this.chart.ntInput && (item === 'POBLong' || item === 'POBLongShort')) return false;
    this.keep(
      runInput(this.ctx(), (d) => {
        const ctx: MoveContext = {
          ...performContext(d),
          addUndo: (undo, redo, overWrite) => draftAddUndo(d, undo, redo, overWrite),
        };
        const b = new UndoChainBuilder();
        switch (item) {
          case 'POBHidden':
            pobHiddenClick(d.chart, b, ctx);
            break;
          case 'POBVisible':
            pobVisibleClick(d.chart, b, ctx);
            break;
          case 'POBHiddenVisible':
            pobHiddenVisibleClick(d.chart, b, ctx);
            break;
          case 'POBLong':
            pobLongClick(d.chart, b, ctx);
            break;
          case 'POBShort':
            pobNormalClick(d.chart, b, ctx);
            break;
          case 'POBLongShort':
            pobNormalLongClick(d.chart, b, ctx);
            break;
        }
        d.chartChanged = true;
        d.redraw = true;
      }),
    );
    return true;
  }

  clipboardOp(
    op: ClipboardOp,
    clipboard: KeyClipboard,
    focus: PanelIndex | null = this.focus,
  ): boolean {
    return this.keep(runClipboardOp(this.ctx(focus), op, clipboard));
  }

  pastePattern(text: string): void {
    this.keep(
      runInput(this.ctx(), (d) => {
        pastePattern(
          d.chart,
          text,
          d.view.panels[d.view.focus].vScroll,
          d.options.pastePatternToVPosition ?? false,
          {
            ...performContext(d),
            addUndo: (undo, redo, overwrite) => draftAddUndo(d, undo, redo, overwrite),
          },
          (a, b) => this.host.confirmPattern?.(a, b) ?? false,
        );
        d.chartChanged = true;
        d.redraw = true;
      }),
    );
  }

  selectAll(focus: PanelIndex | null = this.focus): boolean {
    return this.keep(runMnSelectAll(this.ctx(focus)));
  }

  deleteSelected(focus: PanelIndex | null = this.focus): boolean {
    return this.keep(runMnDelete(this.ctx(focus)));
  }

  saveAs(): SaveOutcome {
    const chart = this.chart;
    if (chart.randomSource !== undefined) return { kind: 'disabled' };
    this.drag = { ...this.drag, selectedNotes: [] };
    this.edit = { ...this.edit, kMouseOver: -1 };
    const warnings: SaveWarning[] = [];
    let text: string;
    try {
      text = saveBMS(chart, this.editorOptions, false, warnings).text;
    } catch (error) {
      if (!isDesktopException(error)) throw error;
      this.host.error?.(error);
      return { kind: 'failed', warnings, error };
    } finally {
      this.tempo = undefined;
    }
    const bytes = encodeText(text, this.encoding);
    this.doc.isSaved = true;
    return { kind: 'saved', bytes, warnings };
  }
}
