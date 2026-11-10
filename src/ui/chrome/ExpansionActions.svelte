<script lang="ts">
  import type { ChromeProps } from './types.ts';
  import { featureText } from '../../i18n/features.ts';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  interface $$Props extends ChromeProps {}

  const t = (s: string) => featureText(chrome.langFile, s, chrome);

  let line = 0;

  let chart = controller.getChart();
  $: chart = viewValue(chrome, controller.getChart());
</script>

<fieldset class="panel-fields">
  <legend>#RANDOM</legend>
  <label>
    {viewValue(chrome, t('Section'))}
    <select
      name="expansion.line"
      value={line}
      onchange={(e) => (line = Number(e.currentTarget.value))}
    >
      {#each viewValue(chrome, chart.expansion.split('\r\n')) as value, i (i)}<option value={i}>
          {i + 1}: {value}
        </option>{/each}
    </select>
  </label>
  {#each [['section', 'Show section ghosts'], ['all', 'Show all ghosts'], ['modify', 'Modify section notes'], ['edit', 'Edit section in tab'], ['remove', 'Remove ghosts'], ['merge', 'Merge section tab']] as const as [action, label] (action)}<button
      name={'expansion.' + action}
      onclick={() => controller.expansionAction(action, line)}
    >
      {viewValue(chrome, t(label))}
    </button>{/each}
</fieldset>
