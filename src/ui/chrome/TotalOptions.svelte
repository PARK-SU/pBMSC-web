<script lang="ts">
  import { recommendedTotal, type TotalOptions } from '../../core/edit/stats.ts';
  import { mathRoundDigits, toDotNetString } from '../../core/vb.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import { webText } from '../../i18n/web.ts';
  import type { ChromeProps } from './types.ts';
  import NumberBox from './NumberBox.svelte';
  import Toggle from './Toggle.svelte';
  import { viewValue } from '../viewer/state.ts';
  export let controller: ChromeProps['controller'];
  export let chrome: ChromeProps['chrome'];
  let draft: TotalOptions = { ...controller.getPreferences().total };
  let applied = controller.getPreferences().total;
  $: current = viewValue(chrome, controller.getPreferences().total);
  $: if (current !== applied) {
    applied = current;
    draft = { ...current };
  }
  $: label = viewValue(chrome, (key: string, fallback = key) =>
    sourceLabel(chrome, `TOTALTool/${key}`, fallback),
  );
  $: count = viewValue(chrome, controller.getPlayableCount());
  $: previews = [0, 1, 2].map((totalOption) =>
    toDotNetString(
      mathRoundDigits(recommendedTotal(count, { ...draft, totalOption }), draft.totalDecimal),
    ),
  );
  const change = (value: Partial<TotalOptions>) => (draft = { ...draft, ...value });
</script>

<div class="total-options">
  <div class="total-table-scroll">
    <table>
      <thead
        ><tr
          >{#each ['CalculationOption', 'Parameters', 'TOTAL', 'CalculationFormula'] as key}<th
              scope="col">{label(key)}</th
            >{/each}</tr
        ></thead
      >
      <tbody>
        {#each [0, 1, 2] as option (option)}
          <tr>
            <td
              ><label
                ><input
                  name="total.formula"
                  type="radio"
                  value={option}
                  checked={draft.totalOption === option}
                  onchange={() => change({ totalOption: option })}
                />{label(
                  option === 0
                    ? 'IIDXTOTALSupposition1'
                    : option === 1
                      ? 'IIDXTOTALSupposition2'
                      : 'Multiplier',
                )}</label
              ></td
            >
            <td
              >{#if option === 2}<input
                  name="total.multiplier"
                  aria-label={label('Multiplier')}
                  type="number"
                  min="0"
                  max="100"
                  step="0.001"
                  value={draft.totalMultiplier.toFixed(3)}
                  onchange={(e) =>
                    change({
                      totalMultiplier: Math.min(100, Math.max(0, Number(e.currentTarget.value))),
                    })}
                />{/if}</td
            >
            <td><output name={'total.preview.' + option}>{previews[option]}</output></td>
            <td
              >{#if option === 0}7.605 * {label('Notes')} / (0.01 * {label('Notes')} + 6.5){:else if option === 1}<div
                >
                  {label('Notes')} &lt; 400 ? 200 + {label('Notes')} / 5 :
                </div>
                <div>{label('Notes')} &lt; 600 ? 280 + ({label('Notes')} - 400) / 2.5 :</div>
                <div>
                  {label('Notes')} &gt; 600 ? 360 + ({label('Notes')} - 600) / 5
                </div>{:else}{label('Notes')} * {label('Multiplier')}{/if}</td
            >
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="total-controls">
    <div>
      <label class="panel-field">
        <span>{label('GlobalMultiplier')}</span>
        <input
          name="total.global"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={draft.totalGlobalMultiplier.toFixed(2)}
          onchange={(e) =>
            change({
              totalGlobalMultiplier: Math.min(100, Math.max(0, Number(e.currentTarget.value))),
            })}
        />
      </label>
      <NumberBox
        name="total.decimals"
        label={label('DecimalPlaces')}
        value={draft.totalDecimal}
        min={0}
        max={10}
        step={1}
        onChange={(totalDecimal) => change({ totalDecimal: Math.round(totalDecimal) })}
      />
    </div>
    <div>
      <Toggle
        name="total.display"
        label={label('DisplayRecommendedTOTAL').replace(
          '{}',
          sourceLabel(chrome, 'ToolBar/RecommendedTOTAL', 'Recommended #TOTAL'),
        )}
        value={draft.totalDisplayValue}
        onChange={(totalDisplayValue) => change({ totalDisplayValue })}
      />
      <Toggle
        name="total.autofill"
        label={label('AutofillTOTAL')}
        value={draft.totalAutofill}
        onChange={(totalAutofill) => change({ totalAutofill })}
      />
    </div>
  </div>
  <div class="settings-buttons">
    <button
      type="button"
      name="applyTotalOptions"
      onclick={() => controller.updateOptions({ total: { ...draft } })}
      >{webText(chrome.langFile, 'ok', {}, chrome)}</button
    >
    <button
      type="button"
      name="cancelTotalOptions"
      onclick={() => (draft = { ...controller.getPreferences().total })}
      >{webText(chrome.langFile, 'cancel', {}, chrome)}</button
    >
  </div>
</div>
