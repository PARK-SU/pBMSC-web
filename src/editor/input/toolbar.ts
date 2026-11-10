import {
  redoAddNoteAll,
  redoNT,
  redoRemoveNoteAll,
  redoWavIncrease,
  UndoChainBuilder,
} from '../../core/edit/chain.ts';
import { convertBMSE2NT, convertNT2BMSE } from '../../core/edit/pairing.ts';
import { measureAtDisplacement } from '../../core/model/measure.ts';
import type { EditTool } from '../edit-state.ts';
import {
  calculateTotalPlayableNotes,
  draftAddUndo,
  runInput,
  type InputContext,
  type InputDraft,
  type InputResult,
} from './events.ts';
import { validateTimeSelection } from './tools/timesel.ts';

function selectOrWrite(d: InputDraft, tool: 'select' | 'write'): void {
  const chart = d.chart;
  const s = d.session;
  d.edit.tool = tool;

  d.edit.shouldDrawTempNote = tool === 'write';
  d.edit.selectedColumn = -1;
  d.edit.tempVPosition = -1;
  d.edit.tempLength = 0;
  d.redraw = true;

  const xMeasure = measureAtDisplacement(chart, -d.view.panels[d.view.focus].vScroll) + 1;
  const vSelStart = chart.measureBottom[xMeasure];
  if (vSelStart === undefined) throw new RangeError(`MeasureBottom(${xMeasure}) is out of range`);
  s.vSelStart = vSelStart;
  s.vSelLength = 0;

  d.status = true;
}

export function tbSelectClick(ctx: InputContext): InputResult {
  return runInput(ctx, (d) => selectOrWrite(d, 'select'));
}

export function tbWriteClick(ctx: InputContext): InputResult {
  return runInput(ctx, (d) => selectOrWrite(d, 'write'));
}

export function tbPostEffectsClick(ctx: InputContext): InputResult {
  return runInput(ctx, (d) => {
    d.edit.tool = 'timeSelect';

    d.edit.vSelMouseOverLine = 0;
    d.edit.shouldDrawTempNote = false;
    d.edit.selectedColumn = -1;
    d.edit.tempVPosition = -1;
    d.edit.tempLength = 0;
    validateTimeSelection(d);

    for (const note of d.chart.notes) note.selected = false;
    d.chartChanged = true;
    d.redraw = true;
    d.status = true;
  });
}

export function setTool(ctx: InputContext, tool: EditTool): InputResult {
  switch (tool) {
    case 'select':
      return tbSelectClick(ctx);
    case 'write':
      return tbWriteClick(ctx);
    case 'timeSelect':
      return tbPostEffectsClick(ctx);
  }
}

export function tbNTInputClick(ctx: InputContext, checked: boolean): InputResult {
  return runInput(ctx, (d) => {
    const chart = d.chart;
    chart.ntInput = checked;

    d.session.bAdjustLength = false;
    d.session.bAdjustUpper = false;

    const b = new UndoChainBuilder();
    redoRemoveNoteAll(b, chart.notes);
    redoNT(b, checked, false);
    if (checked) convertBMSE2NT(chart);
    else convertNT2BMSE(chart);
    d.drag.selectedNotes = [];
    calculateTotalPlayableNotes(d);
    redoAddNoteAll(b, chart.notes);

    draftAddUndo(d, b.undoHead(), b.redoHead());
    d.chartChanged = true;
    d.redraw = true;
  });
}

export function tbWavIncreaseClick(ctx: InputContext): InputResult {
  return runInput(ctx, (d) => {
    const s = d.session;
    const b = new UndoChainBuilder();
    s.wavIncrease = !s.wavIncrease;
    redoWavIncrease(b, s.wavIncrease);
    draftAddUndo(d, b.undoHead(), b.redoHead());
  });
}

export const toggleNTInput = tbNTInputClick;

export const toggleWavIncrease = tbWavIncreaseClick;
