import english from './web.eng.json';
import korean from './web.kor.json';
import type { LangFile } from './lang.ts';
import { sourceLabel, webLabelPaths, type LocaleContext } from './source-labels.ts';

export type WebKey = keyof typeof english;
const additionalText: Partial<Record<LangFile, Partial<typeof english>>> = {
  'chs.Lang.xml': {
    wavIncrease: '输入音符后自动递增 WAV 编号',
    connectSongFolder: '请选择包含 {name} 的歌曲文件夹，以同时载入音效。',
    chartNotInFolder: '所选文件夹中找不到 {name}，或存在多个相同文件。',
    fontName: '字体',
    fontSize: '字号',
    fontBold: '粗体',
    fontItalic: '斜体',
    previous: '上一个',
    next: '下一个',
    touchAction: '触摸操作',
    touchNormalInput: '普通音符输入',
    touchHiddenInput: '隐藏音符输入',
    touchLandmineInput: '地雷音符输入',
    touchLongInput: '长音符输入',
    touchMoveSelect: '选择／移动',
    touchAddCopy: '追加选择／复制',
    touchResize: '调整长音符长度',
    touchSameVisible: '相同音效（当前画面）',
    touchSameAll: '相同音效（整个谱面）',
    touchTimeRange: '选择时间范围',
    touchRangeEnd: '更改范围终点',
    touchHiddenHint: '输入隐藏音符。',
    touchLandmineHint: '输入地雷音符。',
    touchLongHint: '依次点击长音符的起点和终点。',
    touchAddCopyHint: '点击可追加或取消选择，拖动可复制。',
    touchResizeHint: '拖动长音符的端点以调整长度。',
    touchSameVisibleHint: '点击音符，切换画面内相同音效音符的选中状态。',
    touchSameAllHint: '点击音符，切换整个谱面中相同音效音符的选中状态。',
    touchRangeEndHint: '保留范围起点，更改终点。',
  },
  'jpn.Lang.xml': {
    wavIncrease: 'ノート入力後に WAV 番号を自動で増やす',
    connectSongFolder:
      '{name} のキー音を一緒に読み込むには、この BMS が入った曲フォルダーを選択してください。',
    chartNotInFolder: '選択したフォルダーに {name} がないか、同じファイルが複数あります。',
    fontName: 'フォント',
    fontSize: 'サイズ',
    fontBold: '太字',
    fontItalic: '斜体',
    previous: '前へ',
    next: '次へ',
    touchAction: 'タッチ操作',
    touchNormalInput: '通常ノート入力',
    touchHiddenInput: '隠しノート入力',
    touchLandmineInput: '地雷ノート入力',
    touchLongInput: 'ロングノート入力',
    touchMoveSelect: '選択・移動',
    touchAddCopy: '追加選択・コピー',
    touchResize: 'ロングノートの長さ調整',
    touchSameVisible: '同じキー音（画面内）',
    touchSameAll: '同じキー音（譜面全体）',
    touchTimeRange: '時間範囲選択',
    touchRangeEnd: '範囲の終点変更',
    touchHiddenHint: '隠しノートを入力します。',
    touchLandmineHint: '地雷ノートを入力します。',
    touchLongHint: 'ロングノートの始点と終点を順にタップします。',
    touchAddCopyHint: 'タップで選択の追加・解除、ドラッグでコピーします。',
    touchResizeHint: 'ロングノートの端をドラッグして長さを調整します。',
    touchSameVisibleHint: 'ノートをタップすると、画面内の同じキー音の選択を切り替えます。',
    touchSameAllHint: 'ノートをタップすると、譜面全体の同じキー音の選択を切り替えます。',
    touchRangeEndHint: '選択範囲の始点を保ち、終点を変更します。',
  },
};
export function webText(
  file: LangFile | undefined,
  key: WebKey,
  values: Readonly<Record<string, string | number>> = {},
  locale?: LocaleContext,
): string {
  const fallback =
    (file && additionalText[file]?.[key]) ?? (file === 'kor.Lang.xml' ? korean[key] : english[key]);
  const path = webLabelPaths[key];
  const text = path && locale ? sourceLabel(locale, path, fallback) : fallback;
  return text.replace(/\{(\w+)\}/g, (placeholder: string, name: string) =>
    values[name] === undefined ? placeholder : String(values[name]),
  );
}
