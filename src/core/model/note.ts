export interface Note {
  vPosition: number;
  columnIndex: number;
  value: number;
  longNote: boolean;
  hidden: boolean;
  length: number;
  landmine: boolean;
  ghost: boolean;
  comment: boolean;

  lnPair: number;
  selected: boolean;
  hasError: boolean;
  errorType: number;

  tempSelected: boolean;
  tempMouseDown: boolean;
  tempIndex: number;
}

export function emptyNote(): Note {
  return {
    vPosition: 0,
    columnIndex: 0,
    value: 0,
    longNote: false,
    hidden: false,
    length: 0,
    landmine: false,
    ghost: false,
    comment: false,
    lnPair: 0,
    selected: false,
    hasError: false,
    errorType: 0,
    tempSelected: false,
    tempMouseDown: false,
    tempIndex: 0,
  };
}

export function newNote(
  columnIndex: number,
  vPosition: number,
  value: number,
  length = 0,
  hidden = false,
  _selected = false,
  landmine = false,
  ghost = false,
  comment = false,
): Note {
  return {
    ...emptyNote(),
    vPosition,
    columnIndex,
    value,
    longNote: length > 0,
    length,
    hidden,
    landmine,
    ghost,
    comment,
  };
}

export function newNoteBMSE(
  columnIndex: number,
  vPosition: number,
  value: number,
  longNote = false,
  hidden = false,
  _selected = false,
  landmine = false,
  ghost = false,
  comment = false,
): Note {
  return {
    ...emptyNote(),
    vPosition,
    columnIndex,
    value,
    longNote,
    hidden,
    landmine,
    ghost,
    comment,
  };
}

export function cloneNote(note: Readonly<Note>): Note {
  return { ...note };
}

export function cloneNotes(notes: readonly Readonly<Note>[]): Note[] {
  return notes.map(cloneNote);
}

export function equalsBMSE(a: Readonly<Note>, b: Readonly<Note>): boolean {
  return (
    a.vPosition === b.vPosition &&
    a.columnIndex === b.columnIndex &&
    a.value === b.value &&
    a.longNote === b.longNote &&
    a.hidden === b.hidden &&
    a.landmine === b.landmine &&
    a.ghost === b.ghost &&
    a.comment === b.comment
  );
}

export function equalsNT(a: Readonly<Note>, b: Readonly<Note>): boolean {
  return (
    a.vPosition === b.vPosition &&
    a.columnIndex === b.columnIndex &&
    a.value === b.value &&
    a.hidden === b.hidden &&
    a.length === b.length &&
    a.landmine === b.landmine &&
    a.ghost === b.ghost &&
    a.comment === b.comment
  );
}
