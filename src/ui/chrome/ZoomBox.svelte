<script lang="ts">
  import {
    zoomIncrement,
    zoomMaximum,
    zoomMinimum,
    zoomTrackBarMaximum,
    zoomTrackBarMinimum,
    zoomTrackBarValue,
  } from '../../editor/view.ts';

  export let name: string;

  export let label: string;

  export let glyph: string;

  export let value: number;

  export let onChange: (value: number) => void;
  export let slider = false;

  let draft: string | undefined = undefined;

  const apply = (text: string): void => {
    draft = undefined;
    const zoom = Number.parseFloat(text);
    if (Number.isFinite(zoom)) onChange(zoom);
  };

  const commit = (): void => {
    if (draft !== undefined) apply(draft);
  };
</script>

<label class="field zoom" title={label}>
  <span aria-hidden="true">{glyph}</span>
  {#if slider}<input
      type="range"
      name={`${name}.slider`}
      aria-label={label}
      min={zoomTrackBarMinimum / 4}
      max={zoomTrackBarMaximum / 4}
      step={0.25}
      value={zoomTrackBarValue(value) / 4}
      oninput={(e) => onChange(Number(e.currentTarget.value))}
    />{/if}
  <input
    {name}
    type="number"
    inputMode="decimal"
    aria-label={label}
    min={zoomMinimum}
    max={zoomMaximum}
    step={zoomIncrement}
    value={draft ?? value.toFixed(2)}
    oninput={(event) => {
      const typed = event.currentTarget.value;
      const { inputType } = event as Partial<InputEvent>;
      if (inputType) draft = typed;
      else apply(typed);
    }}
    onblur={commit}
    onkeydown={(event) => {
      if (event.key === 'Enter') commit();
    }}
  />
</label>
