<script lang="ts">
  import { c10toId, cIdto10, maxId } from '../../core/bms/base.ts';

  export let name: string;

  export let label: string;

  export let index: number;

  export let base62: boolean;

  export let onChange: (index: number) => void;

  let draft: string | undefined = undefined;

  const apply = (typed: string): void => {
    draft = undefined;
    const id = base62 ? typed.trim() : typed.trim().toUpperCase();
    if (!/^[0-9A-Za-z]{1,2}$/.test(id)) return;
    const value = cIdto10(id, base62);
    if (value >= 1 && value <= maxId(base62)) onChange(value - 1);
  };
</script>

<label class="field id">
  <span>{label}</span>
  <input
    {name}
    value={draft ?? (index < 0 ? '' : c10toId(index + 1, base62))}
    maxLength={2}
    spellCheck={false}
    autoComplete="off"
    autoCapitalize="characters"
    oninput={(event) => (draft = event.currentTarget.value)}
    onblur={() => {
      if (draft !== undefined) apply(draft);
    }}
    onkeydown={(event) => {
      if (event.key === 'Enter' && draft !== undefined) apply(draft);
    }}
  />
</label>
