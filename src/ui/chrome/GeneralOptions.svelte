<script lang="ts">
  import type { ChromeProps } from './types.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import { viewValue } from '../viewer/state.ts';
  import EncodingSelect from './EncodingSelect.svelte';
  import NumberBox from './NumberBox.svelte';
  import Toggle from './Toggle.svelte';

  export let controller: ChromeProps['controller'];
  export let chrome: ChromeProps['chrome'];
  export let text: ChromeProps['text'];
  const label = (key: string, fallback: string) =>
    sourceLabel(chrome, `GeneralOptions/${key}`, fallback);
  $: p = viewValue(chrome, controller.getPreferences());
  const tool = (key: keyof typeof p.tool, value: boolean | number) =>
    controller.updateOptions({ tool: { ...p.tool, [key]: value } });
</script>

<fieldset class="general-options">
  <legend>{viewValue(chrome, label('Title', 'General options'))}</legend>
  <EncodingSelect {controller} {chrome} {text} />
  <NumberBox
    name="options.saveGrid"
    label={viewValue(chrome, label('MaxGridPartition', 'Maximum grid partition in BMS'))}
    min={1}
    max={19200000}
    step={1}
    value={Math.round(192 / p.writer.bmsGridLimit)}
    onChange={(resolution) =>
      controller.updateOptions({ writer: { ...p.writer, bmsGridLimit: 192 / resolution } })}
  />
  <div class="general-option-row">
    <span>{viewValue(chrome, label('MinimumJackThreshold', 'Minimum jack threshold'))}</span>
    <div class="general-jack">
      <input
        name="options.jackBPM"
        aria-label={viewValue(
          chrome,
          label('MinimumJackThreshold', 'Minimum jack threshold') + ' BPM',
        )}
        type="number"
        min="8"
        max="10000"
        value={p.tool.jackBPM ?? 255}
        onchange={(e) =>
          tool('jackBPM', Math.min(10000, Math.max(8, Number(e.currentTarget.value))))}
      />
      <span>BPM</span>
      <input
        name="options.jackTH"
        aria-label={viewValue(
          chrome,
          label('MinimumJackThreshold', 'Minimum jack threshold') + ' /',
        )}
        type="number"
        min="1"
        max="10000"
        value={p.tool.jackTH ?? 16}
        onchange={(e) =>
          tool('jackTH', Math.min(10000, Math.max(1, Number(e.currentTarget.value))))}
      />
      <span
        >{sourceLabel(
          chrome,
          (p.tool.jackTH ?? 16) === 1
            ? 'st'
            : (p.tool.jackTH ?? 16) === 2
              ? 'nd'
              : (p.tool.jackTH ?? 16) === 3
                ? 'rd'
                : 'th',
          'th',
        )}</span
      >
    </div>
  </div>
  <label class="general-option-row">
    <span>{viewValue(chrome, label('AutoLongNoteGap', 'Auto long note gap'))}</span>
    <div class="general-ln-gap">
      <input
        name="options.lnGap"
        type="number"
        min="0"
        max="100"
        step="0.0001"
        value={p.tool.lnGap ?? 16}
        oninput={(e) => tool('lnGap', Math.min(100, Math.max(0, Number(e.currentTarget.value))))}
      />
      <span
        >{sourceLabel(
          chrome,
          p.tool.lnGap === 1 ? 'Beat' : 'Beats',
          p.tool.lnGap === 1 ? 'beat' : 'beats',
        )}</span
      >
    </div>
  </label>
  <div class="general-option-checks">
    <Toggle
      name="options.bpmIds"
      label={viewValue(
        chrome,
        label(chrome.base62 ? 'ExtendBPM62' : 'ExtendBPM', 'Extend BPM IDs'),
      )}
      value={p.writer.bpmx1296}
      onChange={(bpmx1296) => controller.updateOptions({ writer: { ...p.writer, bpmx1296 } })}
    />
    <Toggle
      name="options.bpm08"
      label={viewValue(chrome, label('BPMChannel08', 'Write all BPM changes to channel 08'))}
      value={p.writer.bpmChannel08}
      onChange={(bpmChannel08) =>
        controller.updateOptions({ writer: { ...p.writer, bpmChannel08 } })}
    />
    <Toggle
      name="options.stopIds"
      label={viewValue(
        chrome,
        label(chrome.base62 ? 'ExtendSTOP62' : 'ExtendSTOP', 'Extend STOP IDs'),
      )}
      value={p.writer.stopx1296}
      onChange={(stopx1296) => controller.updateOptions({ writer: { ...p.writer, stopx1296 } })}
    />
    <Toggle
      name="options.templateSnap"
      label={viewValue(
        chrome,
        label(
          'SnapToVerticalPositionTemplate',
          'Snap to vertical position for moving to template position',
        ),
      )}
      value={p.tool.templateSnapToVPosition ?? false}
      onChange={(n) => tool('templateSnapToVPosition', n)}
    />
    <Toggle
      name="options.patternSnap"
      label={viewValue(
        chrome,
        label('SnapToVerticalPositionPattern', 'Snap to vertical position for pasting patterns'),
      )}
      value={p.tool.pastePatternToVPosition ?? false}
      onChange={(n) => tool('pastePatternToVPosition', n)}
    />
  </div>
  <label class="general-option-row">
    <span>{viewValue(chrome, label('MouseWheel', 'Mouse wheel'))}</span>
    <select
      name="options.wheel"
      value={String(p.wheel)}
      onchange={(e) => controller.updateOptions({ wheel: Number(e.currentTarget.value) })}
    >
      {#if ![192, 96, 64, 48].includes(p.wheel)}<option value={String(p.wheel)}
          >{p.wheel / 192}</option
        >{/if}
      {#each [[192, '1'], [96, '1 / 2'], [64, '1 / 3'], [48, '1 / 4']] as [value, caption]}<option
          value={String(value)}>{caption}</option
        >{/each}
    </select>
  </label>
  <label class="general-option-row">
    <span>{viewValue(chrome, label('PageUpDown', 'PageUp / Down'))}</span>
    <select
      name="options.page"
      value={String(p.page)}
      onchange={(e) => controller.updateOptions({ page: Number(e.currentTarget.value) })}
    >
      {#if ![1536, 1152, 768, 576, 384, 192, 96].includes(p.page)}<option value={String(p.page)}
          >{p.page / 192}</option
        >{/if}
      {#each [[1536, '8'], [1152, '6'], [768, '4'], [576, '3'], [384, '2'], [192, '1'], [96, '1 / 2']] as [value, caption]}<option
          value={String(value)}>{caption}</option
        >{/each}
    </select>
  </label>
  <div class="general-option-row">
    <span>{viewValue(chrome, label('MiddleButton', 'Mouse middle button'))}</span>
    <div class="general-middle">
      {#each [0, 1] as value}<label
          ><input
            name="options.middle"
            type="radio"
            {value}
            checked={p.tool.middleButtonMoveMethod === value}
            onchange={() => tool('middleButtonMoveMethod', value)}
          />{viewValue(
            chrome,
            label(
              value === 0 ? 'MiddleButtonAuto' : 'MiddleButtonDrag',
              value === 0 ? 'Auto scroll' : 'Drag',
            ),
          )}</label
        >{/each}
    </div>
  </div>
  <div class="general-option-checks">
    <Toggle
      name="options.autoFocus"
      label={viewValue(
        chrome,
        label('AutoFocusOnMouseEnter', 'Automatically focus the editing panel on mouse enter'),
      )}
      value={p.tool.autoFocusMouseEnter}
      onChange={(n) => tool('autoFocusMouseEnter', n)}
    />
    <Toggle
      name="options.firstClick"
      label={viewValue(
        chrome,
        label('DisableFirstClick', 'Disable first click if the editing panel is not focused'),
      )}
      value={p.tool.firstClickDisabled}
      onChange={(n) => tool('firstClickDisabled', n)}
    />
    <Toggle
      name="options.clickStop"
      label={viewValue(
        chrome,
        label('StopPreviewOnClick', 'Stop preview if clicked on the editing panel'),
      )}
      value={p.tool.clickStopPreview}
      onChange={(n) => tool('clickStopPreview', n)}
    />
  </div>
</fieldset>
