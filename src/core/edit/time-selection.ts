import type { Chart } from '../model/chart.ts';
import { niBPM, niSTOP } from '../model/constants.ts';
import { getMaxVPosition, measureAtDisplacement, updateMeasureBottom } from '../model/measure.ts';
import { newNote } from '../model/note.ts';
import { clng } from '../vb.ts';
import { getDenominator } from '../bms/decimal.ts';
import { addNote, removeNote, type EditContext } from './ops.ts';
import { convertBMSE2NT, convertNT2BMSE } from './pairing.ts';
import { validateSelection } from './selection.ts';
import {
  UndoChainBuilder,
  redoAddNoteAll,
  redoRemoveNoteAll,
  redoChangeMeasure,
  redoChangeTimeSelection,
  redoLongNoteModify,
  redoMoveNote,
  redoRemoveNote,
} from './chain.ts';

function bounds(ctx: EditContext): [number, number] {
  const s = ctx.session;
  return [
    Math.min(s.vSelStart, s.vSelStart + s.vSelLength),
    Math.max(s.vSelStart, s.vSelStart + s.vSelLength),
  ];
}
function validate(chart: Chart, ctx: EditContext): void {
  const s = ctx.session;
  const v = validateSelection(
    { start: s.vSelStart, length: s.vSelLength, half: s.vSelHalf },
    getMaxVPosition(chart),
  );
  s.vSelStart = v.start;
  s.vSelLength = v.length;
  s.vSelHalf = v.half;
}
function selectRange(chart: Chart, ctx: EditContext): void {
  const [lo, hi] = bounds(ctx);
  for (let i = 1; i < chart.notes.length; i++) {
    const n = chart.notes[i]!;
    n.selected =
      n.vPosition < hi &&
      (chart.ntInput ? n.vPosition + n.length >= lo : n.vPosition >= lo) &&
      ctx.nEnabled(n.columnIndex);
  }
}
function bpm(chart: Chart, ctx: EditContext, position: number, value: number): void {
  addNote(chart, newNote(niBPM, position, clng(value)), ctx, true, false);
}

export function bpmChangeTop(chart: Chart, ratio: number, ctx: EditContext): void {
  const s = ctx.session,
    b = new UndoChainBuilder();
  if (s.vSelLength !== 0 && ratio !== 1 && ratio > 0) {
    let [lo, hi] = bounds(ctx);
    lo = Math.max(0, lo);
    hi = Math.min(hi, getMaxVPosition(chart) - 1);
    let lower = chart.notes[0]!.value,
      upper = lower;
    redoRemoveNoteAll(b, chart.notes);
    if (!chart.ntInput) {
      let i = 1;
      for (; i < chart.notes.length && chart.notes[i]!.vPosition <= lo; i++)
        if (chart.notes[i]!.columnIndex === niBPM) lower = chart.notes[i]!.value;
      upper = lower;
      for (; i < chart.notes.length && chart.notes[i]!.vPosition <= hi; i++) {
        const n = chart.notes[i]!;
        if (n.columnIndex === niBPM) {
          upper = n.value;
          n.value = clng(n.value * ratio);
        }
        n.vPosition = (n.vPosition - lo) * ratio + lo;
      }
      for (; i < chart.notes.length; i++) chart.notes[i]!.vPosition += (ratio - 1) * (hi - lo);
      bpm(chart, ctx, lo, lower * ratio);
      bpm(chart, ctx, hi + (ratio - 1) * (hi - lo), upper);
    } else {
      let addLower = true,
        addUpper = true;
      for (let i = 1; i < chart.notes.length; i++) {
        const n = chart.notes[i]!;
        if (n.vPosition <= lo) {
          if (n.columnIndex === niBPM) {
            lower = n.value;
            upper = n.value;
            if (n.vPosition === lo) {
              addLower = false;
              n.value = clng(Math.min(n.value * ratio, 655359999));
            }
          }
          if (n.vPosition + n.length > lo)
            n.length += (Math.min(hi, n.vPosition + n.length) - lo) * (ratio - 1);
        } else if (n.vPosition <= hi) {
          if (n.columnIndex === niBPM) {
            upper = n.value;
            if (n.vPosition === hi) addUpper = false;
            else n.value = clng(Math.min(n.value * ratio, 655359999));
          }
          n.length += (clng(Math.min(hi, n.length + n.vPosition)) - n.vPosition) * (ratio - 1);
          n.vPosition = (n.vPosition - lo) * ratio + lo;
        } else n.vPosition += (hi - lo) * (ratio - 1);
      }
      if (addLower) bpm(chart, ctx, lo, lower * ratio);
      if (addUpper) bpm(chart, ctx, (hi - lo) * ratio + lo, upper);
    }
    for (const n of chart.notes.slice(1)) if (n.columnIndex === niBPM && n.value < 1) n.value = 1;
    redoAddNoteAll(b, chart.notes);
    const previous = { ...s };
    if (s.vSelLength < 0) s.vSelStart += (ratio - 1) * (hi - lo);
    s.vSelLength *= ratio;
    s.vSelHalf *= ratio;
    validate(chart, ctx);
    redoChangeTimeSelection(
      b,
      previous.vSelStart,
      previous.vSelLength,
      previous.vSelHalf,
      s.vSelStart,
      s.vSelLength,
      s.vSelHalf,
      true,
    );
    selectRange(chart, ctx);
  }
  ctx.addUndo(b.undoHead(), b.redoHead());
}

