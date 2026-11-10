<script lang="ts">
  export let name: string;

  export let label: string;

  export let value: number | string;

  export let min: number;

  export let max: number;

  export let step: number | 'any' = 'any';

  export let onValue: (value: string) => void;

  let draft: string | undefined = undefined;

  const apply = () => {
    if (draft !== undefined) {
      const n = Number(draft);
      if (draft.trim() && Number.isFinite(n))
        onValue(n < min ? String(min) : n > max ? String(max) : draft);
      draft = undefined;
    }
  };
</script>

<label class="panel-field">
  <span>{label}</span>
  <input
    {name}
    type="number"
    {min}
    {max}
    {step}
    value={draft ?? value}
    oninput={(e) => (draft = e.currentTarget.value)}
    onblur={apply}
    onkeydown={(e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        apply();
      }
    }}
  />
</label>
