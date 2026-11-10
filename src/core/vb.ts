export type VbErrorKind =
  | 'InvalidCast'
  | 'Format'
  | 'Overflow'
  | 'DivideByZero'
  | 'Argument'
  | 'NullReference'
  | 'IO'
  | 'Arithmetic'
  | 'NotImplemented';

export class VbError extends Error {
  readonly kind: VbErrorKind;

  constructor(kind: VbErrorKind) {
    super(`${kind}Exception`);
    this.name = 'VbError';
    this.kind = kind;
  }
}


const INT64_BOUND = 2 ** 63;

function mathRound(a: number): number {
  if (Number.isInteger(a)) return a;
  const tempVal = a + 0.5;
  let flrTempVal = Math.floor(tempVal);
  if (flrTempVal === tempVal && tempVal % 2 !== 0) flrTempVal -= 1;
  return a < 0 ? -Math.abs(flrTempVal) : Math.abs(flrTempVal);
}

export function cint(x: number): number {
  const rounded = mathRound(x);
  if (!(rounded > -2147483649 && rounded < 2147483648)) throw new VbError('Overflow');
  return rounded === 0 ? 0 : rounded;
}

export function clng(x: number): number {
  const rounded = mathRound(x);
  if (!(rounded >= -INT64_BOUND && rounded < INT64_BOUND)) throw new VbError('Overflow');
  return rounded === 0 ? 0 : rounded;
}

export function intDiv(a: number, b: number): number {
  if (b === 0) throw new VbError('DivideByZero');
  const quotient = Math.trunc(a / b);
  return quotient === 0 ? 0 : quotient;
}

export function int(x: number): number {
  return Math.floor(x);
}

export function hex(n: number, type: 'Integer' | 'Long' = 'Long'): string {
  return BigInt.asUintN(type === 'Integer' ? 32 : 64, BigInt(n))
    .toString(16)
    .toUpperCase();
}


const ALLOW_LEADING_WHITE = 0x1;
const ALLOW_TRAILING_WHITE = 0x2;
const ALLOW_LEADING_SIGN = 0x4;
const ALLOW_TRAILING_SIGN = 0x8;
const ALLOW_PARENTHESES = 0x10;
const ALLOW_DECIMAL_POINT = 0x20;
const ALLOW_THOUSANDS = 0x40;
const ALLOW_EXPONENT = 0x80;
const ALLOW_CURRENCY_SYMBOL = 0x100;
const STYLE_INTEGER = ALLOW_LEADING_WHITE | ALLOW_TRAILING_WHITE | ALLOW_LEADING_SIGN;
const STYLE_FLOAT = STYLE_INTEGER | ALLOW_DECIMAL_POINT | ALLOW_EXPONENT | ALLOW_THOUSANDS;
const STYLE_VB = STYLE_FLOAT | ALLOW_TRAILING_SIGN | ALLOW_PARENTHESES | ALLOW_CURRENCY_SYMBOL;

const PLUS = 0x2b;
const MINUS = 0x2d;
const DECIMAL_SEPARATOR = 0x2e;
const GROUP_SEPARATOR = 0x2c;
const CURRENCY_SYMBOL = 0x20a9;
const ANSI_CURRENCY_SYMBOL = 0x5c;
const NAN_SYMBOL = 'NaN';
const POSITIVE_INFINITY_SYMBOL = String.fromCharCode(0x221e);
const NEGATIVE_INFINITY_SYMBOL = '-' + POSITIVE_INFINITY_SYMBOL;

const STATE_SIGN = 0x1;
const STATE_PARENS = 0x2;
const STATE_DIGITS = 0x4;
const STATE_NONZERO = 0x8;
const STATE_DECIMAL = 0x10;
const STATE_CURRENCY = 0x20;
const NUMBER_MAX_DIGITS = 50;

interface NumberBuffer {
  readonly digits: string;
  readonly scale: number;
  readonly negative: boolean;
}

function isDigit(c: number): boolean {
  return c >= 0x30 && c <= 0x39;
}

function isWhite(c: number): boolean {
  return c === 0x20 || (c >= 0x09 && c <= 0x0d);
}

function tryStringToNumber(
  str: string,
  options: number,
  parseDecimal: boolean,
): NumberBuffer | undefined {
  const length = str.length;
  const at = (i: number): number => (i < length ? str.charCodeAt(i) : 0);
  const allows = (flag: number): boolean => (options & flag) !== 0;
  let currencyPending = allows(ALLOW_CURRENCY_SYMBOL);
  const isCurrency = (c: number): boolean =>
    currencyPending && (c === CURRENCY_SYMBOL || c === ANSI_CURRENCY_SYMBOL);

  let state = 0;
  let negative = false;
  let scale = 0;
  let buffer = '';
  let digitEnd = 0;
  let p = 0;
  let ch = at(0);

  for (;;) {
    if (
      isWhite(ch) &&
      allows(ALLOW_LEADING_WHITE) &&
      ((state & STATE_SIGN) === 0 || (state & STATE_CURRENCY) !== 0)
    ) {
    } else if (
      allows(ALLOW_LEADING_SIGN) &&
      (state & STATE_SIGN) === 0 &&
      (ch === PLUS || ch === MINUS)
    ) {
      state |= STATE_SIGN;
      negative = ch === MINUS;
    } else if (ch === 0x28 && allows(ALLOW_PARENTHESES) && (state & STATE_SIGN) === 0) {
      state |= STATE_SIGN | STATE_PARENS;
      negative = true;
    } else if (isCurrency(ch)) {
      state |= STATE_CURRENCY;
      currencyPending = false;
    } else {
      break;
    }
    ch = at(++p);
  }

  for (;;) {
    if (isDigit(ch)) {
      state |= STATE_DIGITS;
      if (ch !== 0x30 || (state & STATE_NONZERO) !== 0) {
        if (buffer.length < NUMBER_MAX_DIGITS) {
          buffer += String.fromCharCode(ch);
          if (ch !== 0x30 || parseDecimal) digitEnd = buffer.length;
        }
        if ((state & STATE_DECIMAL) === 0) scale++;
        state |= STATE_NONZERO;
      } else if ((state & STATE_DECIMAL) !== 0) {
        scale--;
      }
    } else if (
      allows(ALLOW_DECIMAL_POINT) &&
      (state & STATE_DECIMAL) === 0 &&
      ch === DECIMAL_SEPARATOR
    ) {
      state |= STATE_DECIMAL;
    } else if (
      allows(ALLOW_THOUSANDS) &&
      (state & STATE_DIGITS) !== 0 &&
      (state & STATE_DECIMAL) === 0 &&
      ch === GROUP_SEPARATOR
    ) {
    } else {
      break;
    }
    ch = at(++p);
  }

  if ((state & STATE_DIGITS) === 0) return undefined;

  if ((ch === 0x45 || ch === 0x65) && allows(ALLOW_EXPONENT)) {
    const beforeExponent = p;
    ch = at(++p);
    let negativeExponent = false;
    if (ch === PLUS) {
      ch = at(++p);
    } else if (ch === MINUS) {
      ch = at(++p);
      negativeExponent = true;
    }
    if (isDigit(ch)) {
      let exponent = 0;
      do {
        exponent = exponent * 10 + (ch - 0x30);
        ch = at(++p);
        if (exponent > 1000) {
          exponent = 9999;
          while (isDigit(ch)) ch = at(++p);
        }
      } while (isDigit(ch));
      scale += negativeExponent ? -exponent : exponent;
    } else {
      p = beforeExponent;
      ch = at(p);
    }
  }

  for (;;) {
    if (isWhite(ch) && allows(ALLOW_TRAILING_WHITE)) {
    } else if (
      allows(ALLOW_TRAILING_SIGN) &&
      (state & STATE_SIGN) === 0 &&
      (ch === PLUS || ch === MINUS)
    ) {
      state |= STATE_SIGN;
      negative = ch === MINUS;
    } else if (ch === 0x29 && (state & STATE_PARENS) !== 0) {
      state &= ~STATE_PARENS;
    } else if (isCurrency(ch)) {
      currencyPending = false;
    } else {
      break;
    }
    ch = at(++p);
  }

  if ((state & STATE_PARENS) !== 0) return undefined;
  if ((state & STATE_NONZERO) === 0) {
    if (!parseDecimal) scale = 0;
    if ((state & STATE_DECIMAL) === 0) negative = false;
  }
  for (let i = p; i < length; i++) if (str.charCodeAt(i) !== 0) return undefined;
  return { digits: buffer.slice(0, digitEnd), scale, negative };
}

