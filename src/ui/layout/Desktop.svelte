<script lang="ts">
  import { webText } from '../../i18n/web.ts';
  import { featureText } from '../../i18n/features.ts';
  import { stripMnemonic } from '../../i18n/lang.ts';
  import LangSelect from '../chrome/LangSelect.svelte';
  import LockButtons from '../chrome/LockButtons.svelte';
  import Menu from '../chrome/Menu.svelte';
  import MenuCheck from '../chrome/MenuCheck.svelte';
  import MenuItem from '../chrome/MenuItem.svelte';
  import Notices from '../chrome/Notices.svelte';
  import ThemeSelect from '../chrome/ThemeSelect.svelte';
  import type { LayoutProps } from '../chrome/types.ts';
  import EditMenuItems from '../chrome/EditMenuItems.svelte';
  import DesktopToolbar from '../chrome/DesktopToolbar.svelte';
  import StatusBar from '../chrome/StatusBar.svelte';
  import DesktopPanels from '../chrome/DesktopPanels.svelte';
  import DesktopPanelDialog from '../chrome/DesktopPanelDialog.svelte';
  import Tabs from '../chrome/Tabs.svelte';
  import PanelView from '../panel/PanelView.svelte';
  import Splitter from './Splitter.svelte';
  import { splitterWidth } from './splitter.ts';
  import { viewValue } from '../viewer/state.ts';
  import { settingsPages, settingsPage } from '../chrome/settings-pages.ts';

  export let controller: LayoutProps['controller'];
  export let chrome: LayoutProps['chrome'];
  export let text: LayoutProps['text'];
  export let onOpen: LayoutProps['onOpen'];
  let panels: HTMLDivElement | undefined;
  $: splitters = (chrome.showLSplit ? splitterWidth : 0) + (chrome.showRSplit ? splitterWidth : 0);
  const room = (other: number) => () => (panels?.clientWidth ?? 0) - other - splitters;
  const sideClass = (width: number) => (width > 0 ? 'side' : 'side collapsed');
  const menu = (path: string, fallback: string) =>
    stripMnemonic(
      chrome.lang?.menu(
        `Menu/${path}`,
        chrome.english?.menu(`Menu/${path}`, fallback) ?? fallback,
      ) ?? fallback,
    );
  const show = (section: typeof chrome.panelSection) => {
    if (!chrome.sidebar) controller.toggleSidebar();
    controller.setPanelSection(section);
  };
</script>

