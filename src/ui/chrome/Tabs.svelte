<script lang="ts">
  import type { ChromeProps } from './types.ts';
  import { webText } from '../../i18n/web.ts';
  import Tab from './Tab.svelte';
  import { viewValue } from '../viewer/state.ts';

  export let controller: Pick<ChromeProps, 'controller' | 'chrome'>['controller'];

  export let chrome: Pick<ChromeProps, 'controller' | 'chrome'>['chrome'];

  interface $$Props extends Pick<ChromeProps, 'controller' | 'chrome'> {}
</script>

<div
  class="document-tabs"
  role="tablist"
  tabindex="-1"
  aria-label={viewValue(chrome, webText(chrome.langFile, 'openCharts', {}, chrome))}
  onkeydown={(event) => {
    if ((event.target as HTMLElement).getAttribute('role') !== 'tab') return;
    const index = chrome.tabs.findIndex((t) => t.id === chrome.activeTab);
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? chrome.tabs.length - 1
          : offset !== 0
            ? (index + offset + chrome.tabs.length) % chrome.tabs.length
            : undefined;
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const id = chrome.tabs[next]!.id;
    controller.switchTab(id);
    document.getElementById(`chart-tab-${id}`)?.focus();
  }}
>
  {#each chrome.tabs as tab (tab.id)}<Tab
      {tab}
      {controller}
      active={tab.id === chrome.activeTab}
      langFile={chrome.langFile}
    />{/each}
  <button
    type="button"
    name="newDocument"
    aria-label={viewValue(chrome, webText(chrome.langFile, 'newChart', {}, chrome))}
    onclick={() => controller.newDocument()}
  >
    +
  </button>
</div>
