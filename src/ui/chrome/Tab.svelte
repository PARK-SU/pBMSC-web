<script lang="ts">
  import type { ChromeProps } from './types.ts';
  import type { TabSummary } from '../viewer/controller.ts';
  import { webText } from '../../i18n/web.ts';
  import type { LangFile } from '../../i18n/lang.ts';
  import { styleText } from '../style.ts';

  export let tab: TabSummary;

  export let controller: ChromeProps['controller'];

  export let active: boolean;

  export let langFile: LangFile | undefined;

  let color: HTMLInputElement | undefined = undefined;

  let rgb = [1, 3, 5].map((i) => Number.parseInt(tab.color.slice(i, i + 2), 16));
  $: rgb = [1, 3, 5].map((i) => Number.parseInt(tab.color.slice(i, i + 2), 16));

  function bindTab(element: HTMLDivElement) {
    const down = (event: MouseEvent) => {
      if (event.button === 1) {
        event.preventDefault();
        controller.requestCloseTab(tab.id);
      }
    };
    const auxiliary = (event: MouseEvent) => event.preventDefault();
    const context = (event: MouseEvent) => {
      event.preventDefault();
      color?.click();
    };
    element.addEventListener('mousedown', down);
    element.addEventListener('auxclick', auxiliary);
    element.addEventListener('contextmenu', context);
    return {
      destroy() {
        element.removeEventListener('mousedown', down);
        element.removeEventListener('auxclick', auxiliary);
        element.removeEventListener('contextmenu', context);
      },
    };
  }
</script>

<div
  use:bindTab
  class="document-tab"
  role="group"
  style={styleText({
    backgroundColor: tab.color,
    color: (Math.max(...rgb) + Math.min(...rgb)) / 2 >= 128 ? 'black' : 'white',
  })}
>
  <button
    id={`chart-tab-${tab.id}`}
    type="button"
    role="tab"
    aria-selected={active}
    tabindex={active ? 0 : -1}
    onclick={() => controller.switchTab(tab.id)}
  >
    {tab.isSaved ? '' : '*'}
    {tab.name}
  </button>
  <input
    bind:this={color}
    type="color"
    aria-label={webText(langFile, 'tabColor', { name: tab.name })}
    value={tab.color}
    oninput={(e) => controller.setTabColor(tab.id, e.currentTarget.value)}
  />
  <button
    type="button"
    aria-label={webText(langFile, 'closeChart', { name: tab.name })}
    onclick={() => controller.requestCloseTab(tab.id)}
  >
    ×
  </button>
</div>
