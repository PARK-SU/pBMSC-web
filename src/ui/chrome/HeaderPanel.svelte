<script lang="ts">
  import { c10toId, maxId } from '../../core/bms/base.ts';
  import type { HeaderTextKey } from '../../core/edit/header.ts';
  import type { ChromeProps } from './types.ts';
  import { webText } from '../../i18n/web.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import NumberField from './NumberField.svelte';
  import { viewValue } from '../viewer/state.ts';

  const textHeaders: readonly [HeaderTextKey, string][] = [
    ['title', 'Title'],
    ['artist', 'Artist'],
    ['genre', 'Genre'],
    ['playLevel', 'PlayLevel'],
    ['subTitle', 'SubTitle'],
    ['subArtist', 'SubArtist'],
    ['stageFile', 'StageFile'],
    ['banner', 'Banner'],
    ['backBMP', 'BackBMP'],
    ['exRank', 'ExRank'],
    ['total', 'Total'],
    ['comment', 'Comment'],
  ];

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];
  export let desktop = false;

  interface $$Props extends ChromeProps {
    desktop?: boolean;
  }

  let chart = controller.getChart();
  $: chart = viewValue(chrome, controller.getChart());

  const label = (key: string) => sourceLabel(chrome, `OptionsPanel/Header/${key}`, key);
</script>

<div class="panel-fields header-fields">
  {#each textHeaders.filter(([key]) => !desktop || ['title', 'artist', 'genre'].includes(key)) as [key, title] (key)}<label
      class="panel-field"
    >
      <span>{viewValue(chrome, label(title))}</span>
      <input
        name={`header.${key}`}
        value={chart.header[key]}
        oninput={(e) =>
          controller.panelAction({ kind: 'headerText', key, value: e.currentTarget.value })}
      />
    </label>{/each}
  <NumberField
    name="header.bpm"
    label={viewValue(chrome, label('BPM'))}
    value={chart.notes[0]!.value / 10000}
    min={0.0001}
    max={65535.9999}
    step={0.0001}
    onValue={(value) => controller.panelAction({ kind: 'headerBPM', value: Number(value) })}
  />
  {#each ['player', 'rank', 'difficulty'] as const as key (key)}<label class="panel-field">
      <span>{viewValue(chrome, label(key[0]!.toUpperCase() + key.slice(1)))}</span>
      <select
        name={`header.${key}`}
        value={chart.header[key]}
        onchange={(e) =>
          controller.panelAction({
            kind: 'headerChoice',
            key,
            value: Number(e.currentTarget.value),
          })}
      >
        {#each Array.from({ length: key === 'player' ? 3 : key === 'rank' ? 5 : 6 }) as _, i}<option
            value={i}
          >
            {viewValue(
              chrome,
              label(`${key[0]!.toUpperCase() + key.slice(1)}${key === 'player' ? i + 1 : i}`),
            )}
          </option>{/each}
      </select>
    </label>{/each}
  {#if desktop}
    {#each ['playLevel', 'total'] as const as key (key)}
      <label class="panel-field"
        ><span>{viewValue(chrome, label(key === 'playLevel' ? 'PlayLevel' : 'Total'))}</span>
        <input
          name={`header.${key}`}
          value={chart.header[key]}
          oninput={(e) =>
            controller.panelAction({ kind: 'headerText', key, value: e.currentTarget.value })}
        />
      </label>
    {/each}
  {/if}
  <details class="header-advanced panel-expand" open={!desktop}>
    <summary>{webText(chrome.langFile, 'expand', {}, chrome)}</summary>
    {#if desktop}
      {#each textHeaders.filter(([key]) => !['title', 'artist', 'genre', 'playLevel', 'total'].includes(key)) as [key, title] (key)}
        <label class="panel-field"
          ><span>{viewValue(chrome, label(title))}</span>
          <input
            name={`header.${key}`}
            value={chart.header[key]}
            oninput={(e) =>
              controller.panelAction({ kind: 'headerText', key, value: e.currentTarget.value })}
          />
        </label>
      {/each}
    {/if}
    <label class="panel-field">
      <span>{viewValue(chrome, label('LnObj'))}</span>
      <select
        name="header.lnObj"
        value={chart.header.lnObj}
        onchange={(e) =>
          controller.panelAction({
            kind: 'headerChoice',
            key: 'lnObj',
            value: Number(e.currentTarget.value),
          })}
      >
        <option value={0}>None (#LnType 1)</option>
        {#each Array.from(viewValue(chrome, { length: maxId(chart.base62) })) as _, i}<option
            value={i + 1}
          >
            {viewValue(chrome, c10toId(i + 1, chart.base62))}
          </option>{/each}
      </select>
    </label>
    <label class="panel-field">
      <span>{viewValue(chrome, label('Base'))}</span>
      <select
        name="header.base"
        value={chart.base62 ? '62' : '36'}
        onchange={(e) =>
          controller.panelAction({
            kind: 'base',
            value: e.currentTarget.value === '62',
            options: controller.getPreferences().writer,
          })}
      >
        <option>36</option>
        <option>62</option>
      </select>
    </label>
  </details>
</div>
