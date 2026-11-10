import { cp51949, cp932, cp949, fromCodeUnits, type CodePage } from './codepages.ts';

export const textEncodingNames = [
  'System Ansi',
  'Little Endian UTF16',
  'ASCII',
  'Big Endian UTF16',
  'Little Endian UTF32',
  'UTF7',
  'UTF8',
  'SJIS',
  'EUC-KR',
] as const;

export type TextEncodingName = (typeof textEncodingNames)[number];

type Decode = (bytes: Uint8Array) => string;

interface Setting {
  readonly preamble: readonly number[];
  readonly decode: Decode;
  readonly encode: (text: string) => Uint8Array;
}

export function decodeText(bytes: Uint8Array, encoding: TextEncodingName): string {
  const setting = settings[encoding];
  const { preamble } = setting;
  if (preamble.length > 0 && startsWith(bytes, preamble)) {
    return setting.decode(bytes.subarray(preamble.length));
  }
  if (bytes.length < preamble.length && startsWith(preamble, bytes)) return setting.decode(bytes);
  const [decode, length] = byteOrderMark(bytes) ?? [setting.decode, 0];
  return decode(bytes.subarray(length));
}

export function encodeText(text: string, encoding: TextEncodingName): Uint8Array {
  const { preamble, encode } = settings[encoding];
  const body = encode(text);
  if (preamble.length === 0) return body;
  const bytes = new Uint8Array(preamble.length + body.length);
  bytes.set(preamble);
  bytes.set(body, preamble.length);
  return bytes;
}

function startsWith(bytes: ArrayLike<number>, prefix: ArrayLike<number>): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (bytes[i] !== prefix[i]) return false;
  return true;
}

function byteOrderMark(bytes: Uint8Array): [Decode, number] | undefined {
  const [first, second, third, fourth] = [bytes[0], bytes[1], bytes[2], bytes[3]];
  if (first === 0xfe && second === 0xff) return [decodeUtf16Be, 2];
  if (first === 0xff && second === 0xfe) {
    return third === 0 && fourth === 0 ? [decodeUtf32Le, 4] : [decodeUtf16Le, 2];
  }
  if (first === 0xef && second === 0xbb && third === 0xbf) return [decodeUtf8, 3];
  if (first === 0 && second === 0 && third === 0xfe && fourth === 0xff) return [decodeUtf32Be, 4];
  return undefined;
}

function decodeUtf8(bytes: Uint8Array): string {
  const units = new Uint16Array(bytes.length);
  let length = 0;
  let i = 0;
  while (i < bytes.length) {
    const lead = bytes[i]!;
    if (lead < 0x80) {
      units[length++] = lead;
      i++;
      continue;
    }
    if (lead < 0xc2 || lead > 0xf4) {
      units[length++] = 0xfffd;
      i++;
      continue;
    }
    const count = lead < 0xe0 ? 1 : lead < 0xf0 ? 2 : 3;
    const low = lead === 0xe0 ? 0xa0 : lead === 0xf0 ? 0x90 : 0x80;
    const high = lead === 0xed ? 0x9f : lead === 0xf4 ? 0x8f : 0xbf;
    let codePoint = lead & (0x3f >> count);
    let next = i + 1;
    let valid = true;
    for (let k = 1; k <= count; k++) {
      const byte = bytes[next];
      if (byte === undefined) return fromCodeUnits(units.subarray(0, length));
      if ((byte & 0xc0) !== 0x80) {
        valid = false;
        break;
      }
      next++;
      if (k === 1 && (byte < low || byte > high)) {
        valid = false;
        break;
      }
      codePoint = (codePoint << 6) | (byte & 0x3f);
    }
    if (!valid) {
      units[length++] = 0xfffd;
    } else if (codePoint < 0x10000) {
      units[length++] = codePoint;
    } else {
      units[length++] = 0xd800 + ((codePoint - 0x10000) >> 10);
      units[length++] = 0xdc00 + ((codePoint - 0x10000) & 0x3ff);
    }
    i = next;
  }
  return fromCodeUnits(units.subarray(0, length));
}

const decodeUtf16Le: Decode = (bytes) =>
  new TextDecoder('utf-16le', { ignoreBOM: true }).decode(bytes, { stream: true });
const decodeUtf16Be: Decode = (bytes) =>
  new TextDecoder('utf-16be', { ignoreBOM: true }).decode(bytes, { stream: true });

function decodeUtf32(bytes: Uint8Array, bigEndian: boolean): string {
  const units = new Uint16Array(bytes.length >> 1);
  let length = 0;
  for (let i = 0; i + 4 <= bytes.length; i += 4) {
    const [b0, b1, b2, b3] = [
      bytes[i] ?? 0,
      bytes[i + 1] ?? 0,
      bytes[i + 2] ?? 0,
      bytes[i + 3] ?? 0,
    ];
    const codePoint = bigEndian
      ? ((b0 * 256 + b1) * 256 + b2) * 256 + b3
      : ((b3 * 256 + b2) * 256 + b1) * 256 + b0;
    if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      units[length++] = 0xfffd;
    } else if (codePoint >= 0x10000) {
      units[length++] = 0xd800 + ((codePoint - 0x10000) >> 10);
      units[length++] = 0xdc00 + ((codePoint - 0x10000) & 0x3ff);
    } else {
      units[length++] = codePoint;
    }
  }
  return fromCodeUnits(units.subarray(0, length));
}

