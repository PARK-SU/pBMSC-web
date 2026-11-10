<script lang="ts">
  import type { BeatMode } from '../../core/edit/beat.ts';
  import type { PanelAction } from '../../editor/input/panels.ts';
  import type { ChromeProps } from './types.ts';
  import { webText, type WebKey } from '../../i18n/web.ts';
  import NumberField from './NumberField.svelte';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];
  export let desktop = false;

  interface $$Props extends ChromeProps {
    desktop?: boolean;
  }

  const t = (key: WebKey) => webText(chrome.langFile, key, {}, chrome);

  let mode: BeatMode = 'preserve';

  let ratio = '1';

  let n = 4;

  let d = 4;

  let chart = controller.getChart();
  $: chart = viewValue(chrome, controller.getChart());

  let indices = controller.getBeatSelection();
  $: indices = viewValue(chrome, controller.getBeatSelection());

  const action = (
    extra: Partial<
      Extract<
        PanelAction,
        {
          kind: 'beat';
        }
      >
    >,
  ) => controller.panelAction({ kind: 'beat', indices, mode, action: 'select', ...extra });
</script>

{#snippet measureList()}
  <select
    name="beat.list"
    aria-label={viewValue(chrome, t('Measure'))}
    multiple
    size={9}
    value={viewValue(chrome, indices.map(String))}
    onchange={(e) =>
      action({ indices: Array.from(e.currentTarget.selectedOptions, (o) => Number(o.value)) })}
    onkeydown={(e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c' || e.key === 'v') {
          e.preventDefault();
          void controller.beatClipboard(e.key === 'c' ? 'copy' : 'paste', mode);
        } else if (e.key === 'z') {
          e.preventDefault();
          controller.undo();
        } else if (e.key === 'y') {
          e.preventDefault();
          controller.redo();
        }
      }
    }}
  >
    {#each chart.measureLength as length, i (i)}<option value={String(i)}>
        {viewValue(chrome, String(i).padStart(3, '0'))}: {length / 192}
      </option>{/each}
  </select>
{/snippet}
{#snippet fractionFields()}
  <NumberField
    name="beat.numerator"
    label={viewValue(chrome, t('Numerator'))}
    min={1}
    max={99999}
    step={1}
    value={n}
    onValue={(v) => (n = Number(v))}
  />
  <span class="fraction-divider" aria-hidden="true">/</span>
  <NumberField
    name="beat.denominator"
    label={viewValue(chrome, t('Denominator'))}
    min={1}
    max={10000}
    step={1}
    value={d}
    onValue={(v) => (d = Number(v))}
  />
  <button type="button" onclick={() => action({ action: 'apply', n, d })}
    >{viewValue(chrome, t('Apply fraction'))}</button
  >
{/snippet}

{#snippet ratioFields()}
  <label
    ><span class="beat-ratio-label">{viewValue(chrome, t('Length'))}</span>
    <input name="beat.ratio" value={ratio} oninput={(e) => (ratio = e.currentTarget.value)} />
  </label>
  <button type="button" onclick={() => action({ action: 'apply', ratio })}
    >{viewValue(chrome, t('Apply length'))}</button
  >
{/snippet}

<div class="panel-fields" class:desktop-beat={desktop}>
  {#if desktop}
    <div class="beat-fraction-row">{@render fractionFields()}</div>
    <div class="beat-ratio-row">{@render ratioFields()}</div>
    <details class="panel-expand">
      <summary>{viewValue(chrome, t('expand'))}</summary>
      <div class="panel-buttons">
        <button type="button" onclick={() => void controller.beatClipboard('copy', mode)}
          >{viewValue(chrome, t('Copy'))}</button
        >
        <button type="button" onclick={() => void controller.beatClipboard('paste', mode)}
          >{viewValue(chrome, t('Paste'))}</button
        >
      </div>
    </details>
    <div class="beat-mode-options">
      {#each ['preserve', 'measure', 'cut', 'scale'] as const as item (item)}
        <label
          ><input
            type="radio"
            name="beat.mode"
            value={item}
            checked={mode === item}
            onchange={() => (mode = item)}
          />{viewValue(chrome, t(item))}</label
        >
      {/each}
    </div>
    {@render measureList()}
  {:else}
    {@render measureList()}
    <label
      >{viewValue(chrome, t('Mode'))}
      <select
        name="beat.mode"
        value={mode}
        onchange={(e) => (mode = e.currentTarget.value as BeatMode)}
      >
        {#each ['preserve', 'measure', 'cut', 'scale'] as const as item (item)}<option value={item}
            >{viewValue(chrome, t(item))}</option
          >{/each}
      </select></label
    >
    {@render ratioFields()}
    {@render fractionFields()}
    <div class="panel-buttons">
      <button type="button" onclick={() => void controller.beatClipboard('copy', mode)}
        >{viewValue(chrome, t('Copy'))}</button
      >
      <button type="button" onclick={() => void controller.beatClipboard('paste', mode)}
        >{viewValue(chrome, t('Paste'))}</button
      >
    </div>
  {/if}
</div>
