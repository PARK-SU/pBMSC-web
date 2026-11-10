import { sourceLabel, type LocaleContext } from '../../i18n/source-labels.ts';

export const settingsPages = [
  {
    section: 'options',
    path: 'GeneralOptions/Title',
    menu: 'GeneralOptions',
    fallback: 'General options',
  },
  {
    section: 'keybindings',
    path: 'KeybindingOptions/Title',
    menu: 'KeybindingOptions',
    fallback: 'Keybinding options',
  },
  {
    section: 'visual',
    path: 'VisualOptions/Title',
    menu: 'VisualOptions',
    fallback: 'Visual options',
  },
  {
    section: 'colors',
    path: 'VisualOverrideOptions/Title',
    menu: 'VisualOverrideOptions',
    fallback: 'Color overrides',
  },
  {
    section: 'audio',
    path: 'PlayerOptions/Title',
    menu: 'PlayerOptions',
    fallback: 'Playback options',
  },
] as const;
export function settingsPage(section: string) {
  return settingsPages.find((page) => page.section === section);
}
export function settingsTitle(locale: LocaleContext, section: string): string {
  const page = settingsPage(section);
  return page ? sourceLabel(locale, page.path, page.fallback) : '';
}