const decodeUtf32Le: Decode = (bytes) => decodeUtf32(bytes, false);
const decodeUtf32Be: Decode = (bytes) => decodeUtf32(bytes, true);

function codePoints(text: string): number[] {
  const points: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
    if (unit >= 0xd800 && unit <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      points.push(0x10000 + (unit - 0xd800) * 0x400 + next - 0xdc00);
      i++;
    } else {
      points.push(unit >= 0xd800 && unit <= 0xdfff ? 0xfffd : unit);
    }
  }
  return points;
}

function encodeUtf16(text: string, bigEndian: boolean): Uint8Array {
  const bytes = new Uint8Array(text.length * 2);
  let length = 0;
  const put = (unit: number) => {
    bytes[length++] = bigEndian ? unit >> 8 : unit & 0xff;
    bytes[length++] = bigEndian ? unit & 0xff : unit >> 8;
  };
  for (const codePoint of codePoints(text)) {
    if (codePoint < 0x10000) {
      put(codePoint);
    } else {
      put(0xd800 + ((codePoint - 0x10000) >> 10));
      put(0xdc00 + ((codePoint - 0x10000) & 0x3ff));
    }
  }
  return bytes;
}

function encodeUtf32Le(text: string): Uint8Array {
  const points = codePoints(text);
  const bytes = new Uint8Array(points.length * 4);
  points.forEach((codePoint, i) => {
    bytes[i * 4] = codePoint & 0xff;
    bytes[i * 4 + 1] = (codePoint >> 8) & 0xff;
    bytes[i * 4 + 2] = codePoint >> 16;
  });
  return bytes;
}

const base64Values = new Map(
  Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', (digit, value) => [
    digit.charCodeAt(0),
    value,
  ]),
);

function decodeUtf7(bytes: Uint8Array): string {
  const units = new Uint16Array(bytes.length);
  let length = 0;
  let bits = 0;
  let bitCount = -1;
  let justStarted = false;
  for (const byte of bytes) {
    if (bitCount < 0) {
      if (byte === 0x2b) {
        bitCount = 0;
        justStarted = true;
      } else {
        units[length++] = byte;
      }
      continue;
    }
    const value = byte < 0x80 ? base64Values.get(byte) : undefined;
    if (value !== undefined) {
      justStarted = false;
      bits = ((bits << 6) + value) & 0x3fffff;
      bitCount += 6;
      if (bitCount >= 16) {
        bitCount -= 16;
        units[length++] = (bits >> bitCount) & 0xffff;
      }
      continue;
    }
    bitCount = -1;
    if (byte === 0x2d) {
      if (justStarted) units[length++] = 0x2b;
    } else if (byte !== 0) {
      units[length++] = byte;
    }
  }
  return fromCodeUnits(units.subarray(0, length));
}

const codePageSetting = (codePage: CodePage): Setting => ({
  preamble: [],
  decode: (bytes) => codePage.decode(bytes),
  encode: (text) => codePage.encode(text),
});

const settings: Record<TextEncodingName, Setting> = {
  'System Ansi': codePageSetting(cp949),
  'Little Endian UTF16': {
    preamble: [0xff, 0xfe],
    decode: decodeUtf16Le,
    encode: (text) => encodeUtf16(text, false),
  },
  ASCII: {
    preamble: [],
    decode: (bytes) =>
      fromCodeUnits(Uint16Array.from(bytes, (byte) => (byte < 0x80 ? byte : 0x3f))),
    encode: (text) =>
      Uint8Array.from({ length: text.length }, (_, i) => {
        const unit = text.charCodeAt(i);
        return unit < 0x80 ? unit : 0x3f;
      }),
  },
  'Big Endian UTF16': {
    preamble: [0xfe, 0xff],
    decode: decodeUtf16Be,
    encode: (text) => encodeUtf16(text, true),
  },
  'Little Endian UTF32': {
    preamble: [0xff, 0xfe, 0, 0],
    decode: decodeUtf32Le,
    encode: encodeUtf32Le,
  },
  UTF7: {
    preamble: [],
    decode: decodeUtf7,
    encode: () => {
      throw new Error('Saving as UTF-7 is not supported');
    },
  },
  UTF8: {
    preamble: [0xef, 0xbb, 0xbf],
    decode: decodeUtf8,
    encode: (text) => new TextEncoder().encode(text),
  },
  SJIS: codePageSetting(cp932),
  'EUC-KR': codePageSetting(cp51949),
};
