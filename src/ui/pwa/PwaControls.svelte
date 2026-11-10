<script lang="ts">
  import { webText } from '../../i18n/web.ts';
  import type { ChromeProps } from '../chrome/types.ts';
  import { writeRecovery } from '../recovery/store.ts';
  import { installApp, pwaState, subscribePwa, updateApp } from './state.ts';
  import { readable } from 'svelte/store';
  import { viewValue } from '../viewer/state.ts';

  export let controller: Omit<ChromeProps, 'text'>['controller'];

  export let chrome: Omit<ChromeProps, 'text'>['chrome'];

  interface $$Props extends Omit<ChromeProps, 'text'> {}

  const stateStore = readable(pwaState(), (set) => subscribePwa(() => set(pwaState())));

  $: state = $stateStore;

  let busy = false;

  let error = '';

  const t = (key: Parameters<typeof webText>[1]) => webText(chrome.langFile, key, {}, chrome);

  let unsaved = chrome.tabs.some((tab) => !tab.isSaved);
  $: unsaved = viewValue(
    chrome,
    chrome.tabs.some((tab) => !tab.isSaved),
  );

  let blocked = busy || unsaved || chrome.audioLocked || chrome.project.busy || chrome.saving;
  $: blocked = viewValue(
    chrome,
    busy || unsaved || chrome.audioLocked || chrome.project.busy || chrome.saving,
  );
</script>

<section
  class="panel-fields"
  aria-label={viewValue(chrome, t('app'))}
  lang={chrome.langFile === 'kor.Lang.xml' ? 'ko' : 'en'}
>
  <p role="status" data-pwa-state>
    {viewValue(
      chrome,
      !state.online
        ? t('offline')
        : state.offlineReady
          ? t('offlineReady')
          : state.supported
            ? t('offlinePreparing')
            : t('offlineUnavailable'),
    )}
  </p>
  {#if state.installed}<p>
      {viewValue(chrome, t('installed'))}
    </p>{:else}{#if state.installable}<button
        name="installApp"
        onclick={() => {
          void installApp().catch((e: unknown) => (error = String(e)));
        }}
      >
        {viewValue(chrome, t('installApp'))}
      </button>{:else}<p>{viewValue(chrome, t('installHelp'))}</p>{/if}{/if}
  {#if state.updateReady}
    <button
      name="updateApp"
      disabled={blocked}
      onclick={() => {
        busy = true;
        error = '';
        controller.stopAudio();
        const snapshot = controller.recoverySnapshot();
        if (!snapshot) {
          busy = false;
          return;
        }
        void writeRecovery(structuredClone(snapshot))
          .then(() => updateApp())
          .catch((e: unknown) => {
            error = String(e);
            busy = false;
          });
      }}
    >
      {viewValue(chrome, t('updateApp'))}
    </button>
    {#if unsaved}<p>{viewValue(chrome, t('updateSaveFirst'))}</p>{/if}
  {/if}
  {#if error || state.error}<p role="alert">
      {viewValue(chrome, t('offlineFailed'))}: {error || state.error}
    </p>{/if}
</section>
