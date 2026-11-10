<script lang="ts">
  import { webText } from '../../i18n/web.ts';
  import EncodingSelect from '../chrome/EncodingSelect.svelte';
  import LangSelect from '../chrome/LangSelect.svelte';
  import Menu from '../chrome/Menu.svelte';
  import MenuItem from '../chrome/MenuItem.svelte';
  import MenuCheck from '../chrome/MenuCheck.svelte';
  import Notices from '../chrome/Notices.svelte';
  import ThemeSelect from '../chrome/ThemeSelect.svelte';
  import ZoomBoxes from '../chrome/ZoomBoxes.svelte';
  import type { LayoutProps } from '../chrome/types.ts';
  import ListIds from '../chrome/ListIds.svelte';
  import MobileBar from '../chrome/MobileBar.svelte';
  import PanelView from '../panel/PanelView.svelte';
  import Tabs from '../chrome/Tabs.svelte';
  import ProjectControls from '../chrome/ProjectControls.svelte';
  import PanelSheet from './PanelSheet.svelte';
  import { viewValue } from '../viewer/state.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import Icon from '../chrome/Icon.svelte';
  import TimeSelectionBar from '../chrome/TimeSelectionBar.svelte';

  export let controller: LayoutProps['controller'];

  export let chrome: LayoutProps['chrome'];

  export let text: LayoutProps['text'];

  export let onOpen: LayoutProps['onOpen'];

  interface $$Props extends LayoutProps {}
</script>

<div class="app compact">
  <header class="topbar">
    <span class="file-chip" title={chrome.fileName}>
      {chrome.isSaved ? '' : '*'}
      {chrome.fileName}
    </span>
    <button
      type="button"
      name="mobileOpen"
      class="mobile-file-action"
      title={viewValue(chrome, sourceLabel(chrome, 'ToolBar/Open', text.menu('open')))}
      aria-label={viewValue(chrome, sourceLabel(chrome, 'ToolBar/Open', text.menu('open')))}
      disabled={chrome.project.busy}
      onclick={onOpen}><Icon name="Open" /></button
    >
    <button
      type="button"
      name="mobileSave"
      class="mobile-file-action"
      title={viewValue(chrome, sourceLabel(chrome, 'ToolBar/Save', text.menu('save')))}
      aria-label={viewValue(chrome, sourceLabel(chrome, 'ToolBar/Save', text.menu('save')))}
      disabled={chrome.saving || chrome.project.busy}
      onclick={() => void controller.saveProject()}><Icon name="Save" /></button
    >
    <ProjectControls {controller} {chrome} {text} />
    <Menu
      label={'\u{22EE}'}
      ariaLabel={viewValue(chrome, webText(chrome.langFile, 'menu', {}, chrome))}
      className="overflow"
    >
      <MenuItem onSelect={onOpen}>{viewValue(chrome, text.menu('open'))}</MenuItem>
      <MenuItem onSelect={() => controller.requestSaveAs()}
        >{viewValue(chrome, text.menu('saveAs'))}</MenuItem
      >
      <MenuItem onSelect={() => controller.newDocument()}>
        {viewValue(chrome, webText(chrome.langFile, 'new', {}, chrome))}
      </MenuItem>
      <MenuItem onSelect={() => controller.requestCloseTab(chrome.activeTab)}>
        {viewValue(chrome, webText(chrome.langFile, 'close', {}, chrome))}
      </MenuItem>
      <MenuItem onSelect={() => controller.toggleSidebar()}>
        {viewValue(chrome, webText(chrome.langFile, 'panels', {}, chrome))}
      </MenuItem>
      <MenuCheck checked={chrome.ntInput} onChange={(ntInput) => controller.setNTInput(ntInput)}
        >{viewValue(
          chrome,
          sourceLabel(chrome, 'Menu/Options/NT', text.text('ntInput')),
        )}</MenuCheck
      >
      <MenuCheck checked={chrome.wavIncrease} onChange={() => controller.toggleWavIncrease()}
        >{viewValue(chrome, webText(chrome.langFile, 'wavIncrease', {}, chrome))}</MenuCheck
      >
      <MenuCheck
        checked={viewValue(chrome, controller.getPreferences().errorCheck)}
        onChange={(errorCheck) => controller.updateOptions({ errorCheck })}
        >{viewValue(
          chrome,
          sourceLabel(chrome, 'Menu/Options/ErrorCheck', 'Error check'),
        )}</MenuCheck
      >
      <MenuCheck
        checked={viewValue(chrome, controller.getPreferences().tool.previewOnClick)}
        onChange={(previewOnClick) =>
          controller.updateOptions({
            tool: { ...controller.getPreferences().tool, previewOnClick },
          })}
        >{viewValue(
          chrome,
          sourceLabel(chrome, 'Menu/Options/PreviewOnClick', 'Preview on click'),
        )}</MenuCheck
      >
      <MenuCheck
        checked={viewValue(chrome, controller.getPreferences().showFileName)}
        onChange={(showFileName) => controller.updateOptions({ showFileName })}
        >{viewValue(
          chrome,
          sourceLabel(chrome, 'Menu/Options/ShowFileName', 'Show filenames'),
        )}</MenuCheck
      >
      <div class="ids">
        <ListIds {controller} {chrome} {text} />
      </div>
      <EncodingSelect {controller} {chrome} {text} />
      <ThemeSelect {controller} {chrome} {text} />
      <LangSelect {controller} {chrome} {text} />
      <div class="zooms">
        <ZoomBoxes {controller} {chrome} />
      </div>
    </Menu>
  </header>
  <Notices {chrome} {text} />
  <Tabs {controller} {chrome} />
  <main class="workspace compact-workspace">
    <PanelView
      {controller}
      panel={1}
      label={viewValue(chrome, webText(chrome.langFile, 'editingPanel', {}, chrome))}
      className="full"
    />
  </main>
  {#if chrome.tool === 'timeSelect'}<TimeSelectionBar {controller} {chrome} />{/if}
  <MobileBar {controller} {chrome} {text} />
  {#if chrome.sidebar}<PanelSheet {controller} {chrome} {text} {onOpen} />{/if}
</div>
