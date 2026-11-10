<script lang="ts">
  import { webText } from '../../i18n/web.ts';
  import type { LangFile } from '../../i18n/lang.ts';

  export let value: string;
  export let onChange: (value: string) => void;
  export let letters = false;
  export let base62 = false;
  export let langFile: LangFile | undefined;
  $: keys = letters ? '1234567890' : '1234567890.-+';
  $: alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + (base62 ? 'abcdefghijklmnopqrstuvwxyz' : '');
</script>

<div class="numeric-keypad">
  <div class="keypad-digits">
    {#each [...keys] as key (key)}
      <button type="button" data-key={key} onclick={() => onChange(value + key)}>{key}</button>
    {/each}
  </div>
  <div class="keypad-actions">
    <button type="button" onclick={() => onChange('')}>{webText(langFile, 'clear')}</button>
    <button
      type="button"
      aria-label={webText(langFile, 'backspace')}
      onclick={() => onChange(value.slice(0, -1))}>⌫</button
    >
  </div>
  {#if letters}
    <details>
      <summary>A–Z{base62 ? ' / a–z' : ''}</summary>
      <div class="keypad-letters">
        {#each [...alphabet] as key (key)}
          <button type="button" data-key={key} onclick={() => onChange(value + key)}>{key}</button>
        {/each}
      </div>
    </details>
  {/if}
</div>
