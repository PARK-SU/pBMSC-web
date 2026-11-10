import type { Note } from '../../core/model/note.ts';
import type { PanelIndex, PanStart } from '../view.ts';

export interface DragState {
  readonly selectedNotes: readonly Readonly<Note>[];
  readonly uAdded: boolean;
  readonly ctrlPressed: boolean;
  readonly duplicatedSelectedNotes: boolean;
  readonly bAdjustSingle: boolean;
  readonly vSelAdjust: boolean;
  readonly vSelK: readonly Readonly<Note>[];
  readonly vSelPStart: number;
  readonly vSelPLength: number;
  readonly vSelPHalf: number;
  readonly temp: PanStart;
  readonly tempFirstMouseDown: boolean;
  readonly vsValue: number;
  readonly hsValue: number;
  readonly timer1: boolean;
  readonly timerMiddle: boolean;
  readonly firstMouseEnter: boolean;
  readonly spMouseOver: PanelIndex;
}

export function createDragState(): DragState {
  return {
    selectedNotes: [],
    uAdded: false,
    ctrlPressed: false,
    duplicatedSelectedNotes: false,
    bAdjustSingle: false,
    vSelAdjust: false,
    vSelK: [],
    vSelPStart: 192,
    vSelPLength: 0,
    vSelPHalf: 0,
    temp: { tempX: 0, tempY: 0, tempV: 0, tempH: 0 },
    tempFirstMouseDown: false,
    vsValue: 0,
    hsValue: 0,
    timer1: false,
    timerMiddle: false,
    firstMouseEnter: true,
    spMouseOver: 1,
  };
}

export const initialDragState: DragState = createDragState();

export function abortDrag(drag: DragState): DragState {
  return drag.selectedNotes.length === 0 ? drag : { ...drag, selectedNotes: [] };
}
