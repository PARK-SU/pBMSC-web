import { noPoint, type EditTool, type PanelPoint } from './edit-state.ts';
import { noModifiers, type KeyModifiers } from './input/modifiers.ts';

export { isNoPoint, noPoint, type EditTool, type PanelPoint } from './edit-state.ts';
export {
  modifierCtrlOnlyActive,
  modifierHiddenActive,
  modifierLandmineActive,
  modifierLongNoteActive,
  modifierMultiselectNoteActive,
  modifierMultiselectVisibleActive,
  noModifiers,
  type KeyModifiers,
} from './input/modifiers.ts';

export interface Interaction {
  readonly tool: EditTool;
  readonly mouseMoveStatus: PanelPoint | undefined;
  readonly modifiers: KeyModifiers;
  readonly kMouseOver: number;
  readonly bAdjustLength: boolean;
  readonly bAdjustUpper: boolean;
  readonly lastMouseDownLocation: PanelPoint;
  readonly pMouseMove: PanelPoint;
  readonly shouldDrawTempNote: boolean;
  readonly selectedColumn: number;
  readonly tempVPosition: number;
  readonly tempLength: number;
  readonly vSelStart: number;
  readonly vSelLength: number;
  readonly vSelHalf: number;
  readonly vSelMouseOverLine: 0 | 1 | 2 | 3;
  readonly middleButtonClicked: boolean;
  readonly middleButtonLocation: PanelPoint;
  readonly cursorPosition: PanelPoint;
  readonly currentWav: number;
  readonly currentBmp: number;
}

export function createInteraction(): Interaction {
  return {
    tool: 'select',
    mouseMoveStatus: undefined,
    modifiers: noModifiers,
    kMouseOver: -1,
    bAdjustLength: false,
    bAdjustUpper: false,
    lastMouseDownLocation: noPoint,
    pMouseMove: noPoint,
    shouldDrawTempNote: false,
    selectedColumn: -1,
    tempVPosition: -1,
    tempLength: 0,
    vSelStart: 192,
    vSelLength: 0,
    vSelHalf: 0,
    vSelMouseOverLine: 0,
    middleButtonClicked: false,
    middleButtonLocation: { x: 0, y: 0 },
    cursorPosition: { x: 0, y: 0 },
    currentWav: 0,
    currentBmp: 0,
  };
}
