import { maxId } from '../bms/base.ts';
import { headerText, type ChartHeader } from '../model/chart.ts';
import { clng, VbError } from '../vb.ts';
import type { ChartDocument } from './document.ts';
import { updatePairing } from './pairing.ts';

export type HeaderTextKey = {
  [K in keyof ChartHeader]: ChartHeader[K] extends string ? K : never;
}[keyof ChartHeader];
export type HeaderChoiceKey = 'player' | 'rank' | 'difficulty' | 'lnObj';

export function setHeaderText(doc: ChartDocument, key: HeaderTextKey, value: string): void {
  const text = headerText(value);
  if (doc.chart.header[key] === text) return;
  doc.chart.header[key] = text;
  doc.isSaved = false;
}

export function setHeaderChoice(doc: ChartDocument, key: HeaderChoiceKey, value: number): void {
  const max =
    key === 'player' ? 2 : key === 'rank' ? 4 : key === 'difficulty' ? 5 : maxId(doc.chart.base62);
  if (!Number.isInteger(value) || value < 0 || value > max) throw new VbError('Argument');
  if (doc.chart.header[key] === value) return;
  doc.chart.header[key] = value;
  doc.isSaved = false;
  if (key === 'lnObj') updatePairing(doc.chart);
}

export function setHeaderBPM(doc: ChartDocument, value: number): void {
  if (!(value >= 0.0001 && value <= 65535.9999)) throw new VbError('Argument');
  const scaled = clng(value * 10000);
  if (doc.chart.notes[0]!.value === scaled) return;
  doc.chart.notes[0]!.value = scaled;
  doc.isSaved = false;
}

export function setExpansion(doc: ChartDocument, value: string): void {
  const text = value.replace(/\r\n|\r|\n/g, '\r\n');
  if (doc.chart.expansion === text) return;
  doc.chart.expansion = text;
  doc.isSaved = false;
}
