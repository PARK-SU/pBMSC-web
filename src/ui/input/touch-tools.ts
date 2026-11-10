import type { Point } from './gestures.ts';

export interface TouchToolHost {
  context?(): unknown;
  begin(): void;
  send(kind: 'down' | 'move' | 'up', point: Point, right: boolean, clicks: 1 | 2): void;
  finish(cancel: boolean): void;
}

export class TouchTools {
  private readonly fingers = new Set<number>();
  private single:
    { id: number; start: Point; point: Point; active: boolean; consumed: boolean } | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastTap: { point: Point; time: number; context: unknown } | undefined;

  private readonly host: TouchToolHost;
  constructor(host: TouchToolHost) {
    this.host = host;
  }

  down(id: number, point: Point): void {
    this.fingers.add(id);
    this.clearTimer();
    if (this.fingers.size !== 1) {
      this.cancel();
      this.lastTap = undefined;
      return;
    }
    this.single = { id, start: point, point, active: false, consumed: false };
    this.timer = setTimeout(() => {
      const single = this.single;
      if (single === undefined || single.active || single.consumed) return;
      this.host.begin();
      this.host.send('down', single.start, true, 1);
      this.host.send('up', single.start, true, 1);
      this.host.finish(false);
      single.consumed = true;
      this.lastTap = undefined;
    }, 500);
  }

  move(id: number, point: Point): void {
    const single = this.single;
    if (single === undefined || single.id !== id || single.consumed) return;
    single.point = point;
    if (!single.active && Math.hypot(point.x - single.start.x, point.y - single.start.y) > 8) {
      this.clearTimer();
      single.active = true;
      this.host.begin();
      this.host.send('down', single.start, false, 1);
    }
    if (single.active) this.host.send('move', point, false, 1);
  }

  up(id: number, point: Point, cancelled = false): void {
    this.fingers.delete(id);
    const single = this.single;
    if (single === undefined || single.id !== id) return;
    this.clearTimer();
    if (cancelled) {
      this.cancel();
      return;
    }
    if (!single.consumed) {
      if (!single.active) {
        const last = this.lastTap;
        const now = performance.now();
        const context = this.host.context?.();
        const twice =
          last !== undefined &&
          last.context === context &&
          now - last.time < 400 &&
          Math.hypot(point.x - last.point.x, point.y - last.point.y) < 24;
        this.host.begin();
        this.host.send('down', point, false, twice ? 2 : 1);
        this.lastTap = twice ? undefined : { point, time: now, context };
      } else this.lastTap = undefined;
      this.host.send('up', point, false, 1);
      this.host.finish(false);
    }
    this.single = undefined;
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private cancel(): void {
    this.clearTimer();
    if (this.single?.active) this.host.finish(true);
    this.single = undefined;
  }

  dispose(): void {
    this.cancel();
    this.fingers.clear();
  }
}
