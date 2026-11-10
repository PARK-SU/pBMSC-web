import { keyComboOf, type KeyEventLike, type KeyPlatform } from '../../editor/input/keyboard.ts';
import { resolveMenuShortcut, type MenuShortcutItem } from '../../editor/input/keybindings.ts';
import { noModifiers, type KeyModifiers } from '../../editor/input/modifiers.ts';

export function keyPlatform(platform: string = navigator.platform): KeyPlatform {
  return /^(Mac|iPhone|iPad|iPod)/.test(platform) ? 'mac' : 'other';
}

export function eventModifiers(
  e: Pick<KeyEventLike, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>,
  platform: KeyPlatform,
): KeyModifiers {
  return { ctrl: e.ctrlKey || (platform === 'mac' && e.metaKey), shift: e.shiftKey, alt: e.altKey };
}

export const activeMenuShortcuts: ReadonlySet<MenuShortcutItem> = new Set<MenuShortcutItem>([
  'mnOpen',
  'mnSave',
  'mnSaveAs',
  'mnFind',
  'mnStatistics',
  'mnStatisticsAdvanced',
  'mnVCOptions',
  'mnGOptions',
  'mnKOptions',
  'mnVOptions',
  'mnPOptions',
  'mnGotoMeasure',
  'mnTimeSelect',
  'mnSelect',
  'mnWrite',
  'mnSLSplitter',
  'mnSRSplitter',
  'CGBPM',
  'CGSTOP',
  'CGSCROLL',
  'CGBLP',
  'mnNTInput',
  'mnPlayB',
  'mnPlay',
  'mnStop',
]);

export function menuShortcutOf(
  e: KeyEventLike,
  platform: KeyPlatform,
): MenuShortcutItem | undefined {
  const combo = keyComboOf(e, platform);
  if (combo === undefined) return undefined;
  const item = resolveMenuShortcut(combo);
  return item !== undefined && activeMenuShortcuts.has(item) ? item : undefined;
}

export interface PageInputTarget {
  readonly modal: () => boolean;
  readonly menuShortcut: (item: MenuShortcutItem) => void;
  readonly open: () => void;
  readonly save: () => void;
  readonly saveAs?: () => void;
  readonly recent?: (index: number) => void;
  readonly stopAudio?: () => void;
  readonly keyUp: (modifiers: KeyModifiers) => void;
  readonly cursor: (clientX: number, clientY: number) => void;
}

export function bindPageInput(target: PageInputTarget): () => void {
  const platform = keyPlatform();
  const keydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') target.stopAudio?.();
    if (target.modal()) return;
    const recent = /^Digit([1-5])$/.exec(event.code)?.[1];
    if (
      target.recent &&
      recent &&
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      event.preventDefault();
      target.recent(Number(recent) - 1);
      return;
    }
    const item = menuShortcutOf(event, platform);
    if (item === undefined) return;
    event.preventDefault();
    if (item === 'mnOpen') target.open();
    else if (item === 'mnSave') target.save();
    else if (item === 'mnSaveAs') (target.saveAs ?? target.save)();
    else target.menuShortcut(item);
  };
  const keyup = (event: KeyboardEvent): void => target.keyUp(eventModifiers(event, platform));
  const blur = (): void => target.keyUp(noModifiers);
  const pointermove = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') target.cursor(event.clientX, event.clientY);
  };
  document.addEventListener('keydown', keydown);
  document.addEventListener('keyup', keyup);
  window.addEventListener('blur', blur);
  window.addEventListener('pointermove', pointermove, { passive: true });
  return () => {
    document.removeEventListener('keydown', keydown);
    document.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', blur);
    window.removeEventListener('pointermove', pointermove);
  };
}
