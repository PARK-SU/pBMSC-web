<script lang="ts">
  import type { PanelAction } from '../../editor/input/panels.ts';
  import { niB } from '../../core/model/constants.ts';
  import type { ChromeProps } from './types.ts';
  import ZoomBoxes from './ZoomBoxes.svelte';
  import { webText, type WebKey } from '../../i18n/web.ts';
  import NumberField from './NumberField.svelte';
  import type { ViewerController } from '../viewer/controller.ts';
  import type { ViewerChrome } from '../viewer/controller.ts';
  import type { UiText } from '../viewer/text.ts';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ViewerController;

  export let chrome: ViewerChrome;

  export let text: UiText;
  export let desktop = false;

  interface $$Props extends ChromeProps {
    desktop?: boolean;
  }

  $: props = { controller, chrome, text };

  const t = (key: WebKey) => webText(props.chrome.langFile, key, {}, props.chrome);

  let view = controller.getView();
  $: view = viewValue(chrome, controller.getView());

  const change = (
    action: Extract<
      PanelAction,
      {
        kind: 'grid';
      }
    >,
  ) => controller.panelAction(action);
</script>

<div class="panel-fields" class:desktop-grid={desktop}>
  {#snippet columns()}
    <NumberField
      name="grid.bgmColumns"
      label={viewValue(chrome, t('BGM columns'))}
      value={view.gColumns - niB + 1}
      min={1}
      max={999}
      step={1}
      onValue={(value) => change({ kind: 'grid', bgmColumns: Number(value) })}
    />
  {/snippet}
  {#if !desktop}{@render columns()}{/if}
  <div class:division-row={desktop}>
    <NumberField
      name="grid.divide"
      label={viewValue(chrome, desktop ? '↕' : t('Division'))}
      value={view.cgDivideValue}
      min={1}
      max={1920}
      onValue={(divide) => change({ kind: 'grid', divide })}
    />
    <NumberField
      name="grid.sub"
      label={viewValue(chrome, desktop ? '/' : t('Subdivision'))}
      value={view.cgSubValue}
      min={1}
      max={1920}
      onValue={(sub) => change({ kind: 'grid', sub })}
    />
  </div>
  <ZoomBoxes {controller} chrome={props.chrome} slider={desktop} />
  {#each [['snap', 'gSnap', 'Snap to grid'], ['disableVertical', 'disableVerticalMove', 'Disable vertical moves']] as const as [key, field, label] (key)}<label
    >
      <input
        type="checkbox"
        name={`grid.${key}`}
        checked={view[field]}
        onchange={(e) => change({ kind: 'grid', [key]: e.currentTarget.checked })}
      />
      {viewValue(chrome, t(label))}
    </label>{/each}
  <details class="panel-expand grid-advanced" open={!desktop}>
    <summary>{viewValue(chrome, t('expand'))}</summary>
    {#if desktop}{@render columns()}{/if}
    {#each [['show', 'gShowGrid', 'Grid'], ['showSub', 'gShowSubGrid', 'Sub grid'], ['showVertical', 'gShowVerticalLine', 'Column lines'], ['showMeasure', 'gShowMeasureBar', 'Measure lines'], ['showCaption', 'gShowC', 'Column captions']] as const as [key, field, label] (key)}
      <label
        ><input
          type="checkbox"
          name={`grid.${key}`}
          checked={view[field]}
          onchange={(e) => change({ kind: 'grid', [key]: e.currentTarget.checked })}
        />{viewValue(chrome, t(label))}</label
      >
    {/each}
    {#each ['CGBPM', 'CGSTOP', 'CGSCROLL', 'CGBLP'] as const as item, i (item)}<button
        type="button"
        onclick={() => controller.menuShortcut(item)}
      >
        {['BPM', 'STOP', 'SCROLL', 'BGA / Layer / Poor'][i]}
      </button>{/each}
  </details>
</div>
