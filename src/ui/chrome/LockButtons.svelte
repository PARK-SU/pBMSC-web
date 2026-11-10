<script lang="ts">
  import type { ChromeProps } from './types.ts';
  import { viewValue } from '../viewer/state.ts';

  const lockKeys = ['lockLeft', 'lockMiddle', 'lockRight'] as const;

  const lockLetters = ['L', 'M', 'R'] as const;

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  export let text: ChromeProps['text'];

  interface $$Props extends ChromeProps {}
</script>

<div class="field locks" role="group" aria-label={viewValue(chrome, text.label('scrollLock'))}>
  <span>{viewValue(chrome, text.label('scrollLock'))}</span>
  {#each [0, 1, 2] as const as panel (panel)}<button
      type="button"
      name={`lock${panel}`}
      class="toggle"
      title={viewValue(chrome, text.text(lockKeys[panel]))}
      aria-label={viewValue(chrome, text.text(lockKeys[panel]))}
      aria-pressed={chrome.spLock[panel]}
      onclick={() => controller.setSpLock(panel, !chrome.spLock[panel])}
    >
      {lockLetters[panel]}
    </button>{/each}
</div>
