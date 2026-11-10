<script lang="ts">
  export let name: string;
</script>

<img
  class="toolbar-icon"
  src={`${import.meta.env.BASE_URL}data/ui-${name}.png`}
  alt=""
  width="16"
  height="16"
  draggable="false"
/>
