<script lang="ts">
  import { onDestroy } from 'svelte';
  import { c10toId } from '../../core/bms/base.ts';
  import { webText, type WebKey } from '../../i18n/web.ts';
  import type { KeyModifiers } from '../../editor/input/modifiers.ts';
  import type { ChromeProps } from './types.ts';
  import ToolButtons from './ToolButtons.svelte';
  import AudioControls from './AudioControls.svelte';
  import ZoomBoxes from './ZoomBoxes.svelte';
  import NumberField from './NumberField.svelte';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];
  export let chrome: ChromeProps['chrome'];
  export let text: ChromeProps['text'];

  $: props = { controller, chrome, text };

  let gridMenu: HTMLDetailsElement | undefined;
  let divideInput: HTMLInputElement | undefined;
  let divide = '';
  const t = (key: Parameters<typeof webText>[1]) => webText(chrome.langFile, key, {}, chrome);
  $: view = viewValue(chrome, controller.getView());

  type TouchOption = readonly [label: WebKey, hint: WebKey | undefined, modifiers: KeyModifiers];
  const normal = { ctrl: false, shift: false, alt: false };
  const ctrl = { ...normal, ctrl: true };
  const shift = { ...normal, shift: true };
  const ctrlShift = { ...ctrl, shift: true };
  const ctrlAlt = { ...ctrl, alt: true };
  const inputOptions: readonly TouchOption[] = [
    ['touchNormalInput', undefined, normal],
    ['touchHiddenInput', 'touchHiddenHint', ctrl],
    ['touchLandmineInput', 'touchLandmineHint', ctrlShift],
    ['touchLongInput', 'touchLongHint', shift],
  ];
  const selectOptions: readonly TouchOption[] = [
    ['touchMoveSelect', undefined, normal],
    ['touchAddCopy', 'touchAddCopyHint', ctrl],
    ['touchResize', 'touchResizeHint', shift],
    ['touchSameVisible', 'touchSameVisibleHint', ctrlShift],
    ['touchSameAll', 'touchSameAllHint', ctrlAlt],
  ];
  const timeOptions: readonly TouchOption[] = [
    ['touchTimeRange', undefined, normal],
    ['touchRangeEnd', 'touchRangeEndHint', shift],
  ];
  $: actions =
    chrome.tool === 'write'
      ? inputOptions.filter(([label]) => label !== 'touchLongInput' || !chrome.ntInput)
      : chrome.tool === 'select'
        ? selectOptions.filter(([label]) => label !== 'touchResize' || chrome.ntInput)
        : timeOptions;
  $: currentAction =
    actions.find(
      ([, , modifiers]) =>
        modifiers.ctrl === chrome.sticky.ctrl &&
        modifiers.shift === chrome.sticky.shift &&
        modifiers.alt === chrome.sticky.alt,
    ) ?? actions[0]!;
  onDestroy(() => controller.setTouchModifiers(normal));

  const applyDivision = () => {
    if (!divideInput?.reportValidity()) return;
    controller.panelAction({ kind: 'grid', divide });
  };

  const openWav = () => {
    if (gridMenu) gridMenu.open = false;
    controller.setPanelSection('wav');
    if (!chrome.sidebar) controller.toggleSidebar();
  };
</script>

