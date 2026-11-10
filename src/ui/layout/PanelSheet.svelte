<script lang="ts">
  import { webText } from '../../i18n/web.ts';
  import type { LayoutProps } from '../chrome/types.ts';
  import ToolButtons from '../chrome/ToolButtons.svelte';
  import SidePanels from '../chrome/SidePanels.svelte';
  import FindPanel from '../chrome/FindPanel.svelte';
  import Icon from '../chrome/Icon.svelte';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import type { ViewerController } from '../viewer/controller.ts';
  import type { ViewerChrome } from '../viewer/controller.ts';
  import type { UiText } from '../viewer/text.ts';
  import { onMount } from 'svelte';
  import { viewValue } from '../viewer/state.ts';
  import OptionsPanel from '../chrome/OptionsPanel.svelte';
  import { settingsPage, settingsTitle } from '../chrome/settings-pages.ts';

  export let controller: ViewerController;

  export let chrome: ViewerChrome;

  export let text: UiText;

  interface $$Props extends LayoutProps {}

  $: props = { controller, chrome, text };
  $: find = chrome.panelSection === 'navigate' && chrome.navigationTarget === 'find';
  $: settings = settingsPage(chrome.panelSection);
  const close = () => {
    if (find || settings) controller.setPanelSection('header');
    controller.toggleSidebar();
  };
  $: title = settings
    ? settingsTitle(chrome, chrome.panelSection)
    : sourceLabel(chrome, 'ToolBar/Find', 'Find / Delete / Replace (Ctrl+F)');

  let ref: HTMLDialogElement | undefined = undefined;

  onMount(() => {
    ref?.showModal();
  });
</script>

<dialog
  class="panel-sheet"
  class:find-dialog={find}
  class:settings-dialog={settings !== undefined}
  class:visual-dialog={chrome.panelSection === 'visual'}
  bind:this={ref}
  aria-label={find || settings
    ? title
    : viewValue(chrome, webText(props.chrome.langFile, 'panels', {}, props.chrome))}
  oncancel={(e) => {
    e.preventDefault();
    close();
  }}
>
  {#if find || settings}
    <div class="desktop-dialog-title">
      <span
        >{#if find}<Icon name="Find" />{/if}{title}</span
      >
      <button type="button" aria-label={sourceLabel(chrome, 'Find/Close', 'Close')} onclick={close}
        >×</button
      >
    </div>
    {#if find}<FindPanel
        {controller}
        {chrome}
        onClose={close}
      />{:else}{#key chrome.panelSection}<OptionsPanel
          {controller}
          {chrome}
          {text}
          onClose={close}
        />{/key}{/if}
  {:else}
    <ToolButtons {...props} />
    <SidePanels {...props} />
  {/if}
</dialog>
