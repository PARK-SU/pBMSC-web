import { maxId } from '../bms/base.ts';

export interface EditSession {
  vSelStart: number;
  vSelLength: number;
  vSelHalf: number;
  wavIncrease: boolean;
  currentWav: number;
  currentBmp: number;
  beatSelection: number[];
  bAdjustLength: boolean;
  bAdjustUpper: boolean;
}

export function createEditSession(): EditSession {
  return {
    vSelStart: 192,
    vSelLength: 0,
    vSelHalf: 0,
    wavIncrease: false,
    currentWav: 0,
    currentBmp: 0,
    beatSelection: [],
    bAdjustLength: false,
    bAdjustUpper: false,
  };
}


export function decreaseCurrentWAV(s: EditSession): void {
  if (s.currentWav === -1) {
    s.currentWav = 0;
  } else {
    let newIndex = s.currentWav - 1;
    if (newIndex < 0) newIndex = 0;
    s.currentWav = newIndex;
  }
}

export function increaseCurrentWAV(s: EditSession, base62: boolean): void {
  if (s.currentWav === -1) {
    s.currentWav = 0;
  } else {
    let newIndex = s.currentWav + 1;
    if (newIndex > maxId(base62) - 1) newIndex = maxId(base62) - 1;
    s.currentWav = newIndex;
  }
}

export function decreaseCurrentBMP(s: EditSession): void {
  if (s.currentBmp === -1) {
    s.currentBmp = 0;
  } else {
    let newIndex = s.currentBmp - 1;
    if (newIndex < 0) newIndex = 0;
    s.currentBmp = newIndex;
  }
}

export function increaseCurrentBMP(s: EditSession, base62: boolean): void {
  if (s.currentBmp === -1) {
    s.currentBmp = 0;
  } else {
    let newIndex = s.currentBmp + 1;
    if (newIndex > maxId(base62) - 1) newIndex = maxId(base62) - 1;
    s.currentBmp = newIndex;
  }
}
