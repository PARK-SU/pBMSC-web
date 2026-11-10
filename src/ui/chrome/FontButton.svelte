<script lang="ts">
  import { tick } from 'svelte';
  import { cssFont, type ThemeFont } from '../../settings/theme-loader.ts';
  import { webText } from '../../i18n/web.ts';
  import type { ChromeProps } from './types.ts';
  import { viewValue } from '../viewer/state.ts';
  export let name: string;
  export let label: string;
  export let value: ThemeFont;
  export let chrome: ChromeProps['chrome'];
  export let onChange: (font: ThemeFont) => void;
  let draft = { ...value };
  let editing = false;
  let dialog: HTMLDialogElement | undefined;
  $: t = viewValue(chrome, (key: Parameters<typeof webText>[1]) =>
    webText(chrome.langFile, key, {}, chrome),
  );
  const open = async () => {
    draft = { ...value };
    editing = true;
    await tick();
    dialog?.showModal();
  };
</script>

<button
  type="button"
  {name}
  class="font-button"
  title={label}
  aria-label={label}
  style:font={cssFont(value)}
  onclick={() => void open()}>{value.name}</button
>
{#if editing}
  <dialog
    class="edit-dialog font-dialog"
    bind:this={dialog}
    aria-label={label}
    oncancel={(e) => {
      e.preventDefault();
      editing = false;
    }}
  >
    <form
      onsubmit={(e) => {
        e.preventDefault();
        onChange({ ...draft, name: draft.name.trim() });
        editing = false;
      }}
    >
      <label
        >{t('fontName')}<input
          name={name + '.name'}
          value={draft.name}
          required
          oninput={(e) => (draft = { ...draft, name: e.currentTarget.value })}
        /></label
      >
      <label
        >{t('fontSize')}<input
          name={name + '.size'}
          type="number"
          min="1"
          max="200"
          step="0.25"
          value={draft.size}
          required
          oninput={(e) => (draft = { ...draft, size: Number(e.currentTarget.value) })}
        /></label
      >
      <label class="font-style-option"
        ><input
          name={name + '.bold'}
          type="checkbox"
          checked={(draft.style & 1) !== 0}
          onchange={(e) =>
            (draft = {
              ...draft,
              style: e.currentTarget.checked ? draft.style | 1 : draft.style & ~1,
            })}
        />{t('fontBold')}</label
      >
      <label class="font-style-option"
        ><input
          name={name + '.italic'}
          type="checkbox"
          checked={(draft.style & 2) !== 0}
          onchange={(e) =>
            (draft = {
              ...draft,
              style: e.currentTarget.checked ? draft.style | 2 : draft.style & ~2,
            })}
        />{t('fontItalic')}</label
      >
      <div class="settings-buttons">
        <button type="submit">{t('ok')}</button>
        <button type="button" onclick={() => (editing = false)}>{t('cancel')}</button>
      </div>
    </form>
  </dialog>
{/if}
