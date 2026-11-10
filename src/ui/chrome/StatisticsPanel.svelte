<script lang="ts">
  import type { ChromeProps } from './types.ts';
  import { featureText } from '../../i18n/features.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import { c10toId } from '../../core/bms/base.ts';
  import { statisticsRows, statisticsColumns } from '../../core/edit/analysis.ts';
  import Toggle from './Toggle.svelte';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  interface $$Props extends ChromeProps {}

  const statisticsLabels: Readonly<Record<string, string>> = {
    A: 'lA',
    D: 'lD',
    Total: 'lTotal',
    Short: 'lShort',
    Long: 'lLong',
    LNOBJ: 'lLnObj',
    Hidden: 'lHidden',
    Errors: 'lErrors',
  };
  const t = (s: string) => {
    const path = statisticsLabels[s];
    return path
      ? sourceLabel(chrome, `Statistics/${path}`, s)
      : featureText(chrome.langFile, s, chrome);
  };

  let advanced = true;

  let data: number[][] = [];

  let wav: ReturnType<typeof controller.getWavUsage> = [];

  let error = '';

  $: {
    chrome;
    data = [];
    wav = [];
    error = '';
    try {
      data = controller.getStatistics(advanced);
      if (!advanced) data = data.slice(0, 6);
      if (advanced) wav = controller.getWavUsage();
    } catch (e) {
      error = String(e);
    }
  }

  let columns = advanced
    ? statisticsColumns
    : ['Short', 'Long', 'LNOBJ', 'Hidden', 'Errors', 'Total'];
  $: columns = viewValue(
    chrome,
    advanced ? statisticsColumns : ['Short', 'Long', 'LNOBJ', 'Hidden', 'Errors', 'Total'],
  );

  let rows = advanced ? statisticsRows : ['BPM', 'STOP', 'A', 'D', 'BGM', 'Total'];
  $: rows = viewValue(
    chrome,
    advanced ? statisticsRows : ['BPM', 'STOP', 'A', 'D', 'BGM', 'Total'],
  );
</script>

<div class="panel-fields feature-panel">
  <Toggle
    name="stats.advanced"
    label={viewValue(chrome, t('Advanced'))}
    value={advanced}
    onChange={(value) => (advanced = value)}
  />
  {#if error}<p role="alert">{error}</p>{:else}
    <div class="stats-scroll">
      <table class="stats-table">
        <caption>{viewValue(chrome, t('Statistics'))}</caption>
        <thead>
          <tr>
            <th></th>
            {#each columns as c (c)}<th>{viewValue(chrome, t(c))}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each data as row, i (i)}<tr>
              <th scope="row">{viewValue(chrome, t(rows[i] ?? ''))}</th>
              {#each row as n, j (j)}<td>{n}</td>{/each}
            </tr>{/each}
        </tbody>
      </table>
    </div>
    {#if advanced}<details>
        <summary>{viewValue(chrome, t('WAV usage'))}</summary>
        <ul>
          {#each wav as w (w.id)}<li>
              #WAV{viewValue(chrome, c10toId(w.id, chrome.base62))}: {w.count}
              {viewValue(chrome, w.assigned ? '' : ' — ' + t('Unassigned'))}
            </li>{/each}
        </ul>
      </details>{/if}
  {/if}
</div>
