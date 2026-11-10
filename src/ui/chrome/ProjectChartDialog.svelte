<script lang="ts">
  import { onMount } from 'svelte';
  import { webText } from '../../i18n/web.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import type { ChromeProps } from './types.ts';
  import { viewValue } from '../viewer/state.ts';
  import { focusOnMount } from '../input/focus.ts';

  export let controller: ChromeProps['controller'];
  export let chrome: ChromeProps['chrome'];

  let dialog: HTMLDialogElement | undefined;
  let path = '';
  const selection = chrome.projectSelection!;

  onMount(() => dialog?.showModal());
</script>

<dialog
  bind:this={dialog}
  class="edit-dialog project-chart-dialog"
  aria-label={viewValue(chrome, webText(chrome.langFile, 'projectChart', {}, chrome))}
  oncancel={(event) => {
    event.preventDefault();
    void controller.chooseProjectChart();
  }}
>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      if (path) void controller.chooseProjectChart(path);
    }}
  >
    <p>{selection.name}</p>
    <label>
      {viewValue(chrome, webText(chrome.langFile, 'projectChart', {}, chrome))}
      <select
        name="chooseProjectChart"
        bind:value={path}
        size={Math.min(10, selection.charts.length + 1)}
        required
        use:focusOnMount
      >
        <option value="" disabled>—</option>
        {#each selection.charts as chart (chart)}<option value={chart}>{chart}</option>{/each}
      </select>
    </label>
    <div class="dialog-buttons">
      <button type="submit" disabled={!path}
        >{viewValue(chrome, sourceLabel(chrome, 'Menu/File/Open', 'Open'))}</button
      >
      <button type="button" onclick={() => void controller.chooseProjectChart()}
        >{viewValue(chrome, webText(chrome.langFile, 'cancel', {}, chrome))}</button
      >
    </div>
  </form>
</dialog>

<style>
  .project-chart-dialog {
    width: 440px;
  }
  select {
    width: 100%;
  }
</style>
