export interface KeyEventLike {
  readonly keyCode: number;
  readonly key: string;
  readonly code?: string;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  readonly isComposing?: boolean;
}

export type KeyPlatform = 'mac' | 'other';

export interface KeyCombo {
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly name: string;
}

const keysNames: readonly string[] = [
  'None|LButton|RButton|Cancel|MButton|XButton1|XButton2|LButton, XButton2',
  'Back|Tab|LineFeed|LButton, LineFeed|Clear|Return|RButton, Clear|RButton, Return',
  'ShiftKey|ControlKey|Menu|Pause|Capital|KanaMode|RButton, Capital|JunjaMode',
  'FinalMode|HanjaMode|RButton, FinalMode|Escape|IMEConvert|IMENonconvert|IMEAceept|IMEModeChange',
  'Space|PageUp|Next|End|Home|Left|Up|Right',
  'Down|Select|Print|Execute|PrintScreen|Insert|Delete|Help',
  'D0|D1|D2|D3|D4|D5|D6|D7',
  'D8|D9|RButton, D8|RButton, D9|MButton, D8|MButton, D9|XButton2, D8|XButton2, D9',
  '64|A|B|C|D|E|F|G',
  'H|I|J|K|L|M|N|O',
  'P|Q|R|S|T|U|V|W',
  'X|Y|Z|LWin|RWin|Apps|RButton, RWin|Sleep',
  'NumPad0|NumPad1|NumPad2|NumPad3|NumPad4|NumPad5|NumPad6|NumPad7',
  'NumPad8|NumPad9|Multiply|Add|Separator|Subtract|Decimal|Divide',
  'F1|F2|F3|F4|F5|F6|F7|F8',
  'F9|F10|F11|F12|F13|F14|F15|F16',
  'F17|F18|F19|F20|F21|F22|F23|F24',
  'Back, F17|Back, F18|Back, F19|Back, F20|Back, F21|Back, F22|Back, F23|Back, F24',
  'NumLock|Scroll|RButton, NumLock|RButton, Scroll|MButton, NumLock|MButton, Scroll|XButton2, NumLock|XButton2, Scroll',
  'Back, NumLock|Back, Scroll|LineFeed, NumLock|LineFeed, Scroll|Clear, NumLock|Clear, Scroll|RButton, Clear, NumLock|RButton, Clear, Scroll',
  'LShiftKey|RShiftKey|LControlKey|RControlKey|LMenu|RMenu|BrowserBack|BrowserForward',
  'BrowserRefresh|BrowserStop|BrowserSearch|BrowserFavorites|BrowserHome|VolumeMute|VolumeDown|VolumeUp',
  'MediaNextTrack|MediaPreviousTrack|MediaStop|MediaPlayPause|LaunchMail|SelectMedia|LaunchApplication1|LaunchApplication2',
  'Back, MediaNextTrack|Back, MediaPreviousTrack|Oem1|Oemplus|Oemcomma|OemMinus|OemPeriod|OemQuestion',
  'Oemtilde|LButton, Oemtilde|RButton, Oemtilde|Cancel, Oemtilde|MButton, Oemtilde|XButton1, Oemtilde|XButton2, Oemtilde|LButton, XButton2, Oemtilde',
  'Back, Oemtilde|Tab, Oemtilde|LineFeed, Oemtilde|LButton, LineFeed, Oemtilde|Clear, Oemtilde|Return, Oemtilde|RButton, Clear, Oemtilde|RButton, Return, Oemtilde',
  'ShiftKey, Oemtilde|ControlKey, Oemtilde|Menu, Oemtilde|Pause, Oemtilde|Capital, Oemtilde|KanaMode, Oemtilde|RButton, Capital, Oemtilde|JunjaMode, Oemtilde',
  'FinalMode, Oemtilde|HanjaMode, Oemtilde|RButton, FinalMode, Oemtilde|OemOpenBrackets|Oem5|Oem6|Oem7|Oem8',
  'Space, Oemtilde|PageUp, Oemtilde|OemBackslash|LButton, OemBackslash|Home, Oemtilde|ProcessKey|MButton, OemBackslash|Packet',
  'Down, Oemtilde|Select, Oemtilde|Back, OemBackslash|Tab, OemBackslash|PrintScreen, Oemtilde|Back, ProcessKey|Clear, OemBackslash|Back, Packet',
  'D0, Oemtilde|D1, Oemtilde|ShiftKey, OemBackslash|ControlKey, OemBackslash|D4, Oemtilde|ShiftKey, ProcessKey|Attn|Crsel',
  'Exsel|EraseEof|Play|Zoom|NoName|Pa1|OemClear|LButton, OemClear',
]
  .join('|')
  .split('|');

