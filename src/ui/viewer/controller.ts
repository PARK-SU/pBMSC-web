import { maxId, cIdto10 } from '../../core/bms/base.ts';
import { createDocument } from '../../core/edit/document.ts';
import { parseBMS } from '../../core/bms/parse.ts';
import { openBMSFunc } from '../../core/bms/template.ts';
import { saveBMS, type SaveWarning } from '../../core/bms/serialize.ts';
import type { ChartDocument } from '../../core/edit/document.ts';
import { canRedo, canUndo, type UndoStack } from '../../core/edit/undo.ts';
import { createChart, type Chart, type ReadonlyChart } from '../../core/model/chart.ts';
import { decodeText, encodeText, type TextEncodingName } from '../../core/text/encoding.ts';
import { VbError } from '../../core/vb.ts';
import type { EditState, EditTool, PanelPoint } from '../../editor/edit-state.ts';
import { EditorSession } from '../../editor/editor-session.ts';
import type {
  InputMessage,
  PanelMouseEvent,
  PanelSize,
  ToolVisual,
} from '../../editor/input/events.ts';
import type { KeyCombo } from '../../editor/input/keyboard.ts';
import type {
  ClipboardOp,
  KeyClipboard,
  MenuShortcutItem,
} from '../../editor/input/keybindings.ts';
import type { KeyModifiers } from '../../editor/input/modifiers.ts';
import type { PanelAction } from '../../editor/input/panels.ts';
import { cloneNote } from '../../core/model/note.ts';
import type { PromptRequest } from '../../editor/input/prompts.ts';
import { timerTicks } from '../../editor/input/scroll.ts';
import type { Interaction } from '../../editor/interaction.ts';
import {
  createPanelRenderer,
  staticPointerKey,
  type ErrorIcons,
  type PanelRenderer,
  type PanelRendererOptions,
  type PanelScene,
} from '../../editor/render/renderer.ts';
import type { StatusBarModel } from '../../editor/status.ts';
import {
  createEditorView,
  hScrollRange,
  pMainInResize,
  setGxHeight,
  setGxWidth,
  setPanelFocus,
  setPanelWidth,
  setSpLock,
  updateColumnsX,
  vScrollRange,
  type EditorView,
  type PanelIndex,
  type ScrollRange,
} from '../../editor/view.ts';
import { defaultLangFile, parseLangXml, type Lang, type LangFile } from '../../i18n/lang.ts';
import { webText } from '../../i18n/web.ts';
import {
  applyThemeColumns,
  defaultVisualSettings,
  defaultThemeName,
  parseThemeXml,
  type Theme,
  type ThemeName,
  type VisualSettings,
} from '../../settings/theme-loader.ts';
import {
  createClipboardAccess,
  eventClipboard,
  type ClipboardAccess,
  type ClipboardEventLike,
} from '../input/clipboard.ts';
import { applyPinchPan, type PanelScrollState, type PinchPanMove } from '../input/gestures.ts';
import { wheelDelta } from '../input/wheel.ts';
import { lanePreset, type LanePreset } from '../input/lanes.ts';
import { nLeft, getColumnWidth } from '../../editor/view.ts';
import { describeError } from './errors.ts';
import { downloadBlob, downloadFile } from './save.ts';
import { statusStrings } from './text.ts';
import {
  AudioEngine,
  initialAudioState,
  type AudioUiState,
  type AuditionLine,
  type WaveOptions,
} from '../../audio/engine.ts';
import { getMouseVPosition, setPanelVScroll } from '../../editor/view.ts';
import {
  buildPreviewTempoMap,
  timeFromVPosition,
  vPositionFromTime,
} from '../../audio/preview/tempo.ts';
import { waveColorSettings } from '../../editor/render/audio.ts';
import { ProjectStore, type Project, type ProjectLink } from '../../project/store.ts';
import type { FeatureAction } from '../../editor/input/features.ts';
import { advancedStatistics, legacyStatistics } from '../../core/edit/analysis.ts';
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
  type EditorPreferences,
} from '../../settings/preferences.ts';
import {
  keybindingsInit,
  resolveKeybinding,
  selectionBounds,
} from '../../editor/input/keybindings.ts';
import { determineXKeyMode } from '../../editor/view.ts';
import { loadColorOverrideActive, type ColorOverride } from '../../settings/color-overrides.ts';
import {
  newOpExpand,
  selectSection,
  bDisplayGhostAllClick,
  expandDisplayGhostNotes,
  expandModifyNotes,
  expandRemoveGhostNotes,
  removeGhostNotes,
  type OpExpandState,
} from '../../core/edit/random.ts';
import { generateHeaderMeta, generateHeaderIndexedData } from '../../core/bms/serialize.ts';
import { openSM } from '../../core/bms/sm.ts';
import {
  chartFiles,
  directoryFiles,
  droppedFiles,
  findStoredChart,
  importArchive,
  importProject,
  matchingChartPath,
  readProjectChart,
  selectedFiles,
} from '../../project/import.ts';
import {
  fileName as baseName,
  isAudioFile,
  isChartFile,
  pathKey,
  projectPath,
  relativeFile,
} from '../../project/paths.ts';
import {
  projectArchive,
  writeDirectoryFile,
  type PickerWindow,
  type WritableFile,
} from '../../project/export.ts';

export interface ProjectChrome {
  readonly busy: boolean;
  readonly message: string;
  readonly failed: boolean;
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly charts: readonly string[];
  readonly recent: readonly { id: string; name: string }[];
}
const initialProject: ProjectChrome = {
  busy: false,
  message: '',
  failed: false,
  id: '',
  name: '',
  path: '',
  charts: [],
  recent: [],
};

export const panelIndices: readonly PanelIndex[] = [0, 1, 2];

const englishLangFile: LangFile = 'eng.Lang.xml';

export const fileNameInit = 'Untitled.bms';

export const defaultTextEncoding: TextEncodingName = 'SJIS';

export interface PanelScroll {
  readonly panel: PanelIndex;
  readonly vRange: ScrollRange;
  readonly vScroll: number;
  readonly hRange: ScrollRange;
  readonly hScroll: number;
}

export interface PanelHost {
  readonly staticCanvas: HTMLCanvasElement;
  readonly dynamicCanvas: HTMLCanvasElement;
  readonly sync?: (frame: PanelScroll) => void;
  readonly clientOrigin?: () => PanelPoint;
  readonly focusArea?: () => void;
}

export interface FrameStats {
  readonly time: number;
  readonly panels: readonly { panel: PanelIndex; staticMs: number; dynamicMs: number }[];
}

export type ChromeMessage =
  | InputMessage
  | { readonly kind: 'saveWarning'; readonly warning: SaveWarning }
  | { readonly kind: 'saveAsDisabled' };

export interface PanelKeyOutcome {
  readonly preventDefault: boolean;
  readonly failed: boolean;
}

export interface ViewerChrome {
  readonly ready: boolean;
  readonly fileName: string;
  readonly encoding: TextEncodingName;
  readonly themeName: ThemeName | undefined;
  readonly langFile: LangFile | undefined;
  readonly lang: Lang | undefined;
  readonly english: Lang | undefined;
  readonly gxHeight: number;
  readonly gxWidth: number;
  readonly gDivide: number;
  readonly gSnap: boolean;
  readonly disableVerticalMove: boolean;
  readonly pinchZoom: boolean;
  readonly spLock: readonly [boolean, boolean, boolean];
  readonly showLSplit: boolean;
  readonly showRSplit: boolean;
  readonly leftWidth: number;
  readonly rightWidth: number;
  readonly error: string | undefined;
  readonly isSaved: boolean;
  readonly tool: EditTool;
  readonly ntInput: boolean;
  readonly wavIncrease: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly base62: boolean;
  readonly currentWav: number;
  readonly currentBmp: number;
  readonly prompt: PromptRequest | undefined;
  readonly message: ChromeMessage | undefined;
  readonly tabs: readonly TabSummary[];
  readonly activeTab: number;
  readonly panelRevision: number;
  readonly sidebar: boolean;
  readonly panelSection:
    | 'header'
    | 'grid'
    | 'wav'
    | 'bmp'
    | 'beat'
    | 'expansion'
    | 'navigate'
    | 'tools'
    | 'options'
    | 'visual'
    | 'keybindings'
    | 'audio'
    | 'colors'
    | 'statistics';
  readonly navigationTarget: 'goto' | 'find';
  readonly navigationRequest: number;
  readonly saving: boolean;
  readonly saveDialog: boolean;
  readonly closingTab: number | undefined;
  readonly sticky: KeyModifiers;
  readonly lanePreset: LanePreset;
  readonly audio: AudioUiState;
  readonly audioLocked: boolean;
  readonly project: ProjectChrome;
  readonly projectSelection:
    { readonly id: string; readonly name: string; readonly charts: readonly string[] } | undefined;
}

export interface TabSummary {
  readonly id: number;
  readonly name: string;
  readonly color: string;
  readonly isSaved: boolean;
}

interface OpenTab {
  sectionSource?: number;
  id: number;
  name: string;
  color: string;
  doc: ChartDocument;
  bytes: Uint8Array | undefined;
  openedUndo: UndoStack;
  project?: ProjectLink;
  templates?: Map<string, Uint8Array>;
}

export interface RecoverySnapshot {
  readonly version: 1;
  readonly tabs: OpenTab[];
  readonly activeTab: number;
  readonly encoding: TextEncodingName;
}

type ErrorSource = 'theme' | 'lang' | 'edit' | undefined;

export interface ViewerDeps {
  createRenderer(
    staticCanvas: HTMLCanvasElement,
    dynamicCanvas: HTMLCanvasElement,
    options: PanelRendererOptions,
  ): PanelRenderer;
  loadData(file: string): Promise<string>;
  loadImage(file: string): Promise<CanvasImageSource>;
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(handle: number): void;
  now(): number;
  download(bytes: Uint8Array, fileName: string): void;
  readonly clipboard: ClipboardAccess;
  confirmPattern(clipboardCount: number, selectionCount: number): boolean;
}

export interface ViewerOptions {
  readonly gxHeight?: number;
  readonly deps?: Partial<ViewerDeps>;
}

async function fetchData(file: string): Promise<Response> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  return response;
}

async function loadData(file: string): Promise<string> {
  return (await fetchData(file)).text();
}

export async function loadDataImage(file: string): Promise<ImageBitmap> {
  const blob = await (await fetchData(file)).blob();
  return createImageBitmap(blob, { colorSpaceConversion: 'none' });
}

export async function loadErrorIcons(
  loadImage: (file: string) => Promise<CanvasImageSource> = loadDataImage,
): Promise<ErrorIcons> {
  const [imageError, imageErrorR] = await Promise.all([
    loadImage('ImageError.png'),
    loadImage('ImageErrorR.png'),
  ]);
  return { imageError, imageErrorR };
}

function defaultDeps(): ViewerDeps {
  return {
    createRenderer: createPanelRenderer,
    loadData,
    loadImage: loadDataImage,
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    now: () => performance.now(),
    download: downloadFile,
    clipboard: createClipboardAccess(
      typeof navigator === 'undefined' ? undefined : navigator.clipboard,
    ),
    confirmPattern: () =>
      window.confirm(
        'Warning: The clipboard note count is different from the highlighted note count. Continue?',
      ),
  };
}

function toolVisual(visual: VisualSettings): ToolVisual {
  return {
    kHeight: visual.kHeight,
    peDeltaMouseOver: visual.peDeltaMouseOver,
    middleDeltaRelease: visual.middleDeltaRelease,
  };
}

interface Dirty {
  static: boolean;
  dynamic: boolean;
  sync?: boolean;
}

interface AttachedPanel {
  readonly host: PanelHost;
  readonly renderer: PanelRenderer;
}

