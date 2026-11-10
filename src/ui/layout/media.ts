import { readable, type Readable } from 'svelte/store';

export const desktopMediaQuery = '(min-width: 768px)';

export const compactGxHeight = 2;

export function isDesktopWidth(): boolean {
  return window.matchMedia(desktopMediaQuery).matches;
}

export function mediaQuery(query: string): Readable<boolean> {
  const list = window.matchMedia(query);
  return readable(list.matches, (set) => {
    const change = () => set(list.matches);
    list.addEventListener('change', change);
    change();
    return () => list.removeEventListener('change', change);
  });
}
