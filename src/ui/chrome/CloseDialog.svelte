<script lang="ts">
  import { webText } from '../../i18n/web.ts';
  import type { ChromeProps } from './types.ts';
  import { onMount } from 'svelte';
  import { viewValue } from '../viewer/state.ts';
  import { focusOnMount } from '../input/focus.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  interface $$Props extends ChromeProps {}

  let dialog: HTMLDialogElement | undefined = undefined;

  onMount(() => dialog?.showModal());
</script>

<dialog
  bind:this={dialog}
  class="edit-dialog"
  aria-label={viewValue(chrome, webText(chrome.langFile, 'unsaved', {}, chrome))}
  oncancel={(e) => {
    e.preventDefault();
    controller.answerClose('cancel');
  }}
>
  <p>
    {chrome.fileName}: {viewValue(chrome, webText(chrome.langFile, 'closeQuestion', {}, chrome))}
  </p>
  <div class="dialog-buttons">
    <button type="button" use:focusOnMount onclick={() => controller.answerClose('save')}>
      {viewValue(chrome, webText(chrome.langFile, 'save', {}, chrome))}
    </button>
    <button type="button" onclick={() => controller.answerClose('discard')}>
      {viewValue(chrome, webText(chrome.langFile, 'discard', {}, chrome))}
    </button>
    <button type="button" onclick={() => controller.answerClose('cancel')}>
      {viewValue(chrome, webText(chrome.langFile, 'cancel', {}, chrome))}
    </button>
  </div>
</dialog>
