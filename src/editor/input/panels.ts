import { convertChartBase } from '../../core/bms/base62.ts';
import { changeBeat, copyBeats, pasteBeats, type BeatMode } from '../../core/edit/beat.ts';
import { findNotes, type FindQuery } from '../../core/edit/find.ts';
import {
  setExpansion,
  setHeaderBPM,
  setHeaderChoice,
  setHeaderText,
  type HeaderChoiceKey,
  type HeaderTextKey,
} from '../../core/edit/header.ts';
import {
  addResources,
  duplicateWavs,
  moveResources,
  removeResources,
  renameResource,
  type ResourceKind,
} from '../../core/edit/lists.ts';
import type { EditContext } from '../../core/edit/ops.ts';
import type { EditorOptions } from '../../core/model/chart.ts';
import { niB } from '../../core/model/constants.ts';
import { doubleTryParse, VbError } from '../../core/vb.ts';
import { setCGDivideValue, setCGSubValue, setPlayer, updateColumnsX } from '../view.ts';
import {
  draftAddUndo,
  performContext,
  runInput,
  type InputContext,
  type InputResult,
} from './events.ts';

export type PanelAction =
  | { readonly kind: 'headerText'; readonly key: HeaderTextKey; readonly value: string }
  | { readonly kind: 'headerChoice'; readonly key: HeaderChoiceKey; readonly value: number }
  | { readonly kind: 'headerBPM'; readonly value: number }
  | { readonly kind: 'expansion'; readonly value: string }
  | { readonly kind: 'base'; readonly value: boolean; readonly options: Readonly<EditorOptions> }
  | {
      readonly kind: 'grid';
      readonly divide?: string;
      readonly sub?: string;
      readonly snap?: boolean;
      readonly disableVertical?: boolean;
      readonly show?: boolean;
      readonly showSub?: boolean;
      readonly showVertical?: boolean;
      readonly showMeasure?: boolean;
      readonly showCaption?: boolean;
      readonly bgmColumns?: number;
    }
  | {
      readonly kind: 'resource';
      readonly resource: ResourceKind;
      readonly indices: readonly number[];
      readonly action: 'add' | 'rename' | 'remove' | 'up' | 'down' | 'duplicate';
      readonly paths?: readonly string[];
      readonly name?: string;
      readonly changeLabel?: boolean;
    }
  | {
      readonly kind: 'beat';
      readonly indices: readonly number[];
      readonly action: 'select' | 'apply' | 'copy' | 'paste';
      readonly mode: BeatMode;
      readonly ratio?: string;
      readonly n?: number;
      readonly d?: number;
      readonly text?: string;
    }
  | {
      readonly kind: 'find';
      readonly query: FindQuery;
      readonly operation: 'select' | 'unselect' | 'previous' | 'next';
    }
  | { readonly kind: 'goto'; readonly value: string };

export interface PanelActionResult {
  readonly input: InputResult;
  readonly resourceSelection?: readonly number[];
  readonly clipboard?: string;
}

