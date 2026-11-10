import type { ReadonlyChart } from '../../core/model/chart.ts';
import { getMaxVPosition } from '../../core/model/measure.ts';
import { cint } from '../../core/vb.ts';
import type { Theme } from '../../settings/theme-loader.ts';
import type { Interaction, PanelPoint } from '../interaction.ts';
import type { EditorView, PanelIndex } from '../view.ts';
import { createNoteDrawer, drawNotes } from './notes.ts';
import { drawAudioBackground, drawNoteWaveforms, type AudioVisual } from './audio.ts';
import {
  drawClickAndScroll,
  drawMouseOver,
  drawSelectionBox,
  drawTempNote,
  drawTimeSelection,
} from './overlays.ts';
import { Painter, releaseContextCache } from './paint.ts';
import {
  drawBackgroundColor,
  drawBg,
  drawColumnCaptions,
  drawPanelLines,
  pointerHighlightColumn,
  pointerLineRow,
} from './static-layer.ts';

export interface ErrorIcons {
  readonly imageError: CanvasImageSource;
  readonly imageErrorR: CanvasImageSource;
}

export interface PanelScene {
  readonly colorOverrides?: readonly (number | undefined)[];
  readonly chart: ReadonlyChart;
  readonly theme: Theme;
  readonly view: EditorView;
  readonly panel: PanelIndex;
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly playback?: boolean;
  readonly errorIcons?: ErrorIcons | undefined;
  readonly audio?: AudioVisual | undefined;
  readonly interaction?: Interaction | undefined;
  readonly focusPanelHeight?: number | undefined;
  readonly clientOrigin?: PanelPoint | undefined;
}

export interface Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, w: number, h: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  fillText(text: string, x: number, y: number): void;
  drawImage(image: CanvasImageSource, x: number, y: number, w: number, h: number): void;
  measureText(text: string): Pick<TextMetrics, 'fontBoundingBoxAscent' | 'fontBoundingBoxDescent'>;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  fill(): void;
  stroke(): void;
}

export interface PanelFrame {
  readonly xTHeight: number;
  readonly xTWidth: number;
  readonly xPanelHScroll: number;
  readonly xPanelDisplacement: number;
  readonly xVSR: number;
  readonly xVSu: number;
}

export function panelFrame(scene: PanelScene): PanelFrame {
  const { chart, view } = scene;
  const xTHeight = Math.floor(scene.height);
  const xTWidth = Math.floor(scene.width);
  const state = view.panels[scene.panel];
  const xVSR = -state.vScroll;
  const xTop = Math.fround(xVSR + Math.fround(xTHeight / view.gxHeight));
  const xMax = getMaxVPosition(chart);
  return {
    xTHeight,
    xTWidth,
    xPanelHScroll: state.hScroll,
    xPanelDisplacement: state.vScroll,
    xVSR,
    xVSu: cint(xTop > xMax ? xMax : xTop),
  };
}

function playbackScene(input: PanelScene): { scene: PanelScene; offsetY: number } {
  if (!input.playback) return { scene: input, offsetY: 0 };
  const { view, panel } = input;
  const pixels = view.panels[panel].vScroll * view.gxHeight;
  const anchor = Math.ceil(pixels);
  return {
    scene: {
      ...input,
      height: input.height + 1,
      view: {
        ...view,
        panels: view.panels.map((state, i) =>
          i === panel ? { ...state, vScroll: anchor / view.gxHeight } : state,
        ) as unknown as EditorView['panels'],
      },
    },
    offsetY: anchor - pixels - 1,
  };
}

export function drawStaticLayer(ctx: Ctx2D, input: PanelScene): void {
  const { scene, offsetY } = playbackScene(input);
  const frame = panelFrame(scene);
  const painter = new Painter(ctx, scene.pixelRatio, frame.xTWidth, frame.xTHeight);
  drawBg(painter, scene, frame);
  drawBackgroundColor(painter, scene, frame);
  painter.setOffsetY(offsetY);
  drawPanelLines(painter, scene, frame);
  painter.setOffsetY(0);
  drawColumnCaptions(painter, scene, frame);
}

export function staticPointerKey(scene: PanelScene): string {
  if (scene.interaction?.mouseMoveStatus === undefined) return '';
  const frame = panelFrame(scene);
  const column = pointerHighlightColumn(scene, frame);
  const row = pointerLineRow(scene, frame)!;
  return `${column}|${row >= 0 && row < frame.xTHeight ? row : -1}`;
}

