<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { readable } from 'svelte/store';
  import { webText } from '../../i18n/web.ts';
  import type { RecoverySnapshot, ViewerController } from '../viewer/controller.ts';
  import { readRecovery, writeRecovery } from './store.ts';

  export let controller: ViewerController;
  let pending: RecoverySnapshot | undefined;
  let ready = false;
  let failed = false;
  let dialog: HTMLDialogElement;
  let stopWatching = () => {};
  const chrome = readable(controller.getChrome(), (set) =>
    controller.subscribe(() => set(controller.getChrome())),
  );
  const t = (key: Parameters<typeof webText>[1]) => webText($chrome.langFile, key, {}, $chrome);

  $: if (pending && dialog && !dialog.open) dialog.showModal();
  $: if (ready) stopWatching = watchChanges();

  function watchChanges() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previous = controller.getChrome();
    let writes = Promise.resolve();
    const unsubscribe = controller.subscribe(() => {
      const next = controller.getChrome();
      const dirty = next.panelRevision !== previous.panelRevision || next.tabs !== previous.tabs;
      previous = next;
      if (!dirty) return;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        const snapshot = controller.recoverySnapshot();
        if (snapshot === undefined) return;
        const copy = structuredClone(snapshot);
        writes = writes
          .then(() => writeRecovery(copy))
          .catch(() => {
            failed = true;
          });
      }, 300);
    });
    return () => {
      unsubscribe();
      if (timer !== undefined) clearTimeout(timer);
    };
  }

  onMount(() => {
    let live = true;
    void readRecovery()
      .then((value) => {
        if (!live) return;
        pending = value;
        ready = value === undefined;
      })
      .catch(() => {
        if (live) failed = true;
      });
    return () => {
      live = false;
    };
  });
  onDestroy(() => stopWatching());
</script>

{#if pending}
  <dialog class="recovery-dialog" bind:this={dialog} oncancel={(event) => event.preventDefault()}>
    <span>{($chrome.langFile, t('recover'))}</span>
    <button
      name="restoreSession"
      onclick={() => {
        if (pending) controller.restoreRecovery(pending);
        pending = undefined;
        ready = true;
      }}>{($chrome.langFile, t('restore'))}</button
    >
    <button
      name="discardSession"
      onclick={() => {
        void writeRecovery(null).catch(() => {
          failed = true;
        });
        pending = undefined;
        ready = true;
      }}>{($chrome.langFile, t('discard'))}</button
    >
  </dialog>
{:else if failed}
  <div class="recovery-banner" role="status">{($chrome.langFile, t('recoveryFailed'))}</div>
{/if}
