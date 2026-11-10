import { cp51949BestFit, cp949BestFit, eucKr } from './tables/euc-kr.ts';
import { cp932BestFit, jis0208 } from './tables/jis0208.ts';

export interface CodePage {
  decode(bytes: Uint8Array): string;
  encode(text: string): Uint8Array;
}

const digitValues = new Map(
  Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', (digit, value) => [
    digit.charCodeAt(0),
    value,
  ]),
);

function readNumbers(data: string): number[] {
  const numbers: number[] = [];
  let n = 0;
  for (let i = 0; i < data.length; i++) {
    const value = digitValues.get(data.charCodeAt(i));
    if (value === undefined) continue;
    if (value >= 32) {
      n = n * 32 + value - 32;
    } else {
      numbers.push(n * 32 + value);
      n = 0;
    }
  }
  return numbers;
}

export function readIndex(data: string): Uint16Array {
  const numbers = readNumbers(data);
  const index = new Uint16Array(numbers.length);
  let previous = -1;
  numbers.forEach((n, pointer) => {
    if (n === 0) return;
    previous += 1 + (n === 1 ? 0 : n % 2 === 0 ? (n - 2) / 2 : -(n - 1) / 2);
    index[pointer] = previous;
  });
  return index;
}

export function readBestFit(data: string): [number, number][] {
  const numbers = readNumbers(data);
  const mappings: [number, number][] = [];
  let codeUnit = 0;
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    codeUnit += numbers[i] ?? 0;
    mappings.push([codeUnit, numbers[i + 1] ?? 0]);
  }
  return mappings;
}

export function fromCodeUnits(units: Uint16Array): string {
  let text = '';
  for (let i = 0; i < units.length; i += 0x2000) {
    text += String.fromCharCode(...units.subarray(i, i + 0x2000));
  }
  return text;
}

interface Definition {
  isLead(byte: number): boolean;
  single(byte: number): number;
  pair(lead: number, trail: number): number | undefined;
  readonly replacement: number;
  writes?(lead: number, trail: number): boolean;
  readonly bestFit: string;
}

const leadByteMark = 0xffff;

function codePage(definition: Definition): CodePage {
  let decodeTables: { single: Uint16Array; pairs: Uint16Array } | undefined;
  let encodeTable: Uint16Array | undefined;

  const getDecodeTables = () => {
    if (decodeTables) return decodeTables;
    const single = new Uint16Array(256);
    const pairs = new Uint16Array(0x10000);
    for (let byte = 0; byte < 256; byte++) {
      if (!definition.isLead(byte)) {
        single[byte] = definition.single(byte);
        continue;
      }
      single[byte] = leadByteMark;
      for (let trail = 0; trail < 256; trail++) {
        pairs[byte * 256 + trail] = definition.pair(byte, trail) ?? definition.replacement;
      }
    }
    decodeTables = { single, pairs };
    return decodeTables;
  };

  const getEncodeTable = () => {
    if (encodeTable) return encodeTable;
    const unset = 0xffff;
    const table = new Uint16Array(0x10000).fill(unset);
    const set = (codeUnit: number, bytes: number) => {
      if (table[codeUnit] === unset) table[codeUnit] = bytes;
    };
    for (let byte = 0; byte < 256; byte++) {
      if (!definition.isLead(byte)) set(definition.single(byte), byte);
    }
    for (let byte = 0; byte < 256; byte++) {
      if (!definition.isLead(byte)) continue;
      for (let trail = 0; trail < 256; trail++) {
        const codeUnit = definition.pair(byte, trail);
        if (codeUnit !== undefined && (definition.writes?.(byte, trail) ?? true)) {
          set(codeUnit, byte * 256 + trail);
        }
      }
    }
    for (const [codeUnit, bytes] of readBestFit(definition.bestFit)) set(codeUnit, bytes);
    for (let codeUnit = 0; codeUnit < 0x10000; codeUnit++) {
      if (table[codeUnit] === unset) table[codeUnit] = 0x3f;
    }
    encodeTable = table;
    return encodeTable;
  };

  return {
    decode(bytes) {
      const { single, pairs } = getDecodeTables();
      const units = new Uint16Array(bytes.length);
      let length = 0;
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i] ?? 0;
        const unit = single[byte] ?? leadByteMark;
        if (unit !== leadByteMark) {
          units[length++] = unit;
        } else if (i + 1 < bytes.length) {
          units[length++] = pairs[byte * 256 + (bytes[++i] ?? 0)] ?? definition.replacement;
        }
      }
      return fromCodeUnits(units.subarray(0, length));
    },
    encode(text) {
      const table = getEncodeTable();
      const bytes = new Uint8Array(text.length * 2);
      let length = 0;
      for (let i = 0; i < text.length; i++) {
        const value = table[text.charCodeAt(i)] ?? 0x3f;
        if (value > 0xff) bytes[length++] = value >> 8;
        bytes[length++] = value & 0xff;
      }
      return bytes.slice(0, length);
    },
  };
}

