<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { keepFocus } from '../input/focus.ts';

  export let label: string;
  export let ariaLabel: string | undefined = undefined;
  export let className: string | undefined = undefined;
  let details: HTMLDetailsElement;
  const inMenu = ariaLabel === undefined;
  setContext('menu', inMenu);

  function keyDown(event: KeyboardEvent) {
    if (!details.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      details.open = false;
      details.querySelector('summary')?.focus();
      return;
    }
    if (!inMenu || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    const items = [...details.querySelectorAll<HTMLElement>('.menu-items > [role^="menuitem"]')];
    if (!items.length) return;
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = index < 0 ? (step > 0 ? 0 : items.length - 1) : index + step;
    items[(next + items.length) % items.length]!.focus();
  }

  onMount(() => {
    const close = (event: PointerEvent) => {
      if (details.open && !details.contains(event.target as Node)) details.open = false;
    };
    document.addEventListener('pointerdown', close);
    const select = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('[data-close-menu]')) details.open = false;
    };
    details.addEventListener('click', select);
    details.addEventListener('keydown', keyDown);
    return () => {
      document.removeEventListener('pointerdown', close);
      details.removeEventListener('click', select);
      details.removeEventListener('keydown', keyDown);
    };
  });
</script>

<details bind:this={details} class={className === undefined ? 'menu' : `menu ${className}`}>
  <summary aria-label={ariaLabel} onmousedown={keepFocus}>{label}</summary>
  <div class="menu-items" role={inMenu ? 'menu' : 'group'}><slot /></div>
</details>
