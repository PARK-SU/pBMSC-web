<script lang="ts">
  import { onMount } from 'svelte';
  import { readable } from 'svelte/store';
  import type { LangFile } from '../i18n/lang.ts';
  import OpenFileInput from './chrome/OpenFileInput.svelte';
  import EditDialogs from './chrome/Dialogs.svelte';
  import { bindPageInput } from './input/shortcuts.ts';
  import CompactLayout from './layout/Compact.svelte';
  import DesktopLayout from './layout/Desktop.svelte';
  import { desktopMediaQuery, mediaQuery } from './layout/media.ts';
  import type { ViewerController } from './viewer/controller.ts';
  import { uiText } from './viewer/text.ts';

  export let controller: ViewerController;
  const chromeStore = readable(controller.getChrome(), (set) =>
    controller.subscribe(() => set(controller.getChrome())),
  );
  const desktop = mediaQuery(desktopMediaQuery);
  const htmlLangs: Readonly<Record<LangFile, string>> = {
    'chs.Lang.xml': 'zh-Hans',
    'eng.Lang.xml': 'en',
    'jpn.Lang.xml': 'ja',
    'kor.Lang.xml': 'ko',
  };
  let fileInput: { open(): void } | undefined;
  const open = () => fileInput?.open();
  $: chrome = $chromeStore;
  $: text = uiText(chrome.lang, chrome.english, chrome.langFile);
  $: layout = $desktop ? DesktopLayout : CompactLayout;
  $: document.documentElement.lang = htmlLangs[chrome.langFile ?? 'eng.Lang.xml'];

  onMount(() => {
    const viewport = window.visualViewport;
    const resize = () =>
      document.documentElement.style.setProperty(
        '--app-height',
        `${viewport?.height ?? window.innerHeight}px`,
      );
    resize();
    viewport?.addEventListener('resize', resize);
    const unbind = bindPageInput({
      modal: () => {
        const state = controller.getChrome();
        return (
          document.querySelector('dialog[open]') !== null ||
          state.prompt !== undefined ||
          state.message !== undefined ||
          state.saving ||
          state.saveDialog ||
          state.projectSelection !== undefined ||
          state.closingTab !== undefined
        );
      },
      menuShortcut: (item) => controller.menuShortcut(item),
      open,
      save: () => void controller.saveProject(),
      saveAs: () => controller.requestSaveAs(),
      recent: (index) => controller.openRecent(index),
      stopAudio: () => controller.stopAudio(),
      keyUp: (modifiers) => controller.keyUp(modifiers),
      cursor: (x, y) => controller.setCursor(x, y),
    });
    const over = (event: DragEvent) => {
      if (Array.from(event.dataTransfer?.types ?? []).includes('Files')) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types).includes('Files')) return;
      event.preventDefault();
      void controller.importDrop(event.dataTransfer);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      viewport?.removeEventListener('resize', resize);
      unbind();
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  });
</script>

<svelte:component this={layout} {controller} {chrome} {text} onOpen={open} />
<OpenFileInput {controller} {chrome} bind:this={fileInput} />
<EditDialogs {controller} {chrome} {text} />