let jis0208Index: Uint16Array | undefined;
let eucKrIndex: Uint16Array | undefined;

function shiftJisPointer(lead: number, trail: number): number | undefined {
  if (trail < 0x40 || trail === 0x7f || trail > 0xfc) return undefined;
  return (lead - (lead < 0xa0 ? 0x81 : 0xc1)) * 188 + trail - (trail < 0x7f ? 0x40 : 0x41);
}

function indexed(index: Uint16Array, pointer: number | undefined): number | undefined {
  const codeUnit = pointer === undefined ? 0 : (index[pointer] ?? 0);
  return codeUnit === 0 ? undefined : codeUnit;
}

export const cp932 = codePage({
  isLead: (byte) => (byte >= 0x81 && byte <= 0x9f) || (byte >= 0xe0 && byte <= 0xfc),
  single(byte) {
    if (byte <= 0x80) return byte;
    if (byte >= 0xa1 && byte <= 0xdf) return 0xff61 - 0xa1 + byte;
    return byte === 0xa0 ? 0xf8f0 : 0xf8f1 - 0xfd + byte;
  },
  pair(lead, trail) {
    const pointer = shiftJisPointer(lead, trail);
    if (pointer !== undefined && pointer >= 8836 && pointer <= 10715) {
      return 0xe000 - 8836 + pointer;
    }
    jis0208Index ??= readIndex(jis0208);
    return indexed(jis0208Index, pointer);
  },
  replacement: 0x30fb,
  writes(lead, trail) {
    const pointer = shiftJisPointer(lead, trail) ?? 0;
    return pointer < 8272 || pointer > 8835;
  },
  bestFit: cp932BestFit,
});

function eucKrPointer(lead: number, trail: number): number | undefined {
  return trail < 0x41 || trail > 0xfe ? undefined : (lead - 0x81) * 190 + trail - 0x41;
}

export const cp949 = codePage({
  isLead: (byte) => byte >= 0x81 && byte <= 0xfe,
  single: (byte) => (byte === 0xff ? 0xf8f7 : byte),
  pair(lead, trail) {
    if ((lead === 0xc9 || lead === 0xfe) && trail >= 0xa1 && trail <= 0xfe) {
      return (lead === 0xc9 ? 0xe000 : 0xe05e) + trail - 0xa1;
    }
    eucKrIndex ??= readIndex(eucKr);
    return indexed(eucKrIndex, eucKrPointer(lead, trail));
  },
  replacement: 0x3f,
  bestFit: cp949BestFit,
});

const cp51949PrivateUse = new Map([
  [0xa0, 0xf8e6],
  [0xad, 0xf8e7],
  [0xae, 0xf8e8],
  [0xaf, 0xf8e9],
  [0xfe, 0xf8ea],
  [0xff, 0xf8eb],
]);

export const cp51949 = codePage({
  isLead: (byte) =>
    (byte >= 0xa1 && byte <= 0xac) ||
    (byte >= 0xb0 && byte <= 0xc8) ||
    (byte >= 0xca && byte <= 0xfd),
  single: (byte) => (byte <= 0x9f ? byte : (cp51949PrivateUse.get(byte) ?? 0x3f)),
  pair(lead, trail) {
    if (trail < 0xa1 || trail > 0xfe) return undefined;
    if (lead === 0xb4 && trail === 0xd3) return 0xb2d6;
    eucKrIndex ??= readIndex(eucKr);
    return indexed(eucKrIndex, eucKrPointer(lead, trail));
  },
  replacement: 0x3f,
  bestFit: cp51949BestFit,
});
