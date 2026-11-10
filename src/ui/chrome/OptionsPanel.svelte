<script lang="ts">
  import type { ChromeProps } from './types.ts';
  import { featureText } from '../../i18n/features.ts';
  import { keybindingsInit } from '../../editor/input/keybindings.ts';
  import { defaultPreferences } from '../../settings/preferences.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import Toggle from './Toggle.svelte';
  import GeneralOptions from './GeneralOptions.svelte';
  import VisualOptions from './VisualOptions.svelte';
  import TotalOptions from './TotalOptions.svelte';
  import ColorsPanel from './ColorsPanel.svelte';
  import NumberBox from './NumberBox.svelte';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];
  export let chrome: ChromeProps['chrome'];
  export let text: ChromeProps['text'];
  export let onClose: () => void = () => controller.setPanelSection('header');
  const t = (s: string) => featureText(chrome.langFile, s, chrome);
  $: p = viewValue(chrome, controller.getPreferences());
  let binding = 0;
  let combos = (controller.getPreferences().bindings['0'] ?? keybindingsInit[0]!.combo).join(',');
  const tool = (key: keyof typeof p.tool, value: boolean | number) =>
    controller.updateOptions({ tool: { ...p.tool, [key]: value } });
</script>

{#if chrome.panelSection === 'visual'}
  <VisualOptions {controller} {chrome} {onClose} />
{:else}
  <div class="panel-fields settings-content">
    {#if chrome.panelSection === 'options'}
      <GeneralOptions {controller} {chrome} {text} />
      <details class="total-section">
        <summary>{sourceLabel(chrome, 'TOTALTool/Title', '#TOTAL')}</summary>
        <TotalOptions {controller} {chrome} />
      </details>
      <button
        name="resetOptions"
        onclick={() => {
          const defaults = defaultPreferences();
          controller.updateOptions({
            tool: { ...defaults.tool, previewOnClick: p.tool.previewOnClick },
            writer: defaults.writer,
            total: defaults.total,
            wheel: defaults.wheel,
            page: defaults.page,
          });
        }}>{viewValue(chrome, t('Restore defaults'))}</button
      >
    {:else if chrome.panelSection === 'audio'}
      <fieldset>
        <legend>{viewValue(chrome, t('Audio'))}</legend>
        <Toggle
          name="options.preview"
          label={viewValue(chrome, t('Preview on click'))}
          value={p.tool.previewOnClick}
          onChange={(n) => tool('previewOnClick', n)}
        />
        <NumberBox
          name="options.audioOffset"
          label={viewValue(chrome, t('Audio offset (ms)'))}
          value={p.audioOffset}
          min={-2000}
          max={2000}
          onChange={(audioOffset) => controller.updateOptions({ audioOffset })}
        />
      </fieldset>
    {:else if chrome.panelSection === 'keybindings'}
      <fieldset>
        <legend>{viewValue(chrome, t('Keybinding'))}</legend>
        <select
          name="options.binding"
          aria-label={viewValue(chrome, t('Keybinding'))}
          value={binding}
          onchange={(e) => {
            const id = Number(e.currentTarget.value);
            binding = id;
            combos = (
              p.bindings[String(id)] ?? keybindingsInit.find((k) => k.opVar === id)!.combo
            ).join(',');
          }}
        >
          {#each viewValue( chrome, keybindingsInit.filter((k) => k.description !== '*HIDDEN*') ) as k (k.opVar)}<option
              value={k.opVar}
            >
              {viewValue(chrome, t(k.opName))}
            </option>{/each}
        </select>
        <label>
          {viewValue(chrome, t('Key combinations, separated by commas'))}
          <input
            name="options.combos"
            value={combos}
            oninput={(e) => (combos = e.currentTarget.value)}
          />
        </label>
        <button
          name="applyKeybinding"
          onclick={() =>
            controller.updateOptions({
              bindings: {
                ...p.bindings,
                [String(binding)]: combos
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              },
            })}
        >
          {viewValue(chrome, t('Apply keybinding'))}
        </button>
      </fieldset>
    {:else if chrome.panelSection === 'colors'}
      <ColorsPanel {controller} {chrome} {text} />
    {/if}
    <div class="settings-buttons">
      <button type="button" name="closeSettings" onclick={onClose}
        >{sourceLabel(chrome, 'Find/Close', 'Close')}</button
      >
    </div>
  </div>
{/if}
