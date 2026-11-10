import {
  buttonsFromDom,
  type MouseButtonsFlags,
  type PanelMouseEvent,
} from '../../editor/input/events.ts';
import type { KeyModifiers } from '../../editor/input/modifiers.ts';
import type { PanelPoint } from '../../editor/edit-state.ts';
import type { PanelIndex } from '../../editor/view.ts';

export interface PointerEventLike {
  readonly type: string;
  readonly pointerId: number;
  readonly pointerType: string;
  readonly buttons: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly timeStamp: number;
}

export interface PanelPointerEvent {
  readonly kind: 'down' | 'move' | 'up';
  readonly event: PanelMouseEvent;
}

export const doubleClickTime = 500;

export const doubleClickSize = 4;

export class ClickCounter {
  private last:
    { button: MouseButtonsFlags; x: number; y: number; time: number; clicks: 1 | 2 } | undefined;

  down(button: MouseButtonsFlags, x: number, y: number, time: number): 1 | 2 {
    const last = this.last;
    const half = doubleClickSize / 2;
    const clicks: 1 | 2 =
      last !== undefined &&
      last.clicks === 1 &&
      last.button === button &&
      time - last.time <= doubleClickTime &&
      Math.abs(x - last.x) <= half &&
      Math.abs(y - last.y) <= half
        ? 2
        : 1;
    this.last = { button, x, y, time, clicks };
    return clicks;
  }
}

const domButtonBits = [1, 2, 4, 8, 16] as const;

export class PanelPointerInput {
  private heldBits = 0;
  private pointerId: number | undefined;
  private last: { x: number; y: number; client: PanelPoint } | undefined;
  private readonly clicks = new ClickCounter();
  private readonly panel: PanelIndex;

  constructor(panel: PanelIndex) {
    this.panel = panel;
  }

  get held(): number {
    return this.heldBits;
  }

  handle(e: PointerEventLike, origin: PanelPoint, modifiers: KeyModifiers): PanelPointerEvent[] {
    if (e.pointerType === 'touch') return [];
    if (this.heldBits !== 0 && e.pointerId !== this.pointerId) return [];

    const x = Math.floor(e.clientX - origin.x);
    const y = Math.floor(e.clientY - origin.y);
    const client = { x: Math.floor(e.clientX), y: Math.floor(e.clientY) };
    const at = (button: MouseButtonsFlags, clicks: 0 | 1 | 2, p = { x, y, client }) => ({
      panel: this.panel,
      x: p.x,
      y: p.y,
      button,
      clicks,
      client: p.client,
      modifiers,
    });
    const events: PanelPointerEvent[] = [];

    if (e.type === 'pointercancel' || e.type === 'lostpointercapture') {
      const p = this.last ?? { x, y, client };
      for (const bit of domButtonBits) {
        if ((this.heldBits & bit) !== 0) {
          events.push({ kind: 'up', event: at(buttonsFromDom(bit), 1, p) });
        }
      }
      this.heldBits = 0;
      this.pointerId = undefined;
      return events;
    }

    const bits = e.buttons & 31;
    const moved = this.last === undefined || this.last.x !== x || this.last.y !== y;
    if (e.type === 'pointermove' && (bits === this.heldBits || moved)) {
      events.push({ kind: 'move', event: at(buttonsFromDom(this.heldBits), 0) });
    }
    if (bits !== this.heldBits) {
      const released = this.heldBits & ~bits;
      const pressed = bits & ~this.heldBits;
      for (const bit of domButtonBits) {
        if ((released & bit) !== 0) events.push({ kind: 'up', event: at(buttonsFromDom(bit), 1) });
      }
      for (const bit of domButtonBits) {
        if ((pressed & bit) === 0) continue;
        const button = buttonsFromDom(bit);
        const clicks = this.clicks.down(button, client.x, client.y, e.timeStamp);
        events.push({ kind: 'down', event: at(button, clicks) });
      }
    }
    if (bits !== 0 && this.heldBits === 0) this.pointerId = e.pointerId;
    if (bits === 0) this.pointerId = undefined;
    this.heldBits = bits;
    this.last = { x, y, client };
    return events;
  }
}
