<script lang="ts">
  import { keepFocus } from '../input/focus.ts';

  export let checked: boolean;
  export let onChange: (checked: boolean) => void;
</script>

<button
  type="button"
  role="menuitemcheckbox"
  aria-checked={checked}
  data-close-menu
  onmousedown={keepFocus}
  onclick={() => onChange(!checked)}><slot /></button
>
