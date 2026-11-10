<script lang="ts">
  import { c10toId, maxId } from '../../core/bms/base.ts';
  import type { PanelAction } from '../../editor/input/panels.ts';
  import type { ChromeProps } from './types.ts';
  import { webText, type WebKey } from '../../i18n/web.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import { viewValue } from '../viewer/state.ts';
  import Icon from './Icon.svelte';

  export let controller: (ChromeProps & { kind: 'wav' | 'bmp' })['controller'];

  export let chrome: (ChromeProps & { kind: 'wav' | 'bmp' })['chrome'];

  export let kind: (ChromeProps & { kind: 'wav' | 'bmp' })['kind'];
  export let desktop = false;

  interface $$Props extends ChromeProps {
    kind: 'wav' | 'bmp';
    desktop?: boolean;
  }

  const resourceLabels: Readonly<Record<string, string>> = {
    Up: 'MoveUp',
    Down: 'MoveDown',
    'Add / replace': 'Browse',
    Remove: 'Remove',
    Duplicate: 'Duplicate',
  };
  const t = (key: WebKey) => {
    const fallback = webText(chrome.langFile, key, {}, chrome);
    const path = resourceLabels[key];
    return path
      ? sourceLabel(chrome, `OptionsPanel/${kind.toUpperCase()}/${path}`, fallback)
      : fallback;
  };

  let multi = true;

  let relabel = true;

  let name: string | undefined = undefined;

  let files: HTMLInputElement | undefined = undefined;

  let chart = controller.getChart();
  $: chart = viewValue(chrome, controller.getChart());

  let selected = controller.getListSelection(kind);
  $: selected = viewValue(chrome, controller.getListSelection(kind));

  let table = kind === 'wav' ? chart.hWAV : chart.hBMP;
  $: table = viewValue(chrome, kind === 'wav' ? chart.hWAV : chart.hBMP);

  const action = (
    op: Extract<
      PanelAction,
      {
        kind: 'resource';
      }
    >['action'],
    extra: Partial<
      Extract<
        PanelAction,
        {
          kind: 'resource';
        }
      >
    > = {},
  ) =>
    controller.panelAction({
      kind: 'resource',
      resource: kind,
      indices: selected,
      action: op,
      changeLabel: relabel,
      ...extra,
    });
</script>

<div class="panel-fields resource-fields" class:desktop-resource={desktop}>
  <select
    name={`${kind}.list`}
    aria-label={viewValue(chrome, kind.toUpperCase())}
    size={9}
    multiple={multi}
    value={viewValue(chrome, multi ? selected.map(String) : String(selected[0] ?? ''))}
    onchange={(e) => {
      controller.setListSelection(
        kind,
        Array.from(e.currentTarget.selectedOptions, (o) => Number(o.value)),
      );
      name = undefined;
    }}
    onclick={() => {
      if (kind === 'wav') controller.previewWav();
    }}
    ondblclick={() => files?.click()}
    onkeydown={(e) => {
      if (e.code === 'Space' && kind === 'wav') {
        e.preventDefault();
        controller.previewWav();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        action('remove');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        files?.click();
      }
    }}
  >
    {#each Array.from(viewValue(chrome, { length: maxId(chart.base62) })) as _, i}<option
        value={String(i)}
      >
        {viewValue(chrome, c10toId(i + 1, chart.base62))}: {table[i + 1]}
      </option>{/each}
  </select>
  <div class="panel-buttons">
    <button
      type="button"
      title={viewValue(chrome, t('Up'))}
      aria-label={viewValue(chrome, t('Up'))}
      onclick={() => action('up')}><Icon name="Up" /></button
    >
    <button
      type="button"
      title={viewValue(chrome, t('Down'))}
      aria-label={viewValue(chrome, t('Down'))}
      onclick={() => action('down')}><Icon name="Down" /></button
    >
    <button
      type="button"
      title={viewValue(chrome, t('Add / replace'))}
      aria-label={viewValue(chrome, t('Add / replace'))}
      onclick={() => files?.click()}
    >
      <Icon name="Open" />
    </button>
    <button
      type="button"
      title={viewValue(chrome, t('Remove'))}
      aria-label={viewValue(chrome, t('Remove'))}
      onclick={() => action('remove')}
    >
      <Icon name="Remove" />
    </button>
    {#if kind === 'wav'}<button
        type="button"
        disabled={!selected.length}
        title={viewValue(chrome, t('Duplicate'))}
        aria-label={viewValue(chrome, t('Duplicate'))}
        onclick={() => action('duplicate')}
      >
        <Icon name="Duplicate" />
      </button>{/if}
  </div>
  <details class="resource-advanced panel-expand" open={!desktop}>
    <summary>{viewValue(chrome, t('expand'))}</summary>
    <label class="panel-field">
      <span>{viewValue(chrome, t('Name'))}</span>
      <input
        name={`${kind}.name`}
        disabled={!selected.length}
        value={name ?? (selected[0] === undefined ? '' : table[selected[0] + 1])}
        oninput={(e) => (name = e.currentTarget.value)}
        onblur={() => {
          if (name !== undefined) {
            action('rename', { name });
            name = undefined;
          }
        }}
        onkeydown={(e) => {
          if (e.key === 'Enter' && name !== undefined) {
            action('rename', { name });
            name = undefined;
          }
        }}
      />
    </label>
    <label>
      <input
        type="checkbox"
        checked={multi}
        onchange={(e) => {
          multi = e.currentTarget.checked;
          if (!e.currentTarget.checked) controller.setListSelection(kind, selected.slice(0, 1));
        }}
      />
      {viewValue(chrome, t('Multi select'))}
    </label>
    <label>
      <input
        type="checkbox"
        checked={relabel}
        onchange={(e) => (relabel = e.currentTarget.checked)}
      />
      {viewValue(chrome, t('Change note labels when moving'))}
    </label>
  </details>
  <input
    bind:this={files}
    type="file"
    data-resource={kind}
    hidden
    multiple={multi}
    accept={kind === 'wav'
      ? '.wav,.ogg,.mp3'
      : '.bmp,.png,.jpg,.gif,.mpg,.mpeg,.avi,.mp4,.webm,.wmv'}
    onchange={(e) => {
      const picked = Array.from(e.currentTarget.files ?? []);
      action('add', { paths: picked.map((f) => f.name) });
      if (kind === 'wav') void controller.importKeysounds(picked);
      e.currentTarget.value = '';
    }}
  />
</div>