const POWER10 = [
  0xa000000000000000n,
  0xc800000000000000n,
  0xfa00000000000000n,
  0x9c40000000000000n,
  0xc350000000000000n,
  0xf424000000000000n,
  0x9896800000000000n,
  0xbebc200000000000n,
  0xee6b280000000000n,
  0x9502f90000000000n,
  0xba43b74000000000n,
  0xe8d4a51000000000n,
  0x9184e72a00000000n,
  0xb5e620f480000000n,
  0xe35fa931a0000000n,
  0xcccccccccccccccdn,
  0xa3d70a3d70a3d70bn,
  0x83126e978d4fdf3cn,
  0xd1b71758e219652en,
  0xa7c5ac471b478425n,
  0x8637bd05af6c69b7n,
  0xd6bf94d5e57a42ben,
  0xabcc77118461ceffn,
  0x89705f4136b4a599n,
  0xdbe6fecebdedd5c2n,
  0xafebff0bcb24ab02n,
  0x8cbccc096f5088cfn,
  0xe12e13424bb40e18n,
  0xb424dc35095cd813n,
  0x901d7cf73ab0acdcn,
];
const POWER10_EXPONENT = [4, 7, 10, 14, 17, 20, 24, 27, 30, 34, 37, 40, 44, 47, 50];
const POWER10_BY16 = [
  0x8e1bc9bf04000000n,
  0x9dc5ada82b70b59en,
  0xaf298d050e4395d6n,
  0xc2781f49ffcfa6d4n,
  0xd7e77a8f87daf7fan,
  0xefb3ab16c59b14a0n,
  0x850fadc09923329cn,
  0x93ba47c980e98cden,
  0xa402b9c5a8d3a6e6n,
  0xb616a12b7fe617a8n,
  0xca28a291859bbf90n,
  0xe070f78d39275566n,
  0xf92e0c3537826140n,
  0x8a5296ffe33cc92cn,
  0x9991a6f3d6bf1762n,
  0xaa7eebfb9df9de8an,
  0xbd49d14aa79dbc7en,
  0xd226fc195c6a2f88n,
  0xe950df20247c83f8n,
  0x81842f29f2cce373n,
  0x8fcac257558ee4e2n,
  0xe69594bec44de160n,
  0xcfb11ead453994c3n,
  0xbb127c53b17ec165n,
  0xa87fea27a539e9b3n,
  0x97c560ba6b0919b5n,
  0x88b402f7fd7553abn,
  0xf64335bcf065d3a0n,
  0xddd0467c64bce4c4n,
  0xc7caba6e7c5382edn,
  0xb3f4e093db73a0b7n,
  0xa21727db38cb0053n,
  0x91ff83775423cc29n,
  0x8380dea93da4bc82n,
  0xece53cec4a314f00n,
  0xd5605fcdcf32e217n,
  0xc0314325637a1978n,
  0xad1c8eab5ee43ba2n,
  0x9becce62836ac5b0n,
  0x8c71dcd9ba0b495cn,
  0xfd00b89747823938n,
  0xe3e27a444d8d991an,
];
const POWER10_BY16_EXPONENT = [
  54, 107, 160, 213, 266, 319, 373, 426, 479, 532, 585, 638, 691, 745, 798, 851, 904, 957, 1010,
  1064, 1117,
];

const UINT64_MAX = (1n << 64n) - 1n;
const UINT64_TOP_BIT = 1n << 63n;

function mul64Lossy(a: bigint, b: bigint): { value: bigint; shift: number } {
  const aHigh = a >> 32n;
  const aLow = a & 0xffffffffn;
  const bHigh = b >> 32n;
  const bLow = b & 0xffffffffn;
  const value = aHigh * bHigh + ((aHigh * bLow) >> 32n) + ((aLow * bHigh) >> 32n);
  return (value & UINT64_TOP_BIT) === 0n ? { value: value << 1n, shift: -1 } : { value, shift: 0 };
}

const bitsView = new DataView(new ArrayBuffer(8));

function numberToDouble(number: NumberBuffer): number {
  const digits = number.digits;
  const total = digits.length;
  let bits: bigint;
  if (total === 0) {
    bits = 0n;
  } else {
    let remaining = total;
    let count = Math.min(remaining, 9);
    remaining -= count;
    let value = BigInt(digits.slice(0, count));
    if (remaining > 0) {
      count = Math.min(remaining, 9);
      remaining -= count;
      value = value * 10n ** BigInt(count) + BigInt(digits.slice(9, 9 + count));
    }
    const scale = number.scale - (total - remaining);
    const absScale = Math.abs(scale);
    if (absScale >= 22 * 16) {
      bits = scale > 0 ? 0x7ff0000000000000n : 0n;
    } else {
      let exponent = 64;
      for (const shift of [32, 16, 8, 4, 2, 1]) {
        if (value >> BigInt(64 - shift) === 0n) {
          value <<= BigInt(shift);
          exponent -= shift;
        }
      }
      const index = absScale & 15;
      if (index !== 0) {
        const powerExponent = POWER10_EXPONENT[index - 1]!;
        exponent += scale < 0 ? -powerExponent + 1 : powerExponent;
        const product = mul64Lossy(value, POWER10[index + (scale < 0 ? 15 : 0) - 1]!);
        value = product.value;
        exponent += product.shift;
      }
      const index16 = absScale >> 4;
      if (index16 !== 0) {
        const powerExponent = POWER10_BY16_EXPONENT[index16 - 1]!;
        exponent += scale < 0 ? -powerExponent + 1 : powerExponent;
        const product = mul64Lossy(value, POWER10_BY16[index16 + (scale < 0 ? 21 : 0) - 1]!);
        value = product.value;
        exponent += product.shift;
      }
      if ((value & 0x400n) !== 0n) {
        let rounded = value + 0x3ffn + ((value >> 11n) & 1n);
        if (rounded > UINT64_MAX) {
          rounded = ((rounded & UINT64_MAX) >> 1n) | UINT64_TOP_BIT;
          exponent += 1;
        }
        value = rounded;
      }
      exponent += 0x3fe;
      if (exponent <= 0) {
        if (exponent === -52 && value >= 0x8000000000000058n) bits = 1n;
        else if (exponent <= -52) bits = 0n;
        else bits = value >> BigInt(-exponent + 12);
      } else if (exponent >= 0x7ff) {
        bits = 0x7ff0000000000000n;
      } else {
        bits = (BigInt(exponent) << 52n) + ((value >> 11n) & 0xfffffffffffffn);
      }
    }
  }
  bitsView.setBigUint64(0, number.negative ? bits | UINT64_TOP_BIT : bits);
  return bitsView.getFloat64(0);
}

