<script lang="ts">
  import { onMount } from 'svelte';

  let waiting = false;

  onMount(() => {
    const timer = setTimeout(() => (waiting = true), 300);
    return () => clearTimeout(timer);
  });
</script>

{waiting ? '◌' : '▶'}
