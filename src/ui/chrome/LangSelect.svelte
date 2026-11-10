<script lang="ts">
  import { langNames, type LangFile } from '../../i18n/lang.ts';
  import NoneLoaded from './NoneLoaded.svelte';
  import type { ChromeProps } from './types.ts';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  export let text: ChromeProps['text'];

  interface $$Props extends ChromeProps {}
</script>

<label class="field">
  <span>{viewValue(chrome, text.menu('language'))}</span>
  <select
    name="language"
    value={chrome.langFile ?? ''}
    onchange={(event) => void controller.setLang(event.currentTarget.value as LangFile)}
  >
    <NoneLoaded shown={chrome.langFile === undefined} />
    {#each langNames as { file, name } (file)}<option value={file}>
        {name}
      </option>{/each}
  </select>
</label>
