<script lang="ts">
  import type { LangFile } from '../../i18n/lang.ts';
  import { desktopMediaQuery, mediaQuery } from '../layout/media.ts';
  import Keypad from './Keypad.svelte';
  import {
    promptDefaultText,
    promptMessage,
    type PromptRequest,
  } from '../../editor/input/prompts.ts';
  import { promptText } from '../viewer/messages.ts';
  import type { UiText } from '../viewer/text.ts';
  import { onMount } from 'svelte';
  import { focusOnMount } from '../input/focus.ts';

  export let request: PromptRequest;

  export let text: UiText;

  export let onAnswer: (answer: string | null) => void;

  export let langFile: LangFile | undefined;

  let dialog: HTMLDialogElement | undefined = undefined;

  onMount(() => dialog?.showModal());

  let input: HTMLInputElement | undefined = undefined;

  let value = promptDefaultText(request);

  const desktop = mediaQuery(desktopMediaQuery);
  const answer = (value: string | null) => {
    dialog?.close();
    onAnswer(value);
  };
  $: compact = !$desktop;

  let numeric = compact && request.kind !== 'editComment';
  $: numeric = compact && request.kind !== 'editComment';
</script>

<dialog
  bind:this={dialog}
  class="edit-dialog prompt"
  oncancel={(event) => {
    event.preventDefault();
    answer(null);
  }}
>
  <form
    method="dialog"
    onsubmit={(event) => {
      event.preventDefault();
      answer(input?.value ?? '');
    }}
  >
    <label>
      <span class="dialog-text">{promptText(promptMessage(request), text)}</span>
      <input
        bind:this={input}
        name="answer"
        {value}
        oninput={(e) => (value = e.currentTarget.value)}
        inputMode={numeric ? 'none' : undefined}
        autoComplete="off"
        spellCheck={false}
        use:focusOnMount
      />
    </label>
    {#if numeric}<Keypad
        {value}
        onChange={(nextValue) => (value = nextValue)}
        letters={request.kind === 'editLabel'}
        base62={request.kind === 'editLabel' && request.base62}
        {langFile}
      />{/if}
    <div class="dialog-buttons">
      <button type="submit">{text.label('ok')}</button>
      <button type="button" onclick={() => answer(null)}>
        {text.label('cancel')}
      </button>
    </div>
  </form>
</dialog>