export function keysName(vk: number): string {
  return keysNames[vk] ?? String(vk);
}

export const codeToUsVirtualKey: Readonly<Record<string, number>> = {
  ...Object.fromEntries(
    Array.from({ length: 26 }, (_, i) => [`Key${String.fromCharCode(65 + i)}`, 65 + i]),
  ),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Digit${i}`, 48 + i])),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Numpad${i}`, 96 + i])),
  ...Object.fromEntries(Array.from({ length: 24 }, (_, i) => [`F${i + 1}`, 112 + i])),
  NumpadMultiply: 106,
  NumpadAdd: 107,
  NumpadComma: 108,
  NumpadSubtract: 109,
  NumpadDecimal: 110,
  NumpadDivide: 111,
  NumpadEnter: 13,
  Semicolon: 186,
  Equal: 187,
  Comma: 188,
  Minus: 189,
  Period: 190,
  Slash: 191,
  Backquote: 192,
  BracketLeft: 219,
  Backslash: 220,
  BracketRight: 221,
  Quote: 222,
  IntlBackslash: 226,
  IntlRo: 226,
  IntlYen: 220,
  Space: 32,
  Enter: 13,
  Tab: 9,
  Backspace: 8,
  Escape: 27,
  CapsLock: 20,
  Insert: 45,
  Delete: 46,
  Home: 36,
  End: 35,
  PageUp: 33,
  PageDown: 34,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  Pause: 19,
  ScrollLock: 145,
  NumLock: 144,
  PrintScreen: 44,
  ContextMenu: 93,
  ShiftLeft: 16,
  ShiftRight: 16,
  ControlLeft: 17,
  ControlRight: 17,
  AltLeft: 18,
  AltRight: 18,
  MetaLeft: 91,
  MetaRight: 92,
  Lang1: 21,
  Lang2: 25,
  Convert: 28,
  NonConvert: 29,
  KanaMode: 21,
};

export function virtualKey(e: KeyEventLike): number | undefined {
  if (e.isComposing === true || e.keyCode === 229) return undefined;
  if (e.key === 'Meta' || e.key === 'OS') {
    return e.code === 'MetaRight' || e.code === 'OSRight' ? 92 : 91;
  }
  switch (e.keyCode) {
    case 0:
      return e.code === undefined ? undefined : codeToUsVirtualKey[e.code];
    case 58:
    case 59:
      return 186;
    case 61:
      return 187;
    case 64:
      return 192;
    case 160:
      return 222;
    case 163:
      return 191;
    case 171:
      return e.key === '+' || e.key === '*' ? 187 : 171;
    case 173:
      return e.key === '-' || e.key === '_' ? 189 : 173;
    default:
      return e.keyCode <= 255 ? e.keyCode : undefined;
  }
}

export function keyComboOf(e: KeyEventLike, platform: KeyPlatform = 'other'): KeyCombo | undefined {
  const vk = virtualKey(e);
  if (vk === undefined) return undefined;
  return {
    ctrl: e.ctrlKey || (platform === 'mac' && e.metaKey),
    shift: e.shiftKey,
    alt: e.altKey,
    name: keysName(vk),
  };
}

export function comboString(c: KeyCombo): string {
  return `${c.ctrl ? 'Ctrl+' : ''}${c.shift ? 'Shift+' : ''}${c.alt ? 'Alt+' : ''}${c.name}`;
}

export function modifierKeyKind(
  e: KeyEventLike,
  platform: KeyPlatform = 'other',
): 'modifier' | 'ignore' | undefined {
  if (e.key === 'Meta' || e.key === 'OS') return platform === 'mac' ? 'modifier' : 'ignore';
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'AltGraph') {
    return 'modifier';
  }
  const vk = virtualKey(e);
  return vk === 16 || vk === 17 || vk === 18 ? 'modifier' : undefined;
}
