export const wheelDelta = 120;

export const domDeltaPixel = 0;
export const domDeltaLine = 1;
export const domDeltaPage = 2;

export const pixelsPerNotch = 100;

export const linesPerNotch = 3;

export function wheelEventDelta(deltaY: number, deltaMode: number): number {
  switch (deltaMode) {
    case domDeltaLine:
      return (-deltaY * wheelDelta) / linesPerNotch;
    case domDeltaPage:
      return -deltaY * wheelDelta;
    default:
      return (-deltaY * wheelDelta) / pixelsPerNotch;
  }
}

export class WheelAccumulator {
  private rest = 0;

  add(deltaY: number, deltaMode: number): number {
    const delta = wheelEventDelta(deltaY, deltaMode);
    if (!Number.isFinite(delta) || delta === 0) return 0;
    if (Math.sign(delta) !== Math.sign(this.rest)) this.rest = 0;
    this.rest += delta;
    const notches = Math.trunc(this.rest / wheelDelta) || 0;
    this.rest -= notches * wheelDelta;
    return notches;
  }

  reset(): void {
    this.rest = 0;
  }
}
