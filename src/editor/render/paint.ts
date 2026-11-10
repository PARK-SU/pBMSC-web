import { argbToCss, cssFont, fontSizePx, type ThemeFont } from '../../settings/theme-loader.ts';
import {
  drawRectangle,
  fillEdge,
  fillRectangle,
  gradientPoint,
  gradientT,
  type PixelSink,
} from './gdi.ts';
import type { Ctx2D } from './renderer.ts';


const cssColors = new Map<number, string>();
const cssColorLimit = 4096;

export function cssColor(argb: number): string {
  let css = cssColors.get(argb);
  if (css === undefined) {
    if (cssColors.size >= cssColorLimit) cssColors.clear();
    css = argbToCss(argb);
    cssColors.set(argb, css);
  }
  return css;
}

const cssFonts = new WeakMap<Readonly<ThemeFont>, string>();

export function themeCssFont(font: Readonly<ThemeFont>): string {
  let css = cssFonts.get(font);
  if (css === undefined) {
    css = cssFont(font);
    cssFonts.set(font, css);
  }
  return css;
}


export interface FontMetrics {
  readonly emPx: number;
  readonly ascent: number;
  readonly lineSpacing: number;
  readonly height: number;
}

function measureFont(ctx: Ctx2D, font: Readonly<ThemeFont>): FontMetrics {
  const emPx = fontSizePx(font);
  const textMetrics = ctx.measureText('0');
  const fontAscent = textMetrics.fontBoundingBoxAscent as number | undefined;
  const fontDescent = textMetrics.fontBoundingBoxDescent as number | undefined;
  const hasMetrics =
    typeof fontAscent === 'number' &&
    typeof fontDescent === 'number' &&
    fontAscent > 0 &&
    fontDescent >= 0;
  const ascent = hasMetrics ? fontAscent : 0.8 * emPx;
  const lineSpacing = hasMetrics ? fontAscent + fontDescent : 1.2 * emPx;
  return { emPx, ascent, lineSpacing, height: Math.ceil(lineSpacing) };
}

const lineBreak = /\r\n|\r|\n/;

const tileEdge = 1e-6;

const single = Math.fround;

export interface TwoColorGradient {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly from: number;
  readonly to: number;
}

const aaGradientStops = 16;

function lerpArgb(from: number, to: number, t: number): number {
  const mix = (shift: number): number => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * t);
  };
  return (mix(24) << 24) | (mix(16) << 16) | (mix(8) << 8) | mix(0);
}


interface ContextCache {
  readonly gradients: Map<number, Map<number, Map<number, CanvasGradient>>>;
  gradientCount: number;
  readonly fonts: Map<string, FontMetrics>;
}

const contextCaches = new WeakMap<Ctx2D, ContextCache>();
const gradientLimit = 2048;

function contextCache(ctx: Ctx2D): ContextCache {
  let cache = contextCaches.get(ctx);
  if (cache === undefined) {
    cache = { gradients: new Map(), gradientCount: 0, fonts: new Map() };
    contextCaches.set(ctx, cache);
  }
  return cache;
}

export function releaseContextCache(ctx: Ctx2D): void {
  contextCaches.delete(ctx);
}

function gradientShape(dx: number, dy: number): number | undefined {
  if (dx <= -32768 || dx >= 32768 || dy <= -32768 || dy >= 32768) return undefined;
  return (dx + 32768) * 65536 + (dy + 32768);
}


export class Painter implements PixelSink {
  private readonly cache: ContextCache;
  private fill: string | CanvasGradient | undefined;
  private font: string | undefined;
  private offsetY = 0;

  readonly ctx: Ctx2D;
  readonly pixelRatio: number;
  readonly width: number;
  readonly height: number;

  constructor(ctx: Ctx2D, pixelRatio: number, width: number, height: number) {
    this.ctx = ctx;
    this.pixelRatio = pixelRatio;
    this.width = width;
    this.height = height;
    this.cache = contextCache(ctx);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.textBaseline = 'alphabetic';
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.ctx.fillRect(x, y, w, h);
  }

  setOffsetY(value: number): void {
    this.offsetY = value;
    const pr = this.pixelRatio;
    this.ctx.setTransform(pr, 0, 0, pr, 0, value * pr);
  }

  private setFill(style: string | CanvasGradient): void {
    if (style !== this.fill) {
      this.ctx.fillStyle = style;
      this.fill = style;
    }
  }

  solid(argb: number): void {
    this.setFill(cssColor(argb));
  }

  fillRectangle(argb: number, x: number, y: number, w: number, h: number): void {
    if (!(w > 0 && h > 0)) return;
    this.solid(argb);
    fillRectangle(this, x, y, w, h);
  }

  drawRectangle(argb: number, x: number, y: number, w: number, h: number): void {
    if (!(w > 0 && h > 0)) return;
    this.solid(argb);
    drawRectangle(this, x, y, w, h);
  }