export function bpmChangeHalf(chart: Chart, delta: number, ctx: EditContext): void {
  const s = ctx.session,
    b = new UndoChainBuilder();
  let [lo, hi] = bounds(ctx),
    mid = s.vSelStart + s.vSelHalf;
  if (s.vSelLength !== 0 && delta !== 0 && mid + delta > lo && mid + delta < hi) {
    lo = Math.max(lo, 0);
    hi = Math.min(hi, getMaxVPosition(chart) - 1);
    mid = Math.max(lo, Math.min(hi, mid));
    const r1 = (mid - lo + delta) / (mid - lo),
      r2 = (hi - mid - delta) / (hi - mid);
    let lower = chart.notes[0]!.value,
      middle = lower,
      upper = lower;
    redoRemoveNoteAll(b, chart.notes);
    if (!chart.ntInput) {
      let i = 1;
      for (; i < chart.notes.length && chart.notes[i]!.vPosition <= lo; i++)
        if (chart.notes[i]!.columnIndex === niBPM) lower = chart.notes[i]!.value;
      middle = lower;
      for (; i < chart.notes.length && chart.notes[i]!.vPosition <= mid; i++) {
        const n = chart.notes[i]!;
        if (n.columnIndex === niBPM) {
          middle = n.value;
          n.value = clng(n.value * r1);
        }
        n.vPosition = (n.vPosition - lo) * r1 + lo;
      }
      upper = middle;
      for (; i < chart.notes.length && chart.notes[i]!.vPosition <= hi; i++) {
        const n = chart.notes[i]!;
        if (n.columnIndex === niBPM) {
          upper = n.value;
          n.value = clng(Math.min(n.value * r2, 655359999));
        }
        n.vPosition = (n.vPosition - mid) * r2 + mid + delta;
      }
      bpm(chart, ctx, lo, lower * r1);
      bpm(chart, ctx, mid + delta, middle * r2);
      bpm(chart, ctx, hi, upper);
    } else {
      let addLower = true,
        addMiddle = true,
        addUpper = true;
      for (let i = 1; i < chart.notes.length; i++) {
        const n = chart.notes[i]!,
          end = n.vPosition + n.length;
        if (n.vPosition <= lo) {
          if (n.columnIndex === niBPM) {
            lower = n.value;
            middle = n.value;
            upper = n.value;
            if (n.vPosition === lo) {
              addLower = false;
              n.value = clng(n.value * r1);
            }
          }
          if (end > hi) {
          } else if (end > mid) n.length = (end - mid) * r2 + mid + delta - n.vPosition;
          else if (end > lo) n.length = (end - lo) * r1 + lo - n.vPosition;
        } else if (n.vPosition <= mid) {
          if (n.columnIndex === niBPM) {
            middle = n.value;
            upper = n.value;
            if (n.vPosition === mid) {
              addMiddle = false;
              n.value = clng(n.value * clng(r2));
            } else n.value = clng(n.value * clng(r1));
          }
          if (end > hi) n.length = end - lo - (n.vPosition - lo) * r1;
          else if (end > mid) n.length = (mid - n.vPosition) * r1 + (end - mid) * r2;
          else n.length *= r1;
          n.vPosition = (n.vPosition - lo) * r1 + lo;
        } else if (n.vPosition <= hi) {
          if (n.columnIndex === niBPM) {
            upper = n.value;
            if (n.vPosition === hi) addUpper = false;
            else n.value = clng(Math.min(n.value * r2, 655359999));
          }
          n.length = end > hi ? (hi - n.vPosition) * r2 + end - hi : n.length * r2;
          n.vPosition = (n.vPosition - mid) * r2 + mid + delta;
        }
      }
      if (addLower) bpm(chart, ctx, lo, lower * r1);
      if (addMiddle) bpm(chart, ctx, mid + delta, middle * r2);
      if (addUpper) bpm(chart, ctx, hi, upper);
    }
    const oldHalf = s.vSelHalf;
    s.vSelHalf += delta;
    validate(chart, ctx);
    redoChangeTimeSelection(
      b,
      s.vSelStart,
      s.vSelLength,
      oldHalf,
      s.vSelStart,
      s.vSelStart,
      s.vSelHalf,
      true,
    );
    redoAddNoteAll(b, chart.notes);
    selectRange(chart, ctx);
  }
  ctx.addUndo(b.undoHead(), b.redoHead());
}

