<script lang="ts">
  import { featureMessage } from '../../i18n/features.ts';
  import type { LangFile } from '../../i18n/lang.ts';
  import type { ChromeMessage } from '../viewer/controller.ts';
  import { messageText } from '../viewer/messages.ts';
  import type { UiText } from '../viewer/text.ts';
  import { onMount } from 'svelte';
  import { focusOnMount } from '../input/focus.ts';

  export let message: ChromeMessage;

  export let text: UiText;

  export let onClose: () => void;

  export let langFile: LangFile | undefined;

  let dialog: HTMLDialogElement | undefined = undefined;

  onMount(() => dialog?.showModal());

  let shown = messageText(message, text);
  $: shown = messageText(message, text);
</script>

<dialog
  bind:this={dialog}
  class="edit-dialog message"
  role="alertdialog"
  aria-label={shown.error ? text.text('error') : undefined}
  oncancel={(event) => {
    event.preventDefault();
    onClose();
  }}
>
  <form
    method="dialog"
    onsubmit={(event) => {
      event.preventDefault();
      onClose();
    }}
  >
    {#if shown.error}<p class="dialog-title">{text.text('error')}</p>{/if}
    <p class="dialog-text">{shown.english ? featureMessage(langFile, shown.text) : shown.text}</p>
    <div class="dialog-buttons">
      <button type="submit" use:focusOnMount>
        {text.label('ok')}
      </button>
    </div>
  </form>
</dialog>
