<script lang="ts">
  import type { ChromeProps } from './types.ts';
  import IdBox from './IdBox.svelte';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  export let text: ChromeProps['text'];

  interface $$Props extends ChromeProps {}
</script>

<IdBox
  name="currentWav"
  label={viewValue(chrome, text.label('wavTitle'))}
  index={chrome.currentWav}
  base62={chrome.base62}
  onChange={(index) => controller.setCurrentWav(index)}
/>
<IdBox
  name="currentBmp"
  label={viewValue(chrome, text.label('bmpTitle'))}
  index={chrome.currentBmp}
  base62={chrome.base62}
  onChange={(index) => controller.setCurrentBmp(index)}
/>
