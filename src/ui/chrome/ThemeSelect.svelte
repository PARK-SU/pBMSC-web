<script lang="ts">
  import { themeNames, type ThemeName } from '../../settings/theme-loader.ts';
  import NoneLoaded from './NoneLoaded.svelte';
  import type { ChromeProps } from './types.ts';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  export let text: ChromeProps['text'];

  interface $$Props extends ChromeProps {}
</script>

<label class="field">
  <span>{viewValue(chrome, text.menu('theme'))}</span>
  <select
    name="theme"
    value={chrome.themeName ?? ''}
    onchange={(event) => void controller.setTheme(event.currentTarget.value as ThemeName)}
  >
    <NoneLoaded shown={chrome.themeName === undefined} />
    {#each themeNames as name (name)}<option value={name}>
        {name}
      </option>{/each}
  </select>
</label>
