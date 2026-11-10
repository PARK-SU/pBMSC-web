<script lang="ts">
  export let name: string;

  export let label: string;

  export let value: number;

  export let onChange: (n: number) => void;

  export let min: number = -192000;

  export let max: number = 192000;

  export let step: number | 'any' = 'any';
</script>

<label class="panel-field">
  <span>{label}</span>
  <input
    type="number"
    {name}
    {value}
    {min}
    {max}
    {step}
    oninput={(e) => {
      const n = Number(e.currentTarget.value);
      if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
    }}
  />
</label>
