export interface KeyModifiers {
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
}

export type ModifierState = KeyModifiers;

export const noModifiers: KeyModifiers = { ctrl: false, shift: false, alt: false };

export function modifierLongNoteActive(m: KeyModifiers): boolean {
  return m.shift && !m.ctrl;
}

export function modifierHiddenActive(m: KeyModifiers): boolean {
  return m.ctrl && !m.shift;
}

export function modifierLandmineActive(m: KeyModifiers): boolean {
  return modifierMultiselectVisibleActive(m);
}

export function modifierMultiselectVisibleActive(m: KeyModifiers): boolean {
  return m.shift && m.ctrl;
}

export function modifierMultiselectNoteActive(m: KeyModifiers): boolean {
  return m.alt && m.ctrl;
}

export function modifierCtrlOnlyActive(m: KeyModifiers): boolean {
  return m.ctrl && !m.shift && !m.alt;
}
