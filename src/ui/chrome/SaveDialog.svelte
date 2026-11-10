<script lang="ts">
  import { textEncodingNames, type TextEncodingName } from '../../core/text/encoding.ts';
  import { webText } from '../../i18n/web.ts';
  import type { ChromeProps } from './types.ts';
  import { saveFileName, saveFileTypes, type SaveFileType } from '../viewer/save.ts';
  import { onMount } from 'svelte';
  import { viewValue } from '../viewer/state.ts';
  import { focusOnMount } from '../input/focus.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  interface $$Props extends ChromeProps {}

  let dialog: HTMLDialogElement | undefined = undefined;

  onMount(() => dialog?.showModal());

  let name = chrome.fileName;

  let fileType: SaveFileType =
    saveFileTypes.find(
      ([type]) =>
        !type.startsWith('_') && chrome.fileName.toLowerCase().endsWith(`.${type.toLowerCase()}`),
    )?.[0] ?? '_bms';

  let encoding = chrome.encoding;
</script>

<dialog
  bind:this={dialog}
  class="edit-dialog save-dialog"
  aria-label={viewValue(chrome, webText(chrome.langFile, 'saveAs', {}, chrome))}
  oncancel={(e) => {
    e.preventDefault();
    controller.cancelSaveAs();
  }}
>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      void controller.confirmSaveAs(saveFileName(name, fileType), encoding);
    }}
  >
    <label>
      {viewValue(chrome, webText(chrome.langFile, 'fileName', {}, chrome))}
      <input
        name="saveFileName"
        value={name}
        required
        use:focusOnMount
        oninput={(e) => (name = e.currentTarget.value)}
      />
    </label>
    <label>
      {viewValue(chrome, webText(chrome.langFile, 'fileType', {}, chrome))}
      <select
        name="saveFileType"
        value={fileType}
        onchange={(e) => {
          const value = e.currentTarget.value as SaveFileType;
          fileType = value;
          name = saveFileName(name, value);
        }}
      >
        {#each saveFileTypes as [value, fallback] (value)}<option {value}>
            {viewValue(chrome, chrome.lang?.t(`FileType/${value}`, fallback) ?? fallback)}
          </option>{/each}
      </select>
    </label>
    <label>
      {viewValue(chrome, webText(chrome.langFile, 'encoding', {}, chrome))}
      <select
        name="saveEncoding"
        value={encoding}
        onchange={(e) => (encoding = e.currentTarget.value as TextEncodingName)}
      >
        {#each textEncodingNames as value (value)}<option>{value}</option>{/each}
      </select>
    </label>
    <div class="dialog-buttons">
      <button type="submit"
        >{viewValue(chrome, webText(chrome.langFile, 'download', {}, chrome))}</button
      >
      <button type="button" onclick={() => controller.cancelSaveAs()}>
        {viewValue(chrome, webText(chrome.langFile, 'cancel', {}, chrome))}
      </button>
    </div>
  </form>
</dialog>
