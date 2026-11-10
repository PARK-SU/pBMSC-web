import { clng, int, len, mid, toDotNetG15, VbError } from '../vb.ts';

export function writeDecimalWithDot(v: number): string {
  return toDotNetG15(v);
}

export function add3Zeros(xNum: number): string {
  const xStr1 = '000' + String(xNum);
  return mid(xStr1, len(xStr1) - 2);
}

export function add2Zeros(xNum: number): string {
  const xStr1 = '00' + String(xNum);
  return mid(xStr1, len(xStr1) - 1);
}

const longMin = -(2n ** 63n);
const longMax = 2n ** 63n - 1n;

function checkedLong(v: bigint): bigint {
  if (v < longMin || v > longMax) throw new VbError('Overflow');
  return v;
}

export function getDenominator(a: number, maxDenom = 0x7fffffff): number {
  let m00 = 1n;
  let m01 = 0n;
  let m10 = 0n;
  let m11 = 1n;
  let x = a;
  let ai = BigInt(clng(int(x)));
  const limit = BigInt(maxDenom);

  while (checkedLong(checkedLong(m10 * ai) + m11) <= limit) {
    let t = checkedLong(checkedLong(m00 * ai) + m01);
    m01 = m00;
    m00 = t;
    t = checkedLong(checkedLong(m10 * ai) + m11);
    m11 = m10;
    m10 = t;

    if (x === Number(ai)) break;
    x = 1 / (x - Number(ai));

    if (x > 2 ** 63) break;
    ai = BigInt(clng(int(x)));
  }

  return Number(m10);
}
