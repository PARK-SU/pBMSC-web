import { bmsChannelToColumn } from '../model/channels.ts';
import { mid, startsWithCulture, startsWithIgnoreCase, trim, vbReplace, vbSplit } from '../vb.ts';
import { dotNetEnd, dotNetIgnoreCase, dotNetSpace } from './dotnet-regex.ts';

export function swic(str: string, strHash: string): boolean {
  return startsWithIgnoreCase(str, strHash);
}

const base62Line = new RegExp(
  `^${dotNetIgnoreCase('#BASE')}${dotNetSpace}+62${dotNetSpace}*${dotNetEnd}`,
);

export function isBase62BMS(xStrLine: readonly string[]): boolean {
  for (const sLine of xStrLine) {
    if (base62Line.test(trim(sLine))) return true;
  }
  return false;
}

export interface ExpansionState {
  xExpansion: string;
  xStack: number;
}

export function addToExpansion(state: ExpansionState, sLine: string): void {
  const sLineTrim = trim(sLine);
  if (swic(sLineTrim, '#IF') || swic(sLineTrim, '#SWITCH') || swic(sLineTrim, '#SETSWITCH')) {
    state.xStack += 1;
    state.xExpansion += sLine + '\r\n';
  } else if (swic(sLineTrim, '#ENDIF') || swic(sLineTrim, '#ENDSW')) {
    state.xStack -= 1;
    state.xExpansion += sLine + '\r\n';
  } else if (startsWithCulture(sLineTrim, '#')) {
    state.xExpansion += sLine + '\r\n';
  }
}

export function extractExpansion(xString: string): string {
  xString = vbReplace(vbReplace(vbReplace(xString, '\n', '\r'), '\r\r', '\r'), '\r', '\r\n');
  const xStrLine = vbSplit(xString, '\r\n');
  const state: ExpansionState = { xExpansion: '', xStack: 0 };
  for (const sLine of xStrLine) {
    const sLineTrim = trim(sLine);
    if (state.xStack > 0) {
      addToExpansion(state, sLine);
      continue;
    } else if (startsWithCulture(sLineTrim, '#') && mid(sLineTrim, 7, 1) === ':') {
      const xIdentifier = mid(sLineTrim, 5, 2);
      if (bmsChannelToColumn(xIdentifier) === 0) state.xExpansion += sLine + '\r\n';
    } else {
      addToExpansion(state, sLine);
    }
  }
  return state.xExpansion;
}
