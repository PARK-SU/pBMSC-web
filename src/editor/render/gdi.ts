export interface PixelSink {
  fillRect(x: number, y: number, w: number, h: number): void;
}

const single = Math.fround;

export function fillEdge(c: number): number {
  return Math.ceil(Math.floor(c * 16 + 0.5) / 16) + 0;
}

export function penPixel(c: number): number {
  return Math.ceil(Math.floor(c * 256 + 0.5) / 256 - 0.5) + 0;
}

export function fillRectangle(sink: PixelSink, x: number, y: number, w: number, h: number): void {
  if (!(w > 0 && h > 0)) return;
  const x0 = fillEdge(x);
  const y0 = fillEdge(y);
  const x1 = fillEdge(single(x + w));
  const y1 = fillEdge(single(y + h));
  if (x1 > x0 && y1 > y0) sink.fillRect(x0, y0, x1 - x0, y1 - y0);
}

export function drawRectangle(sink: PixelSink, x: number, y: number, w: number, h: number): void {
  if (!(w > 0 && h > 0)) return;
  const left = penPixel(x);
  const top = penPixel(y);
  const right = penPixel(single(x + w));
  const bottom = penPixel(single(y + h));
  const width = right - left + 1;
  sink.fillRect(left, top, width, 1);
  if (bottom === top) return;
  sink.fillRect(left, bottom, width, 1);
  if (bottom - top < 2) return;
  sink.fillRect(left, top + 1, 1, bottom - top - 1);
  if (right !== left) sink.fillRect(right, top + 1, 1, bottom - top - 1);
}

export function drawHorizontalLine(sink: PixelSink, x0: number, x1: number, y: number): void {
  const left = penPixel(x0);
  sink.fillRect(left, penPixel(y), penPixel(x1) - left + 1, 1);
}

export function drawVerticalLine(sink: PixelSink, x: number, y0: number, y1: number): void {
  const top = penPixel(y0);
  sink.fillRect(penPixel(x), top, 1, penPixel(y1) - top + 1);
}

export function gradientPoint(c: number): number {
  return c + 0.5;
}

export function gradientT(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  i: number,
  j: number,
): number {
  const dx = p2x - p1x;
  const dy = p2y - p1y;
  return ((i - p1x) * dx + (j - p1y) * dy) / (dx * dx + dy * dy);
}

export function checkLinearGradientPoints(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
): void {
  if (p1x === p2x && p1y === p2y) {
    throw new Error(
      `LinearGradientBrush: both points are (${p1x}, ${p1y}) (GDI+ OutOfMemoryException)`,
    );
  }
}
