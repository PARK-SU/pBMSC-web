import { cint } from '../../core/vb.ts';
import { mouseMoveStatusPoint, type PanelPoint } from '../edit-state.ts';
import { vScrollMinimum } from '../view.ts';
import {
  draftSetHScroll,
  draftSetVScroll,
  hScrollUserMaximum,
  mouseButtons,
  runInput,
  type InputContext,
  type InputDraft,
  type InputResult,
} from './events.ts';
import type { KeyModifiers } from './modifiers.ts';
import { mouseMove } from './mouse.ts';

export const timerTickMs = 1000 / 64;

export function timerTicks(
  carryMs: number,
  elapsedMs: number,
  maxTicks = 4,
): { ticks: number; carryMs: number } {
  const total = carryMs + Math.max(0, elapsedMs);
  const ticks = Math.trunc(total / timerTickMs);
  if (ticks > maxTicks) return { ticks: maxTicks, carryMs: 0 };
  return { ticks, carryMs: total - ticks * timerTickMs };
}

function scrollFocusedPanel(d: InputDraft, dy: number, dx: number, modifiers: KeyModifiers): void {
  const focus = d.view.focus;

  let xI1 = cint(d.view.panels[focus].vScroll + dy);
  if (xI1 > 0) xI1 = 0;
  const minimum = vScrollMinimum(d.chart);
  if (xI1 < minimum) xI1 = minimum;
  draftSetVScroll(d, focus, xI1, modifiers);

  xI1 = cint(d.view.panels[focus].hScroll + dx);
  const userMaximum = hScrollUserMaximum(d, focus);
  if (xI1 > userMaximum) xI1 = userMaximum;
  if (xI1 < 0) xI1 = 0;
  draftSetHScroll(d, focus, xI1);
}

export function timer1Tick(ctx: InputContext, modifiers: KeyModifiers): InputResult {
  return runInput(ctx, (d) => {
    if (!d.drag.timer1) return;
    d.edit.modifiers = modifiers;
    const { tempX, tempY } = d.drag.temp;
    scrollFocusedPanel(d, tempY / 5 / d.view.gxHeight, tempX / 10 / d.view.gxWidth, modifiers);

    const p = mouseMoveStatusPoint(d.edit);
    mouseMove(d, {
      panel: d.view.focus,
      x: p.x,
      y: p.y,
      button: mouseButtons.left,
      clicks: 0,
      client: p,
      modifiers,
    });
  });
}

export function timerMiddleTick(
  ctx: InputContext,
  cursor: PanelPoint,
  modifiers: KeyModifiers,
): InputResult {
  return runInput(ctx, (d) => {
    if (!d.drag.timerMiddle) return;
    if (!d.edit.middleButtonClicked) {
      d.drag.timerMiddle = false;
      return;
    }
    d.edit.modifiers = modifiers;
    const origin = d.edit.middleButtonLocation;
    scrollFocusedPanel(
      d,
      (cursor.y - origin.y) / 5 / d.view.gxHeight,
      (cursor.x - origin.x) / 5 / d.view.gxWidth,
      modifiers,
    );

    const p = mouseMoveStatusPoint(d.edit);
    mouseMove(d, {
      panel: d.view.focus,
      x: p.x,
      y: p.y,
      button: mouseButtons.none,
      clicks: 0,
      client: cursor,
      modifiers,
    });
  });
}