function numberToInt32(number: NumberBuffer): number | undefined {
  const digits = number.digits;
  let i = number.scale;
  if (i > 10 || i < digits.length) return undefined;
  let n = 0;
  let p = 0;
  while (--i >= 0) {
    if (n >>> 0 > 214748364) return undefined;
    n = (n * 10 + (p < digits.length ? digits.charCodeAt(p++) - 0x30 : 0)) | 0;
  }
  if (number.negative) {
    n = -n | 0;
    if (n > 0) return undefined;
  } else if (n < 0) {
    return undefined;
  }
  return n;
}

const DECIMAL_DIGIT_LIMIT = 0x199999999999999999999999n;

function decimalToLong(number: NumberBuffer): bigint {
  const digits = number.digits;
  const at = (i: number): number => (i >= 0 && i < digits.length ? digits.charCodeAt(i) : 0);
  let exponent = number.scale;
  let mantissa = 0n;
  if (digits.length === 0) {
    if (exponent > 0) exponent = 0;
  } else {
    if (exponent > 29) throw new VbError('Overflow');
    let p = 0;
    while (
      (exponent > 0 || (at(p) !== 0 && exponent > -28)) &&
      (mantissa < DECIMAL_DIGIT_LIMIT || (mantissa === DECIMAL_DIGIT_LIMIT && at(p) <= 0x35))
    ) {
      mantissa *= 10n;
      if (at(p) !== 0) mantissa += BigInt(at(p++) - 0x30);
      exponent--;
    }
    const next = at(p++);
    if (next >= 0x35) {
      let roundUp = true;
      if (next === 0x35 && at(p - 2) % 2 === 0) {
        let count = 20;
        while (at(p) === 0x30 && count !== 0) {
          p++;
          count--;
        }
        if (at(p) === 0 || count === 0) roundUp = false;
      }
      if (roundUp) {
        mantissa += 1n;
        if (mantissa === 1n << 96n) {
          mantissa = DECIMAL_DIGIT_LIMIT + 1n;
          exponent++;
        }
      }
    }
  }
  if (exponent > 0) throw new VbError('Overflow');
  const scale = exponent <= -29 ? 28 : -exponent;
  if (exponent <= -29) mantissa = 0n;
  const unit = 10n ** BigInt(scale);
  let integer = mantissa / unit;
  const fraction = mantissa % unit;
  const half = unit / 2n;
  if (scale > 0 && (fraction > half || (fraction === half && integer % 2n === 1n))) integer += 1n;
  if (number.negative) integer = -integer;
  if (integer < -(1n << 63n) || integer >= 1n << 63n) throw new VbError('Overflow');
  return integer;
}

function digitValue(c: number): number {
  if (isDigit(c)) return c - 0x30;
  if (c >= 0x41 && c <= 0x5a) return c - 0x41 + 10;
  if (c >= 0x61 && c <= 0x7a) return c - 0x61 + 10;
  return -1;
}

function parseRadix(s: string, radix: 8 | 16, bits: 32 | 64): bigint {
  const length = s.length;
  if (length === 0) throw new VbError('Argument');
  let i = 0;
  if (s.charCodeAt(0) === MINUS) throw new VbError('Argument');
  if (s.charCodeAt(0) === PLUS) i++;
  if (
    radix === 16 &&
    i + 1 < length &&
    s.charCodeAt(i) === 0x30 &&
    (s.charCodeAt(i + 1) === 0x78 || s.charCodeAt(i + 1) === 0x58)
  ) {
    i += 2;
  }
  const start = i;
  const base = BigInt(radix);
  const maxValue = ((1n << BigInt(bits)) - 1n) / base;
  let result = 0n;
  for (; i < length; i++) {
    const digit = digitValue(s.charCodeAt(i));
    if (digit < 0 || digit >= radix) break;
    if (result > maxValue) throw new VbError('Overflow');
    result = result * base + BigInt(digit);
  }
  if (i === start || i < length) throw new VbError('Format');
  return result;
}

function toHalfwidthNumbers(s: string): string {
  let result = '';
  for (let i = 0; i < s.length; i++) result += String.fromCharCode(halfwidth(s.charCodeAt(i)));
  return result;
}

function halfwidth(c: number): number {
  if (c >= 0xff01 && c <= 0xff5e && c !== 0xff3c) return c - 0xfee0;
  if (c === 0x3000) return 0x20;
  if (c === CURRENCY_SYMBOL || c === 0xffe6) return ANSI_CURRENCY_SYMBOL;
  if (c >= 0x80 && isWhiteSpace(c)) return 0x3f;
  const letter = c >= 0xc0 && c <= 0xff ? ascAscii(c) : -1;
  return letter < 0 ? c : letter;
}

function hexOrOctValue(value: string): bigint | undefined {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c === 0x26 && i + 2 < value.length) {
      const kind = value.charCodeAt(i + 1);
      const rest = toHalfwidthNumbers(value.substring(i + 2));
      if (kind === 0x48 || kind === 0x68) return BigInt.asIntN(64, parseRadix(rest, 16, 64));
      if (kind === 0x4f || kind === 0x6f) return BigInt.asIntN(64, parseRadix(rest, 8, 64));
      throw new VbError('Format');
    }
    if (c !== 0x20 && c !== 0x3000) return undefined;
  }
  return undefined;
}

function parseDouble(s: string, styles: number): number {
  const number = tryStringToNumber(s, styles, false);
  if (number === undefined) {
    const trimmed = trim(s);
    if (trimmed === POSITIVE_INFINITY_SYMBOL) return Infinity;
    if (trimmed === NEGATIVE_INFINITY_SYMBOL) return -Infinity;
    if (trimmed === NAN_SYMBOL) return NaN;
    throw new VbError('Format');
  }
  const value = numberToDouble(number);
  if (!Number.isFinite(value)) throw new VbError('Overflow');
  return value === 0 ? 0 : value;
}

