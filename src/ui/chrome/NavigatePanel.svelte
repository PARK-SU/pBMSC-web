<script lang="ts">
  import type { ChromeProps } from './types.ts';
  import { webText, type WebKey } from '../../i18n/web.ts';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];
  export let chrome: ChromeProps['chrome'];

  const t = (key: WebKey) => webText(chrome.langFile, key, {}, chrome);
  let measure = '1';
  let position = false;
  let patternPosition = false;
  let template: HTMLInputElement | undefined;
  let measureInput: HTMLInputElement | undefined;

  $: navigationRequest = chrome.navigationRequest;
  $: {
    navigationRequest;
    measureInput?.focus();
    measureInput?.select();
  }
</script>

<div class="panel-fields">
  <label>
    {viewValue(chrome, t('Measure'))}
    <input
      name="gotoMeasure"
      bind:this={measureInput}
      value={measure}
      oninput={(e) => (measure = e.currentTarget.value)}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          controller.panelAction({ kind: 'goto', value: measure });
        }
      }}
    />
  </label>
  <button type="button" onclick={() => controller.panelAction({ kind: 'goto', value: measure })}>
    {viewValue(chrome, t('Go to measure'))}
  </button>
  <button type="button" onclick={() => controller.menuShortcut('mnFind')}>
    {viewValue(chrome, t('Find note'))}
  </button>
  <button type="button" onclick={() => template?.click()}>
    {viewValue(chrome, t('Load template'))}
  </button>
  <span>{viewValue(chrome, controller.getChart().fileNameTemplate)}</span>
  <input
    bind:this={template}
    type="file"
    data-template
    hidden
    accept=".bms,.bme,.bml,.pms,.txt"
    onchange={(e) => {
      const file = e.currentTarget.files?.[0];
      if (file) void controller.loadTemplate(file);
      e.currentTarget.value = '';
    }}
  />
  <label>
    <input
      type="checkbox"
      checked={position}
      onchange={(e) => {
        position = e.currentTarget.checked;
        controller.setTemplateOptions(e.currentTarget.checked, patternPosition);
      }}
    />
    {viewValue(chrome, t('Template snap also moves time (P)'))}
  </label>
  <label>
    <input
      type="checkbox"
      checked={patternPosition}
      onchange={(e) => {
        patternPosition = e.currentTarget.checked;
        controller.setTemplateOptions(position, e.currentTarget.checked);
      }}
    />
    {viewValue(chrome, t('Pattern paste also moves time'))}
  </label>
  <button type="button" onclick={() => void controller.pastePattern()}>
    {viewValue(chrome, t('Paste pattern'))}
  </button>
</div>
