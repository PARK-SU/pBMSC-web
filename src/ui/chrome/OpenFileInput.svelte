<script lang="ts">
  import { webText } from '../../i18n/web.ts';
  import type { PickerWindow } from '../../project/export.ts';
  import type { ChromeProps } from './types.ts';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];
  export let chrome: ChromeProps['chrome'];

  let chartInput: HTMLInputElement | undefined;
  let folderInput: HTMLInputElement | undefined;
  let pendingFile: File | undefined;

  export function open(): void {
    if (chrome.project.busy) return;
    const picker = window as PickerWindow;
    if (picker.showOpenFilePicker && picker.showDirectoryPicker) void controller.importChartFile();
    else if (pendingFile) folderInput?.click();
    else chartInput?.click();
  }

  async function readChart(file: File): Promise<void> {
    if (/\.zip$/i.test(file.name)) {
      pendingFile = undefined;
      await controller.importProjectSelection([file]);
      return;
    }
    if (await controller.openCachedChart(file)) {
      pendingFile = undefined;
      return;
    }
    pendingFile = file;
    if (navigator.userActivation?.isActive !== false) folderInput?.click();
  }
</script>

<input
  bind:this={chartInput}
  type="file"
  data-chart-file
  accept=".bms,.bme,.bml,.pms,.bmsc,.txt,.zip"
  hidden
  onchange={(event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) void readChart(file);
  }}
/>
<input
  bind:this={folderInput}
  type="file"
  data-song-folder
  webkitdirectory
  multiple
  hidden
  onchange={async (event) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (files.length && (await controller.importProjectSelection(files, pendingFile)))
      pendingFile = undefined;
  }}
/>

{#if pendingFile}
  <div class="folder-request" role="status">
    <p>
      {viewValue(
        chrome,
        webText(chrome.langFile, 'connectSongFolder', { name: pendingFile.name }, chrome),
      )}
    </p>
    {#if chrome.project.failed}<p role="alert">{chrome.project.message}</p>{/if}
    <div class="dialog-buttons">
      <button type="button" disabled={chrome.project.busy} onclick={() => folderInput?.click()}
        >{viewValue(chrome, webText(chrome.langFile, 'openFolder', {}, chrome))}</button
      >
      <button type="button" disabled={chrome.project.busy} onclick={() => (pendingFile = undefined)}
        >{viewValue(chrome, webText(chrome.langFile, 'cancel', {}, chrome))}</button
      >
    </div>
  </div>
{/if}

<style>
  .folder-request {
    position: fixed;
    top: 56px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 80;
    width: 440px;
    max-width: calc(100vw - 24px);
    box-sizing: border-box;
    padding: 12px;
    border: 1px solid #a0a0a0;
    background: #fff;
    box-shadow: 2px 2px 8px rgb(0 0 0 / 25%);
  }
  p {
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>
