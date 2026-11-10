<script lang="ts">
  import { hasWebAssembly } from '../../audio/webAssembly.ts';
  import { webText } from '../../i18n/web.ts';
  import { featureMessage } from '../../i18n/features.ts';
  import type { ChromeProps } from './types.ts';
  import { viewValue } from '../viewer/state.ts';

  export let chrome: Omit<ChromeProps, 'controller'>['chrome'];

  export let text: Omit<ChromeProps, 'controller'>['text'];

  interface $$Props extends Omit<ChromeProps, 'controller'> {}
</script>

{#if chrome.error !== undefined}<p class="notice error" role="alert">
    {viewValue(chrome, text.text('error'))}: {viewValue(
      chrome,
      featureMessage(chrome.langFile, chrome.error),
    )}
  </p>{/if}
{#if viewValue(chrome, !hasWebAssembly())}<p class="notice" role="status">
    {viewValue(chrome, webText(chrome.langFile, 'noWebAssembly', {}, chrome))}
  </p>{/if}
