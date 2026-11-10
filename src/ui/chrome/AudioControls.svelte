<script lang="ts">
  import { webText, type WebKey } from '../../i18n/web.ts';
  import { featureMessage } from '../../i18n/features.ts';
  import { keepFocus } from '../input/focus.ts';
  import type { ChromeProps } from './types.ts';
  import PreparingIcon from './PreparingIcon.svelte';
  import { viewValue } from '../viewer/state.ts';
  import { isAudioFile } from '../../project/paths.ts';
  import Icon from './Icon.svelte';
  import { readable } from 'svelte/store';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];
  interface $$Props extends ChromeProps {}

  const audioStore = readable(controller.getChrome().audio, (set) =>
    controller.subscribeAudio(() => set(controller.getChrome().audio)),
  );
  let audio = controller.getChrome().audio;
  $: audio = $audioStore;

  let wave = audio.wave;
  $: wave = viewValue(chrome, audio.wave);

  let busy = audio.loading || chrome.project.busy;
  $: busy = viewValue(chrome, audio.loading || chrome.project.busy);

  let files: HTMLInputElement | undefined = undefined;

  let folder: HTMLInputElement | undefined = undefined;

  let waveform: HTMLInputElement | undefined = undefined;

  let details: HTMLDetailsElement | undefined = undefined;

  const t = (key: WebKey) => webText(chrome.langFile, key, {}, chrome);

  const load = (input: HTMLInputElement) => {
    const picked = Array.from(input.files ?? []).filter(
      (file) => !input.webkitdirectory || isAudioFile(file.name) || file.type.startsWith('audio/'),
    );
    if (picked.length) void controller.importKeysounds(picked);
    input.value = '';
  };

  const time = (n: number) =>
    `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
</script>

<div class="audio-controls">
  <button
    type="button"
    name="playBeginning"
    title={viewValue(chrome, t('playBeginning'))}
    aria-label={viewValue(chrome, t('playBeginning'))}
    onmousedown={keepFocus}
    onclick={() => controller.playAudio(true)}
    disabled={busy || audio.exporting}
  >
    <Icon name="PlayBeginning" />
  </button>
  <button
    type="button"
    name="playAudio"
    title={viewValue(chrome, t('play'))}
    aria-label={viewValue(chrome, t('play'))}
    aria-busy={audio.kind === 'preparing'}
    onmousedown={keepFocus}
    onclick={() => controller.playAudio()}
    disabled={busy || audio.exporting}
  >
    {#if audio.kind === 'preparing'}<PreparingIcon />{:else}<Icon name="Play" />{/if}
  </button>
  <button
    type="button"
    name="stopAudio"
    title={viewValue(chrome, t('stopAudio'))}
    aria-label={viewValue(chrome, t('stopAudio'))}
    onmousedown={keepFocus}
    onclick={() => controller.stopAudio()}
    disabled={!chrome.audioLocked && !audio.exporting}
  >
    <Icon name="Stop" />
  </button>
  <output class="audio-clock" aria-live="off">
    {viewValue(chrome, time(audio.seconds))} / {viewValue(chrome, time(audio.duration))}
  </output>
  <details class="audio-menu" bind:this={details}>
    <summary aria-label={viewValue(chrome, t('audio'))}>
      ♫{audio.error || audio.warnings.length ? ' !' : ''}
    </summary>
    <div class="audio-options">
      <div class="panel-buttons">
        <button name="loadKeysounds" onclick={() => files?.click()} disabled={busy}>
          {viewValue(chrome, t('audioFiles'))}
        </button>
        <button name="loadAudioFolder" onclick={() => folder?.click()} disabled={busy}>
          {viewValue(chrome, t('audioFolder'))}
        </button>
        <button
          name="playSelected"
          onclick={() => controller.playAudio(false, true)}
          disabled={busy}
        >
          {viewValue(chrome, t('playSelected'))}
        </button>
        <button
          name="exportAudio"
          onclick={() => controller.exportAudio()}
          disabled={busy || audio.exporting}
        >
          {viewValue(chrome, t('exportWave'))}
        </button>
      </div>
      <p>
        {viewValue(chrome, audio.loading ? t('preparing') : `${audio.files} ${t('files')}`)} · {viewValue(
          chrome,
          t('cache'),
        )}{' '}
        {viewValue(chrome, (audio.cacheBytes / 1024 ** 2).toFixed(1))} MB
      </p>
      {#if audio.files === 0 && !busy}
        <p data-audio-folder-hint>{viewValue(chrome, t('audioFolderHint'))}</p>
      {/if}
      {#if audio.exporting}<div>
          {viewValue(chrome, t('exporting'))} <progress value={audio.progress} max={1}></progress>
          <button onclick={() => controller.stopAudio()}>{viewValue(chrome, t('cancel'))}</button>
        </div>{/if}
      <label>
        {viewValue(chrome, t('offset'))}{' '}
        <input
          name="audioOffset"
          type="number"
          min={-2000}
          max={2000}
          step={10}
          value={audio.offsetMs}
          oninput={(e) => controller.setAudioOffset(Number(e.currentTarget.value))}
        />
      </label>
      <label>
        <input
          type="checkbox"
          name="previewOnClick"
          checked={audio.previewOnClick}
          onchange={(e) =>
            controller.setPreviewOptions(e.currentTarget.checked, audio.clickStopPreview)}
        />
        {viewValue(chrome, t('previewOnClick'))}
      </label>
      <label>
        <input
          type="checkbox"
          name="clickStopPreview"
          checked={audio.clickStopPreview}
          onchange={(e) =>
            controller.setPreviewOptions(audio.previewOnClick, e.currentTarget.checked)}
        />
        {viewValue(chrome, t('clickStopPreview'))}
      </label>
      <label>
        <input
          type="checkbox"
          name="audioLine"
          checked={wave.audioLine}
          onchange={(e) => controller.setWaveOptions({ audioLine: e.currentTarget.checked })}
        />
        {viewValue(chrome, t('audioLine'))}
      </label>
      <hr />
      <div class="panel-buttons">
        <button name="loadWaveform" disabled={audio.loading} onclick={() => waveform?.click()}>
          {viewValue(chrome, t('loadWave'))}
        </button>
        <button name="clearWaveform" onclick={() => controller.clearWaveform()}>
          {viewValue(chrome, t('clearWave'))}
        </button>
      </div>
      <output>{audio.waveName}</output>
      <label>
        <input
          name="waveLock"
          type="checkbox"
          checked={wave.locked}
          onchange={(e) => controller.setWaveOptions({ locked: e.currentTarget.checked })}
        />
        {viewValue(chrome, t('lockedBGM'))}
      </label>
      <label>
        <input
          name="waveOnNotes"
          type="checkbox"
          checked={wave.onNotes}
          onchange={(e) => controller.setWaveOptions({ onNotes: e.currentTarget.checked })}
        />
        {viewValue(chrome, t('waveOnNotes'))}
      </label>
      {#each [['position', 'wavePosition', 0, 192000, 1], ['left', 'waveLeft', -10000, 10000, 1], ['width', 'waveWidth', 1, 1000, 1], ['precision', 'precision', 0.125, 4, 0.125], ['opacity', 'opacity', 0, 255, 1], ['saturation', 'saturation', 0, 1, 0.01]] as const as [key, label, min, max, step] (key)}<label
        >
          {viewValue(chrome, t(label))}
          <input
            name={`wave.${key}`}
            type="number"
            {min}
            {max}
            {step}
            value={wave[key]}
            disabled={key === 'position' && wave.locked}
            oninput={(e) =>
              controller.setWaveOptions({
                [key]: Math.min(max, Math.max(min, Number(e.currentTarget.value))),
              })}
          />
        </label>{/each}
      {#if audio.error}<p role="alert">
          {viewValue(chrome, featureMessage(chrome.langFile, audio.error))}
        </p>{/if}
      {#if audio.kind !== 'preparing' && audio.warnings.length > 0}<ul class="audio-warnings">
          {#each audio.warnings as message (message)}<li>
              {viewValue(chrome, featureMessage(chrome.langFile, message))}
            </li>{/each}
        </ul>{/if}
      <a href={`${import.meta.env.BASE_URL}vendor/NOTICE.txt`} target="_blank" rel="noreferrer">
        {viewValue(chrome, t('licenses'))}
      </a>
    </div>
  </details>
  {#if audio.error || audio.warnings.length > 0}<button
      name="audioWarnings"
      aria-label={viewValue(chrome, t('audioWarnings'))}
      class="audio-warning"
      onclick={() => {
        if (details) details.open = !details.open;
      }}
    >
      !
    </button>{/if}
  <input
    bind:this={files}
    hidden
    type="file"
    multiple
    accept="audio/*,.ogg,.wav,.flac"
    data-audio-files
    onchange={(e) => load(e.currentTarget)}
  />
  <input
    bind:this={folder}
    webkitdirectory
    hidden
    type="file"
    multiple
    data-audio-folder
    onchange={(e) => load(e.currentTarget)}
  />
  <input
    bind:this={waveform}
    hidden
    type="file"
    accept="audio/*,.ogg,.wav"
    data-waveform-file
    onchange={(e) => {
      const f = e.currentTarget.files?.[0];
      if (f) controller.loadWaveform(f);
      e.currentTarget.value = '';
    }}
  />
</div>
