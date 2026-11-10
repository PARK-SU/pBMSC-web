<script lang="ts">
  import type { ChromeProps } from './types.ts';
  import { keepFocus } from '../input/focus.ts';
  import { webText, type WebKey } from '../../i18n/web.ts';
  import { featureText } from '../../i18n/features.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import ToolsPanel from './ToolsPanel.svelte';
  import OptionsPanel from './OptionsPanel.svelte';
  import ColorsPanel from './ColorsPanel.svelte';
  import StatisticsPanel from './StatisticsPanel.svelte';
  import ExpansionActions from './ExpansionActions.svelte';
  import HeaderPanel from './HeaderPanel.svelte';
  import GridPanel from './GridPanel.svelte';
  import ResourcePanel from './ResourcePanel.svelte';
  import BeatPanel from './BeatPanel.svelte';
  import NavigatePanel from './NavigatePanel.svelte';
  import type { ViewerController } from '../viewer/controller.ts';
  import type { ViewerChrome } from '../viewer/controller.ts';
  import type { UiText } from '../viewer/text.ts';
  import { viewValue } from '../viewer/state.ts';
  import { settingsPages } from './settings-pages.ts';

  export let controller: ViewerController;

  export let chrome: ViewerChrome;

  export let text: UiText;
  export let onClose: (() => void) | undefined = undefined;

  interface $$Props extends ChromeProps {
    onClose?: () => void;
  }

  $: props = { controller, chrome, text };

  const t = (key: WebKey) => webText(chrome.langFile, key, {}, chrome);

  let section = chrome.panelSection;
  $: section = viewValue(chrome, chrome.panelSection);

  const title = (key: string, fallback: string) => sourceLabel(chrome, key, fallback);

  let sections = [
    ['header', title('OptionsPanel/Header/Header', 'Header')],
    ['grid', title('OptionsPanel/Grid/Title', 'Grid')],
    ['wav', '#WAV'],
    ['bmp', '#BMP'],
    ['beat', title('OptionsPanel/Beat', 'Beat')],
    ['expansion', title('OptionsPanel/Expansion', 'Expansion')],
    ['navigate', t('navigation')],
    ['tools', featureText(chrome.langFile, 'Tools', chrome)],
    ...settingsPages.map((page) => [page.section, title(page.path, page.fallback)]),
    ['statistics', featureText(chrome.langFile, 'Statistics', chrome)],
  ];
  $: sections = viewValue(chrome, [
    ['header', title('OptionsPanel/Header/Header', 'Header')],
    ['grid', title('OptionsPanel/Grid/Title', 'Grid')],
    ['wav', '#WAV'],
    ['bmp', '#BMP'],
    ['beat', title('OptionsPanel/Beat', 'Beat')],
    ['expansion', title('OptionsPanel/Expansion', 'Expansion')],
    ['navigate', t('navigation')],
    ['tools', featureText(chrome.langFile, 'Tools', chrome)],
    ...settingsPages.map((page) => [page.section, title(page.path, page.fallback)]),
    ['statistics', featureText(chrome.langFile, 'Statistics', chrome)],
  ]);
</script>

<aside class="side-panels" aria-label={viewValue(chrome, t('Chart panels'))}>
  <div class="panel-buttons">
    <select
      aria-label={viewValue(chrome, t('Panel'))}
      value={section}
      onchange={(e) => controller.setPanelSection(e.currentTarget.value as typeof section)}
    >
      {#each sections as [id, label] (id)}<option value={id}>
          {label}
        </option>{/each}
    </select>
    <button
      type="button"
      aria-label={viewValue(chrome, t('Close panels'))}
      onmousedown={keepFocus}
      onclick={() => (onClose ? onClose() : controller.toggleSidebar())}
    >
      ×
    </button>
  </div>
  {#key chrome.activeTab}<div>
      {#if section === 'header'}<HeaderPanel {...props} />{/if}
      {#if section === 'grid'}<GridPanel {...props} />{/if}
      {#if section === 'wav' || section === 'bmp'}{#key section}<ResourcePanel
            {...props}
            kind={section}
          />{/key}{/if}
      {#if section === 'beat'}<BeatPanel {...props} />{/if}
      {#if section === 'navigate'}<NavigatePanel {...props} />{/if}
      {#if section === 'tools'}<ToolsPanel {...props} />{/if}
      {#if ['options', 'visual', 'keybindings', 'audio'].includes(section)}<OptionsPanel
          {...props}
          onClose={onClose ?? (() => controller.toggleSidebar())}
        />{/if}
      {#if section === 'colors'}<ColorsPanel {...props} />{/if}
      {#if section === 'statistics'}<StatisticsPanel {...props} />{/if}
      {#if section === 'expansion'}<label class="panel-fields">
          <span>{viewValue(chrome, title('OptionsPanel/Expansion', 'Expansion'))}</span>
          <textarea
            name="expansion"
            rows={18}
            disabled={viewValue(chrome, !controller.canEditExpansion())}
            value={viewValue(chrome, controller.getChart().expansion.replaceAll('\r\n', '\n'))}
            oninput={(e) =>
              controller.panelAction({
                kind: 'expansion',
                value: e.currentTarget.value.replace(/\r?\n/g, '\r\n'),
              })}></textarea>
        </label>{/if}
      {#if section === 'expansion'}<ExpansionActions {...props} />{/if}
    </div>{/key}
  <span class="panel-total">
    {viewValue(chrome, t('notes'))}: {viewValue(chrome, controller.getPlayableCount())}
  </span>
</aside>