  gradientRectangle(
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    bright: number,
    dark: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    if (!(w > 0 && h > 0)) return;
    const x0 = Math.max(0, fillEdge(x));
    const y0 = Math.max(0, fillEdge(y));
    const x1 = Math.min(this.width, fillEdge(single(x + w)));
    const y1 = Math.min(this.height, fillEdge(single(y + h)));
    if (x1 <= x0 || y1 <= y0) return;

    const t00 = gradientT(p1x, p1y, p2x, p2y, x0, y0);
    const t10 = gradientT(p1x, p1y, p2x, p2y, x1 - 1, y0);
    const t01 = gradientT(p1x, p1y, p2x, p2y, x0, y1 - 1);
    const t11 = gradientT(p1x, p1y, p2x, p2y, x1 - 1, y1 - 1);
    const tMin = Math.min(t00, t10, t01, t11);
    const tMax = Math.max(t00, t10, t01, t11);
    const dx = p2x - p1x;
    const dy = p2y - p1y;
    this.setFill(
      tMin >= 0 && tMax < 1
        ? this.gradient(bright, dark, dx, dy)
        : this.tiledGradient(bright, dark, dx, dy, Math.floor(tMin), Math.floor(tMax) + 1),
    );
    const pr = this.pixelRatio;
    this.ctx.setTransform(pr, 0, 0, pr, p1x * pr, (p1y + this.offsetY) * pr);
    this.ctx.fillRect(x0 - p1x, y0 - p1y, x1 - x0, y1 - y0);
    this.ctx.setTransform(pr, 0, 0, pr, 0, this.offsetY * pr);
  }

  private gradient(bright: number, dark: number, dx: number, dy: number): CanvasGradient {
    const shape = gradientShape(dx, dy);
    const { gradients } = this.cache;
    let byDark = gradients.get(bright);
    let byShape = byDark?.get(dark);
    let gradient = shape === undefined ? undefined : byShape?.get(shape);
    if (gradient !== undefined) return gradient;

    gradient = this.ctx.createLinearGradient(
      gradientPoint(0),
      gradientPoint(0),
      gradientPoint(dx),
      gradientPoint(dy),
    );
    gradient.addColorStop(0, cssColor(bright));
    gradient.addColorStop(1, cssColor(dark));
    if (shape === undefined) return gradient;

    if (this.cache.gradientCount >= gradientLimit) {
      gradients.clear();
      this.cache.gradientCount = 0;
      byDark = undefined;
      byShape = undefined;
    }
    if (byDark === undefined) {
      byDark = new Map();
      gradients.set(bright, byDark);
    }
    if (byShape === undefined) {
      byShape = new Map();
      byDark.set(dark, byShape);
    }
    byShape.set(shape, gradient);
    this.cache.gradientCount++;
    return gradient;
  }

  private tiledGradient(
    bright: number,
    dark: number,
    dx: number,
    dy: number,
    kMin: number,
    kMax: number,
  ): CanvasGradient {
    const gradient = this.ctx.createLinearGradient(
      gradientPoint(kMin * dx),
      gradientPoint(kMin * dy),
      gradientPoint(kMax * dx),
      gradientPoint(kMax * dy),
    );
    const span = kMax - kMin;
    const brightCss = cssColor(bright);
    const darkCss = cssColor(dark);
    for (let k = 0; k < span; k++) {
      gradient.addColorStop(k / span, brightCss);
      gradient.addColorStop(k + 1 < span ? (k + 1 - tileEdge) / span : 1, darkCss);
    }
    return gradient;
  }

  drawImage(image: CanvasImageSource, x: number, y: number, w: number, h: number): void {
    this.ctx.drawImage(image, x, y, w, h);
  }

  fillPolygonAA(points: readonly (readonly [number, number])[], gradient: TwoColorGradient): void {
    const { ctx } = this;
    const css = ctx.createLinearGradient(
      gradient.x0 + 0.5,
      gradient.y0 + 0.5,
      gradient.x1 + 0.5,
      gradient.y1 + 0.5,
    );
    for (let k = 0; k <= aaGradientStops; k++) {
      css.addColorStop(
        k / aaGradientStops,
        cssColor(lerpArgb(gradient.from, gradient.to, k / aaGradientStops)),
      );
    }
    this.setFill(css);
    ctx.beginPath();
    points.forEach(([x, y], k) => {
      if (k === 0) ctx.moveTo(x + 0.5, y + 0.5);
      else ctx.lineTo(x + 0.5, y + 0.5);
    });
    ctx.closePath();
    ctx.fill();
  }

  fillCircleAA(argb: number, cx: number, cy: number, r: number): void {
    const { ctx } = this;
    this.solid(argb);
    ctx.beginPath();
    ctx.arc(cx + 0.5, cy + 0.5, r, 0, 2 * Math.PI);
    ctx.fill();
  }

  drawCircleAA(argb: number, cx: number, cy: number, r: number): void {
    const { ctx } = this;
    ctx.strokeStyle = cssColor(argb);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx + 0.5, cy + 0.5, r, 0, 2 * Math.PI);
    ctx.stroke();
  }

  useFont(font: Readonly<ThemeFont>): FontMetrics {
    const css = themeCssFont(font);
    if (css !== this.font) {
      this.ctx.font = css;
      this.font = css;
    }
    let metrics = this.cache.fonts.get(css);
    if (metrics === undefined) {
      metrics = measureFont(this.ctx, font);
      this.cache.fonts.set(css, metrics);
    }
    return metrics;
  }

  drawString(text: string, font: Readonly<ThemeFont>, argb: number, x: number, y: number): void {
    if (text === '') return;
    const metrics = this.useFont(font);
    this.solid(argb);
    const textX = x + metrics.emPx / 6;
    const baseline = y + metrics.ascent;
    if (!lineBreak.test(text)) {
      this.ctx.fillText(text, textX, baseline);
      return;
    }
    const lines = text.split(lineBreak);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line !== '') this.ctx.fillText(line, textX, baseline + i * metrics.lineSpacing);
    }
  }
}