export function bpmChangeByValue(
  chart: Chart,
  value: number,
  ctx: EditContext,
): string | undefined {
  const s = ctx.session;
  if (s.vSelLength === 0) return;
  let [lo, hi] = bounds(ctx),
    mid = s.vSelStart + s.vSelHalf;
  if (mid === hi) mid = lo;
  lo = Math.max(0, lo);
  hi = Math.min(hi, getMaxVPosition(chart) - 1);
  mid = Math.max(lo, Math.min(hi, mid));
  let current = chart.notes[0]!.value,
    i = 1;
  for (; i < chart.notes.length && chart.notes[i]!.vPosition <= lo; i++)
    if (chart.notes[i]!.columnIndex === niBPM) current = chart.notes[i]!.value;
  const positions = [lo],
    values = [current];
  for (; i < chart.notes.length && chart.notes[i]!.vPosition <= hi; i++)
    if (chart.notes[i]!.columnIndex === niBPM) {
      positions.push(chart.notes[i]!.vPosition);
      values.push(chart.notes[i]!.value);
    }
  positions.push(hi);
  let span = 0;
  for (let j = 0; j < values.length; j++) span += (positions[j + 1]! - positions[j]!) / values[j]!;
  const constant = (hi - lo) / span;
  if ((hi - lo) / constant <= (mid - lo) / value)
    return `Please enter a value that is greater than ${((mid - lo) * constant) / (hi - lo) / 10000}.`;
  const divider = constant * (mid - lo) - value * (hi - lo);
  if (divider === 0) return;
  const result = (((mid - hi) * value) / divider) * constant;
  const b = new UndoChainBuilder();
  redoRemoveNoteAll(b, chart.notes);
  const transform = (position: number): number => {
    let time = 0,
      j = 0;
    for (; j < values.length && position >= positions[j + 1]!; j++)
      time += (positions[j + 1]! - positions[j]!) / values[j]!;
    time += (position - positions[j]!) / values[j]!;
    return time - (mid - lo) / value > 0
      ? (time - (mid - lo) / value) * result + mid
      : time * value + lo;
  };
  for (const n of chart.notes.slice(1)) {
    const end = n.vPosition + n.length;
    if (n.vPosition > lo && n.vPosition < hi) n.vPosition = transform(n.vPosition);
    if (chart.ntInput && n.length > 0)
      n.length = (end > lo && end < hi ? transform(end) : end) - n.vPosition;
  }
  i = 1;
  while (i < chart.notes.length && chart.notes[i]!.vPosition <= hi) {
    const n = chart.notes[i]!;
    if (n.vPosition >= lo && n.columnIndex === niBPM) chart.notes.splice(i, 1);
    else i++;
  }
  chart.notes.push(newNote(niBPM, mid, clng(result)), newNote(niBPM, hi, values.at(-1)!));
  if (lo !== mid) chart.notes.push(newNote(niBPM, lo, value));
  redoAddNoteAll(b, chart.notes);
  selectRange(chart, ctx);
  ctx.addUndo(b.undoHead(), b.redoHead());
  return undefined;
}

export function convertAreaToStop(chart: Chart, ctx: EditContext): string | undefined {
  if (ctx.session.vSelLength === 0) return;
  const [lo, hi] = bounds(ctx);
  if (chart.notes.some((n) => n.vPosition > lo && n.vPosition <= hi))
    return "The selected area can't have notes anywhere but at the start.";
  const b = new UndoChainBuilder();
  redoRemoveNoteAll(b, chart.notes);
  for (const n of chart.notes.slice(1)) if (n.vPosition > hi) n.vPosition -= ctx.session.vSelLength;
  chart.notes.push(newNote(niSTOP, lo, clng(ctx.session.vSelLength * 10000)));
  redoAddNoteAll(b, chart.notes);
  ctx.addUndo(b.undoHead(), b.redoHead());
  return undefined;
}

