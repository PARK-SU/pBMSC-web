import type { WavePeaks } from '../../audio/peaks.ts';
import { peakRange } from '../../audio/peaks.ts';
import type { AuditionLine, WaveOptions } from '../../audio/engine.ts';
import { niSTOP } from '../../core/model/constants.ts';
import { isColumnSound } from '../../core/model/column.ts';
import {
  buildTempoMap,
  timeFromVPosition,
  vPositionFromTime,
  type TempoMap,
} from '../../core/time/timing.ts';
import { cint } from '../../core/vb.ts';
import {
  getColumnWidth,
  horizontalPositionToDisplay,
  nEnabled,
  nLeft,
  noteRowToPanelHeight,
} from '../view.ts';
import { fromArgb } from './colors.ts';
import type { Painter } from './paint.ts';
import type { PanelScene } from './renderer.ts';

export interface AudioVisual {
  readonly options: WaveOptions;
  readonly wave: WavePeaks | undefined;
  readonly wavePosition: number;
  readonly notes: ReadonlyMap<number, WavePeaks>;
  readonly audition: AuditionLine | undefined;
}

function hsl(argb: number) {
  const r = (argb >>> 16) & 255,
    g = (argb >>> 8) & 255,
    b = argb & 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  const l = Math.fround((max + min) / 510);
  const s = delta === 0 ? 0 : Math.fround(delta / (max + min <= 255 ? max + min : 510 - max - min));
  let h =
    delta === 0
      ? 0
      : max === r
        ? (g - b) / delta
        : max === g
          ? 2 + (b - r) / delta
          : 4 + (r - g) / delta;
  h *= 60;
  if (h < 0) h += 360;
  return { h: Math.fround(h), s, l };
}

export function waveColorSettings(argb: number): Pick<WaveOptions, 'opacity' | 'saturation'> {
  return { opacity: argb >>> 24, saturation: hsl(argb).s };
}

export function waveColor(argb: number, options: WaveOptions): number {
  const { h, l } = hsl(argb),
    hue = cint(h),
    saturation = cint(options.saturation * 1000) / 1000;
  const light = (cint(l * 1000) - 500) / 500;
  const rgb =
    hue < 60
      ? [1, (hue - 30) / 30, -1]
      : hue < 120
        ? [(90 - hue) / 30, 1, -1]
        : hue < 180
          ? [-1, 1, (hue - 150) / 30]
          : hue < 240
            ? [-1, (210 - hue) / 30, 1]
            : hue < 300
              ? [(hue - 270) / 30, -1, 1]
              : [1, -1, (330 - hue) / 30];
  const channel = (x: number) =>
    cint(((x * saturation * (1 - Math.abs(light)) + light + 1) * 255) / 2);
  return fromArgb(cint(options.opacity), channel(rgb[0]!), channel(rgb[1]!), channel(rgb[2]!));
}

function waveform(
  painter: Painter,
  scene: PanelScene,
  map: TempoMap,
  peaks: WavePeaks,
  position: number,
  left: number,
  width: number,
): void {
  const audio = scene.audio!;
  const precision = audio.options.precision;
  if (precision <= 0 || width <= 0) return;
  const origin = timeFromVPosition(map, position),
    view = scene.view;
  const offset = view.panels[scene.panel].vScroll;
  const color = waveColor(scene.theme.visual.pBGMWav, audio.options);
  const step = 1 / Math.min(4, precision);
  const end = vPositionFromTime(map, origin + peaks.duration);
  const first = Math.max(0, noteRowToPanelHeight(view, end, offset, scene.height) - step);
  const last = Math.min(
    scene.height,
    noteRowToPanelHeight(view, position, offset, scene.height) + step,
  );
  for (let y = Math.ceil(first / step) * step; y < last; y += step) {
    const high = (scene.height - y - 1) / view.gxHeight - offset;
    const low = (scene.height - y - step - 1) / view.gxHeight - offset;
    const from = timeFromVPosition(map, low) - origin,
      to = timeFromVPosition(map, high) - origin;
    if (to < 0 || from > peaks.duration) continue;
    for (let channel = 0; channel < 2; channel++) {
      const [a, b] = peakRange(peaks, channel, from, to);
      painter.fillRectangle(
        color,
        left + a * width,
        y,
        Math.max(1, (b - a) * width),
        Math.max(step, 1),
      );
    }
  }
}

export function drawAudioBackground(painter: Painter, scene: PanelScene): void {
  const audio = scene.audio;
  if (!audio) return;
  if (audio.wave)
    waveform(
      painter,
      scene,
      buildTempoMap(scene.chart.notes.filter((n) => n.columnIndex !== niSTOP)),
      audio.wave,
      audio.wavePosition,
      audio.options.left,
      audio.options.width,
    );
  const line = audio.audition;
  if (line) {
    const scroll = scene.view.panels[scene.panel].vScroll;
    painter.fillRectangle(
      fromArgb(255, 0, 255, 127),
      0,
      noteRowToPanelHeight(scene.view, line.position, scroll, scene.height),
      scene.width,
      1,
    );
    painter.fillRectangle(
      fromArgb(255, 255, 0, 0),
      0,
      noteRowToPanelHeight(scene.view, line.end, scroll, scene.height),
      scene.width,
      1,
    );
  }
}

export function drawNoteWaveforms(painter: Painter, scene: PanelScene): void {
  const audio = scene.audio;
  if (!audio?.options.onNotes || !audio.notes.size) return;
  const view = scene.view,
    scroll = view.panels[scene.panel];
  const map = buildTempoMap(scene.chart.notes.filter((n) => n.columnIndex !== niSTOP));
  const bottom = -scroll.vScroll,
    top = bottom + scene.height / view.gxHeight;
  for (let i = 1; i < scene.chart.notes.length; i++) {
    const note = scene.chart.notes[i]!;
    if (note.comment || !isColumnSound(note.columnIndex) || !nEnabled(view, note.columnIndex))
      continue;
    const peaks = audio.notes.get(cint(note.value / 10000));
    if (!peaks) continue;
    if (note.vPosition > top) break;
    const end = vPositionFromTime(map, timeFromVPosition(map, note.vPosition) + peaks.duration);
    if (end < bottom) continue;
    const x = nLeft(view, note.columnIndex);
    const left = cint(
      (horizontalPositionToDisplay(view, x, scroll.hScroll) +
        horizontalPositionToDisplay(
          view,
          x + getColumnWidth(view, note.columnIndex),
          scroll.hScroll,
        )) /
        2,
    );
    if (left + audio.options.width < 0 || left - audio.options.width > scene.width) continue;
    waveform(painter, scene, map, peaks, note.vPosition, left, audio.options.width);
  }
}
