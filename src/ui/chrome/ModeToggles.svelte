<script lang="ts">
  import type { ChromeProps } from './types.ts';
  import { keepFocus } from '../input/focus.ts';
  import { webText } from '../../i18n/web.ts';
  import { viewValue } from '../viewer/state.ts';
  import Icon from './Icon.svelte';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  export let text: ChromeProps['text'];

  interface $$Props extends ChromeProps {}
</script>

<div class="field toggles" role="group">
  <button
    type="button"
    name="ntInput"
    class="toggle wide"
    title={viewValue(chrome, text.text('ntInput'))}
    aria-label={viewValue(chrome, text.text('ntInput'))}
    aria-pressed={chrome.ntInput}
    onmousedown={keepFocus}
    onclick={() => controller.setNTInput(!chrome.ntInput)}
  >
    <Icon name="NTInput" />
  </button>
  <button
    type="button"
    name="wavIncrease"
    class="toggle wide"
    title={viewValue(chrome, webText(chrome.langFile, 'wavIncrease', {}, chrome))}
    aria-label={viewValue(chrome, webText(chrome.langFile, 'wavIncrease', {}, chrome))}
    aria-pressed={chrome.wavIncrease}
    onmousedown={keepFocus}
    onclick={() => controller.toggleWavIncrease()}
  >
    <Icon name="WavIncrease" />
  </button>
</div>