<footer class="mobile-bar">
  <AudioControls {...props} />
  <div class="mobile-row mobile-tool-row">
    {#if !chrome.sidebar}<ToolButtons {...props} />{/if}
    <button type="button" name="mobilePanels" onclick={() => controller.toggleSidebar()}>
      {viewValue(chrome, t('panels'))}
    </button>
    <button
      type="button"
      name="mobileWav"
      aria-haspopup="dialog"
      aria-expanded={chrome.sidebar && chrome.panelSection === 'wav'}
      aria-label={viewValue(chrome, '#WAV ' + c10toId(chrome.currentWav + 1, chrome.base62))}
      onclick={openWav}
    >
      <span class="mobile-id-kind">WAV</span><strong
        >{viewValue(chrome, c10toId(chrome.currentWav + 1, chrome.base62))}</strong
      >
    </button>
  </div>
  <div class="mobile-row mobile-grid-row">
    <button
      name="gridMinus"
      aria-label={viewValue(chrome, t('Division') + ' −')}
      onclick={() =>
        controller.panelAction({ kind: 'grid', divide: String(Math.max(1, view.gDivide / 2)) })}
      >−</button
    >
    <details
      class="grid-palette"
      bind:this={gridMenu}
      ontoggle={() => {
        if (gridMenu?.open) divide = view.cgDivideValue;
      }}
    >
      <summary title={viewValue(chrome, t('grid'))} aria-label={viewValue(chrome, t('grid'))}>
        <span>{viewValue(chrome, t('grid'))}</span><strong>{view.gDivide}</strong>
      </summary>
      <div class="mobile-grid-options">
        <div class="grid-presets" role="group" aria-label={viewValue(chrome, t('Division'))}>
          {#each [1, 2, 4, 8, 16, 32] as value (value)}
            <button
              type="button"
              name={'gridPreset-' + value}
              aria-pressed={view.gDivide === value}
              onclick={() => {
                divide = String(value);
                controller.panelAction({ kind: 'grid', divide });
              }}>{value}</button
            >
          {/each}
        </div>
        <form
          class="grid-division-input"
          onsubmit={(e) => {
            e.preventDefault();
            applyDivision();
          }}
        >
          <label for="mobile-grid-divide">{viewValue(chrome, t('Division'))}</label>
          <input
            id="mobile-grid-divide"
            name="mobileGridDivide"
            bind:this={divideInput}
            type="number"
            inputMode="numeric"
            min="1"
            max="1920"
            step="1"
            required
            value={divide}
            oninput={(e) => (divide = e.currentTarget.value)}
          />
          <button type="submit" name="applyGridDivide">{viewValue(chrome, t('ok'))}</button>
        </form>
        <NumberField
          name="mobileGridSub"
          label={viewValue(chrome, t('Subdivision'))}
          value={view.cgSubValue}
          min={1}
          max={1920}
          step={1}
          onValue={(sub) => controller.panelAction({ kind: 'grid', sub })}
        />
        <ZoomBoxes {controller} {chrome} slider />
        <label class="panel-check">
          <input
            name="mobileGridSnap"
            type="checkbox"
            checked={view.gSnap}
            onchange={(e) =>
              controller.panelAction({ kind: 'grid', snap: e.currentTarget.checked })}
          />
          {viewValue(chrome, t('Snap to grid'))}
        </label>
        <label class="panel-check">
          <input
            name="mobileVerticalPosition"
            type="checkbox"
            checked={view.disableVerticalMove}
            onchange={(e) =>
              controller.panelAction({ kind: 'grid', disableVertical: e.currentTarget.checked })}
          />
          {viewValue(chrome, t('Disable vertical moves'))}
        </label>
        <label class="panel-check">
          <input
            name="pinchZoom"
            type="checkbox"
            checked={chrome.pinchZoom}
            onchange={(e) => controller.updateOptions({ pinchZoom: e.currentTarget.checked })}
          />
          {viewValue(chrome, t('pinchZoom'))}
        </label>
      </div>
    </details>
    <button
      name="gridPlus"
      aria-label={viewValue(chrome, t('Division') + ' +')}
      onclick={() =>
        controller.panelAction({ kind: 'grid', divide: String(Math.min(1920, view.gDivide * 2)) })}
      >+</button
    >
    <button
      name="mobileSnap"
      title={viewValue(chrome, t('Snap to grid'))}
      aria-label={viewValue(chrome, t('Snap to grid'))}
      aria-pressed={view.gSnap}
      onclick={() => controller.panelAction({ kind: 'grid', snap: !view.gSnap })}
      >{viewValue(chrome, t('snap'))}</button
    >
    <select
      class="mobile-touch-action"
      class:active={currentAction[0] !== actions[0]![0]}
      name="mobileTouchAction"
      aria-label={viewValue(chrome, t('touchAction'))}
      aria-describedby="mobile-touch-hint"
      value={currentAction[0]}
      onchange={(e) => {
        const action = actions.find(([label]) => label === e.currentTarget.value);
        if (action) controller.setTouchModifiers(action[2]);
      }}
    >
      {#each actions as [label] (label)}<option value={label}>{viewValue(chrome, t(label))}</option
        >{/each}
    </select>
  </div>
  <small id="mobile-touch-hint"
    >{viewValue(
      chrome,
      t(currentAction[1] ?? (chrome.pinchZoom ? 'touchHint' : 'touchPanHint')),
    )}</small
  >
</footer>
