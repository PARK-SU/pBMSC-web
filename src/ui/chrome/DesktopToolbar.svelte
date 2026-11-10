<script lang="ts">
  import type { LayoutProps } from './types.ts';
  import { featureText } from '../../i18n/features.ts';
  import { webText } from '../../i18n/web.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import { recommendedTotal } from '../../core/edit/stats.ts';
  import { mathRoundDigits, toDotNetString } from '../../core/vb.ts';
  import { keepFocus } from '../input/focus.ts';
  import { viewValue } from '../viewer/state.ts';
  import Icon from './Icon.svelte';
  import AudioControls from './AudioControls.svelte';
  import ProjectControls from './ProjectControls.svelte';

  export let controller: LayoutProps['controller'];
  export let chrome: LayoutProps['chrome'];
  export let text: LayoutProps['text'];
  export let onOpen: LayoutProps['onOpen'];
  const toolbarLabel = (key: string, fallback: string) =>
    sourceLabel(chrome, `ToolBar/${key}`, fallback);
  $: preferences = viewValue(chrome, controller.getPreferences());
  $: primary = [
    {
      name: 'newDocumentToolbar',
      icon: 'New',
      label: toolbarLabel('New', text.menu('new')),
      action: () => controller.newDocument(),
    },
    {
      name: 'openChart',
      icon: 'Open',
      label: toolbarLabel('Open', text.menu('open')),
      action: onOpen,
    },
    {
      name: 'saveChart',
      icon: 'Save',
      label: toolbarLabel('Save', text.menu('save')),
      action: () => void controller.saveProject(),
    },
    {
      name: 'cutNotes',
      icon: 'Cut',
      label: toolbarLabel('Cut', text.menu('cut')),
      action: () => void controller.menuClipboard('cut'),
    },
    {
      name: 'copyNotes',
      icon: 'Copy',
      label: toolbarLabel('Copy', text.menu('copy')),
      action: () => void controller.menuClipboard('copy'),
    },
    {
      name: 'pasteNotes',
      icon: 'Paste',
      label: toolbarLabel('Paste', text.menu('paste')),
      action: () => void controller.menuClipboard('paste'),
    },
    {
      name: 'findNotes',
      icon: 'Find',
      label: toolbarLabel('Find', webText(chrome.langFile, 'navigation', {}, chrome)),
      action: () => controller.menuShortcut('mnFind'),
    },
  ];
  $: tools = [
    {
      name: 'toolTimeSelect',
      tool: 'timeSelect' as const,
      icon: 'TimeSelection',
      label: text.text('timeSelectTool'),
    },
    { name: 'toolSelect', tool: 'select' as const, icon: 'Select', label: text.text('selectTool') },
    { name: 'toolWrite', tool: 'write' as const, icon: 'Write', label: text.text('writeTool') },
  ];
</script>

<div
  class="desktop-toolstrip"
  role="toolbar"
  aria-label={featureText(chrome.langFile, 'Tools', chrome)}
>
  <div class="toolbar-group">
    {#each primary as item (item.name)}
      <button
        type="button"
        name={item.name}
        title={item.label}
        aria-label={item.label}
        onmousedown={keepFocus}
        onclick={item.action}><Icon name={item.icon} /></button
      >
    {/each}
  </div>
  <button
    type="button"
    name="statistics"
    title={featureText(chrome.langFile, 'Statistics', chrome)}
    aria-label={featureText(chrome.langFile, 'Statistics', chrome)}
    onmousedown={keepFocus}
    onclick={() => controller.setPanelSection('statistics')}
    ><Icon name="Statistics" />{viewValue(chrome, controller.getPlayableCount())}</button
  >
  <div class="toolbar-group">
    <button
      type="button"
      name="errorCheck"
      title={featureText(chrome.langFile, 'Error check', chrome)}
      aria-label={featureText(chrome.langFile, 'Error check', chrome)}
      aria-pressed={preferences.errorCheck}
      onmousedown={keepFocus}
      onclick={() => controller.updateOptions({ errorCheck: !preferences.errorCheck })}
    >
      <Icon name="PreviewCheck" />
    </button>
    <button
      type="button"
      name="previewOnClickToolbar"
      title={webText(chrome.langFile, 'previewOnClick', {}, chrome)}
      aria-label={webText(chrome.langFile, 'previewOnClick', {}, chrome)}
      aria-pressed={chrome.audio.previewOnClick}
      onmousedown={keepFocus}
      onclick={() =>
        controller.setPreviewOptions(!chrome.audio.previewOnClick, chrome.audio.clickStopPreview)}
    >
      <Icon name="PreviewOnClick" />
    </button>
    <button
      type="button"
      name="showFileName"
      title={featureText(chrome.langFile, 'Show filenames', chrome)}
      aria-label={featureText(chrome.langFile, 'Show filenames', chrome)}
      aria-pressed={preferences.showFileName}
      onmousedown={keepFocus}
      onclick={() => controller.updateOptions({ showFileName: !preferences.showFileName })}
      >File</button
    >
  </div>
  <div class="toolbar-group">
    <button
      type="button"
      name="ntInput"
      title={text.text('ntInput')}
      aria-label={text.text('ntInput')}
      aria-pressed={chrome.ntInput}
      onmousedown={keepFocus}
      onclick={() => controller.setNTInput(!chrome.ntInput)}><Icon name="NTInput" /></button
    >
    <button
      type="button"
      name="wavIncrease"
      title={webText(chrome.langFile, 'wavIncrease', {}, chrome)}
      aria-label={webText(chrome.langFile, 'wavIncrease', {}, chrome)}
      aria-pressed={chrome.wavIncrease}
      onmousedown={keepFocus}
      onclick={() => controller.toggleWavIncrease()}><Icon name="WavIncrease" /></button
    >
  </div>
  <div class="toolbar-group">
    <button
      type="button"
      name="undo"
      title={text.text('undoButton')}
      aria-label={text.text('undoButton')}
      disabled={!chrome.canUndo}
      onmousedown={keepFocus}
      onclick={() => controller.undo()}><Icon name="Undo" /></button
    >
    <button
      type="button"
      name="redo"
      title={text.text('redoButton')}
      aria-label={text.text('redoButton')}
      disabled={!chrome.canRedo}
      onmousedown={keepFocus}
      onclick={() => controller.redo()}><Icon name="Redo" /></button
    >
    {#each tools as item (item.tool)}
      <button
        type="button"
        name={item.name}
        title={item.label}
        aria-label={item.label}
        aria-pressed={chrome.tool === item.tool}
        onmousedown={keepFocus}
        onclick={() => controller.setTool(item.tool)}><Icon name={item.icon} /></button
      >
    {/each}
  </div>
  <AudioControls {controller} {chrome} {text} />
  <ProjectControls {controller} {chrome} {text} />
  {#if preferences.total.totalDisplayValue}
    <output class="recommended-total">
      {featureText(chrome.langFile, 'Recommended #TOTAL', chrome)}:
      {viewValue(
        chrome,
        toDotNetString(
          mathRoundDigits(
            recommendedTotal(controller.getPlayableCount(), preferences.total),
            preferences.total.totalDecimal,
          ),
        ),
      )}
    </output>
  {/if}
</div>