const panelOnlyFields: ReadonlySet<keyof EditorView> = new Set<keyof EditorView>([
  'panels',
  'focus',
  'spLock',
  'spDiff',
  'showLSplit',
  'showRSplit',
]);

function changesEveryPanel(previous: EditorView, next: EditorView): boolean {
  for (const key of Object.keys(next) as (keyof EditorView)[]) {
    if (!panelOnlyFields.has(key) && previous[key] !== next[key]) return true;
  }
  return false;
}

function sameField(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Reflect.get(a, key) === Reflect.get(b, key))
  );
}

function changesDynamicLayer(previous: Interaction, next: Interaction): boolean {
  for (const key of Object.keys(next) as (keyof Interaction)[]) {
    if (key === 'mouseMoveStatus') continue;
    if (key === 'cursorPosition' && !next.middleButtonClicked) continue;
    if (!sameField(previous[key], next[key])) return true;
  }
  return false;
}

function sameStatus(a: StatusBarModel, b: StatusBarModel): boolean {
  return (Object.keys(b) as (keyof StatusBarModel)[]).every((key) => sameField(a[key], b[key]));
}

export class ViewerController {
  private readonly deps: ViewerDeps;
  private readonly editor: EditorSession;
  private openedUndo: UndoStack;
  private theme: Theme | undefined;
  private themeVisual: VisualSettings | undefined;
  private preferences = defaultPreferences();
  private colorRules: readonly ColorOverride[] = [];
  private colorTable: readonly (number | undefined)[] = [];
  private expansionDialog: { text: string; state: OpExpandState } | undefined;
  private errorIcons: ErrorIcons | undefined;
  private english: Lang | undefined;
  private englishRequest: Promise<Lang> | undefined;
  private themeRequest = 0;
  private langRequest = 0;
  private openRequest = 0;
  private themeName: ThemeName | undefined;
  private langFile: LangFile | undefined;
  private errorSource: ErrorSource;
  private bytes: Uint8Array | undefined;
  private pixelRatio = 1;
  private readonly attached: (AttachedPanel | undefined)[] = [undefined, undefined, undefined];
  private readonly dirty: Dirty[] = [
    { static: true, dynamic: true },
    { static: true, dynamic: true },
    { static: true, dynamic: true },
  ];
  private frameHandle: number | undefined;
  private chrome: ViewerChrome;
  private readonly listeners = new Set<() => void>();
  private readonly frameListeners = new Set<(stats: FrameStats) => void>();

  private lastFocusedArea: PanelIndex | null = null;
  private pointerClient: PanelPoint | undefined;
  private interaction: Interaction;
  private readonly pointerKeys: string[] = ['', '', ''];
  private messages: ChromeMessage[] = [];
  private editErrors = 0;
  private deferredUp: PanelMouseEvent | undefined;
  private status: StatusBarModel;
  private readonly statusListeners = new Set<() => void>();
  private readonly audioListeners = new Set<() => void>();
  private timerHandle: number | undefined;
  private timerLast = 0;
  private timerCarry = 0;
  private inTimerFrame = false;
  private openTabs: OpenTab[] = [];
  private nextTab = 2;
  private activeTab = 1;
  private tabSummary: readonly TabSummary[] = [];
  private panelRevision = 0;
  private saving = false;
  private closeRequest: { id: number; previous: number } | undefined;
  private closeAfterSave: { id: number; previous: number } | undefined;
  private readonly sticky: KeyModifiers = { ctrl: false, shift: false, alt: false };
  private audioEngine: AudioEngine | undefined;
  private auditionLine: AuditionLine | undefined;
  private audioScrub: PanelIndex | undefined;
  private scrubTimer: ReturnType<typeof setTimeout> | undefined;
  private waveStamp = '';
  private audioExtent = 0;
  private readonly projects = new ProjectStore();
  private projectRequest = 0;
  private projectAbort: AbortController | undefined;
  private preset: LanePreset = 'theme';
  private themeVisibility: readonly boolean[] | undefined;
  private touchSnapshot:
    | {
        doc: ChartDocument;
        saved: {
          doc: ChartDocument;
          session: EditorSession['session'];
          edit: EditorSession['edit'];
          drag: EditorSession['drag'];
          view: EditorView;
        };
      }
    | undefined;

  constructor(options: ViewerOptions = {}) {
    this.deps = { ...defaultDeps(), ...options.deps };
    let view = createEditorView();
    if (options.gxHeight !== undefined) view = setGxHeight(view, options.gxHeight);
    const noSize: PanelSize = { width: 0, height: 0 };
    this.editor = new EditorSession({
      chart: createChart(),
      view,
      panelSizes: [noSize, noSize, noSize],
      encoding: defaultTextEncoding,
      host: {
        focusArea: (panel) => this.attached[panel]?.host.focusArea?.(),
        message: (message) => void this.messages.push(message),
        error: (error) => {
          this.editErrors++;
          this.fail(error, 'edit');
        },
        confirmPattern: (a, b) => this.deps.confirmPattern(a, b),
        kept: (result) => {
          if (result.chartChanged) this.audioEngine?.stop();
          if (result.preview)
            void this.audioEngine?.audition(
              this.editor.chart,
              result.preview.stop,
              result.preview.wavId,
              result.preview.noteIndex,
            );
          if (result.chartChanged) {
            this.panelRevision++;
            this.invalidate(panelIndices, { static: false, dynamic: true });
          }
        },
      },
    });
    this.openedUndo = this.editor.doc.undo;
    this.openTabs = [
      {
        id: 1,
        name: fileNameInit,
        color: '#f0f0f0',
        doc: this.editor.doc,
        bytes: undefined,
        openedUndo: this.openedUndo,
      },
    ];
    this.status = this.editor.status;
    this.interaction = this.editor.interaction(undefined);
    this.chrome = {
      ready: false,
      fileName: fileNameInit,
      encoding: defaultTextEncoding,
      themeName: defaultThemeName,
      langFile: defaultLangFile,
      lang: undefined,
      english: undefined,
      ...this.viewChrome(view),
      error: undefined,
      sidebar: typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
      panelSection: 'header',
      navigationTarget: 'goto',
      navigationRequest: 0,
      pinchZoom: true,
      saving: false,
      saveDialog: false,
      closingTab: undefined,
      sticky: this.sticky,
      lanePreset: this.preset,
      audio: initialAudioState,
      audioLocked: false,
      project: initialProject,
      projectSelection: undefined,
      ...this.editChrome(),
    };
  }

  async start(): Promise<void> {
    void this.loadErrorIcons();
    if (typeof indexedDB !== 'undefined') void this.refreshProjects();
    if (typeof localStorage !== 'undefined') {
      this.preferences = loadPreferences(localStorage);
    }
    await Promise.all([
      this.setLang(this.preferences.langFile),
      this.setTheme(this.preferences.themeName),
    ]);
    this.applyPreferences(false);
    this.loadColors();
  }

  private async loadErrorIcons(): Promise<void> {
    try {
      this.errorIcons = await loadErrorIcons((file) => this.deps.loadImage(file));
    } catch {
      return;
    }
    this.invalidate(panelIndices, { static: false, dynamic: true });
  }