export function drawDynamicLayer(
  ctx: Ctx2D,
  input: PanelScene,
  onError?: (error: unknown) => void,
): void {
  const { scene, offsetY } = playbackScene(input);
  const frame = panelFrame(scene);
  const painter = new Painter(ctx, scene.pixelRatio, frame.xTWidth, frame.xTHeight);
  painter.setOffsetY(offsetY);
  let firstError: { error: unknown } | undefined;
  const overlay = (draw: () => void): void => {
    try {
      draw();
    } catch (error) {
      firstError ??= { error };
    }
  };
  overlay(() => drawAudioBackground(painter, scene));
  const skipped = drawNotes(painter, scene, frame);
  firstError ??= skipped;
  overlay(() => drawNoteWaveforms(painter, scene));
  const i = scene.interaction;
  if (i !== undefined) {
    const { chart } = scene;
    overlay(() => drawSelectionBox(painter, scene));
    if (i.tool === 'select' && i.kMouseOver !== -1 && i.kMouseOver <= chart.notes.length - 1) {
      overlay(() => drawMouseOver(painter, scene, frame, createNoteDrawer(painter, scene, frame)));
    }
    if (i.shouldDrawTempNote && i.selectedColumn > -1 && i.tempVPosition > -1) {
      overlay(() => drawTempNote(painter, scene, frame));
    }
    if (i.tool === 'timeSelect') overlay(() => drawTimeSelection(painter, scene, frame));
    if (i.middleButtonClicked) overlay(() => drawClickAndScroll(painter, scene));
  }
  if (firstError !== undefined) onError?.(firstError.error);
}

export interface PanelRendererOptions {
  readonly onError?: (error: unknown) => void;
}

export interface DrawTimings {
  readonly staticMs: number;
  readonly dynamicMs: number;
}

export interface PanelRenderer {
  draw(
    scene: PanelScene,
    dirty: { readonly static: boolean; readonly dynamic: boolean },
  ): DrawTimings;
  dispose(): void;
}

export function createPanelRenderer(
  staticCanvas: HTMLCanvasElement,
  dynamicCanvas: HTMLCanvasElement,
  options: PanelRendererOptions = {},
): PanelRenderer {
  const staticCtx = staticCanvas.getContext('2d', { alpha: false });
  const dynamicCtx = dynamicCanvas.getContext('2d');
  if (staticCtx === null || dynamicCtx === null) throw new Error('Canvas 2D is not available');
  let disposed = false;
  let lastScene: PanelScene | undefined;
  let lastPointerKey: string | undefined;

  const resize = (canvas: HTMLCanvasElement, width: number, height: number): boolean => {
    if (canvas.width === width && canvas.height === height) return false;
    canvas.width = width;
    canvas.height = height;
    return true;
  };

  const restored = (ctx: Ctx2D, dirty: { static: boolean; dynamic: boolean }): void => {
    releaseContextCache(ctx);
    if (lastScene === undefined) return;
    try {
      renderer.draw(lastScene, dirty);
    } catch (error) {
      options.onError?.(error);
    }
  };
  const staticRestored = (): void => restored(staticCtx, { static: true, dynamic: false });
  const dynamicRestored = (): void => restored(dynamicCtx, { static: false, dynamic: true });
  staticCanvas.addEventListener('contextrestored', staticRestored);
  dynamicCanvas.addEventListener('contextrestored', dynamicRestored);

  const renderer: PanelRenderer = {
    draw(scene, dirty) {
      if (disposed) return { staticMs: 0, dynamicMs: 0 };
      lastScene = scene;
      const width = Math.round(scene.width * scene.pixelRatio);
      const height = Math.round(scene.height * scene.pixelRatio);
      const staticResized = resize(staticCanvas, width, height);
      const dynamicResized = resize(dynamicCanvas, width, height);

      let staticMs = 0;
      const pointerKey = staticPointerKey(scene);
      if (dirty.static || staticResized || pointerKey !== lastPointerKey) {
        const start = performance.now();
        lastPointerKey = pointerKey;
        drawStaticLayer(staticCtx, scene);
        staticMs = performance.now() - start;
      }
      let dynamicMs = 0;
      if (dirty.dynamic || dynamicResized) {
        const start = performance.now();
        dynamicCtx.setTransform(1, 0, 0, 1, 0, 0);
        dynamicCtx.clearRect(0, 0, width, height);
        drawDynamicLayer(dynamicCtx, scene, options.onError);
        dynamicMs = performance.now() - start;
      }
      return { staticMs, dynamicMs };
    },
    dispose() {
      disposed = true;
      lastScene = undefined;
      staticCanvas.removeEventListener('contextrestored', staticRestored);
      dynamicCanvas.removeEventListener('contextrestored', dynamicRestored);
      releaseContextCache(staticCtx);
      releaseContextCache(dynamicCtx);
    },
  };
  return renderer;
}