function vbConversion(convert: () => number): number {
  try {
    return convert();
  } catch (error) {
    if (error instanceof VbError && error.kind === 'Format') throw new VbError('InvalidCast');
    throw error;
  }
}

export function cdbl(s: string | null): number {
  if (s === null) return 0;
  return vbConversion(() => {
    const literal = hexOrOctValue(s);
    if (literal !== undefined) return Number(literal);
    return parseDouble(toHalfwidthNumbers(s), STYLE_VB);
  });
}

export function cintStr(s: string | null): number {
  if (s === null) return 0;
  return vbConversion(() => {
    const literal = hexOrOctValue(s);
    if (literal !== undefined) {
      if (literal < -0x80000000n || literal > 0x7fffffffn) throw new VbError('Overflow');
      return Number(literal);
    }
    return cint(parseDouble(toHalfwidthNumbers(s), STYLE_VB));
  });
}

export function clngStr(s: string | null): number {
  if (s === null) return 0;
  return vbConversion(() => {
    const literal = hexOrOctValue(s);
    if (literal !== undefined) return Number(literal);
    const number = tryStringToNumber(toHalfwidthNumbers(s), STYLE_VB, true);
    if (number === undefined) throw new VbError('Format');
    return Number(decimalToLong(number));
  });
}

export function integerParse(s: string | null): number {
  if (s === null) throw new VbError('Argument');
  const number = tryStringToNumber(s, STYLE_INTEGER, false);
  if (number === undefined) throw new VbError('Format');
  const value = numberToInt32(number);
  if (value === undefined) throw new VbError('Overflow');
  return value;
}

export function integerTryParse(s: string | null): number | undefined {
  if (s === null) return undefined;
  const number = tryStringToNumber(s, STYLE_INTEGER, false);
  return number === undefined ? undefined : numberToInt32(number);
}

export function doubleParse(s: string | null): number {
  if (s === null) throw new VbError('Argument');
  return parseDouble(s, STYLE_FLOAT);
}

interface NonFiniteSymbols {
  readonly nan: string;
  readonly positiveInfinity: string;
  readonly negativeInfinity: string;
}

const KO_KR_SYMBOLS: NonFiniteSymbols = {
  nan: NAN_SYMBOL,
  positiveInfinity: POSITIVE_INFINITY_SYMBOL,
  negativeInfinity: NEGATIVE_INFINITY_SYMBOL,
};

const INVARIANT_SYMBOLS: NonFiniteSymbols = {
  nan: 'NaN',
  positiveInfinity: 'Infinity',
  negativeInfinity: '-Infinity',
};

const STYLE_FLOAT_ONLY = STYLE_INTEGER | ALLOW_DECIMAL_POINT | ALLOW_EXPONENT;

function tryParseDouble(s: string, styles: number, symbols: NonFiniteSymbols): number | undefined {
  const number = tryStringToNumber(s, styles, false);
  if (number !== undefined) {
    const value = numberToDouble(number);
    if (Number.isFinite(value)) return value === 0 ? 0 : value;
  }
  const trimmed = trim(s);
  if (trimmed === symbols.positiveInfinity) return Infinity;
  if (trimmed === symbols.negativeInfinity) return -Infinity;
  if (trimmed === symbols.nan) return NaN;
  return undefined;
}

export function doubleTryParse(s: string | null): number | undefined {
  if (s === null) return undefined;
  return tryParseDouble(s, STYLE_FLOAT, KO_KR_SYMBOLS);
}

export function doubleTryParseFloatInvariant(s: string | null): number | undefined {
  if (s === null) return undefined;
  return tryParseDouble(s, STYLE_FLOAT_ONLY, INVARIANT_SYMBOLS);
}

export function cboolStr(s: string | null): boolean {
  const value = s ?? '';
  if (nlsEqualsIgnoreCase(value, 'False')) return false;
  if (nlsEqualsIgnoreCase(value, 'True')) return true;
  const isNonZero = vbConversion(() => {
    const literal = hexOrOctValue(value);
    if (literal !== undefined) return literal !== 0n ? 1 : 0;
    return parseDouble(toHalfwidthNumbers(value), STYLE_VB) !== 0 ? 1 : 0;
  });
  return isNonZero !== 0;
}

export function convertToInt32Hex(s: string | null): number {
  if (s === null) return 0;
  return Number(BigInt.asIntN(32, parseRadix(s, 16, 32)));
}


export function len(s: string): number {
  return s.length;
}

export function mid(s: string | null, start: number, length?: number): string {
  if (length === undefined) {
    if (s === null) return '';
    return mid(s, start, s.length);
  }
  if (start <= 0 || length < 0) throw new VbError('Argument');
  if (length === 0 || s === null || start > s.length) return '';
  if (start + length > 2147483647) throw new VbError('Overflow');
  return s.substring(start - 1, start - 1 + length);
}

export function instr(s: string | null, find: string | null): number {
  if (s === null || s.length === 0) return 0;
  if (find === null || find.length === 0) return 1;
  return s.indexOf(find) + 1;
}

export function isWhiteSpace(c: number): boolean {
  return (
    (c >= 0x09 && c <= 0x0d) ||
    c === 0x20 ||
    c === 0x85 ||
    c === 0xa0 ||
    c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) ||
    c === 0x2028 ||
    c === 0x2029 ||
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000
  );
}

export function trim(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && isWhiteSpace(s.charCodeAt(start))) start++;
  while (end > start && isWhiteSpace(s.charCodeAt(end - 1))) end--;
  return s.substring(start, end);
}

export function trimVB(s: string | null): string {
  if (s === null) return '';
  const isSpace = (c: number): boolean => c === 0x20 || c === 0x3000;
  let start = 0;
  let end = s.length;
  while (start < end && isSpace(s.charCodeAt(start))) start++;
  while (end > start && isSpace(s.charCodeAt(end - 1))) end--;
  return s.substring(start, end);
}

export function vbReplace(
  s: string | null,
  find: string | null,
  replacement: string | null,
): string {
  if (s === null || s.length === 0) return '';
  if (find === null || find.length === 0) return s;
  return s.split(find).join(replacement ?? '');
}

export function vbSplit(s: string | null, delimiter: string): string[] {
  if (s === null || s.length === 0) return [''];
  if (delimiter.length === 0) return [s];
  const pattern = nlsElements(delimiter);
  const items: string[] = [];
  let last = 0;
  for (;;) {
    const index = nlsIndexOf(s, pattern, last);
    if (index < 0) {
      items.push(s.substring(last));
      return items;
    }
    items.push(s.substring(last, index));
    last = index + delimiter.length;
    if (last >= s.length) {
      items.push('');
      return items;
    }
  }
}

export function startsWithIgnoreCase(s: string, prefix: string): boolean {
  return nlsStartsWith(s, prefix, true);
}

