<script lang="ts">
  import { getContext } from 'svelte';
  import { keepFocus } from '../input/focus.ts';

  export let onSelect: () => void;
  export let disabled = false;
  const inMenu = getContext<boolean>('menu') ?? true;
</script>

<button
  type="button"
  role={inMenu ? 'menuitem' : undefined}
  {disabled}
  data-close-menu
  onmousedown={keepFocus}
  onclick={onSelect}><slot /></button
>
