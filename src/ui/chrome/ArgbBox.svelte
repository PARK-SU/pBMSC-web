<script lang="ts">
  import { colorA } from '../../editor/render/colors.ts';
  import NumberBox from './NumberBox.svelte';

  export let name: string;

  export let label: string;

  export let value: number;

  export let onChange: (n: number) => void;

  export let alphaLabel: string;
</script>

<div class="color-field">
  <label>
    {label}
    <input
      {name}
      type="color"
      value={'#' + (value & 0xffffff).toString(16).padStart(6, '0')}
      oninput={(e) =>
        onChange((colorA(value) << 24) | Number.parseInt(e.currentTarget.value.slice(1), 16))}
    />
  </label>
  <NumberBox
    name={name + '.alpha'}
    label={alphaLabel}
    value={colorA(value)}
    min={0}
    max={255}
    step={1}
    onChange={(a) => onChange((Math.round(a) << 24) | (value & 0xffffff))}
  />
</div>
