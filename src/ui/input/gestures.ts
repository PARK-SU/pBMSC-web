import { cint } from '../../core/vb.ts';
import {
  hScrollRange,
  setGxHeight,
  setPanelHScroll,
  setPanelVScroll,
  vScrollMinimum,
  type EditorView,
  type PanelIndex,
  type ScrollChart,
} from '../../editor/view.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface PanelScrollState {
  readonly gxHeight: number;
  readonly vScroll: number;
  readonly hScroll: number;
}

export interface PinchPanStart extends PanelScrollState {
  readonly centre: Point;
  readonly distance: number;
}

export interface PinchPanMove {
  readonly start: PinchPanStart;
  readonly centre: Point;
  readonly distance: number;
  readonly zooming: boolean;
}

export const pinchThreshold = 0.1;

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class PinchPanTracker {
  private readonly points = new Map<number, Point>();
  private start: PinchPanStart | undefined;
  private zooming = false;
  get paired(): boolean {
    return this.start !== undefined;
  }
  tracks(id: number): boolean {
    return this.points.has(id);
  }

  down(id: number, point: Point, state: PanelScrollState): void {
    if (this.points.size >= 2 || this.points.has(id)) return;
    this.points.set(id, point);
    const [a, b] = [...this.points.values()];
    if (a !== undefined && b !== undefined) {
      this.zooming = false;
      this.start = {
        gxHeight: state.gxHeight,
        vScroll: state.vScroll,
        hScroll: state.hScroll,
        centre: midpoint(a, b),
        distance: distance(a, b),
      };
    }
  }

  move(id: number, point: Point): PinchPanMove | undefined {
    if (!this.points.has(id)) return undefined;
    this.points.set(id, point);
    const start = this.start;
    const [a, b] = [...this.points.values()];
    if (start === undefined || a === undefined || b === undefined) return undefined;
    return { start, centre: midpoint(a, b), distance: distance(a, b), zooming: this.zooming };
  }

  checkPinch(): void {
    const start = this.start;
    const [a, b] = [...this.points.values()];
    if (this.zooming || start === undefined || a === undefined || b === undefined) return;
    const spread = distance(a, b);
    if (start.distance > 0 && Math.abs(spread / start.distance - 1) > pinchThreshold) {
      this.zooming = true;
      this.start = { ...start, distance: spread };
    }
  }

  up(id: number): void {
    if (!this.points.delete(id)) return;
    this.start = undefined;
    this.zooming = false;
  }
}

export function pinchZoom(start: PinchPanStart, spread: number): number {
  return Math.round(((start.gxHeight * spread) / start.distance) * 100) / 100;
}

export function applyPinchPan(
  chart: ScrollChart,
  view: EditorView,
  panel: PanelIndex,
  move: PinchPanMove,
  panelWidth: number,
  panelHeight: number,
): EditorView {
  const { start, centre } = move;
  let next = view;
  if (move.zooming && start.distance > 0) next = setGxHeight(next, pinchZoom(start, move.distance));

  const vPosition =
    (panelHeight - start.vScroll * start.gxHeight - start.centre.y - 1) / start.gxHeight;
  let xVS = cint((panelHeight - centre.y - 1) / next.gxHeight - vPosition);
  if (xVS > 0) xVS = 0;
  const minimum = vScrollMinimum(chart);
  if (xVS < minimum) xVS = minimum;
  next = setPanelVScroll(chart, next, panel, xVS);

  let xHS = cint(
    Math.fround(start.hScroll + Math.fround((start.centre.x - centre.x) / next.gxWidth)),
  );
  if (xHS < 0) xHS = 0;
  const { userMaximum } = hScrollRange(next, panelWidth);
  if (xHS > userMaximum) xHS = userMaximum;
  return setPanelHScroll(next, panel, xHS);
}