export function startsWithCulture(s: string, prefix: string): boolean {
  return nlsStartsWith(s, prefix, false);
}

export function endsWithCulture(s: string, suffix: string): boolean {
  const pattern = nlsElements(suffix, false);
  if (pattern.length === 0) return true;
  let previous = NLS_IGNORABLE;
  for (let i = 0; i < s.length; i++) {
    const cls = nlsClass(s.charCodeAt(i));
    if (cls !== NLS_IGNORABLE && (cls !== NLS_MARK || previous === NLS_IGNORABLE)) {
      const end = nlsMatchEnd(s, i, pattern, false);
      if (end >= 0 && skipIgnorable(s, end) === s.length) return true;
    }
    previous = cls;
  }
  return false;
}

function nlsStartsWith(s: string, prefix: string, ignoreCase: boolean): boolean {
  const pattern = nlsElements(prefix, ignoreCase);
  if (pattern.length === 0) return true;
  const first = skipIgnorable(s, 0);
  return first < s.length && nlsMatchEnd(s, first, pattern, ignoreCase) >= 0;
}

function nlsEqualsIgnoreCase(text: string, t: string): boolean {
  const s = text.split('\0').join('');
  const pattern = nlsElements(t, true);
  const first = skipIgnorable(s, 0);
  if (pattern.length === 0) return first === s.length;
  if (first >= s.length) return false;
  const end = nlsMatchEnd(s, first, pattern, true);
  return end >= 0 && skipIgnorable(s, end) === s.length;
}


const NLS_PLAIN = 0;
const NLS_IGNORABLE = 1;
const NLS_MARK = 2;
const NLS_EXPANSION = 3;

const NLS_IGNORABLE_RANGES =
  '00ad 034f 0378-0379 037f-0383 038b 038d 03a2 0524-0525 0528-0530 0557-0558 0560 0588 ' +
  '058b-0590 05c8-05cf 05eb-05ef 05f5-05ff 0604-0605 061c-061d 0640 070e 074b-074c 07b2-07bf ' +
  '07fb-07ff 082e-082f 083f 085c-085d 085f-0900 0978 0980 0984 098d-098e 0991-0992 09a9 09b1 ' +
  '09b3-09b5 09ba-09bb 09c5-09c6 09c9-09ca 09cf-09d6 09d8-09db 09de 09e4-09e5 09fb-0a00 0a04 ' +
  '0a0b-0a0e 0a11-0a12 0a29 0a31 0a34 0a37 0a3a-0a3b 0a3d 0a43-0a46 0a49-0a4a 0a4e-0a50 ' +
  '0a52-0a58 0a5d 0a5f-0a65 0a76-0a80 0a84 0a8e 0a92 0aa9 0ab1 0ab4 0aba-0abb 0ac6 0aca ' +
  '0ace-0acf 0ad1-0adf 0ae4-0ae5 0af0 0af2-0b00 0b04 0b0d-0b0e 0b11-0b12 0b29 0b31 0b34 ' +
  '0b3a-0b3b 0b45-0b46 0b49-0b4a 0b4e-0b55 0b58-0b5b 0b5e 0b64-0b65 0b78-0b81 0b84 0b8b-0b8d ' +
  '0b91 0b96-0b98 0b9b 0b9d 0ba0-0ba2 0ba5-0ba7 0bab-0bad 0bba-0bbd 0bc3-0bc5 0bc9 0bce-0bcf ' +
  '0bd1-0bd6 0bd8-0be5 0bfb-0c00 0c04 0c0d 0c11 0c29 0c34 0c3a-0c3c 0c45 0c49 0c4e-0c54 0c57 ' +
  '0c5a-0c5f 0c64-0c65 0c70-0c77 0c80-0c81 0c84 0c8d 0c91 0ca9 0cb4 0cba-0cbb 0cc5 0cc9 ' +
  '0cce-0cd4 0cd7-0cdd 0cdf 0ce4-0ce5 0cf0 0cf3-0d01 0d04 0d0d 0d11 0d3b-0d3c 0d45 0d49 ' +
  '0d4f-0d56 0d58-0d5f 0d64-0d65 0d76-0d78 0d80-0d81 0d84 0d97-0d99 0db2 0dbc 0dbe-0dbf ' +
  '0dc7-0dc9 0dcb-0dce 0dd5 0dd7 0de0-0df1 0df5-0e00 0e3b-0e3e 0e5c-0e80 0e83 0e85-0e86 0e89 ' +
  '0e8b-0e8c 0e8e-0e93 0e98 0ea0 0ea4 0ea6 0ea8-0ea9 0eac 0eba 0ebe-0ebf 0ec5 0ec7 0ecc ' +
  '0ece-0ecf 0eda-0edb 0ede-0eff 0f48 0f6d-0f70 0f98 0fbd 0fcd 0fdb-0fff 10c6-10cf 10fd-10ff ' +
  '1249 124e-124f 1257 1259 125e-125f 1289 128e-128f 12b1 12b6-12b7 12bf 12c1 12c6-12c7 12d7 ' +
  '1311 1316-1317 135b-135c 137d-137f 139a-139f 13f5-13ff 169d-169f 16f1-16ff 170d 1715-171f ' +
  '1737-173f 1754-175f 176d 1771 1774-177f 17de-17df 17ea-17ef 17fa-17ff 1806 180b-180d 180f ' +
  '181a-181f 1878-187f 18ab-18af 18f6-18ff 191d-191f 192c-192f 193c-193f 1941-1943 196e-196f ' +
  '1975-197f 19ac-19af 19ca-19cf 19db-19dd 1a1c-1a1d 1a5f 1a7d-1a7e 1a8a-1a8f 1a9a-1a9f ' +
  '1aae-1aff 1b4c-1b4f 1b7d-1b7f 1bab-1bad 1bba-1bbf 1bf4-1bfb 1c38-1c3a 1c4a-1c4c 1c80-1ccf ' +
  '1cf3-1cff 1de7-1dfb 1f16-1f17 1f1e-1f1f 1f46-1f47 1f4e-1f4f 1f58 1f5a 1f5c 1f5e 1f7e-1f7f ' +
  '1fb5 1fc5 1fd4-1fd5 1fdc 1ff0-1ff1 1ff5 1fff 200c-200f 202a-202e 2060-206f 2072-2073 208f ' +
  '209d-209f 20b6-20b8 20bb-20cf 20f1-20ff 218a-218f 23f4-23ff 2427-243f 244b-245f 26bd-26bf ' +
  '2700 2795-2797 27b0 27bf 27cb 27cd 2b4d-2b4f 2b5a-2bff 2c2f 2c5f 2cf2-2cf8 2d26-2d2f ' +
  '2d66-2d6e 2d71-2d7e 2d97-2d9f 2da7 2daf 2db7 2dbf 2dc7 2dcf 2dd7 2ddf 2e32-2e7f 2e9a ' +
  '2ef4-2eff 2fd6-2fef 3040 3097-3098 3100-3104 312e-3130 318f-3191 31bb-31bf 31e4-31ee 321f ' +
  '32ff a48d-a48f a4c7-a4cf a62c-a63f a660-a661 a674-a67b a698-a69f a6f8-a6ff a78f a792-a79f ' +
  'a7aa-a7f9 a82c-a82f a836-a83f a878-a87f a8c5-a8cd a8da-a8f1 a8f8-a8fa a8fc-a8ff a954-a95e ' +
  'a97d-a97f a9ce a9da-a9dd a9e0-a9ff aa37-aa3f aa4e-aa4f aa5a-aa5b aa7c-aa7f aac3-aada ' +
  'aae0-ab00 ab07-ab08 ab0f-ab10 ab17-ab1f ab27 ab2f-abbf abee-abef abfa-abff d7a4-d7af ' +
  'd7c7-d7ca d7fc-d7ff d8c0-db7f fa6e-fa6f fada-faff fb07-fb12 fb18-fb1c fb37 fb3d fb3f fb42 ' +
  'fb45 fbb2-fbd2 fd40-fd4f fd90-fd91 fdc8-fdef fdfe-fe0f fe1a-fe1f fe27-fe2f fe53 fe67 ' +
  'fe6c-fe6f fe75 fefd-ff00 ffbf-ffc1 ffc8-ffc9 ffd0-ffd1 ffd8-ffd9 ffdd-ffdf ffe7 ffef-ffff';

