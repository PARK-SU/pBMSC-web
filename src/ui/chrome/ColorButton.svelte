<script lang="ts">
  import { tick } from 'svelte';
  import { argbToCss } from '../../settings/theme-loader.ts';
  import { webText } from '../../i18n/web.ts';
  import type { ChromeProps } from './types.ts';

  export let name: string;
  export let label: string;
  export let value: number;
  export let chrome: ChromeProps['chrome'];
  export let onChange: (value: number) => void;
  export let vertical = false;
  export let background: number | undefined = undefined;
  export let foreground: number | undefined = undefined;
  let editing = false;
  let hex = '';
  let dialog: HTMLDialogElement | undefined;
  $: unsigned = value >>> 0;
  $: caption = vertical
    ? [24, 16, 8, 0]
        .map((shift) => ((unsigned >>> shift) & 255).toString(16).toUpperCase())
        .join('\n')
    : unsigned.toString(16).padStart(8, '0').toUpperCase();
  $: back = background ?? value;
  $: luminance =
    0.299 * ((back >>> 16) & 255) + 0.587 * ((back >>> 8) & 255) + 0.114 * (back & 255);
  $: color =
    foreground === undefined
      ? luminance + 255 - ((back >>> 24) & 255) >= 128
        ? '#000'
        : '#fff'
      : argbToCss(foreground | 0xff000000);
  $: preview = /^[0-9a-f]{8}$/i.test(hex) ? Number.parseInt(hex, 16) : unsigned;
  const open = async () => {
    hex = unsigned.toString(16).padStart(8, '0').toUpperCase();
    editing = true;
    await tick();
    dialog?.showModal();
  };
</script>

<button
  type="button"
  {name}
  class="argb-button"
  class:vertical
  title={label}
  aria-label={label}
  style:background-color={argbToCss(back)}
  style:color
  onclick={() => void open()}>{caption}</button
>
{#if editing}
  <dialog
    class="edit-dialog color-dialog"
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
        if (!/^[0-9a-f]{8}$/i.test(hex)) return;
        const number = Number.parseInt(hex, 16);
        onChange(number > 0x7fffffff ? number - 0x100000000 : number);
        editing = false;
      }}
    >
      <label
        >{label}<input
          name={name + '.hex'}
          aria-label="ARGB"
          value={hex}
          maxLength={8}
          pattern={'[0-9A-Fa-f]{8}'}
          required
          oninput={(e) => (hex = e.currentTarget.value)}
        /></label
      >
      <div class="color-choices">
        <input
          type="color"
          name={name + '.rgb'}
          aria-label="RGB"
          value={'#' + (preview & 0xffffff).toString(16).padStart(6, '0')}
          oninput={(e) =>
            (hex = (
              (preview >>> 24).toString(16).padStart(2, '0') + e.currentTarget.value.slice(1)
            ).toUpperCase())}
        />
        <label
          >A<input
            type="number"
            name={name + '.alpha'}
            min="0"
            max="255"
            step="1"
            value={preview >>> 24}
            oninput={(e) => {
              const alpha = Math.max(0, Math.min(255, Number(e.currentTarget.value)));
              hex = (((alpha << 24) | (preview & 0xffffff)) >>> 0)
                .toString(16)
                .padStart(8, '0')
                .toUpperCase();
            }}
          /></label
        >
      </div>
      <div class="settings-buttons">
        <button type="submit">{webText(chrome.langFile, 'ok', {}, chrome)}</button>
        <button type="button" onclick={() => (editing = false)}
          >{webText(chrome.langFile, 'cancel', {}, chrome)}</button
        >
      </div>
    </form>
  </dialog>
{/if}
