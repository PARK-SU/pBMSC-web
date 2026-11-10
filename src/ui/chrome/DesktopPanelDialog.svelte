<script lang="ts">
  import { onMount } from 'svelte';
  import type { ChromeProps } from './types.ts';
  import { webText } from '../../i18n/web.ts';
  import SidePanels from './SidePanels.svelte';
  import FindPanel from './FindPanel.svelte';
  import Icon from './Icon.svelte';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import OptionsPanel from './OptionsPanel.svelte';
  import { settingsPage, settingsTitle } from './settings-pages.ts';
  export let controller: ChromeProps['controller'];
  export let chrome: ChromeProps['chrome'];
  export let text: ChromeProps['text'];
  let dialog: HTMLDialogElement;
  const close = () => controller.setPanelSection('header');
  $: find = chrome.panelSection === 'navigate' && chrome.navigationTarget === 'find';
  $: settings = settingsPage(chrome.panelSection);
  $: title = find
    ? sourceLabel(chrome, 'ToolBar/Find', 'Find / Delete / Replace (Ctrl+F)')
    : settings
      ? settingsTitle(chrome, chrome.panelSection)
      : webText(chrome.langFile, 'panels', {}, chrome);
  onMount(() => dialog.showModal());
</script>

<dialog
  class="desktop-panel-dialog"
  class:find-dialog={find}
  class:settings-dialog={settings !== undefined}
  class:visual-dialog={chrome.panelSection === 'visual'}
  aria-label={title}
  bind:this={dialog}
  oncancel={(e) => {
    e.preventDefault();
    close();
  }}
>
  <div class="desktop-dialog-title">
    <span
      >{#if find}<Icon name="Find" />{/if}{title}</span
    >
    <button
      type="button"
      aria-label={webText(chrome.langFile, 'Close panels', {}, chrome)}
      onclick={close}>×</button
    >
  </div>
  {#if find}
    <FindPanel {controller} {chrome} onClose={close} />
  {:else if settings}
    {#key chrome.panelSection}<OptionsPanel {controller} {chrome} {text} onClose={close} />{/key}
  {:else}
    <SidePanels {controller} {chrome} {text} onClose={close} />
  {/if}
</dialog>
