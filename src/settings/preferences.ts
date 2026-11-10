import { defaultEditorOptions, type EditorOptions } from '../core/model/chart.ts';
import { defaultTotalOptions, type TotalOptions } from '../core/edit/stats.ts';
import { defaultToolOptions, type ToolOptions } from '../editor/input/events.ts';
import {
  defaultVisualSettings,
  defaultThemeName,
  themeNames,
  type ThemeName,
  type VisualSettings,
  type ThemeColumn,
} from './theme-loader.ts';
import { defaultLangFile, langNames, type LangFile } from '../i18n/lang.ts';

export interface EditorPreferences {
  tool: ToolOptions;
  writer: EditorOptions;
  total: TotalOptions;
  visual: Partial<VisualSettings>;
  columns: ThemeColumn[];
  wheel: number;
  page: number;
  showFileName: boolean;
  errorCheck: boolean;
  bindings: Record<string, readonly string[]>;
  audioOffset: number;
  pinchZoom: boolean;
  themeName: ThemeName;
  langFile: LangFile;
}
export function defaultPreferences(): EditorPreferences {
  return {
    tool: { ...defaultToolOptions, lnGap: 16, jackBPM: 255, jackTH: 16 },
    writer: { ...defaultEditorOptions },
    total: { ...defaultTotalOptions },
    visual: {},
    columns: [],
    wheel: 96,
    page: 384,
    showFileName: false,
    errorCheck: true,
    bindings: {},
    audioOffset: 0,
    pinchZoom: true,
    themeName: defaultThemeName,
    langFile: defaultLangFile,
  };
}
function fields<T extends object>(sample: T, value: unknown): Partial<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, unknown> = {},
    input = value as Record<string, unknown>;
  for (const [key, base] of Object.entries(sample)) {
    const entry = input[key];
    if (
      typeof entry === typeof base &&
      (typeof entry === 'boolean' ||
        typeof entry === 'string' ||
        (typeof entry === 'number' && Number.isFinite(entry)))
    )
      result[key] = entry;
    else if (base && typeof base === 'object' && entry && typeof entry === 'object')
      result[key] = { ...base, ...fields(base, entry) };
  }
  return result as Partial<T>;
}
export const preferencesKey = 'pbmsc-web:preferences';
export function loadPreferences(storage: Pick<Storage, 'getItem'>): EditorPreferences {
  const base = defaultPreferences();
  try {
    const raw: unknown = JSON.parse(storage.getItem(preferencesKey) ?? 'null');
    if (!raw || typeof raw !== 'object' || !('version' in raw) || raw.version !== 1) return base;
    const value = raw as Record<string, unknown>;
    const bindings: Record<string, readonly string[]> = {};
    if (value['bindings'] && typeof value['bindings'] === 'object')
      for (const [id, combos] of Object.entries(value['bindings']))
        if (
          /^\d+$/.test(id) &&
          Array.isArray(combos) &&
          combos.every((c) => typeof c === 'string' && c.length <= 80)
        )
          bindings[id] = combos as string[];
    return {
      ...base,
      themeName: themeNames.find((name) => name === value['themeName']) ?? base.themeName,
      langFile: langNames.find((lang) => lang.file === value['langFile'])?.file ?? base.langFile,
      ...fields(
        {
          wheel: base.wheel,
          page: base.page,
          showFileName: base.showFileName,
          errorCheck: base.errorCheck,
          audioOffset: 0,
          pinchZoom: base.pinchZoom,
        },
        value,
      ),
      tool: { ...base.tool, ...fields(base.tool, value['tool']) },
      writer: { ...base.writer, ...fields(base.writer, value['writer']) },
      total: { ...base.total, ...fields(base.total, value['total']) },
      visual: fields(defaultVisualSettings, value['visual']),
      columns: Array.isArray(value['columns'])
        ? value['columns']
            .filter(
              (column): column is Record<string, unknown> =>
                column &&
                typeof column === 'object' &&
                Number.isInteger(column.index) &&
                column.index >= 0 &&
                column.index <= 27,
            )
            .map((column) => ({
              ...fields(
                {
                  width: 0,
                  title: '',
                  noteColor: 0,
                  textColor: 0,
                  longNoteColor: 0,
                  longTextColor: 0,
                  bg: 0,
                },
                column,
              ),
              index: column['index'] as number,
            }))
        : [],
      bindings,
    };
  } catch {
    return base;
  }
}
export function savePreferences(storage: Pick<Storage, 'setItem'>, value: EditorPreferences): void {
  storage.setItem(preferencesKey, JSON.stringify({ ...value, version: 1 }));
}