const NLS_MARK_RANGES =
  '02b9-02c5 02c8 02cc-02cf 02d1-02d7 02de-02df 02e4-034e 0350-0362 0374 0483-0487 0559-055a ' +
  '0591-05bd 05bf-05c2 05c4-05c5 05c7 0602 0610-061a 064b-065f 0670 06d8-06dc 06e1-06e8 ' +
  '06ea-06ed 0711 0730-074a 07a6-07b0 07eb-07f3 0818-0819 081c-082d 0859-085b 093c 0951-0954 ' +
  '0971 09bc 0a01-0a02 0a3c 0a70-0a71 0abc 0b3c 0b70 0c55-0c56 0cbc 0cd5-0cd6 0e47-0e4d 0f39 ' +
  '0f71 0f7f 0f84-0f85 0f88-0f8f 10fc 135d-135f 1361-1368 16eb-16ed 1a74-1a7c 1a7f 1b6b-1b73 ' +
  '1c37 1dc0-1dd1 1dfc-1dff 20d0-20f0 2cef-2cf1 2d7f 302a-302f 303c-303e 3099-309c a66f ' +
  'a67c-a67d a6f0-a6f1 a92b-a92d fb1e fe20-fe26 ff9e-ff9f';

const NLS_EXPANSION_RANGES =
  '00c6:AE 00de:TH 00df:SS 00e6:AE 00fe:TH 0132-0133:IJ 0152-0153:OE 01bb:2 01bc-01bd:5 ' +
  '01c7-01c9:LJ 01ca-01cc:NJ 01f1-01f3:DZ 0238:DB 0239:QP 02a9:FN 02aa:LS 02ab:LZ 02b0:H ' +
  '02b2:J 02b3:R 02b7:W 02b8:Y 02e1:L 02e2:S 02e3:X 061e:# 1d01-1d02:AE 1d2c:A 1d2d:AE 1d2e:B ' +
  '1d30:D 1d31:E 1d33:G 1d34:H 1d35:I 1d36:J 1d37:K 1d38:L 1d39:M 1d3a:N 1d3c:O 1d3e:P 1d3f:R ' +
  '1d40:T 1d41:U 1d42:W 1d43:A 1d46:AE 1d47:B 1d48:D 1d49:E 1d4d:G 1d4f:K 1d50:M 1d52:O 1d56:P ' +
  '1d57:T 1d58:U 1d5b:V 1d9c:C 1da0:F 1dbb:Z 1e9e:SS 1efa-1efb:LL 2057:# 212a:K 24ff:0 2780:1 ' +
  '2781:2 2782:3 2783:4 2784:5 2785:6 2786:7 2787:8 2788:9 2c7d:V 32cc:HG 32ce:EV 3372:DA ' +
  '3373:AU 3375:OV 3376:PC 3377:DM 337a:IU 3380:PA 3381:NA 3383:MA 3384:KA 3385:KB 3386:MB ' +
  '3387:GB 338a:PF 338b:NF 338e:MG 338f:KG 3390:HZ 3399:FM 339a:NM 339c:MM 339d:CM 339e:KM ' +
  '33a9:PA 33b0:PS 33b1:NS 33b3:MS 33b4:PV 33b5:NV 33b7:MV 33b8:KV 33b9:MV 33ba:PW 33bb:NW ' +
  '33bd:MW 33be:KW 33bf:MW 33c3:BQ 33c4:CC 33c5:CD 33c8:DB 33c9:GY 33ca:HA 33cb:HP 33cc:IN ' +
  '33cd:KK 33ce:KM 33cf:KT 33d0:LM 33d1:LN 33d3:LX 33d4:MB 33d7:PH 33da:PR 33db:SR 33dc:SV ' +
  '33dd:WB a732-a733:AA a734-a735:AO a736-a737:AU a738-a73b:AV a73c-a73d:AY a74e-a74f:OO ' +
  'a760-a761:VY a764-a767:TH fb00:FF fb01:FI fb02:FL fb06:ST';

let nlsClasses: Uint8Array | undefined;
const nlsExpansions = new Map<number, string>();

function nlsClass(c: number): number {
  nlsClasses ??= buildNlsClasses();
  return nlsClasses[c]!;
}

function nlsExpansion(c: number): string {
  return nlsExpansions.get(c)!;
}

function buildNlsClasses(): Uint8Array {
  const classes = new Uint8Array(0x10000);
  const load = (ranges: string, cls: number): void => {
    for (const range of ranges.split(' ')) {
      const [span = '', expansion = ''] = range.split(':');
      const [from = '', to = from] = span.split('-');
      for (let c = parseInt(from, 16); c <= parseInt(to, 16); c++) {
        classes[c] = cls;
        if (expansion !== '') nlsExpansions.set(c, expansion);
      }
    }
  };
  load(NLS_IGNORABLE_RANGES, NLS_IGNORABLE);
  load(NLS_MARK_RANGES, NLS_MARK);
  load(NLS_EXPANSION_RANGES, NLS_EXPANSION);
  return classes;
}

function upperAscii(c: number): number {
  return c >= 0x61 && c <= 0x7a ? c - 0x20 : c;
}

function foldAscii(c: number, ignoreCase: boolean): number {
  return ignoreCase ? upperAscii(c) : c;
}

function expansionFor(c: number, ignoreCase: boolean): string {
  const expansion = nlsExpansion(c);
  const ch = String.fromCharCode(c);
  return ignoreCase || ch.toUpperCase() === ch ? expansion : expansion.toLowerCase();
}

