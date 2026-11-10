<script lang="ts">
  import type { ChromeProps } from './types.ts';
  import { featureText } from '../../i18n/features.ts';
  import type { FeatureAction } from '../../editor/input/features.ts';
  import NumberBox from './NumberBox.svelte';
  import Toggle from './Toggle.svelte';
  import { onMount } from 'svelte';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  interface $$Props extends ChromeProps {}

  const t = (s: string) => featureText(chrome.langFile, s, chrome);

  let transform: Extract<FeatureAction, { kind: 'transform' }>['operation'] = 'mirror';

  let clear = true;

  let sort = true;

  let byName = false;

  let old = false;

  let choices: readonly string[] = [];

  let choice = 0;

  let resolver: ((value: number | undefined) => void) | undefined = undefined;

  onMount(() => () => resolver?.(undefined));

  let p = controller.getPreferences();
  $: p = viewValue(chrome, controller.getPreferences());
</script>

<div class="panel-fields feature-panel">
  <fieldset>
    <legend>{viewValue(chrome, t('Selected notes'))}</legend>
    <select
      name="transform.operation"
      aria-label={viewValue(chrome, t('Selected notes'))}
      value={transform}
      onchange={(e) => (transform = e.currentTarget.value as typeof transform)}
    >
      {#each [['mirror', 'Mirror'], ['flip', 'Flip'], ['random', 'Random'], ['rRandom', 'R-Random'], ['sRandom', 'S-Random'], ['hRandom', 'H-Random'], ['sort', 'Sort'], ['autoPosition', 'Serial LN by position'], ['autoColumn', 'Serial LN by column'], ['objToNT', 'LNOBJ to NT'], ['ntToObj', 'NT to LNOBJ']] as const as [id, label] (id)}<option
          value={id}
        >
          {viewValue(chrome, t(label))}
        </option>{/each}
    </select>
    <NumberBox
      name="options.lnGap"
      label={viewValue(chrome, t('LN gap (beats)'))}
      value={p.tool.lnGap ?? 16}
      min={0}
      max={192}
      onChange={(lnGap) => controller.updateOptions({ tool: { ...p.tool, lnGap } })}
    />
    <button
      name="applyTransform"
      onclick={() =>
        controller.featureAction({
          kind: 'transform',
          operation: transform,
          gap: p.tool.lnGap ?? 16,
          jackSpeed: 240 / (p.tool.jackBPM ?? 255) / (p.tool.jackTH ?? 16),
        })}
    >
      {viewValue(chrome, t('Apply'))}
    </button>
    <button
      name="technicalCheck"
      onclick={() =>
        controller.featureAction({
          kind: 'check',
          jackSpeed: 240 / (p.tool.jackBPM ?? 255) / (p.tool.jackTH ?? 16),
        })}
    >
      {viewValue(chrome, t('Check technical errors'))} (Ctrl+Alt+E)
    </button>
  </fieldset>
  <fieldset>
    <legend>{viewValue(chrome, t('Conversion wizard'))}</legend>
    <Toggle
      name="conversion.clear"
      label={viewValue(chrome, t('Remove unused definitions'))}
      value={clear}
      onChange={(value) => (clear = value)}
    />
    <Toggle
      name="conversion.sort"
      label={viewValue(chrome, t('Sort definitions'))}
      value={sort}
      onChange={(value) => (sort = value)}
    />
    <Toggle
      name="conversion.filename"
      label={viewValue(chrome, t('Sort by filename'))}
      value={byName}
      onChange={(value) => (byName = value)}
    />
    <Toggle
      name="conversion.old"
      label={viewValue(chrome, t('Use old format / hexadecimal labels'))}
      value={old}
      onChange={(value) => (old = value)}
    />
    <button
      name="convertDefinitions"
      onclick={() =>
        controller.featureAction({
          kind: 'conversion',
          options: { clearUnused: clear, sort, byFilename: byName, useOldFormat: old },
          writer: p.writer,
        })}
    >
      {viewValue(chrome, t('Convert definitions'))}
    </button>
  </fieldset>
  <label>
    {viewValue(chrome, t('Import SM'))}
    <input
      type="file"
      data-sm-file
      accept=".sm"
      onchange={(e) => {
        const file = e.currentTarget.files?.[0];
        e.currentTarget.value = '';
        if (file)
          void controller.importSM(
            file,
            (list) =>
              new Promise((resolve) => {
                resolver = resolve;
                choices = list;
                choice = 0;
              }),
          );
      }}
    />
  </label>
  {#if choices.length > 0}<fieldset>
      <legend>{viewValue(chrome, t('Choose chart'))}</legend>
      <select
        name="sm.chart"
        aria-label={viewValue(chrome, t('Choose chart'))}
        value={choice}
        onchange={(e) => (choice = Number(e.currentTarget.value))}
      >
        {#each choices as label, i (i)}<option value={i}>
            {label}
          </option>{/each}
      </select>
      <button
        name="importSMChart"
        onclick={() => {
          resolver?.(choice);
          resolver = undefined;
          choices = [];
        }}
      >
        {viewValue(chrome, t('Import'))}
      </button>
      <button
        onclick={() => {
          resolver?.(undefined);
          resolver = undefined;
          choices = [];
        }}
      >
        {viewValue(chrome, t('Cancel'))}
      </button>
    </fieldset>{/if}
</div>