<div class="app desktop">
  <div class="desktop-editor">
    <header class="desktop-menubar">
      <nav class="menubar">
        <Menu label={viewValue(chrome, menu('File/Title', 'File'))}>
          <MenuItem onSelect={() => controller.newDocument()}
            >{viewValue(chrome, text.menu('new'))}</MenuItem
          >
          <MenuItem onSelect={onOpen}>{viewValue(chrome, text.menu('open'))}</MenuItem>
          <MenuItem onSelect={() => void controller.saveProject()}
            >{viewValue(chrome, text.menu('save'))}</MenuItem
          >
          <MenuItem onSelect={() => controller.requestSaveAs()}
            >{viewValue(chrome, text.menu('saveAs'))}</MenuItem
          >
          <MenuItem onSelect={() => controller.requestCloseTab(chrome.activeTab)}
            >{viewValue(chrome, text.menu('close'))}</MenuItem
          >
        </Menu>
        <Menu label={viewValue(chrome, menu('Edit/Title', 'Edit'))}>
          <EditMenuItems {controller} {chrome} {text} />
          <MenuItem onSelect={() => show('navigate')}
            >{viewValue(chrome, webText(chrome.langFile, 'navigation', {}, chrome))}</MenuItem
          >
        </Menu>
        <Menu label={viewValue(chrome, menu('View/Title', 'View'))}>
          <MenuCheck checked={chrome.sidebar} onChange={() => controller.toggleSidebar()}
            >{viewValue(chrome, webText(chrome.langFile, 'panels', {}, chrome))}</MenuCheck
          >
          <MenuCheck
            checked={chrome.showLSplit}
            onChange={(value) => controller.setShowSplit(0, value)}
            >{viewValue(chrome, text.menu('leftSplitter'))}</MenuCheck
          >
          <MenuCheck
            checked={chrome.showRSplit}
            onChange={(value) => controller.setShowSplit(2, value)}
            >{viewValue(chrome, text.menu('rightSplitter'))}</MenuCheck
          >
          <LockButtons {controller} {chrome} {text} />
          {#each [['header', 'Header'], ['grid', 'Grid'], ['wav', '#WAV'], ['bmp', '#BMP'], ['beat', 'Measure'], ['expansion', 'Expansion']] as const as [section, label] (section)}
            <MenuItem onSelect={() => show(section)}
              >{viewValue(chrome, featureText(chrome.langFile, label, chrome))}</MenuItem
            >
          {/each}
        </Menu>
        <Menu label={viewValue(chrome, menu('Options/Title', 'Options'))}>
          <MenuCheck checked={chrome.ntInput} onChange={(value) => controller.setNTInput(value)}
            >{viewValue(chrome, menu('Options/NT', 'NT input'))}</MenuCheck
          >
          <MenuCheck
            checked={viewValue(chrome, controller.getPreferences().errorCheck)}
            onChange={(errorCheck) => controller.updateOptions({ errorCheck })}
            >{viewValue(chrome, menu('Options/ErrorCheck', 'Error check'))}</MenuCheck
          >
          <MenuCheck
            checked={viewValue(chrome, controller.getPreferences().tool.previewOnClick)}
            onChange={(previewOnClick) =>
              controller.updateOptions({
                tool: { ...controller.getPreferences().tool, previewOnClick },
              })}>{viewValue(chrome, menu('Options/PreviewOnClick', 'Preview on click'))}</MenuCheck
          >
          <MenuCheck
            checked={viewValue(chrome, controller.getPreferences().showFileName)}
            onChange={(showFileName) => controller.updateOptions({ showFileName })}
            >{viewValue(chrome, menu('Options/ShowFileName', 'Show filenames'))}</MenuCheck
          >
          <hr class="settings-menu-separator" />
          {#each settingsPages as page (page.section)}
            <MenuItem onSelect={() => show(page.section)}
              >{viewValue(chrome, menu('Options/' + page.menu, page.fallback))}</MenuItem
            >
          {/each}
          <hr class="settings-menu-separator" />
          <div class="menu-settings">
            <ThemeSelect {controller} {chrome} {text} /><LangSelect {controller} {chrome} {text} />
          </div>
        </Menu>
        <Menu label={viewValue(chrome, menu('Conversion', 'Conversion'))}>
          <MenuItem onSelect={() => show('tools')}
            >{viewValue(
              chrome,
              featureText(chrome.langFile, 'Conversion wizard', chrome),
            )}</MenuItem
          >
          <MenuItem onSelect={() => show('tools')}
            >{viewValue(chrome, featureText(chrome.langFile, 'Selected notes', chrome))}</MenuItem
          >
        </Menu>
        <Menu label={viewValue(chrome, menu('Preview/Title', 'Preview'))}>
          <MenuItem disabled={chrome.project.busy} onSelect={() => controller.playAudio(true)}
            >{viewValue(chrome, webText(chrome.langFile, 'playBeginning', {}, chrome))}</MenuItem
          >
          <MenuItem disabled={chrome.project.busy} onSelect={() => controller.playAudio()}
            >{viewValue(chrome, webText(chrome.langFile, 'play', {}, chrome))}</MenuItem
          >
          <MenuItem
            disabled={chrome.project.busy}
            onSelect={() => controller.playAudio(false, true)}
            >{viewValue(chrome, webText(chrome.langFile, 'playSelected', {}, chrome))}</MenuItem
          >
          <MenuItem onSelect={() => controller.stopAudio()}
            >{viewValue(chrome, webText(chrome.langFile, 'stopAudio', {}, chrome))}</MenuItem
          >
          <MenuItem disabled={chrome.project.busy} onSelect={() => controller.exportAudio()}
            >{viewValue(chrome, webText(chrome.langFile, 'exportWave', {}, chrome))}</MenuItem
          >
        </Menu>
        <Menu label={viewValue(chrome, menu('Tools/Title', 'Tools'))}>
          {#each [['navigate', 'Navigation'], ['tools', 'Tools'], ['statistics', 'Statistics']] as const as [section, label] (section)}
            <MenuItem onSelect={() => show(section)}
              >{viewValue(chrome, featureText(chrome.langFile, label, chrome))}</MenuItem
            >
          {/each}
        </Menu>
      </nav>
    </header>
    <DesktopToolbar {controller} {chrome} {text} {onOpen} />
    <Tabs {controller} {chrome} />
    <main class="workspace">
      <div class="panels" bind:this={panels}>
        <PanelView
          {controller}
          panel={0}
          label={viewValue(chrome, webText(chrome.langFile, 'leftPanel', {}, chrome))}
          className={viewValue(chrome, sideClass(chrome.leftWidth))}
          style={{ width: chrome.leftWidth }}
        />
        {#if chrome.showLSplit}<Splitter
            {controller}
            panel={0}
            width={chrome.leftWidth}
            maxWidth={viewValue(chrome, room(chrome.rightWidth))}
            label={viewValue(chrome, text.menu('leftSplitter'))}
          />{/if}
        <PanelView
          {controller}
          panel={1}
          label={viewValue(chrome, webText(chrome.langFile, 'middlePanel', {}, chrome))}
        />
        {#if chrome.showRSplit}<Splitter
            {controller}
            panel={2}
            width={chrome.rightWidth}
            maxWidth={viewValue(chrome, room(chrome.leftWidth))}
            label={viewValue(chrome, text.menu('rightSplitter'))}
          />{/if}
        <PanelView
          {controller}
          panel={2}
          label={viewValue(chrome, webText(chrome.langFile, 'rightPanel', {}, chrome))}
          className={viewValue(chrome, sideClass(chrome.rightWidth))}
          style={{ width: chrome.rightWidth }}
        />
      </div>
    </main>
    <footer class="statusbar">
      <StatusBar {controller} {chrome} {text} /><Notices {chrome} {text} />
    </footer>
  </div>
  {#if chrome.sidebar}<DesktopPanels {controller} {chrome} {text} />{/if}
  {#if settingsPage(chrome.panelSection) || ['navigate', 'tools', 'statistics'].includes(chrome.panelSection)}
    <DesktopPanelDialog {controller} {chrome} {text} />
  {/if}
</div>
