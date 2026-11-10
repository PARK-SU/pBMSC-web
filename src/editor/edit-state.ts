import { noModifiers, type KeyModifiers } from './input/modifiers.ts';

export type EditTool = 'select' | 'write' | 'timeSelect';

export type ToolMode = EditTool;

export interface PanelPoint {
  readonly x: number;
  readonly y: number;
}

export const noPoint: PanelPoint = { x: -1, y: -1 };

export type TimeSelectionLine = 0 | 1 | 2 | 3;

export interface EditState {
  readonly tool: EditTool;
  readonly kMouseOver: number;
  readonly mouseMoveStatus: PanelPoint | undefined;
  readonly modifiers: KeyModifiers;
  readonly lastMouseDownLocation: PanelPoint;
  readonly pMouseMove: PanelPoint;
  readonly shouldDrawTempNote: boolean;
  readonly selectedColumn: number;
  readonly tempVPosition: number;
  readonly tempLength: number;
  readonly vSelMouseOverLine: TimeSelectionLine;
  readonly middleButtonClicked: boolean;
  readonly middleButtonLocation: PanelPoint;
  readonly lastStatusVPos: number;
  readonly lastStatusColumn: number;
}

export function createEditState(): EditState {
  return {
    tool: 'select',
    kMouseOver: -1,
    mouseMoveStatus: undefined,
    modifiers: noModifiers,
    lastMouseDownLocation: noPoint,
    pMouseMove: noPoint,
    shouldDrawTempNote: false,
    selectedColumn: -1,
    tempVPosition: -1,
    tempLength: 0,
    vSelMouseOverLine: 0,
    middleButtonClicked: false,
    middleButtonLocation: { x: 0, y: 0 },
    lastStatusVPos: -1,
    lastStatusColumn: -1,
  };
}

export function mouseMoveStatusPoint(edit: Pick<EditState, 'mouseMoveStatus'>): PanelPoint {
  return edit.mouseMoveStatus ?? { x: 0, y: 0 };
}

export function isNoPoint(p: PanelPoint): boolean {
  return p.x === -1 && p.y === -1;
}
