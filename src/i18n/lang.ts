import { integerParse } from '../core/vb.ts';
import { getAttribute, innerText, item, parseXml, type XmlElement } from '../settings/xml.ts';

export interface Lang {
  readonly name: string;
  t(path: string, fallback?: string): string;
  menu(path: string, fallback?: string): string;
}

export function parseLangXml(text: string): Lang {
  const root = parseXml(text);
  if (root.name !== 'iBMSC.Locale') {
    throw new Error(`Language file: the root element is <${root.name}>, not <iBMSC.Locale>`);
  }

  const find = (path: string): XmlElement | undefined => {
    let element: XmlElement | undefined = root;
    for (const name of path.split('/')) {
      element = item(element, name);
      if (element === undefined) return undefined;
    }
    return element;
  };

  return {
    name: getAttribute(root, 'Name'),
    t(path, fallback = path) {
      const element = find(path);
      return element === undefined ? fallback : innerText(element);
    },
    menu(path, fallback = path) {
      const element = find(path);
      if (element === undefined) return fallback;
      const text = innerText(element);
      if (!element.attributes.has('amp')) return text;
      let index: number;
      try {
        index = integerParse(getAttribute(element, 'amp'));
      } catch {
        return text;
      }
      if (index < 0 || index > text.length) return text;
      return text.slice(0, index) + '&' + text.slice(index);
    },
  };
}

export function stripMnemonic(text: string): string {
  return text.replace(/&([\s\S]?)/g, '$1');
}

export const langNames = [
  { file: 'chs.Lang.xml', name: '\u{7B80}\u{4F53}\u{4E2D}\u{6587} by Doaz' },
  { file: 'eng.Lang.xml', name: 'English by Doaz' },
  { file: 'jpn.Lang.xml', name: '\u{65E5}\u{672C}\u{8A9E} by Nekokan' },
  { file: 'kor.Lang.xml', name: '\u{D55C}\u{AD6D}\u{C5B4} by MusicGameLAB' },
] as const;

export type LangFile = (typeof langNames)[number]['file'];

export const defaultLangFile: LangFile = 'eng.Lang.xml';

export const viewerKeys = {
  fileMenu: 'Menu/File/Title',
  open: 'Menu/File/Open',
  viewMenu: 'Menu/View/Title',
  language: 'Menu/Options/Language',
  theme: 'Menu/Options/Theme',
  textEncoding: 'GeneralOptions/TextEncoding',
  scrollLock: 'OptionsPanel/Grid/Scroll',
  lockLeft: 'OptionsPanel/Grid/LockLeft',
  lockMiddle: 'OptionsPanel/Grid/LockMiddle',
  lockRight: 'OptionsPanel/Grid/LockRight',
  leftSplitter: 'SubMenu/ShowHide/LSplit',
  rightSplitter: 'SubMenu/ShowHide/RSplit',
  error: 'Messages/Err',
} as const;

export type ViewerKey = keyof typeof viewerKeys;
