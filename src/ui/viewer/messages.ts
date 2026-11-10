import { c10to62 } from '../../core/bms/base.ts';
import type { SaveWarning } from '../../core/bms/serialize.ts';
import type { PromptMessage } from '../../editor/input/prompts.ts';
import type { ChromeMessage } from './controller.ts';
import type { EditorKey, UiText } from './text.ts';

const promptKeys: Readonly<Record<PromptMessage, EditorKey>> = {
  PromptEnter: 'promptEnter',
  PromptEnterNumeric: 'promptEnterNumeric',
  PromptEnterBPM: 'promptEnterBPM',
  PromptEnterSTOP: 'promptEnterSTOP',
  PromptEnterSCROLL: 'promptEnterSCROLL',
};

export function promptText(message: PromptMessage, text: UiText): string {
  return text.text(promptKeys[message]);
}

function saveWarningProblem(warning: SaveWarning, text: UiText): string {
  switch (warning.message) {
    case 'NoteOverlapError':
      return text.text('noteOverlapError');
    case 'BPMOverflowError':
      return `${text.text('bpmOverflowError')}${warning.count} > ${warning.limit}`;
    case 'STOPOverflowError':
      return `${text.text('stopOverflowError')}${warning.count} > ${warning.limit}`;
    case 'SCROLLOverflowError':
      return `${text.text('scrollOverflowError')}${warning.count} > ${warning.limit}`;
    case 'Base36OverflowError':
      return `${text.text('base36OverflowError')}${warning.id} (${c10to62(warning.id)})`;
  }
}

export function messageText(
  message: ChromeMessage,
  text: UiText,
): { readonly text: string; readonly error: boolean; readonly english: boolean } {
  switch (message.kind) {
    case 'invalidLabel':
      return { text: text.text('invalidLabel'), error: true, english: false };
    case 'text':
      return { text: message.text, error: false, english: true };
    case 'saveAsDisabled':
      return { text: text.text('saveAsDisabled'), error: false, english: false };
    case 'saveWarning':
      return {
        text: [
          text.text('saveWarning'),
          saveWarningProblem(message.warning, text),
          text.text('savedFileWillContainErrors'),
        ].join('\n'),
        error: false,
        english: false,
      };
  }
}
