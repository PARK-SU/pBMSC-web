import { stripMnemonic, viewerKeys, type Lang, type LangFile } from '../../i18n/lang.ts';
import { featureText } from '../../i18n/features.ts';
import { defaultStatusStrings, type StatusStrings } from '../../editor/status.ts';

export const editorKeys = {
  ok: 'OK',
  cancel: 'Cancel',
  saveAs: 'Menu/File/SaveAs',
  save: 'Menu/File/Save',
  new: 'Menu/File/New',
  close: 'Menu/File/Close',
  editMenu: 'Menu/Edit/Title',
  undo: 'Menu/Edit/Undo',
  redo: 'Menu/Edit/Redo',
  cut: 'Menu/Edit/Cut',
  copy: 'Menu/Edit/Copy',
  paste: 'Menu/Edit/Paste',
  delete: 'Menu/Edit/Delete',
  selectAll: 'Menu/Edit/SelectAll',
  timeSelectTool: 'ToolBar/TimeSelectionTool',
  selectTool: 'ToolBar/SelectTool',
  writeTool: 'ToolBar/WriteTool',
  undoButton: 'ToolBar/Undo',
  redoButton: 'ToolBar/Redo',
  ntInput: 'ToolBar/NT',
  wavTitle: 'OptionsPanel/WAV/Title',
  bmpTitle: 'OptionsPanel/BMP/Title',
  selectionInfo: 'StatusBar/SelectionInfo',
  columnCaption: 'StatusBar/ColumnCaption',
  noteIndex: 'StatusBar/NoteIndex',
  measureIndex: 'StatusBar/MeasureIndex',
  gridResolution: 'StatusBar/GridResolution',
  reducedResolution: 'StatusBar/ReducedResolution',
  measureResolution: 'StatusBar/MeasureResolution',
  absolutePosition: 'StatusBar/AbsolutePosition',
  selStart: 'StatusBar/SelStart',
  selLength: 'StatusBar/SelLength',
  selSplit: 'StatusBar/SelSplit',
  statusNote: 'StatusBar/Note',
  statusLongNote: 'StatusBar/LongNote',
  statusHidden: 'StatusBar/Hidden',
  statusLandmine: 'StatusBar/Landmine',
  statusComment: 'StatusBar/Comment',
  statusApproximate: 'StatusBar/Approximate',
  statusError: 'StatusBar/Error',
  statusErrorTechnical: 'StatusBar/ErrorTechnical',
  beats: 'Beats',
  promptEnter: 'Messages/PromptEnter',
  promptEnterNumeric: 'Messages/PromptEnterNumeric',
  promptEnterBPM: 'Messages/PromptEnterBPM',
  promptEnterSTOP: 'Messages/PromptEnterSTOP',
  promptEnterSCROLL: 'Messages/PromptEnterSCROLL',
  invalidLabel: 'Messages/InvalidLabel',
  saveAsDisabled: 'Messages/SaveAsDisabled',
  saveWarning: 'Messages/SaveWarning',
  noteOverlapError: 'Messages/NoteOverlapError',
  bpmOverflowError: 'Messages/BPMOverflowError',
  stopOverflowError: 'Messages/STOPOverflowError',
  scrollOverflowError: 'Messages/SCROLLOverflowError',
  base36OverflowError: 'Messages/Base36OverflowError',
  savedFileWillContainErrors: 'Messages/SavedFileWillContainErrors',
} as const;

export type EditorKey = keyof typeof editorKeys;

export type UiKey = keyof typeof viewerKeys | EditorKey;

const uiKeys: Readonly<Record<UiKey, string>> = { ...viewerKeys, ...editorKeys };

export interface UiText {
  menu(key: UiKey): string;
  label(key: UiKey): string;
  text(key: UiKey): string;
}

export function uiText(
  lang: Lang | undefined,
  english: Lang | undefined,
  langFile?: LangFile,
): UiText {
  const t = (key: UiKey): string => {
    const path = uiKeys[key];
    const fallback = featureText(langFile, english?.t(path, '') ?? '');
    return lang?.t(path, fallback) ?? fallback;
  };
  return {
    menu(key) {
      const path = uiKeys[key];
      const fallback = english?.menu(path, '') ?? '';
      return stripMnemonic(lang?.menu(path, fallback) ?? fallback);
    },
    label: (key) => stripMnemonic(t(key)),
    text: t,
  };
}

const statusKeys: Readonly<Record<keyof StatusStrings, EditorKey>> = {
  note: 'statusNote',
  longNote: 'statusLongNote',
  hidden: 'statusHidden',
  landmine: 'statusLandmine',
  comment: 'statusComment',
  approximate: 'statusApproximate',
  err: 'statusError',
  errTechnical: 'statusErrorTechnical',
  beats: 'beats',
};

export function statusStrings(lang: Lang | undefined, english: Lang | undefined): StatusStrings {
  const strings = { ...defaultStatusStrings };
  for (const field of Object.keys(statusKeys) as (keyof StatusStrings)[]) {
    const path = editorKeys[statusKeys[field]];
    const fallback = english?.t(path, strings[field]) ?? strings[field];
    strings[field] = lang?.t(path, fallback) ?? fallback;
  }
  return strings;
}
