<script lang="ts">
  import { tick } from 'svelte';
  import { readable } from 'svelte/store';
  import { validateSelection } from '../../core/edit/selection.ts';
  import { getMaxVPosition } from '../../core/model/measure.ts';
  import { clng } from '../../core/vb.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import { webText } from '../../i18n/web.ts';
  import { featureText } from '../../i18n/features.ts';
  import type { ChromeProps } from './types.ts';

  export let controller: ChromeProps['controller'];
  export let chrome: ChromeProps['chrome'];
  const selectionStore = readable(controller.getTimeSelection(), (set) => {
    const refresh = () => set(controller.getTimeSelection());
    const status = controller.subscribeStatus(refresh);
    const changed = controller.subscribe(refresh);
    return () => {
      status();
      changed();
    };
  });
  $: selection = $selectionStore;
  const label = (key: string, fallback: string) =>
    sourceLabel(chrome, `StatusBar/${key}`, fallback);
  let numerator = '2';
  let denominator = '1';
  let bpm = '120';
  let editing: 'start' | 'length' | 'half' | undefined;
  let draft = '';
  let dialog: HTMLDialogElement | undefined;
  let input: HTMLInputElement | undefined;
  const captions = {
    start: ['SelStart', 'Selection start'],
    length: ['SelLength', 'Selection length'],
    half: ['SelSplit', 'Selection split'],
  } as const;
  const edit = async (field: 'start' | 'length' | 'half') => {
    draft = String(selection[field]);
    editing = field;
    await tick();
    dialog?.showModal();
    input?.focus();
    input?.select();
  };
  const apply = () => {
    if (!editing || !draft.trim() || !Number.isFinite(Number(draft))) return;
    const value = validateSelection(
      { ...selection, [editing]: Number(draft) },
      getMaxVPosition(controller.getChart()),
    );
    controller.featureAction({ kind: 'selection', ...value });
    editing = undefined;
  };
  const time = (
    operation: 'top' | 'value' | 'stop' | 'define' | 'both' | 'measure' | 'notes',
    value = 0,
  ) => controller.featureAction({ kind: 'time', operation, value });
</script>

<div
  class="time-selection-bar"
  role="group"
  aria-label={sourceLabel(chrome, 'ToolBar/TimeSelectionTool', 'Time selection')}
>
  {#each ['start', 'length', 'half'] as const as field (field)}
    <button
      type="button"
      name={'timeSelection.' + field}
      title={label(captions[field][0], captions[field][1])}
      aria-label={label(captions[field][0], captions[field][1])}
      onclick={() => void edit(field)}>{selection[field]}</button
    >
  {/each}
  <button
    type="button"
    name="timeSelection.reverse"
    class="time-operation"
    onclick={() =>
      controller.featureAction({
        kind: 'selection',
        start: selection.start + selection.length,
        length: -selection.length,
        half: selection.half - selection.length,
      })}>{label('Reverse', 'Reverse selection')}</button
  >
  <span>×</span>
  <input
    name="timeSelection.numerator"
    aria-label={label('ByMultiple', 'Ratio') + ' / 1'}
    type="number"
    step="any"
    value={numerator}
    oninput={(e) => (numerator = e.currentTarget.value)}
  />
  <span>/</span>
  <input
    name="timeSelection.denominator"
    aria-label={label('ByMultiple', 'Ratio') + ' / 2'}
    type="number"
    step="any"
    value={denominator}
    oninput={(e) => (denominator = e.currentTarget.value)}
  />
  <button
    type="button"
    name="timeSelection.ratio"
    class="time-operation"
    onclick={() => {
      const value = Number(numerator) / Number(denominator);
      if (Number.isFinite(value) && value > 0) time('top', value);
    }}>{label('ByMultiple', 'Expand by ratio')}</button
  >
  <input
    name="timeSelection.bpm"
    aria-label="BPM"
    type="number"
    step="any"
    value={bpm}
    oninput={(e) => (bpm = e.currentTarget.value)}
  />
  <button
    type="button"
    name="timeSelection.value"
    class="time-operation"
    onclick={() => {
      if (bpm.trim() && Number.isFinite(Number(bpm))) time('value', clng(Number(bpm)) * 10000);
    }}>{label('ByValue', 'Relocate by value')}</button
  >
  {#each [['stop', 'Convert area to STOP'], ['define', 'Define measure'], ['both', 'Insert/remove both'], ['measure', 'Insert/remove measure space'], ['notes', 'Insert/remove note space']] as const as [operation, caption] (operation)}
    <button
      type="button"
      name={'timeSelection.' + operation}
      class:time-space={operation !== 'stop'}
      class="time-operation"
      onclick={() => time(operation)}>{featureText(chrome.langFile, caption, chrome)}</button
    >
  {/each}
</div>
{#if editing}
  <dialog
    class="edit-dialog time-selection-dialog"
    bind:this={dialog}
    aria-label={label(captions[editing][0], captions[editing][1])}
    oncancel={(e) => {
      e.preventDefault();
      editing = undefined;
    }}
  >
    <form
      onsubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <label
        >{label(captions[editing][0], captions[editing][1])}<input
          bind:this={input}
          name="timeSelection.edit"
          type="number"
          step="any"
          required
          value={draft}
          oninput={(e) => (draft = e.currentTarget.value)}
        /></label
      >
      <div class="panel-buttons">
        <button type="submit">{webText(chrome.langFile, 'ok', {}, chrome)}</button>
        <button type="button" onclick={() => (editing = undefined)}
          >{webText(chrome.langFile, 'cancel', {}, chrome)}</button
        >
      </div>
    </form>
  </dialog>
{/if}
