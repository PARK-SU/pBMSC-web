<script lang="ts">
  import type { ChromeProps } from './types.ts';
  import { featureText } from '../../i18n/features.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import { c10toId, cIdto10 } from '../../core/bms/base.ts';
  import { fromArgb } from '../../editor/render/colors.ts';
  import type { ColorOverride } from '../../settings/color-overrides.ts';
  import Toggle from './Toggle.svelte';
  import ArgbBox from './ArgbBox.svelte';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  interface $$Props extends ChromeProps {}

  const colorLabels: Readonly<Record<string, string>> = {
    'Label from': 'LabelRange',
    To: 'ToText',
    'Save location': 'SaveSettingsTo',
    Load: 'LoadSettingsFrom',
    Save: 'SaveSettingsTo',
  };
  const t = (s: string) => {
    const path = colorLabels[s];
    return path
      ? sourceLabel(chrome, `VisualOverrideOptions/${path}`, s)
      : featureText(chrome.langFile, s, chrome);
  };

  let rules = controller.getColorRules().map((r) => ({ ...r }));

  let index = 0;

  let scope: 'editor' | 'chart' | 'song' = 'chart';

  let rule = rules[index];
  $: rule = viewValue(chrome, rules[index]);

  const change = (value: Partial<ColorOverride>) =>
    (rules = rules.map((r, i) => (i === index ? { ...r, ...value } : r)));

  const swap = (delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= rules.length) return;
    const next = [...rules];
    [next[index], next[to]] = [next[to]!, next[index]!];
    rules = next;
    index = to;
  };
</script>

<div class="panel-fields feature-panel">
  <label>
    {viewValue(chrome, t('Save location'))}
    <select
      name="colors.scope"
      value={scope}
      onchange={(e) => (scope = e.currentTarget.value as typeof scope)}
    >
      {#each ['editor', 'chart', 'song'] as const as s (s)}<option value={s}>
          {viewValue(chrome, t(s[0]!.toUpperCase() + s.slice(1)))}
        </option>{/each}
    </select>
  </label>
  <div class="panel-buttons">
    <button
      name="loadColors"
      onclick={() => {
        const loaded = controller.readColorRules(scope);
        rules = loaded.map((r) => ({ ...r }));
        index = 0;
      }}
    >
      {viewValue(chrome, t('Load'))}
    </button>
    <button name="saveColors" onclick={() => controller.saveColorRules(scope, rules)}>
      {viewValue(chrome, t('Save'))}
    </button>
  </div>
  <select
    size={viewValue(chrome, Math.min(6, Math.max(2, rules.length)))}
    aria-label={viewValue(chrome, t('Color overrides'))}
    name="colors.rule"
    value={index}
    onchange={(e) => (index = Number(e.currentTarget.value))}
  >
    {#each rules as r, i (i)}<option value={i}>
        {r.enabled ? '● ' : '○ '}
        {r.name}
      </option>{/each}
  </select>
  <div class="panel-buttons">
    <button
      name="addColorRule"
      onclick={() => {
        rules = [
          ...rules,
          {
            name: 'Color ' + (rules.length + 1),
            enabled: true,
            colorOption: 0,
            rangeL: 1,
            rangeU: 2,
            noteColor: fromArgb(255, 255, 128, 0),
            noteColorU: fromArgb(255, 0, 128, 255),
          },
        ];
        index = rules.length - 1;
      }}
    >
      {viewValue(chrome, t('Add'))}
    </button>
    <button
      disabled={!rule}
      onclick={() => {
        rules = rules.filter((_, i) => i !== index);
        index = Math.max(0, index - 1);
      }}
    >
      {viewValue(chrome, t('Remove'))}
    </button>
    <button
      disabled={!rule}
      onclick={() => {
        if (rule) {
          rules = [...rules, { ...rule }];
          index = rules.length - 1;
        }
      }}
    >
      {viewValue(chrome, t('Duplicate'))}
    </button>
    <button disabled={index === 0} onclick={() => swap(-1)}>
      {viewValue(chrome, t('Up'))}
    </button>
    <button disabled={index >= rules.length - 1} onclick={() => swap(1)}>
      {viewValue(chrome, t('Down'))}
    </button>
  </div>
  {#if rule}<fieldset>
      <label>
        {viewValue(chrome, t('Name'))}
        <input
          name="colors.name"
          value={rule.name}
          oninput={(e) => change({ name: e.currentTarget.value })}
        />
      </label>
      <Toggle
        name="colors.enabled"
        label={viewValue(chrome, t('Enabled'))}
        value={rule.enabled}
        onChange={(enabled) => change({ enabled })}
      />
      <label>
        {viewValue(chrome, t('Label from'))}
        <input
          name="colors.from"
          maxLength={2}
          value={viewValue(chrome, c10toId(rule.rangeL, chrome.base62))}
          oninput={(e) => change({ rangeL: cIdto10(e.currentTarget.value, chrome.base62) })}
        />
      </label>
      <label>
        {viewValue(chrome, t('To'))}
        <input
          name="colors.to"
          maxLength={2}
          value={viewValue(chrome, c10toId(rule.rangeU, chrome.base62))}
          oninput={(e) => change({ rangeU: cIdto10(e.currentTarget.value, chrome.base62) })}
        />
      </label>
      <select
        aria-label={viewValue(chrome, t('Color overrides'))}
        name="colors.mode"
        value={rule.colorOption}
        onchange={(e) =>
          change({ colorOption: Number(e.currentTarget.value) as ColorOverride['colorOption'] })}
      >
        {#each ['Single color', 'ARGB gradient', 'HSL clockwise', 'HSL counterclockwise'] as s, i (i)}<option
            value={i}
          >
            {viewValue(chrome, t(s))}
          </option>{/each}
      </select>
      <ArgbBox
        name="colors.lower"
        label={viewValue(chrome, t('Lower color'))}
        value={rule.noteColor}
        alphaLabel={viewValue(chrome, t('Alpha'))}
        onChange={(noteColor) => change({ noteColor })}
      />
      <ArgbBox
        name="colors.upper"
        label={viewValue(chrome, t('Upper color'))}
        value={rule.noteColorU}
        alphaLabel={viewValue(chrome, t('Alpha'))}
        onChange={(noteColorU) => change({ noteColorU })}
      />
    </fieldset>{/if}
</div>