function skipIgnorable(s: string, i: number): number {
  while (i < s.length && nlsClass(s.charCodeAt(i)) === NLS_IGNORABLE) i++;
  return i;
}

function attachedMarksEnd(s: string, i: number): number {
  let end = i + 1;
  while (end < s.length && nlsClass(s.charCodeAt(end)) === NLS_MARK) end++;
  return end;
}

function nlsElements(text: string, ignoreCase = true): string[] {
  const elements: string[] = [];
  for (let i = skipIgnorable(text, 0); i < text.length;) {
    const end = attachedMarksEnd(text, i);
    const c = text.charCodeAt(i);
    const cls = nlsClass(c);
    const marks = text.substring(i + 1, end);
    if (cls === NLS_MARK) {
      elements.push(text.substring(i, end));
    } else {
      const base = cls === NLS_EXPANSION ? expansionFor(c, ignoreCase) : '';
      for (let j = 0; j < base.length - 1; j++) elements.push(base.charAt(j));
      const last = base === '' ? foldAscii(c, ignoreCase) : base.charCodeAt(base.length - 1);
      elements.push(String.fromCharCode(last) + marks);
    }
    i = skipIgnorable(text, end);
  }
  return elements;
}

function elementIs(
  element: string | undefined,
  base: number,
  s: string,
  from: number,
  to: number,
): boolean {
  const offset = base < 0 ? 0 : 1;
  if (element?.length !== offset + to - from) return false;
  if (base >= 0 && element.charCodeAt(0) !== base) return false;
  for (let j = from; j < to; j++) {
    if (element.charCodeAt(offset + j - from) !== s.charCodeAt(j)) return false;
  }
  return true;
}

function nlsMatchEnd(
  s: string,
  i: number,
  pattern: readonly string[],
  ignoreCase: boolean,
): number {
  let k = 0;
  for (;;) {
    const end = attachedMarksEnd(s, i);
    const c = s.charCodeAt(i);
    const cls = nlsClass(c);
    if (cls === NLS_MARK) {
      if (!elementIs(pattern[k++], -1, s, i, end)) return -1;
    } else if (cls === NLS_EXPANSION) {
      const expansion = expansionFor(c, ignoreCase);
      for (let j = 0; j < expansion.length; j++) {
        if (k === pattern.length) return -1;
        const marksEnd = j === expansion.length - 1 ? end : i + 1;
        if (!elementIs(pattern[k++], expansion.charCodeAt(j), s, i + 1, marksEnd)) return -1;
      }
    } else if (!elementIs(pattern[k++], foldAscii(c, ignoreCase), s, i + 1, end)) {
      return -1;
    }
    if (k === pattern.length) return end;
    i = skipIgnorable(s, end);
    if (i >= s.length) return -1;
  }
}

function nlsIndexOf(s: string, pattern: readonly string[], from: number): number {
  const first = pattern[0];
  if (first === undefined) return from;
  const firstBase = first.charCodeAt(0);
  let previous = NLS_IGNORABLE;
  for (let i = from; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const cls = nlsClass(c);
    const starts =
      cls === NLS_PLAIN
        ? upperAscii(c) === firstBase
        : cls === NLS_EXPANSION || (cls === NLS_MARK && previous === NLS_IGNORABLE);
    if (starts && nlsMatchEnd(s, i, pattern, true) >= 0) return i;
    previous = cls;
  }
  return -1;
}


const UCASE_RANGES =
  '0061-007a>0041 00b5>039c 00e0-00f6>00c0 00f8-00fe>00d8 00ff>0178 0101-012f/2>0100 0131>0049 ' +
  '0133-0137/2>0132 013a-0148/2>0139 014b-0177/2>014a 017a-017e/2>0179 017f>0053 0180>0243 ' +
  '0183-0185/2>0182 0188>0187 018c>018b 0192>0191 0195>01f6 0199>0198 019a>023d 019e>0220 ' +
  '01a1-01a5/2>01a0 01a8>01a7 01ad>01ac 01b0>01af 01b4-01b6/2>01b3 01b9>01b8 01bd>01bc ' +
  '01bf>01f7 01c5>01c4 01c6>01c4 01c8>01c7 01c9>01c7 01cb>01ca 01cc>01ca 01ce-01dc/2>01cd ' +
  '01dd>018e 01df-01ef/2>01de 01f2>01f1 01f3>01f1 01f5>01f4 01f9-021f/2>01f8 0223-0233/2>0222 ' +
  '023c>023b 0242>0241 0247-024f/2>0246 0250>2c6f 0251>2c6d 0253>0181 0254>0186 0256-0257>0189 ' +
  '0259>018f 025b>0190 0260>0193 0263>0194 0268>0197 0269>0196 026b>2c62 026f>019c 0271>2c6e ' +
  '0272>019d 0275>019f 027d>2c64 0280>01a6 0283>01a9 0288>01ae 0289>0244 028a-028b>01b1 ' +
  '028c>0245 0292>01b7 0345>0399 0371-0373/2>0370 0377>0376 037b-037d>03fd 03ac>0386 ' +
  '03ad-03af>0388 03b1-03c1>0391 03c2>03a3 03c3-03cb>03a3 03cc>038c 03cd-03ce>038e 03d0>0392 ' +
  '03d1>0398 03d5>03a6 03d6>03a0 03d7>03cf 03d9-03ef/2>03d8 03f0>039a 03f1>03a1 03f2>03f9 ' +
  '03f5>0395 03f8>03f7 03fb>03fa 0430-044f>0410 0450-045f>0400 0461-0481/2>0460 ' +
  '048b-04bf/2>048a 04c2-04ce/2>04c1 04cf>04c0 04d1-0523/2>04d0 0561-0586>0531 1d79>a77d ' +
  '1d7d>2c63 1e01-1e95/2>1e00 1e9b>1e60 1ea1-1eff/2>1ea0 1f00-1f07>1f08 1f10-1f15>1f18 ' +
  '1f20-1f27>1f28 1f30-1f37>1f38 1f40-1f45>1f48 1f51-1f57/2>1f59 1f60-1f67>1f68 1f70-1f71>1fba ' +
  '1f72-1f75>1fc8 1f76-1f77>1fda 1f78-1f79>1ff8 1f7a-1f7b>1fea 1f7c-1f7d>1ffa 1f80-1f87>1f88 ' +
  '1f90-1f97>1f98 1fa0-1fa7>1fa8 1fb0-1fb1>1fb8 1fb3>1fbc 1fbe>0399 1fc3>1fcc 1fd0-1fd1>1fd8 ' +
  '1fe0-1fe1>1fe8 1fe5>1fec 1ff3>1ffc 214e>2132 2170-217f>2160 2184>2183 24d0-24e9>24b6 ' +
  '2c30-2c5e>2c00 2c61>2c60 2c65>023a 2c66>023e 2c68-2c6c/2>2c67 2c73>2c72 2c76>2c75 ' +
  '2c81-2ce3/2>2c80 2d00-2d25>10a0 a641-a65f/2>a640 a663-a66d/2>a662 a681-a697/2>a680 ' +
  'a723-a72f/2>a722 a733-a76f/2>a732 a77a-a77c/2>a779 a77f-a787/2>a77e a78c>a78b ff41-ff5a>ff21';

