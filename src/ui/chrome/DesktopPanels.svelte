<script lang="ts">
  import { afterUpdate } from 'svelte';
  import type { ChromeProps } from './types.ts';
  import { webText } from '../../i18n/web.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import { viewValue } from '../viewer/state.ts';
  import HeaderPanel from './HeaderPanel.svelte';
  import GridPanel from './GridPanel.svelte';
  import ResourcePanel from './ResourcePanel.svelte';
  import BeatPanel from './BeatPanel.svelte';
  import ExpansionActions from './ExpansionActions.svelte';
  import Icon from './Icon.svelte';

  export let controller: ChromeProps['controller'];
  export let chrome: ChromeProps['chrome'];
  export let text: ChromeProps['text'];
  let panel: HTMLElement;
  let waveform: HTMLInputElement;
  let previousSection = chrome.panelSection;
  const title = (key: string, fallback: string) =>
    sourceLabel(chrome, `OptionsPanel/${key}`, fallback);
  $: wave = chrome.audio.wave;
  afterUpdate(() => {
    if (previousSection === chrome.panelSection) return;
    previousSection = chrome.panelSection;
    const section = panel.querySelector<HTMLDetailsElement>(
      `[data-desktop-section="${chrome.panelSection}"]`,
    );
    if (section) {
      section.open = true;
      section.scrollIntoView({ block: 'nearest' });
    }
  });
</script>

<aside
  class="desktop-panels"
  bind:this={panel}
  aria-label={webText(chrome.langFile, 'panels', {}, chrome)}
>
  {#key chrome.activeTab}
    <details class="desktop-section" data-desktop-section="header" open>
      <summary>{viewValue(chrome, title('Header/Header', 'HEADER'))}</summary>
      <HeaderPanel {controller} {chrome} {text} desktop />
    </details>
    <details class="desktop-section" data-desktop-section="grid" open>
      <summary>{viewValue(chrome, title('Grid/Title', 'Grid'))}</summary>
      <GridPanel {controller} {chrome} {text} desktop />
    </details>
    <details class="desktop-section" data-desktop-section="bgm" open>
      <summary>{viewValue(chrome, title('WaveForm/Title', 'BGM'))}</summary>
      <div class="bgm-panel">
        <div class="panel-buttons">
          <button
            type="button"
            name="loadBGM"
            title={webText(chrome.langFile, 'loadWave', {}, chrome)}
            aria-label={webText(chrome.langFile, 'loadWave', {}, chrome)}
            onclick={() => waveform.click()}><Icon name="Add" /></button
          >
          <button
            type="button"
            name="clearBGM"
            title={webText(chrome.langFile, 'clearWave', {}, chrome)}
            aria-label={webText(chrome.langFile, 'clearWave', {}, chrome)}
            onclick={() => controller.clearWaveform()}><Icon name="Remove" /></button
          >
          <button
            type="button"
            name="lockBGM"
            title={webText(chrome.langFile, 'lockedBGM', {}, chrome)}
            aria-label={webText(chrome.langFile, 'lockedBGM', {}, chrome)}
            aria-pressed={wave.locked}
            onclick={() => controller.setWaveOptions({ locked: !wave.locked })}
            ><Icon name="WaveLock" /></button
          >
          <output class="bgm-name"
            >{chrome.audio.waveName || webText(chrome.langFile, 'None', {}, chrome)}</output
          >
        </div>
        <label class="bgm-position"
          ><span aria-hidden="true">↕</span>
          <input
            type="range"
            min="0"
            max="1920"
            step="1"
            value={wave.position}
            disabled={wave.locked}
            aria-label={webText(chrome.langFile, 'wavePosition', {}, chrome)}
            oninput={(e) => controller.setWaveOptions({ position: Number(e.currentTarget.value) })}
          />
          <input
            name="bgm.position"
            type="number"
            min="0"
            value={wave.position}
            disabled={wave.locked}
            aria-label={webText(chrome.langFile, 'wavePosition', {}, chrome)}
            onchange={(e) =>
              controller.setWaveOptions({ position: Math.max(0, Number(e.currentTarget.value)) })}
          />
        </label>
        <details class="panel-expand">
          <summary>{webText(chrome.langFile, 'expand', {}, chrome)}</summary>
          {#each [['left', 'waveLeft', -10000, 10000], ['width', 'waveWidth', 1, 1000], ['opacity', 'opacity', 0, 255]] as const as [key, label, min, max] (key)}
            <label class="panel-field"
              ><span>{webText(chrome.langFile, label, {}, chrome)}</span>
              <input
                type="number"
                name={`bgm.${key}`}
                {min}
                {max}
                value={wave[key]}
                onchange={(e) =>
                  controller.setWaveOptions({
                    [key]: Math.max(min, Math.min(max, Number(e.currentTarget.value))),
                  })}
              />
            </label>
          {/each}
        </details>
      </div>
    </details>
    <details class="desktop-section" data-desktop-section="wav" open>
      <summary>{viewValue(chrome, title('WAV/Title', 'WAV'))}</summary>
      <ResourcePanel {controller} {chrome} {text} kind="wav" desktop />
    </details>
    <details class="desktop-section" data-desktop-section="bmp" open>
      <summary>{viewValue(chrome, title('BMP/Title', '#BMP'))}</summary>
      <ResourcePanel {controller} {chrome} {text} kind="bmp" desktop />
    </details>
    <details class="desktop-section" data-desktop-section="beat" open>
      <summary>{viewValue(chrome, title('Beat', 'Measure'))}</summary>
      <BeatPanel {controller} {chrome} {text} desktop />
    </details>
    <details class="desktop-section" data-desktop-section="expansion" open>
      <summary>{viewValue(chrome, title('Expansion', 'Expansion'))}</summary>
      <textarea
        name="expansion"
        rows="18"
        aria-label={viewValue(chrome, title('Expansion', 'Expansion'))}
        disabled={viewValue(chrome, !controller.canEditExpansion())}
        value={viewValue(chrome, controller.getChart().expansion.replaceAll('\r\n', '\n'))}
        oninput={(e) =>
          controller.panelAction({
            kind: 'expansion',
            value: e.currentTarget.value.replace(/\r?\n/g, '\r\n'),
          })}></textarea>
      <ExpansionActions {controller} {chrome} {text} />
    </details>
  {/key}
  <input
    bind:this={waveform}
    type="file"
    hidden
    accept="audio/*,.wav,.ogg,.mp3,.flac,.aif,.aiff"
    onchange={(e) => {
      const file = e.currentTarget.files?.[0];
      e.currentTarget.value = '';
      if (file) controller.loadWaveform(file);
    }}
  />
</aside>
