import { MaxId62 } from '../core/bms/base.ts';
import { cint, mathRoundDigits } from '../core/vb.ts';
import { colorA, colorR, colorG, colorB, fromArgb } from '../editor/render/colors.ts';

export interface ColorOverride {
  name: string;
  enabled: boolean;
  colorOption: 0 | 1 | 2 | 3;
  rangeL: number;
  rangeU: number;
  noteColor: number;
  noteColorU: number;
}
export function interpolateColorARGB(lower: number, upper: number, ratio: number): number {
  const component = (read: (c: number) => number): number =>
    cint((1 - ratio) * read(lower) + ratio * read(upper));
  return fromArgb(component(colorA), component(colorR), component(colorG), component(colorB));
}
function getHSL(color: number): [number, number, number] {
  const r = colorR(color) / 255,
    g = colorG(color) / 255,
    b = colorB(color) / 255;
  const min = Math.min(r, g, b),
    max = Math.max(r, g, b),
    delta = max - min,
    light = (max + min) / 2;
  const hue =
    delta === 0
      ? 0
      : max === r
        ? (6 + (g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
  const saturation = delta === 0 ? 0 : light === 1 ? 1 : delta / (1 - Math.abs(2 * light - 1));
  return [cint(mathRoundDigits(hue * 60, 0)), cint(saturation * 1000), cint(light * 1000)];
}
export function interpolateColorAHSL(
  lower: number,
  upper: number,
  ratio: number,
  direction = 1,
): number {
  const a = getHSL(lower),
    b = getHSL(upper);
  if (direction === 1 && a[0] > b[0]) b[0] += 360;
  else if (direction === 0 && a[0] < b[0]) a[0] += 360;
  const alpha = Math.min((1 - ratio) * colorA(lower) + ratio * colorA(upper), 255);
  const hue = ((1 - ratio) * a[0] + ratio * b[0]) % 360,
    saturation = Math.min((1 - ratio) * a[1] + ratio * b[1], 1000) / 1000,
    light = (Math.min((1 - ratio) * a[2] + ratio * b[2], 1000) - 500) / 500;
  let r: number, g: number, blue: number;
  if (hue < 60) {
    blue = -1;
    r = 1;
    g = (hue - 30) / 30;
  } else if (hue < 120) {
    blue = -1;
    g = 1;
    r = (90 - hue) / 30;
  } else if (hue < 180) {
    r = -1;
    g = 1;
    blue = (hue - 150) / 30;
  } else if (hue < 240) {
    r = -1;
    blue = 1;
    g = (210 - hue) / 30;
  } else if (hue < 300) {
    g = -1;
    blue = 1;
    r = (hue - 270) / 30;
  } else {
    g = -1;
    r = 1;
    blue = (330 - hue) / 30;
  }
  const channel = (value: number): number =>
    cint(((value * saturation * (1 - Math.abs(light)) + light + 1) * 255) / 2);
  return fromArgb(cint(alpha), channel(r), channel(g), channel(blue));
}
export function loadColorOverrideActive(
  rules: readonly ColorOverride[],
): readonly (number | undefined)[] {
  const result = new Array<number | undefined>(MaxId62 + 1).fill(undefined);
  for (let id = 1; id <= MaxId62; id++)
    for (const rule of rules) {
      if (!rule.enabled || id < rule.rangeL || id > rule.rangeU) continue;
      const ratio = (id - rule.rangeL) / Math.max(1, rule.rangeU - rule.rangeL);
      result[id] =
        rule.colorOption === 0
          ? rule.noteColor
          : rule.colorOption === 1
            ? interpolateColorARGB(rule.noteColor, rule.noteColorU, ratio)
            : interpolateColorAHSL(
                rule.noteColor,
                rule.noteColorU,
                ratio,
                rule.colorOption === 2 ? 1 : 0,
              );
      break;
    }
  return result;
}
