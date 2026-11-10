<script lang="ts">
  export let label: string;

  export let value: boolean;

  export let onChange: (checked: boolean) => void;

  export let name: string;
</script>

<label class="panel-check">
  <input
    type="checkbox"
    {name}
    checked={value}
    onchange={(e) => onChange(e.currentTarget.checked)}
  />
  {label}
</label>
