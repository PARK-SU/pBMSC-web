import { keyComboOf, modifierKeyKind } from '../../editor/input/keyboard.ts';
import type { PanelIndex } from '../../editor/view.ts';
import { PinchPanTracker, type Point } from '../input/gestures.ts';
import { TouchTools } from '../input/touch-tools.ts';
import { mouseButtons } from '../../editor/input/events.ts';
import { PanelPointerInput } from '../input/pointer.ts';
import { eventModifiers, keyPlatform } from '../input/shortcuts.ts';
import { WheelAccumulator } from '../input/wheel.ts';
import type { ViewerController } from '../viewer/controller.ts';
import { NativeScrollBar } from './scrollbar.ts';

export interface PanelElements {
  readonly root: HTMLElement;
  readonly area: HTMLElement;
  readonly staticCanvas: HTMLCanvasElement;
  readonly dynamicCanvas: HTMLCanvasElement;
  readonly vScrollBar: HTMLElement;
  readonly vSpacer: HTMLElement;
  readonly vThumb: HTMLElement;
  readonly hScrollBar: HTMLElement;
  readonly hSpacer: HTMLElement;
  readonly hThumb: HTMLElement;
}

const middleButton = 1;

export function bindPanel(
  controller: ViewerController,
  panel: PanelIndex,
  elements: PanelElements,
): () => void {
  const { root, area, staticCanvas, dynamicCanvas } = elements;
  const platform = keyPlatform();
  const cleanups: (() => void)[] = [];
  const listen = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void => {
    target.addEventListener(type, listener, options);
    cleanups.push(() => target.removeEventListener(type, listener, options));
  };

  const vBar = new NativeScrollBar(
    elements.vScrollBar,
    elements.vSpacer,
    'vertical',
    (value) => controller.setVScroll(panel, value),
    elements.vThumb,
  );
  const hBar = new NativeScrollBar(
    elements.hScrollBar,
    elements.hSpacer,
    'horizontal',
    (value) => controller.setHScroll(panel, value),
    elements.hThumb,
  );
  cleanups.push(
    () => vBar.dispose(),
    () => hBar.dispose(),
  );
  const syncAudioLock = (): void => {
    const locked = controller.getChrome().audioLocked;
    root.dataset['audioLocked'] = String(locked);
    elements.vScrollBar.setAttribute('aria-disabled', String(locked));
    elements.vScrollBar.style.pointerEvents = locked ? 'none' : '';
  };
  syncAudioLock();
  cleanups.push(controller.subscribe(syncAudioLock));

  const origin = (): Point => {
    const rect = area.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  };

  cleanups.push(
    controller.attachPanel(panel, {
      staticCanvas,
      dynamicCanvas,
      sync(frame) {
        vBar.update(frame.vRange, frame.vScroll);
        hBar.update(frame.hRange, frame.hScroll);
      },
      clientOrigin: origin,
      focusArea: () => area.focus({ preventScroll: true, focusVisible: false }),
    }),
  );

  const resize = (width: number, height: number): void => {
    const w = Math.max(0, Math.ceil(width));
    const h = Math.max(0, Math.ceil(height));
    for (const canvas of [staticCanvas, dynamicCanvas]) {
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    controller.resizePanel(panel, w, h);
  };
  const observer = new ResizeObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (entry !== undefined) resize(entry.contentRect.width, entry.contentRect.height);
  });
  observer.observe(area);
  cleanups.push(() => observer.disconnect());

  const areaPoint = (event: MouseEvent): Point => {
    const { x, y } = origin();
    return { x: event.clientX - x, y: event.clientY - y };
  };

  listen(root, 'pointerdown', () => controller.focusPanel(panel), { capture: true });
  listen(root, 'focusin', () => controller.focusPanel(panel));
  listen(area, 'focusin', () => controller.areaFocus(panel, true));
  listen(area, 'focusout', () => controller.areaFocus(panel, false));

  listen(area, 'pointerenter', (event) => {
    if (event.pointerType !== 'touch') controller.mouseEnter(panel);
  });
  listen(area, 'pointerleave', (event) => {
    if (event.pointerType !== 'touch') controller.mouseLeave(panel);
  });

  const wheel = new WheelAccumulator();
  listen(
    root,
    'wheel',
    (event) => {
      event.preventDefault();
      const deltaMode = event.deltaMode;
      const deltaY = event.shiftKey && event.deltaY === 0 ? event.deltaX : event.deltaY;
      const notches = wheel.add(deltaY, deltaMode);
      if (notches !== 0) controller.wheel(panel, notches, eventModifiers(event, platform));
    },
    { passive: false },
  );
  listen(root, 'pointerleave', () => wheel.reset());

  listen(area, 'keydown', (event) => {
    const kind = modifierKeyKind(event, platform);
    if (kind === 'modifier') {
      controller.modifierKeyDown(eventModifiers(event, platform));
      return;
    }
    if (kind === 'ignore') return;
    const combo = keyComboOf(event, platform);
    if (combo === undefined) return;
    const outcome = controller.panelKeyDown(panel, combo);
    if (outcome.preventDefault) event.preventDefault();
    if (outcome.failed) event.stopPropagation();
  });
  listen(area, 'cut', (event) => controller.clipboardEvent('cut', event));
  listen(area, 'copy', (event) => controller.clipboardEvent('copy', event));
  listen(area, 'paste', (event) => controller.clipboardEvent('paste', event));

  listen(area, 'contextmenu', (event) => event.preventDefault());
  listen(area, 'mousedown', (event) => {
    if (event.button === middleButton) event.preventDefault();
  });
  listen(area, 'auxclick', (event) => event.preventDefault());

  const mouse = new PanelPointerInput(panel);
  const pointerInput = (event: PointerEvent): void => {
    const idle = mouse.held === 0;
    const events = mouse.handle(event, origin(), eventModifiers(event, platform));
    if (idle && mouse.held !== 0) {
      try {
        area.setPointerCapture(event.pointerId);
      } catch {
      }
    }
    for (const e of events) controller.mouse(e.kind, e.event);
  };

  const touches = new PinchPanTracker();
  let touchClick: { x: number; y: number } | undefined;
  const clearTouchClick = (): void => {
    touchClick = undefined;
  };
  const consumeTouchClick = (event: MouseEvent): void => {
    const last = touchClick;
    if (
      last === undefined ||
      Math.abs(event.clientX - last.x) > 2 ||
      Math.abs(event.clientY - last.y) > 2
    )
      return;
    touchClick = undefined;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  document.addEventListener('pointerdown', clearTouchClick, true);
  document.addEventListener('click', consumeTouchClick, true);
  cleanups.push(() => {
    document.removeEventListener('pointerdown', clearTouchClick, true);
    document.removeEventListener('click', consumeTouchClick, true);
  });
  const touchTools = new TouchTools({
    context: () => {
      const chrome = controller.getChrome();
      return `${chrome.activeTab}:${chrome.tool}:${chrome.sticky.ctrl}:${chrome.sticky.shift}:${chrome.sticky.alt}:${chrome.audioLocked}`;
    },
    begin: () => controller.beginTouchEdit(panel),
    send: (kind, point, right, clicks) => {
      const at = origin();
      controller.touchMouse(kind, {
        panel,
        x: Math.floor(point.x),
        y: Math.floor(point.y),
        client: { x: Math.floor(at.x + point.x), y: Math.floor(at.y + point.y) },
        button: right ? mouseButtons.right : mouseButtons.left,
        clicks,
        modifiers: { ctrl: false, shift: false, alt: false },
      });
    },
    finish: (cancel) => controller.finishTouchEdit(cancel),
  });
  let pinchCheck: number | undefined;
  cleanups.push(() => {
    touchTools.dispose();
    if (pinchCheck !== undefined) cancelAnimationFrame(pinchCheck);
  });
  listen(area, 'pointerdown', (event) => {
    if (event.pointerType !== 'touch') {
      pointerInput(event);
      return;
    }
    event.preventDefault();
    touchTools.down(event.pointerId, areaPoint(event));
    touches.down(event.pointerId, areaPoint(event), controller.panelScrollState(panel));
    try {
      area.setPointerCapture(event.pointerId);
    } catch {
    }
  });
  listen(area, 'pointermove', (event) => {
    if (event.pointerType !== 'touch') {
      pointerInput(event);
      return;
    }
    event.preventDefault();
    touchTools.move(event.pointerId, areaPoint(event));
    const move = touches.move(event.pointerId, areaPoint(event));
    if (move === undefined) return;
    controller.pinchPan(panel, move);
    pinchCheck ??= requestAnimationFrame(() => {
      pinchCheck = undefined;
      touches.checkPinch();
    });
  });
  const pointerEnd = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') {
      pointerInput(event);
      return;
    }
    event.preventDefault();
    if (event.type === 'pointerup') touchClick = { x: event.clientX, y: event.clientY };
    const wasPan = touches.paired && touches.tracks(event.pointerId);
    touchTools.up(event.pointerId, areaPoint(event), event.type !== 'pointerup');
    touches.up(event.pointerId);
    if (wasPan) controller.endAudioScrub();
  };
  listen(area, 'pointerup', pointerEnd);
  listen(area, 'pointercancel', pointerEnd);
  listen(area, 'lostpointercapture', pointerEnd);

  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    const prevent = (event: Event): void => event.preventDefault();
    root.addEventListener(type, prevent, { passive: false });
    cleanups.push(() => root.removeEventListener(type, prevent));
  }

  return () => {
    for (const cleanup of cleanups.reverse()) cleanup();
  };
}
