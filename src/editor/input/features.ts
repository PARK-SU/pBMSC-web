import { checkTechnicalError } from '../../core/edit/analysis.ts';
import { runBmsConversion, type ConversionOptions } from '../../core/edit/conversion.ts';
import { replaceNotes, type FindQuery } from '../../core/edit/find.ts';
import {
  bpmChangeTop,
  bpmChangeHalf,
  bpmChangeByValue,
  convertAreaToStop,
  addOrRemoveMeasureLine,
  insertOrRemoveSpace,
} from '../../core/edit/time-selection.ts';
import {
  mirrorNotes,
  flipNotes,
  randomNotes,
  sortNotes,
  autoLongNotes,
  lnObjToNT,
  ntToLNObj,
} from '../../core/edit/transforms.ts';
import type { EditContext } from '../../core/edit/ops.ts';
import type { EditorOptions } from '../../core/model/chart.ts';
import { calculateGreatestVPosition } from '../../core/model/measure.ts';
import { sortByVPositionInsertion } from '../../core/model/sort.ts';
import { updatePairing } from '../../core/edit/pairing.ts';
import { determineXKeyMode } from '../view.ts';
import {
  draftAddUndo,
  performContext,
  runInput,
  type InputContext,
  type InputResult,
} from './events.ts';

export type FeatureAction =
  | { kind: 'selection'; start: number; length: number; half: number }
  | {
      kind: 'time';
      operation: 'top' | 'half' | 'value' | 'stop' | 'measure' | 'notes' | 'both' | 'define';
      value: number;
    }
  | {
      kind: 'transform';
      operation:
        | 'mirror'
        | 'flip'
        | 'random'
        | 'rRandom'
        | 'sRandom'
        | 'hRandom'
        | 'sort'
        | 'autoPosition'
        | 'autoColumn'
        | 'objToNT'
        | 'ntToObj';
      gap: number;
      jackSpeed: number;
    }
  | {
      kind: 'find';
      operation: 'delete' | 'label' | 'value';
      query: FindQuery;
      replacement: string | number;
    }
  | { kind: 'check'; jackSpeed: number }
  | { kind: 'conversion'; options: ConversionOptions; writer: Readonly<EditorOptions> };
export function runFeature(ctx: InputContext, action: FeatureAction): InputResult {
  return runInput(ctx, (d) => {
    const edit: EditContext = {
      ...performContext(d),
      addUndo: (undo, redo, overwrite) => draftAddUndo(d, undo, redo, overwrite),
    };
    const chart = d.chart,
      mode = determineXKeyMode(d.view, chart.header.player).gXKeyMode;
    let message: string | undefined;
    switch (action.kind) {
      case 'selection':
        d.session.vSelStart = action.start;
        d.session.vSelLength = action.length;
        d.session.vSelHalf = action.half;
        for (const n of chart.notes.slice(1))
          n.selected =
            n.vPosition < Math.max(action.start, action.start + action.length) &&
            n.vPosition + (chart.ntInput ? n.length : 0) >=
              Math.min(action.start, action.start + action.length) &&
            edit.nEnabled(n.columnIndex);
        break;
      case 'time':
        sortByVPositionInsertion(chart.notes);
        switch (action.operation) {
          case 'top':
            bpmChangeTop(chart, action.value, edit);
            break;
          case 'half':
            bpmChangeHalf(chart, action.value, edit);
            break;
          case 'value':
            message = bpmChangeByValue(chart, action.value, edit);
            break;
          case 'stop':
            message = convertAreaToStop(chart, edit);
            break;
          case 'define':
            addOrRemoveMeasureLine(chart, edit);
            break;
          default:
            insertOrRemoveSpace(chart, action.operation, edit);
        }
        break;
      case 'transform':
        switch (action.operation) {
          case 'mirror':
            mirrorNotes(chart, mode, edit);
            break;
          case 'flip':
            flipNotes(chart, mode, edit);
            break;
          case 'random':
          case 'rRandom':
          case 'sRandom':
          case 'hRandom':
            randomNotes(chart, mode, action.operation, edit);
            break;
          case 'sort':
            sortNotes(chart, mode, action.jackSpeed, edit);
            break;
          case 'autoPosition':
          case 'autoColumn':
            autoLongNotes(chart, mode, action.operation === 'autoColumn', action.gap, edit);
            break;
          case 'objToNT':
            lnObjToNT(chart, edit);
            break;
          case 'ntToObj':
            ntToLNObj(chart, edit);
            break;
        }
        break;
      case 'find':
        replaceNotes(chart, action.query, action.operation, action.replacement, edit);
        break;
      case 'check':
        checkTechnicalError(chart, mode, action.jackSpeed);
        break;
      case 'conversion':
        runBmsConversion(chart, action.options, action.writer, edit);
        break;
    }
    if (message) d.message = { kind: 'text', text: message };
    sortByVPositionInsertion(chart.notes);
    updatePairing(chart);
    calculateGreatestVPosition(chart);
    edit.calculateTotalPlayableNotes?.(chart);
    d.chartChanged = true;
    d.redraw = true;
    d.status = true;
    d.edit.kMouseOver = -1;
    d.drag.selectedNotes = [];
  });
}