export function runPanelAction(ctx: InputContext, action: PanelAction): PanelActionResult {
  let resourceSelection: readonly number[] | undefined;
  let clipboard: string | undefined;
  const input = runInput(ctx, (d) => {
    const edit: EditContext = {
      ...performContext(d),
      addUndo: (undo, redo, overwrite) => draftAddUndo(d, undo, redo, overwrite),
    };
    switch (action.kind) {
      case 'headerText':
        setHeaderText(d.doc, action.key, action.value);
        break;
      case 'headerChoice':
        setHeaderChoice(d.doc, action.key, action.value);
        if (action.key === 'player') d.view = setPlayer(d.view, action.value);
        break;
      case 'headerBPM':
        setHeaderBPM(d.doc, action.value);
        break;
      case 'expansion':
        setExpansion(d.doc, action.value);
        break;
      case 'base': {
        const result = convertChartBase(d.chart, action.options, action.value, false);
        if (!result.ok)
          throw new Error(
            result.error === 'Base36OverflowError'
              ? `Base 36 cannot hold id ${result.id}`
              : 'A section tab is open',
          );
        d.doc.isSaved = false;
        break;
      }
      case 'grid':
        if (action.divide !== undefined) d.view = setCGDivideValue(d.view, action.divide);
        if (action.sub !== undefined) d.view = setCGSubValue(d.view, action.sub);
        if (action.bgmColumns !== undefined) {
          if (
            !Number.isInteger(action.bgmColumns) ||
            action.bgmColumns < 1 ||
            action.bgmColumns > 999
          )
            throw new VbError('Argument');
          d.view = updateColumnsX({ ...d.view, gColumns: niB + action.bgmColumns - 1 });
        }
        d.view = {
          ...d.view,
          gSnap: action.snap ?? d.view.gSnap,
          disableVerticalMove: action.disableVertical ?? d.view.disableVerticalMove,
          gShowGrid: action.show ?? d.view.gShowGrid,
          gShowSubGrid: action.showSub ?? d.view.gShowSubGrid,
          gShowVerticalLine: action.showVertical ?? d.view.gShowVerticalLine,
          gShowMeasureBar: action.showMeasure ?? d.view.gShowMeasureBar,
          gShowC: action.showCaption ?? d.view.gShowC,
        };
        break;
      case 'resource': {
        const { resource, indices } = action;
        resourceSelection = [...indices];
        switch (action.action) {
          case 'add':
            resourceSelection = addResources(d.doc, resource, indices, action.paths ?? []);
            break;
          case 'rename':
            if (indices[0] !== undefined)
              renameResource(d.doc, resource, indices[0], action.name ?? '');
            break;
          case 'remove':
            removeResources(d.doc, resource, indices);
            break;
          case 'up':
          case 'down':
            resourceSelection = moveResources(
              d.chart,
              resource,
              indices,
              action.action === 'up' ? -1 : 1,
              action.changeLabel ?? true,
              edit,
            );
            break;
          case 'duplicate':
            if (resource !== 'wav') throw new VbError('Argument');
            resourceSelection = duplicateWavs(d.doc, indices);
            break;
        }
        break;
      }
      case 'beat': {
        d.session.beatSelection = [...action.indices];
        if (action.action === 'copy') clipboard = copyBeats(d.chart, action.indices);
        else if (action.action === 'paste') {
          if (!pasteBeats(d.chart, action.text ?? '', action.mode, edit, d.view.gSub))
            d.message = {
              kind: 'text',
              text: 'Measure length must be greater than 0 and less than 1000.',
            };
        } else if (action.action === 'apply') {
          const fraction =
            action.n !== undefined && action.d !== undefined
              ? { n: action.n, d: action.d }
              : undefined;
          const ratio =
            fraction === undefined ? doubleTryParse(action.ratio ?? '') : fraction.n / fraction.d;
          if (ratio !== undefined) {
            if (fraction === undefined && (ratio <= 0 || ratio >= 1000)) {
              d.message = {
                kind: 'text',
                text: 'Measure length must be greater than 0 and less than 1000.',
              };
              break;
            }
            changeBeat(d.chart, ratio, action.mode, edit, d.view.gSub, fraction);
          }
        }
        break;
      }
      case 'find': {
        const position = findNotes(
          d.chart,
          action.query,
          action.operation,
          -d.view.panels[d.view.focus].vScroll,
          (column) => edit.nEnabled(column),
        );
        if (position !== undefined) {
          const panels: [...typeof d.view.panels] = [...d.view.panels];
          panels[d.view.focus] = { ...panels[d.view.focus], vScroll: -position };
          d.view = { ...d.view, panels };
        }
        break;
      }
      case 'goto': {
        const measure = doubleTryParse(action.value);
        if (measure !== undefined && measure > 0 && measure < 999) {
          const lower = Math.trunc(measure);
          const upper = Math.ceil(measure);
          const position =
            d.chart.measureBottom[lower]! +
            (d.chart.measureBottom[upper]! - d.chart.measureBottom[lower]!) * (measure - lower);
          const panels: [...typeof d.view.panels] = [...d.view.panels];
          panels[d.view.focus] = { ...panels[d.view.focus], vScroll: -position };
          d.view = { ...d.view, panels };
        }
        break;
      }
    }
    d.chartChanged = action.kind !== 'goto' && action.kind !== 'grid';
    d.redraw = true;
    d.status =
      action.kind !== 'headerText' &&
      action.kind !== 'headerChoice' &&
      action.kind !== 'headerBPM' &&
      action.kind !== 'expansion';
  });
  return {
    input,
    ...(resourceSelection === undefined ? {} : { resourceSelection }),
    ...(clipboard === undefined ? {} : { clipboard }),
  };
}