let ucaseTable: Uint16Array | undefined;

function buildUcaseTable(): Uint16Array {
  const table = new Uint16Array(0x10000);
  for (let c = 0; c < 0x10000; c++) table[c] = c;
  for (const run of UCASE_RANGES.split(' ')) {
    const [span = '', to = ''] = run.split('>');
    const [range = '', step = '1'] = span.split('/');
    const [from = '', last = from] = range.split('-');
    const delta = parseInt(to, 16) - parseInt(from, 16);
    for (let c = parseInt(from, 16); c <= parseInt(last, 16); c += Number(step)) {
      table[c] = c + delta;
    }
  }
  return table;
}

export function ucase(s: string): string {
  let ascii = true;
  for (let i = 0; i < s.length && ascii; i++) ascii = s.charCodeAt(i) < 0x80;
  if (ascii) return s.toUpperCase();

  ucaseTable ??= buildUcaseTable();
  let result = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const deseret = c >= 0xdc28 && c <= 0xdc4f && i > 0 && s.charCodeAt(i - 1) === 0xd801;
    result += String.fromCharCode(deseret ? c - 0x28 : ucaseTable[c]!);
  }
  return result;
}


const ASC_LATIN1_LETTERS = 'AAAAAA.CEEEEIIII.NOOOOO..UUUUY..aaaaaa.ceeeeiiii.nooooo..uuuuy.y';

function ascAscii(c: number): number {
  if (c < 0x80) return c;
  if (c >= 0xc0 && c <= 0xff) {
    const letter = ASC_LATIN1_LETTERS.charCodeAt(c - 0xc0);
    return letter === 0x2e ? -1 : letter;
  }
  return -1;
}

function ucaseForAsc(c: number): number {
  if (c >= 0x61 && c <= 0x7a) return c - 0x20;
  if (c >= 0xe0 && c <= 0xfe && c !== 0xf7) return c - 0x20;
  if (c === 0xff) return 0x178;
  if (c === 0x131) return 0x49;
  if (c === 0x17f) return 0x53;
  return c;
}

export function c36Digit(c: string): number {
  const code = ascAscii(ucaseForAsc(c.charCodeAt(0)));
  if (code >= 0x30 && code <= 0x39) return code - 0x30;
  if (code >= 0x41 && code <= 0x5a) return code - 0x41 + 10;
  return 0;
}

export function c62Digit(c: string): number {
  const code = ascAscii(c.charCodeAt(0));
  if (code >= 0x30 && code <= 0x39) return code - 0x30;
  if (code >= 0x41 && code <= 0x5a) return code - 0x41 + 10;
  if (code >= 0x61 && code <= 0x7a) return code - 0x61 + 36;
  return 0;
}


export function toDotNetG15(v: number): string {
  if (Number.isNaN(v)) return 'NaN';
  if (v === Infinity) return 'Infinity';
  if (v === -Infinity) return '-Infinity';
  if (v === 0) return '0';
  const text = Math.abs(v).toExponential(14);
  const e = text.indexOf('e');
  const digits = (text.charAt(0) + text.slice(2, e)).replace(/0+$/, '');
  const exponent = Number(text.slice(e + 1));
  let result: string;
  if (exponent > 14 || exponent < -4) {
    const fraction = digits.length > 1 ? '.' + digits.slice(1) : '';
    const exponentDigits = String(Math.abs(exponent)).padStart(2, '0');
    result = `${digits.charAt(0)}${fraction}E${exponent < 0 ? '-' : '+'}${exponentDigits}`;
  } else if (exponent < 0) {
    result = '0.' + '0'.repeat(-exponent - 1) + digits;
  } else if (digits.length <= exponent + 1) {
    result = digits.padEnd(exponent + 1, '0');
  } else {
    result = digits.slice(0, exponent + 1) + '.' + digits.slice(exponent + 1);
  }
  return v < 0 ? '-' + result : result;
}

export function toDotNetString(v: number): string {
  if (v === Infinity) return POSITIVE_INFINITY_SYMBOL;
  if (v === -Infinity) return NEGATIVE_INFINITY_SYMBOL;
  return toDotNetG15(v);
}

export function toDotNetFixed(v: number, decimals: number): string {
  if (Number.isNaN(v)) return NAN_SYMBOL;
  if (v === Infinity) return POSITIVE_INFINITY_SYMBOL;
  if (v === -Infinity) return NEGATIVE_INFINITY_SYMBOL;

  let digits = '';
  let scale = 0;
  let negative = v < 0;
  if (v !== 0) {
    const text = Math.abs(v).toExponential(14);
    const e = text.indexOf('e');
    digits = (text.charAt(0) + text.slice(2, e)).replace(/0+$/, '');
    scale = Number(text.slice(e + 1)) + 1;
  }

  const pos = scale + decimals;
  let i = 0;
  while (i < pos && i < digits.length) i++;
  if (i === pos && i < digits.length && digits.charCodeAt(i) >= 0x35) {
    while (i > 0 && digits.charCodeAt(i - 1) === 0x39) i--;
    if (i > 0) {
      digits = digits.slice(0, i - 1) + String.fromCharCode(digits.charCodeAt(i - 1) + 1);
    } else {
      scale++;
      digits = '1';
    }
  } else {
    while (i > 0 && digits.charCodeAt(i - 1) === 0x30) i--;
    digits = digits.slice(0, i);
  }
  if (digits === '') {
    scale = 0;
    negative = false;
  }

  const digitAt = (index: number): string =>
    index >= 0 && index < digits.length ? digits.charAt(index) : '0';
  let result = negative ? '-' : '';
  if (scale > 0) {
    for (let k = 0; k < scale; k++) result += digitAt(k);
  } else {
    result += '0';
  }
  if (decimals > 0) {
    result += '.';
    for (let k = 0; k < decimals; k++) result += digitAt(scale + k);
  }
  return result;
}

export function toDotNetFormat(v: number, format: '0.000' | '0.0'): string {
  return toDotNetFixed(v, format === '0.000' ? 3 : 1);
}

const ROUND_POWER10 = [
  1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15,
];

export function mathRoundDigits(value: number, digits: number): number {
  const power10 = ROUND_POWER10[digits];
  if (power10 === undefined) throw new VbError('Argument');
  if (Math.abs(value) < 1e16) return mathRound(value * power10) / power10;
  return value;
}

export function gcdDouble(a: number, b: number, gridLimit: number): number {
  let xNMax = a;
  let xNMin = b;
  if (a < b) {
    xNMax = b;
    xNMin = a;
  }
  while (xNMin >= gridLimit) {
    const remainder = xNMax - Math.floor(xNMax / xNMin) * xNMin;
    xNMax = xNMin;
    xNMin = remainder;
  }
  return xNMax;
}
