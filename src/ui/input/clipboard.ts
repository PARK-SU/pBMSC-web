import type { KeyClipboard } from '../../editor/input/keybindings.ts';

export type SystemClipboard = Pick<Clipboard, 'readText' | 'writeText'>;

export interface ClipboardAccess {
  write(text: string): void;
  read(): Promise<string>;
  remember(text: string): void;
}

export function createClipboardAccess(system: SystemClipboard | undefined): ClipboardAccess {
  let internal = '';
  return {
    write(text) {
      internal = text;
      system?.writeText(text).catch(() => undefined);
    },
    async read() {
      if (system === undefined) return internal;
      try {
        return await system.readText();
      } catch {
        return internal;
      }
    },
    remember(text) {
      internal = text;
    },
  };
}

export interface ClipboardEventLike {
  readonly clipboardData: Pick<DataTransfer, 'getData' | 'setData'> | null;
  preventDefault(): void;
}

export function eventClipboard(event: ClipboardEventLike, access: ClipboardAccess): KeyClipboard {
  const data = event.clipboardData;
  return {
    write(text) {
      if (data === null) {
        access.write(text);
        return;
      }
      event.preventDefault();
      data.setData('text/plain', text);
      access.remember(text);
    },
    read() {
      event.preventDefault();
      return data === null ? '' : data.getData('text/plain');
    },
  };
}