  private updateProject(change: Partial<ProjectChrome>): void {
    this.updateChrome({ project: { ...this.chrome.project, ...change } });
  }
  private projectError(error: unknown): void {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    this.updateProject({
      failed: true,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  private async refreshProjects(): Promise<void> {
    try {
      const recent = (await this.projects.list())
        .slice(0, 10)
        .map(({ id, name }) => ({ id, name }));
      this.updateProject({ recent });
    } catch (error) {
      this.projectError(error);
    }
  }
  private async ensureProject(tab: OpenTab): Promise<Project> {
    if (tab.project) return this.projects.get(tab.project.id);
    const path = projectPath(baseName(tab.name));
    const project = this.projects.create(baseName(tab.name), 'files');
    const bytes = tab.bytes ?? encodeText('#BPM 120\r\n', this.editor.encoding);
    await this.projects.addFile(project, path, new Blob([Uint8Array.from(bytes)]));
    await this.projects.publish(project);
    tab.project = { id: project.id, path };
    return project;
  }
  private async syncProject(): Promise<void> {
    this.loadColors();
    const tab = this.openTabs.find((t) => t.id === this.activeTab);
    if (!tab?.project) {
      this.updateProject({ id: '', name: '', path: '', charts: [] });
      return;
    }
    try {
      const project = await this.projects.get(tab.project.id);
      if (tab.id !== this.activeTab) return;
      this.audio().attachSource(
        tab.id,
        this.projects.source(project, tab.project.path),
        project.files.filter((f) => isAudioFile(f.name)).length,
      );
      this.updateProject({
        id: project.id,
        name: project.name,
        path: tab.project.path,
        charts: chartFiles(project),
      });
    } catch (error) {
      delete tab.project;
      this.projectError(error);
    }
  }
  cancelProject(): void {
    this.projectAbort?.abort();
  }

  private async runProjectImport(
    operation: (
      signal: AbortSignal,
      progress: (count: number, bytes: number, path: string) => void,
    ) => Promise<Project | { project: Project; path: string }>,
  ): Promise<boolean> {
    this.projectAbort?.abort();
    const request = ++this.projectRequest,
      abort = new AbortController();
    this.projectAbort = abort;
    this.stopAudio();
    this.updateProject({ busy: true, message: '', failed: false });
    try {
      const result = await operation(abort.signal, (count, bytes, path) => {
        if (request === this.projectRequest && (count === 1 || count % 8 === 0))
          this.updateProject({
            message: `${count} files · ${(bytes / 1024 ** 2).toFixed(1)} MiB · ${path}`,
          });
      });
      if (request !== this.projectRequest || abort.signal.aborted) return false;
      const project = 'project' in result ? result.project : result;
      if (
        !(await this.openStoredProject(project.id, 'project' in result ? result.path : undefined))
      )
        return false;
      this.updateProject({ message: `${project.files.length} files · ${project.name}` });
      void this.projects.indexDurations(project).catch((e: unknown) => this.projectError(e));
      return true;
    } catch (error) {
      if (request === this.projectRequest) this.projectError(error);
      return false;
    } finally {
      if (request === this.projectRequest) {
        this.projectAbort = undefined;
        this.updateProject({ busy: false });
        await this.refreshProjects();
      }
    }
  }
  async importProjectSelection(files: readonly File[], preferredFile?: File): Promise<boolean> {
    if (!files.length || this.modal) return false;
    const first = files[0]!;
    return this.runProjectImport(async (signal, progress) => {
      try {
        if (!preferredFile && files.length === 1 && /\.zip$/i.test(first.name))
          return await importArchive(this.projects, first, progress, signal);
        if (
          !preferredFile &&
          files.length === 1 &&
          isChartFile(first.name) &&
          !first.webkitRelativePath
        ) {
          const match = await findStoredChart(this.projects, first);
          if (match) return match;
        }
        const root = first.webkitRelativePath?.split('/')[0];
        const entries = [...selectedFiles(files)];
        const path = preferredFile ? await matchingChartPath(entries, preferredFile) : undefined;
        if (preferredFile && !path)
          throw new Error(
            webText(this.chrome.langFile, 'chartNotInFolder', { name: preferredFile.name }),
          );
        const project = await importProject(
          this.projects,
          root || first.name,
          entries,
          root ? 'folder' : 'files',
          progress,
          signal,
        );
        return path ? { project, path } : project;
      } catch (error) {
        if (
          files.length === 1 &&
          !/\.zip$/i.test(first.name) &&
          !signal.aborted &&
          error instanceof DOMException
        )
          await this.openFile(first);
        throw error;
      }
    });
  }
  async openCachedChart(file: File): Promise<boolean> {
    if (this.modal) return false;
    try {
      const match = await findStoredChart(this.projects, file);
      return match ? this.openStoredProject(match.project.id, match.path) : false;
    } catch (error) {
      this.projectError(error);
      return false;
    }
  }
  async importChartFile(): Promise<void> {
    const picker = window as PickerWindow;
    if (!picker.showOpenFilePicker || !picker.showDirectoryPicker || this.modal) return;
    await this.runProjectImport(async (signal, progress) => {
      const [handle] = await picker.showOpenFilePicker!({
        multiple: false,
        types: [
          {
            description: 'BMS / ZIP',
            accept: {
              'application/octet-stream': ['.bms', '.bme', '.bml', '.pms', '.bmsc', '.txt', '.zip'],
            },
          },
        ],
      });
      if (!handle) throw new DOMException('Cancelled', 'AbortError');
      const file = await handle.getFile();
      if (/\.zip$/i.test(file.name)) return importArchive(this.projects, file, progress, signal);
      const match = await findStoredChart(this.projects, file, handle);
      if (match) return match;
      let directory: FileSystemDirectoryHandle | undefined;
      for (const project of await this.projects.list()) {
        const stored = project.directory as
          | (FileSystemDirectoryHandle & {
              queryPermission?: (options: { mode: 'read' }) => Promise<PermissionState>;
            })
          | undefined;
        if (
          stored &&
          (await stored.resolve(handle)) &&
          (!stored.queryPermission ||
            (await stored.queryPermission({ mode: 'read' })) === 'granted')
        ) {
          directory = stored;
          break;
        }
      }
      directory ??= await picker.showDirectoryPicker!({ mode: 'readwrite', startIn: handle });
      const parts = await directory.resolve(handle);
      if (!parts?.length)
        throw new Error(webText(this.chrome.langFile, 'chartNotInFolder', { name: file.name }));
      const project = await importProject(
        this.projects,
        directory.name,
        directoryFiles(directory),
        'folder',
        progress,
        signal,
        directory,
      );
      return { project, path: parts.join('/') };
    });
  }
  async importDirectory(): Promise<void> {
    const picker = (window as PickerWindow).showDirectoryPicker;
    if (!picker || this.modal) return;
    await this.runProjectImport(async (signal, progress) => {
      const directory = await picker.call(window, { mode: 'readwrite' });
      return importProject(
        this.projects,
        directory.name,
        directoryFiles(directory),
        'folder',
        progress,
        signal,
        directory,
      );
    });
  }
  async importDrop(data: DataTransfer): Promise<void> {
    if (this.modal) return;
    const files = Array.from(data.files);
    if (files.length === 1 && (/\.zip$/i.test(files[0]!.name) || isChartFile(files[0]!.name))) {
      await this.importProjectSelection(files);
      return;
    }
    const pending = droppedFiles(data);
    await this.runProjectImport(async (signal, progress) => {
      const drop = await pending;
      return importProject(
        this.projects,
        drop.name,
        drop.entries,
        drop.directory ? 'folder' : 'files',
        progress,
        signal,
        drop.directory,
      );
    });
  }
  async openStoredProject(id: string, path?: string): Promise<boolean> {
    const request = ++this.openRequest;
    try {
      const project = await this.projects.get(id);
      const charts = chartFiles(project);
      const remembered =
        project.lastChart && charts.includes(project.lastChart) ? project.lastChart : undefined;
      const chosen = path ?? remembered ?? (charts.length === 1 ? charts[0] : undefined);
      if (request !== this.openRequest) return false;
      if (!charts.length) throw new Error('No chart in the project');
      if (!chosen) {
        this.updateChrome({ projectSelection: { id, name: project.name, charts } });
        return true;
      }
      project.opened = Date.now();
      project.lastChart = chosen;
      await this.projects.publish(project);
      if (request !== this.openRequest) return false;
      this.updateProject({
        id,
        name: project.name,
        path: chosen,
        charts: chartFiles(project),
        failed: false,
      });
      const existing = this.openTabs.find(
        (t) => t.project?.id === id && pathKey(t.project.path) === pathKey(chosen),
      );
      if (existing) {
        this.switchTab(existing.id);
        return true;
      }
      const loaded = await readProjectChart(
        this.projects,
        project,
        chosen,
        this.chrome.encoding,
        this.editor.chart.ntInput,
      );
      if (request !== this.openRequest) return false;
      this.openBytes(loaded.bytes, loaded.name, loaded.templates, { id, path: chosen });
      await this.syncProject();
      await this.refreshProjects();
      return true;
    } catch (error) {
      if (request === this.openRequest) this.projectError(error);
      return false;
    }
  }
  async chooseProjectChart(path?: string): Promise<void> {
    const selection = this.chrome.projectSelection;
    if (!selection || (path !== undefined && !selection.charts.includes(path))) return;
    this.updateChrome({ projectSelection: undefined });
    this.updateProject({ message: '' });
    if (path !== undefined) await this.openStoredProject(selection.id, path);
  }
  openRecent(index: number): void {
    const project = this.chrome.project.recent[index];
    if (project && !this.modal) void this.openStoredProject(project.id);
  }

  async saveProject(name = this.chrome.fileName, encoding = this.chrome.encoding): Promise<void> {
    if (this.modal) return;
    const tab = this.openTabs.find((t) => t.id === this.activeTab)!;
    const doc = this.editor.doc;
    this.stopAudio();
    this.saving = true;
    this.updateChrome({ saving: true });
    try {
      await new Promise<void>((resolve) =>
        this.deps.requestFrame(() => this.deps.requestFrame(() => resolve())),
      );
      if (doc !== this.editor.doc) throw new Error('The active document changed before saving');
      this.editor.encoding = encoding;
      const saved = this.act(() => this.editor.saveAs(), true);
      if (saved === undefined) return;
      if (saved.kind === 'disabled') {
        this.messages.push({ kind: 'saveAsDisabled' });
        return;
      }
      for (const warning of saved.warnings) this.messages.push({ kind: 'saveWarning', warning });
      if (saved.kind !== 'saved') return;
      let direct = false;
      if (typeof indexedDB !== 'undefined') {
        const project = await this.ensureProject(tab);
        const path = relativeFile(tab.project!.path, name);
        const blob = new Blob([Uint8Array.from(saved.bytes)]);
        if (project.directory) direct = await writeDirectoryFile(project.directory, path, blob);
        project.lastChart = path;
        await this.projects.saveFile(project, path, blob);
        tab.project = { id: project.id, path };
      }
      if (!direct) this.deps.download(saved.bytes, name);
      tab.bytes = saved.bytes;
      this.bytes = saved.bytes;
      this.updateChrome({ fileName: name, encoding });
      this.updateProject({
        failed: false,
        message: direct ? 'Saved to folder' : 'Downloaded chart',
      });
    } catch (error) {
      doc.isSaved = false;
      this.projectError(error);
      this.fail(error, 'edit');
    } finally {
      this.saving = false;
      this.updateChrome({ saving: false });
      this.afterInput();
      if (typeof indexedDB !== 'undefined') {
        await this.syncProject();
        await this.refreshProjects();
      }
    }
  }

  async exportProject(): Promise<void> {
    if (this.modal || this.chrome.project.busy) return;
    const tab = this.openTabs.find((t) => t.id === this.activeTab)!;
    const picker = (window as PickerWindow).showSaveFilePicker;
    const abort = new AbortController();
    this.projectAbort = abort;
    let writer: WritableFile | undefined;
    this.stopAudio();
    this.updateProject({ busy: true, message: '', failed: false });
    try {
      const target = picker?.call(window, {
        suggestedName: `${this.chrome.project.name || baseName(tab.name)}.zip`,
        types: [{ description: 'ZIP project', accept: { 'application/zip': ['.zip'] } }],
      });
      const project = await this.ensureProject(tab);
      const overrides = new Map<string, Blob>();
      this.stashTab();
      for (const open of this.openTabs)
        if (open.project?.id === project.id) {
          const text = saveBMS(structuredClone(open.doc.chart), this.editor.editorOptions).text;
          overrides.set(
            pathKey(open.project.path),
            new Blob([Uint8Array.from(encodeText(text, this.editor.encoding))]),
          );
        }
      const handle = await target;
      writer = await handle?.createWritable();
      const blob = await projectArchive(this.projects, project, writer, abort.signal, overrides);
      if (writer) await writer.close();
      else if (blob) downloadBlob(blob, `${project.name.replace(/\.zip$/i, '')}.zip`);
      this.updateProject({ message: 'Project ZIP exported' });
    } catch (error) {
      await writer?.abort().catch(() => {});
      this.projectError(error);
    } finally {
      this.projectAbort = undefined;
      this.updateProject({ busy: false });
    }
  }


  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getChrome = (): ViewerChrome => this.chrome;

  readonly subscribeAudio = (listener: () => void): (() => void) => {
    this.audioListeners.add(listener);
    return () => this.audioListeners.delete(listener);
  };

  readonly subscribeStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  };

  readonly getStatus = (): StatusBarModel => this.status;

  private updateChrome(change: Partial<ViewerChrome>): void {
    const next = { ...this.chrome, ...change };
    const keys = Object.keys(change) as (keyof ViewerChrome)[];
    if (keys.every((key) => next[key] === this.chrome[key])) return;
    this.chrome = next;
    for (const listener of this.listeners) listener();
  }

  private viewChrome(
    view: EditorView,
  ): Pick<
    ViewerChrome,
    | 'gxHeight'
    | 'gxWidth'
    | 'gDivide'
    | 'gSnap'
    | 'disableVerticalMove'
    | 'spLock'
    | 'showLSplit'
    | 'showRSplit'
    | 'leftWidth'
    | 'rightWidth'
  > {
    return {
      gxHeight: view.gxHeight,
      gxWidth: view.gxWidth,
      gDivide: view.gDivide,
      gSnap: view.gSnap,
      disableVerticalMove: view.disableVerticalMove,
      spLock: view.spLock,
      showLSplit: view.showLSplit,
      showRSplit: view.showRSplit,
      leftWidth: view.panels[0].width,
      rightWidth: view.panels[2].width,
    };
  }

  private editChrome(): Pick<
    ViewerChrome,
    | 'isSaved'
    | 'tool'
    | 'ntInput'
    | 'wavIncrease'
    | 'canUndo'
    | 'canRedo'
    | 'base62'
    | 'currentWav'
    | 'currentBmp'
    | 'prompt'
    | 'message'
    | 'tabs'
    | 'activeTab'
    | 'panelRevision'
  > {
    const { doc, session, edit } = this.editor;
    return {
      isSaved: doc.isSaved,
      tool: edit.tool,
      ntInput: doc.chart.ntInput,
      wavIncrease: session.wavIncrease,
      canUndo: canUndo(doc.undo),
      canRedo: canRedo(doc.undo),
      base62: doc.chart.base62,
      currentWav: session.currentWav,
      currentBmp: session.currentBmp,
      prompt: this.editor.pendingPrompt?.request,
      message: this.messages[0],
      tabs: this.tabsChrome(),
      activeTab: this.activeTab,
      panelRevision: this.panelRevision,
    };
  }

  private fail(error: unknown, source?: ErrorSource, change: Partial<ViewerChrome> = {}): void {
    this.errorSource = source;
    this.updateChrome({ ...change, error: describeError(error) });
  }

  private clearError(source: ErrorSource): Partial<ViewerChrome> {
    if (this.errorSource !== source) return {};
    this.errorSource = undefined;
    return { error: undefined };
  }


  getChart(): ReadonlyChart {
    return this.editor.chart;
  }

  getDocument(): Readonly<Pick<ChartDocument, 'undo' | 'isSaved'>> {
    return this.editor.doc;
  }

  getView(): EditorView {
    return this.editor.view;
  }

  private audio(): AudioEngine {
    if (!this.audioEngine) {
      this.audioEngine = new AudioEngine({
        state: (audio) => {
          if (audio.error || document.hidden) this.audioScrub = undefined;
          if (audio.kind === 'preparing' && audio.duration > 0) {
            const map = buildPreviewTempoMap(this.editor.chart.notes);
            this.audioExtent = Math.max(
              this.audioExtent,
              vPositionFromTime(map, timeFromVPosition(map, audio.position) + audio.duration),
            );
          }
          const previous = this.chrome.audio;
          const audioLocked = audio.kind !== 'stopped' || this.audioScrub !== undefined;
          const controlsChanged =
            audioLocked !== this.chrome.audioLocked ||
            previous.wave !== audio.wave ||
            previous.waveName !== audio.waveName ||
            previous.previewOnClick !== audio.previewOnClick ||
            previous.clickStopPreview !== audio.clickStopPreview;
          if (controlsChanged) this.updateChrome({ audio, audioLocked });
          else this.chrome = { ...this.chrome, audio, audioLocked };
          for (const listener of this.audioListeners) listener();
          if (controlsChanged || previous.duration !== audio.duration)
            this.invalidate(panelIndices);
        },
        follow: (position) => this.followAudio(position),
        audition: (line) => {
          this.auditionLine = line;
          this.invalidate(panelIndices, { static: false, dynamic: true });
        },
        waveChanged: () => {
          this.invalidate(panelIndices, { static: false, dynamic: true });
        },
      });
      this.audioEngine.selectTab(this.activeTab);
      this.audioEngine.setOffset(this.preferences.audioOffset);
      this.audioEngine.setPreviewOptions(
        this.editor.options.previewOnClick,
        this.editor.options.clickStopPreview,
      );
      if (this.theme) this.audioEngine.setWaveOptions(waveColorSettings(this.theme.visual.pBGMWav));
    }
    return this.audioEngine;
  }

  playAudio(fromBeginning = false, selectedOnly = false): void {
    if (this.modal || this.chrome.audio.loading || this.chrome.project.busy) return;
    this.finishTouchEdit(true);
    this.audioScrub = undefined;
    if (this.scrubTimer !== undefined) clearTimeout(this.scrubTimer);
    const position = fromBeginning
      ? 0
      : Math.max(0, -this.editor.view.panels[this.editor.view.focus].vScroll);
    void this.audio().play(this.editor.chart, position, selectedOnly);
  }

  stopAudio(): void {
    this.audioScrub = undefined;
    if (this.scrubTimer !== undefined) clearTimeout(this.scrubTimer);
    this.scrubTimer = undefined;
    this.audioEngine?.stop();
  }

  async importKeysounds(files: readonly File[]): Promise<void> {
    if (this.chrome.project.busy) return;
    const tab = this.openTabs.find((t) => t.id === this.activeTab)!;
    this.stopAudio();
    this.updateProject({ busy: true, failed: false, message: '' });
    try {
      const project = await this.ensureProject(tab);
      for (const file of files) {
        const relative = file.webkitRelativePath;
        const path = relativeFile(
          tab.project!.path,
          relative ? relative.slice(relative.indexOf('/') + 1) : file.name,
        );
        await this.projects.addFile(project, projectPath(path), file);
      }
      await this.projects.publish(project);
      if (tab.id === this.activeTab) await this.syncProject();
      void this.projects.indexDurations(project).catch((e: unknown) => this.projectError(e));
    } catch (error) {
      this.projectError(error);
    } finally {
      this.updateProject({ busy: false });
    }
    this.waveStamp = '';
    this.refreshNoteWaves();
  }
  previewWav(): void {
    const id = this.editor.session.currentWav + 1;
    void this.audio().audition(
      this.editor.chart,
      true,
      this.editor.options.previewOnClick ? id : undefined,
    );
  }
  exportAudio(): void {
    if (this.chrome.project.busy) return;
    void this.audio().export(
      this.editor.chart,
      this.chrome.fileName.replace(/\.[^.]*$/, '') + '.wav',
    );
  }
  loadWaveform(file: File): void {
    void this.audio().loadWave(file);
  }
  clearWaveform(): void {
    this.audioEngine?.clearWave();
  }
  setWaveOptions(options: Partial<WaveOptions>): void {
    this.audio().setWaveOptions(options);
    this.refreshNoteWaves();
  }
  setAudioOffset(ms: number): void {
    this.updateOptions({ audioOffset: ms });
    this.audio().setOffset(ms);
  }
  setPreviewOptions(previewOnClick: boolean, clickStopPreview: boolean): void {
    this.updateOptions({
      tool: { ...this.preferences.tool, previewOnClick, clickStopPreview },
    });
    this.audio().setPreviewOptions(previewOnClick, clickStopPreview);
  }

  private followAudio(position: number): void {
    const view = this.editor.view,
      focus = view.focus,
      value = -position;
    const delta = value - view.panels[focus].vScroll;
    if (delta === 0) return;
    this.setView({
      ...view,
      panels: view.panels.map((p, i) =>
        i === focus || (view.spLock[i] && view.spLock[focus])
          ? { ...p, vScroll: Math.min(0, p.vScroll + delta) }
          : p,
      ) as unknown as EditorView['panels'],
    });
    if (this.frameHandle !== undefined) this.deps.cancelFrame(this.frameHandle);
    this.flush(this.deps.now());
  }

  private audioScrollChart(): ReadonlyChart {
    const chart = this.editor.chart;
    return this.audioExtent > chart.greatestVPosition
      ? { ...chart, greatestVPosition: this.audioExtent }
      : chart;
  }

  private beginAudioScrub(panel: PanelIndex): void {
    if (this.audioScrub !== undefined) {
      this.audioScrub = panel;
      return;
    }
    this.audioScrub = panel;
    this.audioEngine?.stop();
  }

  endAudioScrub(): void {
    const panel = this.audioScrub;
    if (panel === undefined) return;
    this.audioScrub = undefined;
    this.focusPanel(panel);
    this.playAudio();
  }

  private refreshNoteWaves(): void {
    const engine = this.audioEngine;
    if (!engine?.status.wave.onNotes) return;
    const view = this.editor.view;
    const stamp = [
      this.activeTab,
      this.panelRevision,
      view.gxHeight,
      ...view.panels.map(
        (p, i) => `${Math.floor(p.vScroll / 48)}:${this.editor.panelSizes[i]!.height}`,
      ),
    ].join(':');
    if (stamp === this.waveStamp) return;
    this.waveStamp = stamp;
    const ranges = panelIndices
      .filter((i) => this.attached[i] !== undefined)
      .map((i) => ({
        low: -view.panels[i].vScroll,
        high: -view.panels[i].vScroll + this.editor.panelSizes[i].height / view.gxHeight,
      }));
    void engine.updateNoteWaves(this.editor.chart, ranges);
  }

  recoverySnapshot(): RecoverySnapshot | undefined {
    if (this.touchSnapshot !== undefined) return undefined;
    this.stashTab();
    return {
      version: 1,
      tabs: this.openTabs,
      activeTab: this.activeTab,
      encoding: this.editor.encoding,
    };
  }

  restoreRecovery(snapshot: RecoverySnapshot): void {
    if (snapshot.version !== 1 || snapshot.tabs.length === 0 || this.modal) return;
    this.stopAudio();
    for (const tab of this.openTabs) this.audioEngine?.discardTab(tab.id);
    this.openTabs = snapshot.tabs;
    this.activeTab =
      snapshot.tabs.find((t) => t.id === snapshot.activeTab)?.id ?? snapshot.tabs[0]!.id;
    this.nextTab = Math.max(...snapshot.tabs.map((t) => t.id)) + 1;
    const tab = this.openTabs.find((t) => t.id === this.activeTab)!;
    this.audioExtent = 0;
    this.waveStamp = '';
    this.audioEngine?.selectTab(this.activeTab);
    this.editor.activateDocument(tab.doc);
    this.editor.encoding = snapshot.encoding;
    this.bytes = tab.bytes;
    this.openedUndo = tab.openedUndo;
    this.panelRevision++;
    this.invalidate(panelIndices, { static: true, dynamic: true });
    this.updateChrome({ fileName: tab.name, encoding: snapshot.encoding });
    this.afterInput();
    void this.syncProject();
  }

  setTouchModifiers(modifiers: KeyModifiers): void {
    if (
      this.modal ||
      (this.sticky.ctrl === modifiers.ctrl &&
        this.sticky.shift === modifiers.shift &&
        this.sticky.alt === modifiers.alt)
    )
      return;
    const next = { ...modifiers };
    Object.assign(this.sticky, next);
    this.updateChrome({ sticky: next });
    this.modifierKeyDown({ ctrl: false, shift: false, alt: false });
  }

  private withSticky(modifiers: KeyModifiers): KeyModifiers {
    return {
      ctrl: modifiers.ctrl || this.sticky.ctrl,
      shift: modifiers.shift || this.sticky.shift,
      alt: modifiers.alt || this.sticky.alt,
    };
  }

  setLanePreset(preset: LanePreset): void {
    if (preset === this.preset) return;
    if (this.preset === 'theme')
      this.themeVisibility = this.editor.view.columns.map((c) => c.isVisible);
    this.preset = preset;
    if (preset === 'theme' && this.themeVisibility !== undefined) {
      this.setView(
        updateColumnsX({
          ...this.editor.view,
          columns: this.editor.view.columns.map((c, i) => ({
            ...c,
            isVisible: this.themeVisibility![i] ?? c.isVisible,
          })),
        }),
        true,
      );
    } else if (preset !== 'theme') this.setView(lanePreset(this.editor.view, preset), true);
    this.updateChrome({ lanePreset: preset });
  }

  chooseLane(index: number): void {
    const view = this.editor.view;
    const panel = view.focus;
    const x = nLeft(view, index) + getColumnWidth(view, index) / 2;
    this.setHScroll(panel, Math.round(x - this.editor.panelSizes[panel].width / view.gxWidth / 2));
  }

  beginTouchEdit(panel: PanelIndex): void {
    if (this.chrome.audioLocked) return;
    if (this.modal || this.touchSnapshot !== undefined) return;
    this.attached[panel]?.host.focusArea?.();
    this.areaFocus(panel, true);
    const e = this.editor;
    this.touchSnapshot = {
      doc: e.doc,
      saved: structuredClone({
        doc: e.doc,
        session: e.session,
        edit: e.edit,
        drag: e.drag,
        view: e.view,
      }),
    };
  }

  touchMouse(kind: 'down' | 'move' | 'up', event: PanelMouseEvent): void {
    if (this.chrome.audioLocked) {
      this.mouse(kind, event);
      return;
    }
    if (this.touchSnapshot === undefined) return;
    const visual = this.editor.visual;
    this.editor.visual = { ...visual, touchTolerance: 8 };
    try {
      if (kind === 'down') {
        this.mouseEnter(event.panel);
        this.mouse('move', { ...event, button: 0, clicks: 0 });
      }
      this.mouse(kind, event);
    } finally {
      this.editor.visual = visual;
    }
  }

  finishTouchEdit(cancel: boolean): void {
    const snapshot = this.touchSnapshot;
    if (snapshot === undefined) return;
    this.touchSnapshot = undefined;
    if (cancel) {
      Object.assign(snapshot.doc, snapshot.saved.doc);
      if (this.editor.doc === snapshot.doc) {
        const e = this.editor;
        e.activateDocument(snapshot.doc);
        Object.assign(e.session, snapshot.saved.session);
        e.edit = snapshot.saved.edit;
        e.drag = snapshot.saved.drag;
        e.view = snapshot.saved.view;
        e.pendingPrompt = undefined;
        this.messages = [];
        this.deferredUp = undefined;
        e.chartChanged();
      }
      this.invalidate(panelIndices, { static: true, dynamic: true });
    }
    this.panelRevision++;
    this.afterInput();
  }

  getListSelection(kind: 'wav' | 'bmp'): readonly number[] {
    return kind === 'wav' ? this.editor.lwav : this.editor.lbmp;
  }

  getBeatSelection(): readonly number[] {
    return this.editor.session.beatSelection;
  }

  getPlayableCount(): number {
    return this.editor.totalInfo.count;
  }

  getTimeSelection() {
    const s = this.editor.session;
    return { start: s.vSelStart, length: s.vSelLength, half: s.vSelHalf };
  }
  featureAction(action: FeatureAction): void {
    if (this.modal) return;
    if (
      action.kind === 'find' &&
      action.operation === 'label' &&
      (!/^[0-9A-Za-z]{1,2}$/.test(String(action.replacement)) ||
        cIdto10(String(action.replacement), this.editor.chart.base62) === 0)
    ) {
      this.messages.push({ kind: 'invalidLabel' });
      this.afterInput();
      return;
    }
    if (
      action.kind === 'conversion' &&
      this.openTabs.some((t) => t.sectionSource === this.activeTab)
    ) {
      this.fail(new Error('Merge the open RANDOM section before converting.'));
      return;
    }
    this.act(() => {
      this.editor.featureAction(action);
      this.panelRevision++;
    }, true);
  }
  getStatistics(advanced = true) {
    return advanced
      ? advancedStatistics(this.editor.chart).data
      : legacyStatistics(this.editor.chart);
  }
  getWavUsage() {
    return advancedStatistics(this.editor.chart).wav;
  }
  getPreferences(): EditorPreferences {
    return this.preferences;
  }
  updateOptions(change: Partial<EditorPreferences>): void {
    if (this.modal) return;
    this.preferences = { ...this.preferences, ...change };
    this.applyPreferences();
    try {
      if (typeof localStorage !== 'undefined') savePreferences(localStorage, this.preferences);
    } catch (error) {
      this.fail(error);
    }
  }
  private applyPreferences(modifyTotal = true): void {
    const p = this.preferences,
      e = this.editor;
    e.options = { ...p.tool };
    e.totalOptions = { ...p.total };
    e.editorOptions = { ...p.writer };
    if (modifyTotal) e.ctx().calculateTotalPlayableNotes?.(e.chart);
    e.keybindings = keybindingsInit.map((k) => ({
      ...k,
      combo: p.bindings[String(k.opVar)] ?? k.combo,
    }));
    e.view = {
      ...e.view,
      gWheel: p.wheel,
      gPgUpDn: p.page,
      showFileName: p.showFileName,
      errorCheck: p.errorCheck,
    };
    if (this.theme) {
      const previous = e.view;
      e.view = updateColumnsX({
        ...e.view,
        columns: applyThemeColumns(applyThemeColumns(e.view.columns, this.theme), {
          columns: p.columns,
        }),
      });
      for (const panel of panelIndices)
        e.view = pMainInResize(e.view, panel, e.panelSizes[panel].width);
      this.viewChanged(previous, true);
      const waveformColor = this.theme.visual.pBGMWav;
      this.theme = {
        ...this.theme,
        visual: { ...(this.themeVisual ?? this.theme.visual), ...p.visual },
      };
      e.visual = { ...e.visual, ...this.theme.visual };
      if (waveformColor !== this.theme.visual.pBGMWav) {
        this.audioEngine?.setWaveOptions(waveColorSettings(this.theme.visual.pBGMWav));
      }
    }
    this.audioEngine?.setPreviewOptions(e.options.previewOnClick, e.options.clickStopPreview);
    this.audioEngine?.setOffset(p.audioOffset);
    this.updateChrome({ pinchZoom: p.pinchZoom });
    this.panelRevision++;
    this.afterInput();
    this.invalidate(panelIndices, { static: true, dynamic: true });
  }
  getVisualSettings(): Readonly<VisualSettings> {
    return this.theme?.visual ?? defaultVisualSettings;
  }
  getColorRules(): readonly ColorOverride[] {
    return this.colorRules;
  }
  readColorRules(scope: 'editor' | 'chart' | 'song'): readonly ColorOverride[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(this.colorKey(scope)) ?? '[]');
      return Array.isArray(value) ? (value as ColorOverride[]) : [];
    } catch (error) {
      this.fail(error);
      return [];
    }
  }
  private colorKey(scope: 'editor' | 'chart' | 'song'): string {
    const tab = this.openTabs.find((t) => t.id === this.activeTab);
    return `pbmsc-web:colors:${scope}:${scope === 'editor' ? 'default' : scope === 'song' ? (tab?.project?.id ?? this.chrome.fileName) : tab?.project ? tab.project.id + ':' + tab.project.path : this.chrome.fileName}`;
  }
  private loadColors(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      this.colorRules = [];
      for (const scope of ['chart', 'song', 'editor'] as const) {
        const data = localStorage.getItem(this.colorKey(scope));
        if (data !== null) {
          const raw: unknown = JSON.parse(data);
          if (!Array.isArray(raw)) continue;
          this.colorRules = raw as ColorOverride[];
          break;
        }
      }
      this.colorTable = loadColorOverrideActive(this.colorRules);
      this.invalidate(panelIndices, { static: false, dynamic: true });
    } catch (error) {
      this.fail(error);
    }
  }
  saveColorRules(scope: 'editor' | 'chart' | 'song', rules: readonly ColorOverride[]): void {
    try {
      this.colorTable = loadColorOverrideActive(rules);
      this.colorRules = rules.map((r) => ({ ...r }));
      localStorage.setItem(this.colorKey(scope), JSON.stringify(this.colorRules));
      this.panelRevision++;
      this.afterInput();
      this.invalidate(panelIndices, { static: false, dynamic: true });
    } catch (error) {
      this.fail(error);
    }
  }

  expansionAction(
    action: 'section' | 'all' | 'modify' | 'edit' | 'remove' | 'merge',
    line: number,
  ): void {
    if (this.modal) return;
    this.stopAudio();
    if (action === 'merge') {
      this.mergeSection();
      return;
    }
    const chart = this.editor.chart;
    if (action === 'remove') {
      this.act(() => {
        expandRemoveGhostNotes(chart);
        this.refreshExpansion();
      }, true);
      return;
    }
    if (chart.randomSource !== undefined) return;
    try {
      if (this.openTabs.some((t) => t.sectionSource === this.activeTab))
        throw new Error('A section tab is already open.');
      if (action === 'all')
        chart.expansionSplit = bDisplayGhostAllClick(chart.expansion, chart.expansionSplit);
      else {
        if (this.expansionDialog?.text !== chart.expansion)
          this.expansionDialog = { text: chart.expansion, state: newOpExpand(chart.expansion) };
        const result = selectSection(
          { ...this.expansionDialog.state, currSelection: line },
          chart.expansionSplit,
        );
        this.expansionDialog = { text: chart.expansion, state: result.state };
        chart.expansionSplit = result.expansionSplit;
        if (result.message) throw new Error(result.message);
      }
      if (action === 'edit') {
        removeGhostNotes(chart);
        chart.ghostMode = 0;
        this.refreshExpansion();
        const parent = this.openTabs.find((t) => t.id === this.activeTab)!;
        const source = this.activeTab,
          text =
            generateHeaderMeta(chart) +
            generateHeaderIndexedData(chart, this.editor.editorOptions) +
            chart.expansionSplit[1];
        this.openBytes(encodeText(text, this.chrome.encoding), 'RANDOM section.bms');
        const child = this.openTabs.find((t) => t.id === this.activeTab)!;
        child.sectionSource = source;
        if (parent.project) child.project = { ...parent.project };
        if (parent.templates) child.templates = new Map(parent.templates);
        child.doc.chart.randomSource = String(source);
        child.doc.isSaved = false;
        this.afterInput();
        void this.syncProject();
      } else
        this.act(() => {
          if (action === 'modify') expandModifyNotes(chart);
          else
            expandDisplayGhostNotes(chart, action === 'all' ? 0 : 1, {
              answer: 'yes',
              saveBMS: () => {
                saveBMS(chart, this.editor.editorOptions);
              },
            });
          this.refreshExpansion();
        }, true);
    } catch (error) {
      this.fail(error);
    }
  }
  private refreshExpansion(): void {
    this.editor.chartChanged();
    this.editor.ctx().calculateTotalPlayableNotes?.(this.editor.chart);
    this.editor.refreshPanelAll();
    this.editor.refreshStatus();
    this.panelRevision++;
    this.invalidate(panelIndices);
  }
  private mergeSection(): void {
    const child = this.openTabs.find((t) => t.id === this.activeTab),
      source = this.openTabs.find((t) => t.id === child?.sectionSource);
    if (!child || !source) return;
    try {
      const section = saveBMS(child.doc.chart, this.editor.editorOptions).text;
      const copy = structuredClone(source.doc.chart);
      copy.expansion = '';
      const baseline = new Set(saveBMS(copy, this.editor.editorOptions).text.split('\r\n'));
      const lines = section
        .split('\r\n')
        .filter(
          (line) =>
            (!baseline.has(line) && line !== '*---------------------- RANDOM DATA FIELD') ||
            /^#(?:RANDOM|IF|ENDIF)/i.test(line),
        );
      source.doc.chart.expansionSplit[1] = lines.map((line) => line + '\r\n').join('');
      source.doc.chart.expansion = source.doc.chart.expansionSplit.join('\r\n');
      source.doc.isSaved = false;
      this.openTabs = this.openTabs.filter((t) => t !== child);
      this.switchTab(source.id);
      this.panelRevision++;
      this.afterInput();
    } catch (error) {
      this.fail(error);
    }
  }
  async importSM(
    file: Blob & { readonly name: string },
    choose: (choices: readonly string[]) => Promise<number | undefined>,
  ): Promise<void> {
    const request = ++this.openRequest,
      encoding = this.chrome.encoding;
    try {
      const text = decodeText(new Uint8Array(await file.arrayBuffer()), encoding),
        probe = createChart();
      let choices: readonly string[] = [];
      openSM(probe, text, (list) => {
        choices = list;
        return undefined;
      });
      const index = choices.length ? await choose(choices) : 0;
      if (index === undefined || request !== this.openRequest || this.modal) return;
      const chart = createChart();
      chart.ntInput = this.editor.chart.ntInput;
      if (openSM(chart, text, () => index)) return;
      this.stashTab();
      const doc = createDocument(chart, false),
        id = this.nextTab++;
      this.openTabs.push({
        id,
        name: baseName(file.name).replace(/\.sm$/i, '.bms'),
        color: '#f0f0f0',
        doc,
        bytes: undefined,
        openedUndo: doc.undo,
      });
      this.switchTab(id);
    } catch (error) {
      this.fail(error);
    }
  }

  setListSelection(kind: 'wav' | 'bmp', indices: readonly number[]): void {
    if (this.modal) return;
    this.act(() => {
      if (kind === 'wav') {
        this.editor.setWavSelection(indices);
        this.editor.lwavClick();
      } else this.editor.setBmpSelection(indices);
      this.panelRevision++;
    });
  }

  canEditExpansion(): boolean {
    return !this.openTabs.some((t) => t.sectionSource === this.activeTab);
  }

  panelAction(action: PanelAction): string | undefined {
    if (this.modal) return;
    if (action.kind === 'expansion' && !this.canEditExpansion()) return;
    if (
      action.kind === 'find' &&
      [action.query.labelFrom, action.query.labelTo].some(
        (label) => !/^[0-9A-Za-z]{1,2}$/.test(label.trim()) || /^(0|00)$/.test(label.trim()),
      )
    ) {
      this.messages.push({ kind: 'invalidLabel' });
      this.afterInput();
      return;
    }
    return this.act(() => this.editor.panelAction(action), true);
  }

  async beatClipboard(
    action: 'copy' | 'paste',
    mode: 'preserve' | 'measure' | 'cut' | 'scale',
  ): Promise<void> {
    const doc = this.editor.doc;
    const indices = [...this.getBeatSelection()];
    const text = action === 'paste' ? await this.deps.clipboard.read() : undefined;
    if (doc !== this.editor.doc || this.modal) return;
    const copied = this.panelAction({
      kind: 'beat',
      indices,
      action,
      mode,
      ...(text === undefined ? {} : { text }),
    });
    if (copied !== undefined) this.deps.clipboard.write(copied);
  }

  async pastePattern(): Promise<void> {
    if (this.modal) return;
    const doc = this.editor.doc;
    const text = await this.deps.clipboard.read();
    if (!this.modal && doc === this.editor.doc)
      this.act(() => this.editor.pastePattern(text), true);
  }

  setTemplateOptions(position: boolean, pattern: boolean): void {
    this.editor.options = {
      ...this.editor.options,
      templateSnapToVPosition: position,
      pastePatternToVPosition: pattern,
    };
  }

  async loadTemplate(file: Blob & { readonly name: string }): Promise<void> {
    const doc = this.editor.doc;
    const tab = this.openTabs.find((t) => t.doc === doc)!;
    const encoding = this.chrome.encoding;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const notes = openBMSFunc(decodeText(bytes, encoding));
      if (!this.openTabs.some((t) => t.doc === doc)) return;
      if (typeof indexedDB !== 'undefined') {
        const project = await this.ensureProject(tab);
        await this.projects.saveFile(project, relativeFile(tab.project!.path, file.name), file);
      }
      if (!this.openTabs.includes(tab)) return;
      tab.templates ??= new Map();
      tab.templates.set(file.name, bytes);
      doc.chart.notesTemplate = notes.map(cloneNote);
      doc.chart.fileNameTemplate = file.name;
      doc.isSaved = false;
      this.panelRevision++;
      this.afterInput();
    } catch (error) {
      this.fail(error, 'edit');
    }
  }

  toggleSidebar(): void {
    this.updateChrome({ sidebar: !this.chrome.sidebar });
  }

  setPanelSection(panelSection: ViewerChrome['panelSection']): void {
    this.updateChrome({
      panelSection,
      ...(panelSection === 'navigate'
        ? { navigationTarget: 'find', navigationRequest: this.chrome.navigationRequest + 1 }
        : {}),
    });
  }

  private stashTab(): void {
    const tab = this.openTabs.find((t) => t.id === this.activeTab);
    if (tab === undefined) return;
    tab.doc = this.editor.doc;
    tab.name = this.chrome.fileName;
    tab.bytes = this.bytes;
    tab.openedUndo = this.openedUndo;
  }

  private tabsChrome(): readonly TabSummary[] {
    const next = this.openTabs.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      isSaved: t.doc.isSaved,
    }));
    if (
      next.length !== this.tabSummary.length ||
      next.some((t, i) => !sameField(t, this.tabSummary[i]))
    )
      this.tabSummary = next;
    return this.tabSummary;
  }

  switchTab(id: number): void {
    if (id === this.activeTab || this.modal) return;
    this.finishTouchEdit(true);
    this.setTouchModifiers({ ctrl: false, shift: false, alt: false });
    const tab = this.openTabs.find((t) => t.id === id);
    if (tab === undefined) return;
    this.stashTab();
    const previous = this.editor.view;
    this.activeTab = id;
    this.audioExtent = 0;
    this.waveStamp = '';
    this.audioEngine?.selectTab(id);
    this.editor.activateDocument(tab.doc);
    this.bytes = tab.bytes;
    this.openedUndo = tab.openedUndo;
    this.panelRevision++;
    this.updateChrome({ fileName: tab.name });
    this.viewChanged(previous, true);
    this.afterInput();
    void this.syncProject();
  }

  newDocument(): void {
    if (this.modal) return;
    this.stashTab();
    const doc = createDocument(createChart(), true);
    const id = this.nextTab++;
    this.openTabs.push({
      id,
      name: fileNameInit,
      color: '#f0f0f0',
      doc,
      bytes: undefined,
      openedUndo: doc.undo,
    });
    this.switchTab(id);
  }

  setTabColor(id: number, color: string): void {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    const tab = this.openTabs.find((t) => t.id === id);
    if (tab !== undefined) {
      tab.color = color;
      this.afterInput();
    }
  }

  requestCloseTab(id: number): void {
    this.stopAudio();
    this.finishTouchEdit(true);
    if (this.modal) return;
    const section = this.openTabs.find((t) => t.sectionSource === id);
    if (section) {
      this.switchTab(section.id);
      this.updateChrome({ sidebar: true, panelSection: 'expansion' });
      return;
    }
    const previous = this.activeTab;
    this.switchTab(id);
    if (!this.openTabs.some((t) => t.id === id)) return;
    if (this.editor.doc.isSaved) this.closeTab(id, previous);
    else {
      this.closeRequest = { id, previous };
      this.updateChrome({ closingTab: id });
    }
  }

  answerClose(answer: 'save' | 'discard' | 'cancel'): void {
    const request = this.closeRequest;
    if (request === undefined) return;
    this.closeRequest = undefined;
    this.updateChrome({ closingTab: undefined });
    if (answer === 'save') {
      if (this.openTabs.find((t) => t.id === request.id)?.sectionSource !== undefined) {
        this.mergeSection();
        return;
      }
      this.closeAfterSave = request;
      this.requestSaveAs();
    } else if (answer === 'discard') this.closeTab(request.id, request.previous);
    else this.switchTab(request.previous);
  }

  private closeTab(id: number, previous: number): void {
    const index = this.openTabs.findIndex((t) => t.id === id);
    if (index < 0) return;
    this.stopAudio();
    this.audioEngine?.discardTab(id);
    this.openTabs.splice(index, 1);
    if (this.openTabs.length === 0) {
      this.newDocument();
      return;
    }
    const next =
      this.openTabs.find((t) => t.id === previous) ??
      this.openTabs[Math.min(index, this.openTabs.length - 1)]!;
    this.activeTab = -1;
    this.switchTab(next.id);
  }

  requestSaveAs(): void {
    if (!this.modal) this.updateChrome({ saveDialog: true });
  }

  cancelSaveAs(): void {
    this.closeAfterSave = undefined;
    this.updateChrome({ saveDialog: false });
  }

  async confirmSaveAs(fileName: string, encoding: TextEncodingName): Promise<void> {
    if (!this.chrome.saveDialog || fileName.trim() === '') return;
    this.updateChrome({ saveDialog: false });
    await this.saveProject(fileName, encoding);
    const close = this.closeAfterSave;
    this.closeAfterSave = undefined;
    if (close !== undefined && this.editor.doc.isSaved) this.closeTab(close.id, close.previous);
  }

  getTheme(): Theme | undefined {
    return this.theme;
  }

  getEditState(): EditState {
    return this.editor.edit;
  }

  getPanelSize(panel: PanelIndex): PanelSize {
    return this.editor.panelSizes[panel];
  }

  onFrame(listener: (stats: FrameStats) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }


  async openFile(file: Blob & { readonly name: string }): Promise<void> {
    const request = ++this.openRequest;
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch (error) {
      if (request === this.openRequest) this.fail(error);
      return;
    }
    if (request !== this.openRequest) return;
    this.openBytes(bytes, file.name);
  }

  openBytes(
    bytes: Uint8Array,
    fileName: string,
    templates?: Map<string, Uint8Array>,
    project?: ProjectLink,
  ): void {
    this.stopAudio();
    this.finishTouchEdit(true);
    ++this.openRequest;
    const chart = this.readChart(bytes, templates);
    if (chart === undefined) return;
    this.stashTab();
    const doc = createDocument(chart, true);
    const id = this.nextTab++;
    this.openTabs.push({
      id,
      name: fileName,
      color: '#f0f0f0',
      doc,
      bytes,
      openedUndo: doc.undo,
      ...(templates ? { templates } : {}),
      ...(project ? { project } : {}),
    });
    this.activeTab = id;
    this.audioExtent = 0;
    this.waveStamp = '';
    this.audioEngine?.selectTab(id);
    this.bytes = bytes;
    this.updateChrome({ fileName });
    this.showChart(chart);
    void this.syncProject();
  }

  private readChart(
    bytes: Uint8Array,
    templates?: ReadonlyMap<string, Uint8Array>,
  ): Chart | undefined {
    let text: string;
    try {
      text = decodeText(bytes, this.chrome.encoding);
    } catch (error) {
      this.fail(error);
      return undefined;
    }
    const result = parseBMS(text, {
      ntInput: this.editor.chart.ntInput,
      ...(templates
        ? {
            host: {
              readTemplate: (name: string) => {
                const bytes = templates.get(name);
                if (!bytes) throw new VbError('IO');
                return decodeText(bytes, this.chrome.encoding);
              },
            },
          }
        : {}),
    });
    if (!result.ok) {
      this.fail(result.error);
      return undefined;
    }
    return result.chart;
  }

  private showChart(chart: Chart): void {
    const previous = this.editor.view;
    this.editor.openDocument(chart);
    this.openedUndo = this.editor.doc.undo;
    this.setTouchModifiers({ ctrl: false, shift: false, alt: false });
    this.viewChanged(previous, true);
    this.errorSource = undefined;
    this.updateChrome({ error: undefined });
    this.afterInput();
  }

  setEncoding(encoding: TextEncodingName): void {
    if (encoding === this.chrome.encoding) return;
    this.updateChrome({ encoding });
    this.editor.encoding = encoding;
    const { doc } = this.editor;
    if (this.bytes === undefined || !doc.isSaved || doc.undo !== this.openedUndo) return;
    const chart = this.readChart(
      this.bytes,
      this.openTabs.find((t) => t.id === this.activeTab)?.templates,
    );
    if (chart !== undefined) this.showChart(chart);
  }

  saveAs(): void {
    if (this.modal) return;
    const saved = this.act(() => this.editor.saveAs(), true);
    if (saved === undefined) return;
    if (saved.kind === 'disabled') {
      this.messages.push({ kind: 'saveAsDisabled' });
    } else {
      for (const warning of saved.warnings) this.messages.push({ kind: 'saveWarning', warning });
      if (saved.kind === 'saved') this.deps.download(saved.bytes, this.chrome.fileName);
      this.invalidate(panelIndices, { static: false, dynamic: true });
    }
    this.afterInput();
  }

  async setTheme(name: ThemeName): Promise<void> {
    const request = ++this.themeRequest;
    this.updateChrome({ themeName: name });
    let theme: Theme;
    try {
      theme = parseThemeXml(await this.deps.loadData(name));
    } catch (error) {
      if (request === this.themeRequest) this.fail(error, 'theme', { themeName: this.themeName });
      return;
    }
    if (request !== this.themeRequest) return;
    if (name !== this.preferences.themeName) {
      this.preferences = { ...this.preferences, visual: {}, columns: [] };
    }
    this.themeVisual = theme.visual;
    theme = { ...theme, visual: { ...theme.visual, ...this.preferences.visual } };
    this.theme = theme;
    this.audioEngine?.setWaveOptions(waveColorSettings(theme.visual.pBGMWav));
    this.themeName = name;
    const editor = this.editor;
    const previous = editor.view;
    editor.view = updateColumnsX({
      ...previous,
      columns: applyThemeColumns(
        applyThemeColumns(
          previous.columns.map((c, i) =>
            this.preset !== 'theme' && this.themeVisibility !== undefined
              ? { ...c, isVisible: this.themeVisibility[i] ?? c.isVisible }
              : c,
          ),
          theme,
        ),
        { columns: this.preferences.columns },
      ),
    });
    editor.visual = toolVisual(theme.visual);
    editor.refreshPanelAll();
    this.themeVisibility = editor.view.columns.map((c) => c.isVisible);
    if (this.preset !== 'theme') editor.view = lanePreset(editor.view, this.preset);
    this.viewChanged(previous, true);
    this.afterInput();
    this.updateChrome({ ready: this.english !== undefined, ...this.clearError('theme') });
    this.preferences = { ...this.preferences, themeName: name };
    try {
      if (typeof localStorage !== 'undefined') savePreferences(localStorage, this.preferences);
    } catch (error) {
      this.fail(error);
    }
  }

  private loadEnglish(): Promise<Lang> {
    this.englishRequest ??= this.deps.loadData(englishLangFile).then(parseLangXml);
    return this.englishRequest;
  }

  async setLang(file: LangFile): Promise<void> {
    const request = ++this.langRequest;
    this.updateChrome({ langFile: file });
    let english: Lang;
    let lang: Lang;
    try {
      english = await this.loadEnglish();
      lang = file === englishLangFile ? english : parseLangXml(await this.deps.loadData(file));
    } catch (error) {
      if (this.english === undefined) this.englishRequest = undefined;
      if (request === this.langRequest) this.fail(error, 'lang', { langFile: this.langFile });
      return;
    }
    this.english = english;
    if (request !== this.langRequest) return;
    this.langFile = file;
    this.preferences = { ...this.preferences, langFile: file };
    try {
      if (typeof localStorage !== 'undefined') savePreferences(localStorage, this.preferences);
    } catch (error) {
      this.fail(error);
    }
    this.editor.statusStrings = statusStrings(lang, english);
    this.updateChrome({
      lang,
      english,
      ready: this.theme !== undefined,
      ...this.clearError('lang'),
    });
  }


  private setView(next: EditorView, everyPanel = false): void {
    const previous = this.editor.view;
    if (next === previous && !everyPanel) return;
    this.editor.view = next;
    this.viewChanged(previous, everyPanel);
  }

  private viewChanged(previous: EditorView, everyPanel = false): void {
    const next = this.editor.view;
    if (next === previous && !everyPanel) return;
    if (everyPanel || changesEveryPanel(previous, next)) {
      this.invalidate(panelIndices);
    } else {
      const changed = panelIndices.filter((panel) => {
        const a = previous.panels[panel];
        const b = next.panels[panel];
        return a.vScroll !== b.vScroll || a.hScroll !== b.hScroll;
      });
      this.invalidate(changed);
    }
    this.updateChrome(this.viewChrome(next));
    this.checkPointerKeys();
    this.refreshNoteWaves();
  }

  focusPanel(panel: PanelIndex): void {
    this.setView(setPanelFocus(this.editor.view, panel));
  }

  setVScroll(panel: PanelIndex, value: number): void {
    if (this.chrome.audioLocked) {
      this.resync(panel);
      return;
    }
    if (this.audioExtent > this.editor.chart.greatestVPosition) {
      if (!this.editor.edit.modifiers.ctrl && !this.editor.edit.modifiers.shift)
        this.setView(setPanelVScroll(this.audioScrollChart(), this.editor.view, panel, value));
      else this.resync(panel);
      return;
    }
    const range = vScrollRange(this.editor.chart, this.editor.panelSizes[panel].height);
    const clamped = Math.min(Math.max(value, range.minimum), range.maximum);
    this.act(() => this.editor.scrollBar('v', panel, clamped, this.editor.edit.modifiers));
    if (this.editor.view.panels[panel].vScroll !== value) this.resync(panel);
  }

  setHScroll(panel: PanelIndex, value: number): void {
    const range = hScrollRange(this.editor.view, this.editor.panelSizes[panel].width);
    const clamped = Math.min(Math.max(value, range.minimum), range.maximum);
    this.act(() => this.editor.scrollBar('h', panel, clamped, this.editor.edit.modifiers));
    if (this.editor.view.panels[panel].hScroll !== value) this.resync(panel);
  }

  wheel(panel: PanelIndex, notches: number, modifiers: KeyModifiers): void {
    if (this.modal) return;
    if (this.chrome.audioLocked) {
      this.beginAudioScrub(panel);
      this.setView(
        setPanelVScroll(
          this.audioScrollChart(),
          this.editor.view,
          panel,
          this.editor.view.panels[panel].vScroll - notches * this.editor.view.gWheel,
        ),
      );
      if (this.scrubTimer !== undefined) clearTimeout(this.scrubTimer);
      this.scrubTimer = setTimeout(() => this.endAudioScrub(), 150);
      return;
    }
    const delta = Math.sign(notches) * wheelDelta;
    this.act(() => {
      for (let i = 0; i < Math.abs(notches); i++) this.editor.mouseWheel(panel, delta, modifiers);
    });
  }

  setGxHeight(zoom: number): void {
    this.setView(setGxHeight(this.editor.view, zoom));
  }

  setGxWidth(zoom: number): void {
    const [left, middle, right] = this.editor.panelSizes;
    this.setView(setGxWidth(this.editor.view, zoom, [left.width, middle.width, right.width]));
  }

  setSpLock(panel: PanelIndex, value: boolean): void {
    this.setView(setSpLock(this.editor.view, panel, value));
  }

  setShowSplit(panel: 0 | 2, value: boolean): void {
    const view = this.editor.view;
    this.setView(panel === 0 ? { ...view, showLSplit: value } : { ...view, showRSplit: value });
  }

  setSideWidth(panel: 0 | 2, width: number): void {
    this.setView(setPanelWidth(this.editor.view, panel, width));
  }

  panelScrollState(panel: PanelIndex): PanelScrollState {
    const view = this.editor.view;
    const { vScroll, hScroll } = view.panels[panel];
    return { gxHeight: view.gxHeight, vScroll, hScroll };
  }

  pinchPan(panel: PanelIndex, move: PinchPanMove): void {
    if (this.chrome.audioLocked) this.beginAudioScrub(panel);
    const { width, height } = this.editor.panelSizes[panel];
    this.setView(
      applyPinchPan(
        this.audioScrollChart(),
        this.editor.view,
        panel,
        { ...move, zooming: move.zooming && this.preferences.pinchZoom },
        width,
        height,
      ),
    );
  }


  mouse(kind: 'down' | 'move' | 'up', e: PanelMouseEvent): void {
    if (this.chrome.audioLocked) {
      if (kind === 'up' && e.button === 0x100000 && this.audioScrub === undefined) {
        const position = Math.max(
          0,
          getMouseVPosition(
            this.editor.chart,
            this.editor.view,
            this.editor.panelSizes[e.panel].height,
            e.y,
            false,
          ),
        );
        this.stopAudio();
        void this.audio().play(this.editor.chart, position);
      }
      return;
    }
    e = { ...e, modifiers: this.withSticky(e.modifiers) };
    this.pointerClient = e.client;
    if (this.modal) {
      if (kind === 'up') this.deferredUp = e;
      return;
    }
    const editor = this.editor;
    switch (kind) {
      case 'down':
        this.act(() => editor.mouseDown(e), true);
        break;
      case 'move':
        this.act(() => editor.mouseMove(e));
        break;
      case 'up':
        this.act(() => editor.mouseUp(e));
        break;
    }
  }

  mouseEnter(panel: PanelIndex): void {
    if (this.modal) return;
    this.act(() => this.editor.mouseEnter(panel));
  }

  mouseLeave(panel: PanelIndex): void {
    if (this.modal) return;
    this.act(() => this.editor.mouseLeave(panel));
  }

  setCursor(clientX: number, clientY: number): void {
    this.pointerClient = { x: clientX, y: clientY };
    if (this.editor.edit.middleButtonClicked) this.updateInteraction();
  }


  areaFocus(panel: PanelIndex, focused: boolean): void {
    if (focused) {
      this.editor.focus = panel;
      this.lastFocusedArea = panel;
    } else if (this.editor.focus === panel) {
      this.editor.focus = null;
    }
  }

  panelKeyDown(panel: PanelIndex, combo: KeyCombo): PanelKeyOutcome {
    if (combo.name === 'Escape') {
      this.stopAudio();
      return { preventDefault: true, failed: false };
    }
    if (combo.name === 'F4' && combo.shift) {
      this.playAudio(false, true);
      return { preventDefault: true, failed: false };
    }
    if (this.chrome.audioLocked) return { preventDefault: false, failed: false };
    combo = { ...combo, ...this.withSticky(combo) };
    if (this.modal) return { preventDefault: false, failed: false };
    const binding = resolveKeybinding(
      this.editor.keybindings,
      combo,
      determineXKeyMode(this.editor.view, this.editor.chart.header.player).gXKeyMode,
      selectionBounds(this.editor.chart.notes).hasSelectedNotes,
    );
    if (binding?.opVar === 110) {
      this.updateChrome({ sidebar: true, panelSection: 'expansion' });
      return { preventDefault: true, failed: false };
    }
    if (combo.ctrl && combo.shift && combo.name === 'V') {
      void this.pastePattern();
      return { preventDefault: true, failed: false };
    }
    if (combo.name === 'Tab' && !combo.ctrl && !combo.alt && this.openTabs.length > 1) {
      const index = this.openTabs.findIndex((t) => t.id === this.activeTab);
      this.switchTab(
        this.openTabs[
          (index + (combo.shift ? -1 : 1) + this.openTabs.length) % this.openTabs.length
        ]!.id,
      );
      return { preventDefault: false, failed: false };
    }
    const hover = this.hoverPoint(panel);
    const outcome = this.act(
      () => this.editor.previewKeyDown(panel, combo, hover === undefined ? {} : { hover }),
      true,
    );
    return outcome ?? { preventDefault: false, failed: true };
  }

  private hoverPoint(panel: PanelIndex): { panel: PanelIndex; x: number; y: number } | undefined {
    const client = this.pointerClient;
    const origin = this.attached[panel]?.host.clientOrigin?.();
    if (client === undefined || origin === undefined) return undefined;
    return { panel, x: Math.floor(client.x - origin.x), y: Math.floor(client.y - origin.y) };
  }

  modifierKeyDown(modifiers: KeyModifiers): void {
    if (this.modal) return;
    this.act(() => this.editor.modifierKeyDown(this.withSticky(modifiers)));
  }

  keyUp(modifiers: KeyModifiers): void {
    this.act(() => this.editor.keyUp(this.withSticky(modifiers)));
  }

  menuShortcut(item: MenuShortcutItem): void {
    if (this.modal) return;
    if (['mnTimeSelect', 'mnSelect', 'mnWrite', 'mnNTInput'].includes(item)) {
      this.setTouchModifiers({ ctrl: false, shift: false, alt: false });
    }
    if (
      item === 'mnStatistics' ||
      item === 'mnStatisticsAdvanced' ||
      item === 'mnVCOptions' ||
      item === 'mnGOptions' ||
      item === 'mnKOptions' ||
      item === 'mnVOptions' ||
      item === 'mnPOptions'
    ) {
      this.updateChrome({
        sidebar: true,
        panelSection:
          item === 'mnVCOptions'
            ? 'colors'
            : item === 'mnStatistics' || item === 'mnStatisticsAdvanced'
              ? 'statistics'
              : item === 'mnVOptions'
                ? 'visual'
                : item === 'mnKOptions'
                  ? 'keybindings'
                  : item === 'mnPOptions'
                    ? 'audio'
                    : 'options',
      });
      return;
    }
    if (item === 'mnPlayB' || item === 'mnPlay') {
      this.playAudio(item === 'mnPlayB');
      return;
    }
    if (item === 'mnStop') {
      this.stopAudio();
      return;
    }
    if (item === 'mnFind' || item === 'mnGotoMeasure') {
      this.updateChrome({
        sidebar: true,
        panelSection: 'navigate',
        navigationTarget: item === 'mnFind' ? 'find' : 'goto',
        navigationRequest: this.chrome.navigationRequest + 1,
      });
      return;
    }
    this.act(() => this.editor.menuShortcut(item), true);
  }


  setTool(tool: EditTool): void {
    if (this.modal) return;
    this.setTouchModifiers({ ctrl: false, shift: false, alt: false });
    this.act(() => this.editor.setTool(tool), true);
  }

  setNTInput(ntInput: boolean): void {
    if (this.modal || ntInput === this.editor.chart.ntInput) return;
    this.setTouchModifiers({ ctrl: false, shift: false, alt: false });
    this.act(() => this.editor.tbNTInputClick(ntInput), true);
  }

  toggleWavIncrease(): void {
    if (this.modal) return;
    this.act(() => this.editor.tbWavIncreaseClick(), true);
  }

  undo(): void {
    if (this.modal) return;
    this.act(() => this.editor.undo(), true);
  }

  redo(): void {
    if (this.modal) return;
    this.act(() => this.editor.redo(), true);
  }

  clipboardEvent(op: ClipboardOp, event: ClipboardEventLike): void {
    if (this.modal) return;
    const clipboard = eventClipboard(event, this.deps.clipboard);
    this.act(() => this.editor.clipboardOp(op, clipboard), true);
  }

  async menuClipboard(op: ClipboardOp): Promise<void> {
    if (this.modal) return;
    const doc = this.editor.doc;
    const access = this.deps.clipboard;
    const text = op === 'paste' ? await access.read() : '';
    if (this.modal || doc !== this.editor.doc) return;
    const clipboard: KeyClipboard = { write: (t) => access.write(t), read: () => text };
    this.act(() => this.editor.clipboardOp(op, clipboard), true);
  }

  selectAll(): void {
    if (this.modal) return;
    this.act(() => this.editor.selectAll(this.lastFocusedArea), true);
  }

  deleteSelected(): void {
    if (this.modal) return;
    this.act(() => this.editor.deleteSelected(this.lastFocusedArea), true);
  }

  setCurrentWav(index: number): void {
    if (this.modal || !this.isListIndex(index)) return;
    this.act(() => {
      this.editor.setWavSelection([index]);
      this.editor.lwavClick();
    }, true);
  }

  setCurrentBmp(index: number): void {
    if (this.modal || !this.isListIndex(index)) return;
    this.act(() => this.editor.setBmpSelection([index]), true);
  }

  private isListIndex(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < maxId(this.editor.chart.base62);
  }

  answerPrompt(answer: string | null): void {
    if (this.editor.pendingPrompt === undefined) return;
    this.act(() => this.editor.answerPrompt(answer), true);
    this.runDeferredUp();
  }

  dismissMessage(): void {
    if (this.messages.length === 0) return;
    this.messages = this.messages.slice(1);
    this.afterInput();
    this.runDeferredUp();
  }

  private get modal(): boolean {
    return (
      this.saving ||
      this.chrome.saveDialog ||
      this.chrome.projectSelection !== undefined ||
      this.closeRequest !== undefined ||
      this.editor.pendingPrompt !== undefined ||
      this.messages.length > 0
    );
  }

  private runDeferredUp(): void {
    const up = this.deferredUp;
    if (this.modal || up === undefined) return;
    this.deferredUp = undefined;
    this.act(() => this.editor.mouseUp(up));
  }


  private act<T>(operation: () => T, user = false): T | undefined {
    const view = this.editor.view;
    const errors = this.editErrors;
    let result: T | undefined;
    let threw = false;
    try {
      result = operation();
    } catch (error) {
      threw = true;
      this.editor.chartChanged();
      this.invalidate(panelIndices, { static: false, dynamic: true });
      this.fail(error, 'edit');
    }
    if (user && !threw && this.editErrors === errors && this.errorSource === 'edit') {
      this.updateChrome(this.clearError('edit'));
    }
    this.viewChanged(view);
    this.afterInput();
    return result;
  }

  private afterInput(): void {
    if (this.preset !== 'theme') this.editor.view = lanePreset(this.editor.view, this.preset);
    this.stashTab();
    this.updateInteraction();
    this.updateChrome(this.editChrome());
    const status = this.editor.status;
    if (status !== this.status && !sameStatus(this.status, status)) {
      this.status = status;
      for (const listener of this.statusListeners) listener();
    }
    this.ensureTimers();
    this.refreshNoteWaves();
  }


  private updateInteraction(): void {
    const next = this.editor.interaction(this.pointerClient);
    if (changesDynamicLayer(this.interaction, next)) {
      this.invalidate(panelIndices, { static: false, dynamic: true });
    }
    this.interaction = next;
    this.checkPointerKeys();
  }

  private checkPointerKeys(): void {
    const theme = this.theme;
    if (theme === undefined) return;
    for (const panel of panelIndices) {
      const { width, height } = this.editor.panelSizes[panel];
      if (this.attached[panel] === undefined || width <= 0 || height <= 0) continue;
      const key = staticPointerKey(this.scene(panel, theme));
      if (key === this.pointerKeys[panel]) continue;
      this.pointerKeys[panel] = key;
      this.invalidate([panel], { static: true, dynamic: false });
    }
  }

  private scene(panel: PanelIndex, theme: Theme): PanelScene {
    const editor = this.editor;
    const { width, height } = editor.panelSizes[panel];
    const interaction = this.interaction;
    return {
      chart: editor.chart,
      theme,
      view: editor.view,
      panel,
      width,
      height,
      pixelRatio: this.pixelRatio,
      playback: this.chrome.audio.kind === 'playing',
      errorIcons: this.errorIcons,
      colorOverrides: this.colorTable,
      audio: this.audioEngine
        ? {
            options: this.chrome.audio.wave,
            wave: this.audioEngine.wave,
            wavePosition: this.audioEngine.waveformPosition(editor.chart),
            notes: this.audioEngine.noteWaves,
            audition: this.auditionLine,
          }
        : undefined,
      interaction: this.chrome.audioLocked
        ? { ...interaction, kMouseOver: -1, shouldDrawTempNote: false, mouseMoveStatus: undefined }
        : interaction,
      focusPanelHeight: editor.panelSizes[editor.view.focus].height,
      clientOrigin: interaction.middleButtonClicked
        ? this.attached[panel]?.host.clientOrigin?.()
        : undefined,
    };
  }


  private ensureTimers(): void {
    const { drag } = this.editor;
    const on = drag.timer1 || drag.timerMiddle;
    if (!on) {
      if (this.timerHandle !== undefined) this.deps.cancelFrame(this.timerHandle);
      this.timerHandle = undefined;
      return;
    }
    if (this.timerHandle !== undefined || this.inTimerFrame) return;
    this.timerLast = this.deps.now();
    this.timerCarry = 0;
    this.timerHandle = this.deps.requestFrame(this.timerFrame);
  }

  private readonly timerFrame = (time: number): void => {
    this.timerHandle = undefined;
    const { ticks, carryMs } = timerTicks(this.timerCarry, time - this.timerLast);
    this.timerLast = time;
    this.timerCarry = carryMs;
    const editor = this.editor;
    this.inTimerFrame = true;
    try {
      for (let i = 0; i < ticks && !this.modal; i++) {
        const modifiers = editor.edit.modifiers;
        if (editor.drag.timer1) this.act(() => editor.tickTimer1(modifiers));
        if (editor.drag.timerMiddle) {
          const cursor = this.interaction.cursorPosition;
          this.act(() => editor.tickTimerMiddle(cursor, modifiers));
        }
      }
    } finally {
      this.inTimerFrame = false;
    }
    const { drag } = editor;
    if ((drag.timer1 || drag.timerMiddle) && this.timerHandle === undefined) {
      this.timerHandle = this.deps.requestFrame(this.timerFrame);
    }
  };


  attachPanel(panel: PanelIndex, host: PanelHost): () => void {
    this.attached[panel]?.renderer.dispose();
    let renderer: PanelRenderer;
    try {
      renderer = this.deps.createRenderer(host.staticCanvas, host.dynamicCanvas, {
        onError: (error) => this.fail(error),
      });
    } catch (error) {
      this.fail(error);
      return () => {};
    }
    const entry: AttachedPanel = { host, renderer };
    this.attached[panel] = entry;
    this.invalidate([panel]);
    return () => {
      if (this.attached[panel] !== entry) return;
      this.attached[panel] = undefined;
      renderer.dispose();
    };
  }

  resizePanel(panel: PanelIndex, width: number, height: number): void {
    const sizes = this.editor.panelSizes;
    const size = sizes[panel];
    if (size.width === width && size.height === height) return;
    sizes[panel] = { width, height };
    this.setView(pMainInResize(this.editor.view, panel, width));
    this.invalidate([panel]);
    this.checkPointerKeys();
  }

  setPixelRatio(pixelRatio: number): void {
    if (pixelRatio === this.pixelRatio) return;
    this.pixelRatio = pixelRatio;
    this.invalidate(panelIndices);
  }

  private invalidate(
    panels: readonly PanelIndex[],
    layers: Dirty = { static: true, dynamic: true },
  ) {
    if (panels.length === 0) return;
    for (const panel of panels) {
      const dirty = this.dirty[panel]!;
      dirty.static ||= layers.static;
      dirty.dynamic ||= layers.dynamic;
    }
    this.frameHandle ??= this.deps.requestFrame(this.flush);
  }

  private resync(panel: PanelIndex): void {
    this.dirty[panel]!.sync = true;
    this.frameHandle ??= this.deps.requestFrame(this.flush);
  }

  private panelScroll(panel: PanelIndex): PanelScroll {
    const { chart, view, panelSizes } = this.editor;
    const { width, height } = panelSizes[panel];
    const { vScroll, hScroll } = view.panels[panel];
    return {
      panel,
      vRange: vScrollRange(
        this.audioExtent > chart.greatestVPosition ? this.audioScrollChart() : chart,
        height,
      ),
      vScroll,
      hRange: hScrollRange(view, width),
      hScroll,
    };
  }

  private readonly flush = (time: number): void => {
    this.frameHandle = undefined;
    const drawn: { panel: PanelIndex; staticMs: number; dynamicMs: number }[] = [];
    for (const panel of panelIndices) {
      const dirty = this.dirty[panel]!;
      if (!dirty.static && !dirty.dynamic && dirty.sync !== true) continue;
      const attached = this.attached[panel];
      if (attached === undefined) continue;
      const layers = { static: dirty.static, dynamic: dirty.dynamic };
      dirty.static = false;
      dirty.dynamic = false;
      dirty.sync = false;
      const { width, height } = this.editor.panelSizes[panel];
      if (
        this.theme !== undefined &&
        width > 0 &&
        height > 0 &&
        (layers.static || layers.dynamic)
      ) {
        try {
          const ms = attached.renderer.draw(this.scene(panel, this.theme), layers);
          drawn.push({ panel, staticMs: ms.staticMs, dynamicMs: ms.dynamicMs });
        } catch (error) {
          this.fail(error);
        }
      }
      attached.host.sync?.(this.panelScroll(panel));
    }
    if (drawn.length === 0) return;
    const stats: FrameStats = { time, panels: drawn };
    for (const listener of this.frameListeners) listener(stats);
  };

  dispose(): void {
    this.projectAbort?.abort();
    this.stopAudio();
    this.audioEngine?.dispose();
    if (this.frameHandle !== undefined) this.deps.cancelFrame(this.frameHandle);
    if (this.timerHandle !== undefined) this.deps.cancelFrame(this.timerHandle);
    this.frameHandle = undefined;
    this.timerHandle = undefined;
    for (const panel of panelIndices) {
      this.attached[panel]?.renderer.dispose();
      this.attached[panel] = undefined;
    }
  }
}
