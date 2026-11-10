import { c36Digit, c62Digit, intDiv, len, mid } from '../vb.ts';

export const MaxId36 = 1295;
export const MaxId62 = 3843;

const firstDigit = (n: number): string => String(n).charAt(0);

export function c10to36S(xStart: number): string {
  return xStart < 10 ? firstDigit(xStart) : String.fromCharCode(xStart + 55);
}

export function c36to10S(xChar: string): number {
  return c36Digit(xChar);
}

export function c10to36(xStart: number): string {
  if (xStart < 1) xStart = 1;
  if (xStart > 1295) xStart = 1295;
  return c10to36S(intDiv(xStart, 36)) + c10to36S(xStart % 36);
}

export function c36to10(xStart: string): number {
  xStart = mid('00' + xStart, len(xStart) + 1);
  return c36to10S(xStart.charAt(0)) * 36 + c36to10S(xStart.charAt(1));
}

export function c10to62S(xStart: number): string {
  if (xStart < 10) return firstDigit(xStart);
  if (xStart < 36) return String.fromCharCode(xStart + 55);
  return String.fromCharCode(xStart + 61);
}

export function c62to10S(xChar: string): number {
  return c62Digit(xChar);
}

export function c10to62(xStart: number): string {
  if (xStart < 1) xStart = 1;
  if (xStart > MaxId62) xStart = MaxId62;
  return c10to62S(intDiv(xStart, 62)) + c10to62S(xStart % 62);
}

export function c62to10(xStart: string): number {
  xStart = mid('00' + xStart, len(xStart) + 1);
  return c62to10S(xStart.charAt(0)) * 62 + c62to10S(xStart.charAt(1));
}

export function c10toId(xStart: number, xBase62: boolean): string {
  return xBase62 ? c10to62(xStart) : c10to36(xStart);
}

export function cIdto10(xStart: string, xBase62: boolean): number {
  return xBase62 ? c62to10(xStart) : c36to10(xStart);
}

export function maxId(xBase62: boolean): number {
  return xBase62 ? MaxId62 : MaxId36;
}