function refreshMeasures(chart: Chart): void {
  for (const length of chart.measureLength) {
    const a = length / 192;
    clng(a * getDenominator(a));
  }
  updateMeasureBottom(chart);
}
export function addMeasureLine(chart: Chart, position: number): void {
  for (let i = 1; i < 1000; i++)
    if (position < chart.measureBottom[i]!) {
      for (let j = 999; j > i; j--) chart.measureLength[j] = chart.measureLength[j - 1]!;
      chart.measureLength[i] = chart.measureBottom[i]! - position;
      chart.measureLength[i - 1] = position - chart.measureBottom[i - 1]!;
      break;
    }
  refreshMeasures(chart);
}
export function removeMeasureLine(chart: Chart, index: number): void {
  if (index <= 0 || index >= 1000) throw new RangeError(`Measure ${index}`);
  chart.measureLength[index - 1]! += chart.measureLength[index]!;
  for (let i = index; i < 999; i++) chart.measureLength[i] = chart.measureLength[i + 1]!;
  chart.measureLength[999] = 192;
  refreshMeasures(chart);
}
export function addOrRemoveMeasureLine(chart: Chart, ctx: EditContext): void {
  const before = [...chart.measureLength],
    b = new UndoChainBuilder(),
    s = ctx.session;
  if (s.vSelLength === 0) {
    for (let i = 1; i < 1000; i++) {
      if (s.vSelStart === chart.measureBottom[i]) {
        removeMeasureLine(chart, i);
        break;
      }
      if (s.vSelStart < chart.measureBottom[i]!) {
        addMeasureLine(chart, s.vSelStart);
        break;
      }
    }
  } else {
    const [lo, hi] = bounds(ctx);
    let lower = -1,
      upper = -1;
    for (let i = 1; i < 1000; i++) {
      if (lower === -1 && lo <= chart.measureBottom[i]!) lower = i;
      if (hi === chart.measureBottom[i]) {
        upper = i;
        break;
      }
      if (hi < chart.measureBottom[i]!) {
        upper = i - 1;
        break;
      }
    }
    for (let i = upper; i >= lower; i--) removeMeasureLine(chart, i);
    addMeasureLine(chart, lo);
    addMeasureLine(chart, hi);
  }
  redoChangeMeasure(b, before, chart.measureLength);
  ctx.addUndo(b.undoHead(), b.redoHead());
}

export function insertOrRemoveSpace(
  chart: Chart,
  kind: 'measure' | 'notes' | 'both',
  ctx: EditContext,
): void {
  const s = ctx.session,
    delta = s.vSelLength;
  if (delta === 0) return;
  const b = new UndoChainBuilder(),
    [lo, hi] = bounds(ctx);
  if (kind !== 'notes') {
    const before = [...chart.measureLength],
      index = measureAtDisplacement(chart, lo);
    chart.measureLength[index] = Math.max(chart.measureLength[index]! + delta, 1);
    const a = chart.measureLength[index] / 192;
    clng(a * getDenominator(a));
    redoChangeMeasure(b, before, chart.measureLength);
    updateMeasureBottom(chart);
  }
  if (kind !== 'measure') {
    if (!chart.ntInput) {
      redoRemoveNoteAll(b, chart.notes);
      convertBMSE2NT(chart);
      redoAddNoteAll(b, chart.notes);
    }
    let i = 1;
    while (i < chart.notes.length) {
      const n = chart.notes[i]!;
      if (delta < 0 && n.length === 0 && n.selected) {
        redoRemoveNote(b, n);
        removeNote(chart, i, true, s);
        continue;
      }
      if (delta < 0 && n.vPosition >= hi) {
        redoMoveNote(b, n, n.columnIndex, n.vPosition + delta);
        n.vPosition += delta;
      } else if (delta < 0 && n.length !== 0 && n.selected) {
        const end = n.vPosition + n.length;
        if (n.vPosition < lo) {
          const length = end <= hi ? lo - n.vPosition : n.length + delta;
          redoLongNoteModify(b, n, n.vPosition, length);
          n.length = length;
        } else if (end <= hi) {
          redoRemoveNote(b, n);
          removeNote(chart, i, true, s);
          continue;
        } else {
          const position = n.vPosition === lo ? n.vPosition : lo,
            length = n.vPosition === lo ? n.length + delta : end - hi;
          redoLongNoteModify(b, n, position, length);
          n.vPosition = position;
          n.length = length;
        }
      } else if (delta > 0) {
        if ((n.length === 0 && n.vPosition >= lo) || (n.length !== 0 && n.vPosition > lo)) {
          redoMoveNote(b, n, n.columnIndex, n.vPosition + delta);
          n.vPosition += delta;
        }
        else if (n.length !== 0 && n.vPosition <= lo) {
          redoLongNoteModify(b, n, n.vPosition, n.length + delta);
          n.length += delta;
        }
      }
      i++;
    }
    if (!chart.ntInput) {
      redoRemoveNoteAll(b, chart.notes);
      convertNT2BMSE(chart);
      redoAddNoteAll(b, chart.notes);
    }
  }
  ctx.addUndo(b.undoHead(), b.redoHead());
}
