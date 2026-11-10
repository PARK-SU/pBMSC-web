<script lang="ts">
  import { styleText, type CssStyle } from '../style.ts';

  export let name: string;

  export let title: string | undefined = undefined;

  export let width: number | undefined = undefined;

  export let style: CssStyle | undefined = undefined;
</script>

<span
  class="status-item"
  data-status={name}
  {title}
  style={styleText(width === undefined ? style : { width, ...style })}
>
  <slot />
</span>
