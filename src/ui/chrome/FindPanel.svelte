<script lang="ts">
  import { c10toId, maxId } from '../../core/bms/base.ts';
  import type { FindQuery } from '../../core/edit/find.ts';
  import { niA1, niA8, niD1, niD8, niB } from '../../core/model/constants.ts';
  import { clng } from '../../core/vb.ts';
  import { lastDisplayedColumn } from '../../editor/view.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import { webText } from '../../i18n/web.ts';
  import type { ChromeProps } from './types.ts';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];
  export let chrome: ChromeProps['chrome'];
  export let onClose: () => void;

  const label = (key: string, fallback: string) => sourceLabel(chrome, `Find/${key}`, fallback);
  let form: HTMLFormElement;
  let ranges = new Array<boolean>(10).fill(true);
  let measureFrom = '0';
  let measureTo = '999';
  let from = '01';
  let to = c10toId(maxId(chrome.base62), chrome.base62);
  let valueFrom = '0.0001';
  let valueTo = '65535.9999';
  let replacement = '01';
  let replaceValue = '120.0000';
  let columns: number[] | undefined;

  $: view = viewValue(chrome, controller.getView());
  $: bgmColumns = Array.from({ length: lastDisplayedColumn(view) - niB + 1 }, (_, i) => niB + i);
  $: rows = [
    [2, 3, 1],
    Array.from({ length: 8 }, (_, i) => niA1 + i),
    Array.from({ length: 8 }, (_, i) => niD1 + i),
    [23, 24, 25],
    ...Array.from({ length: Math.ceil(bgmColumns.length / 8) }, (_, i) =>
      bgmColumns.slice(i * 8, i * 8 + 8),
    ),
  ];
  $: allColumns = rows.flat().map((column) => column - 1);
  $: selectedColumns = columns ?? allColumns;

  const columnTitle = (column: number) => {
    if (column >= niB) return 'B' + (column - niB + 1);
    if (column >= niA1 && column <= niA8) return 'A' + (column - niA1 + 1);
    if (column >= niD1 && column <= niD8) return 'D' + (column - niD1 + 1);
    return (
      { 1: 'SCROLL', 2: 'BPM', 3: 'STOP', 23: 'BGA', 24: 'LAYER', 25: 'POOR' } as Record<
        number,
        string
      >
    )[column]!;
  };
  const toggleColumn = (column: number) => {
    const index = column - 1;
    columns = selectedColumns.includes(index)
      ? selectedColumns.filter((value) => value !== index)
      : [...selectedColumns, index];
  };
  const toggleGroup = (first: number, last: number) => {
    const group = allColumns.filter((column) => column + 1 >= first && column + 1 <= last);
    const checked = group.some((column) => !selectedColumns.includes(column));
    columns = [
      ...selectedColumns.filter((column) => !group.includes(column)),
      ...(checked ? group : []),
    ];
  };
  const query = (): FindQuery => ({
    range: ranges,
    measureFrom: Number(measureFrom),
    measureTo: Number(measureTo),
    labelFrom: from,
    labelTo: to,
    valueFrom: clng(Number(valueFrom) * 10000),
    valueTo: clng(Number(valueTo) * 10000),
    columns: selectedColumns,
  });
  const find = (operation: 'select' | 'unselect' | 'previous' | 'next') => {
    if (form.reportValidity()) controller.panelAction({ kind: 'find', query: query(), operation });
  };
  const replace = (operation: 'delete' | 'label' | 'value') => {
    if (!form.reportValidity()) return;
    controller.featureAction({
      kind: 'find',
      query: query(),
      operation,
      replacement: operation === 'value' ? clng(Number(replaceValue) * 10000) : replacement,
    });
  };
</script>

<form class="find-panel" bind:this={form} onsubmit={(e) => e.preventDefault()}>
  <div class="find-ranges">
    <span>{viewValue(chrome, label('NoteRange', 'Target notes'))}</span>
    <div class="find-note-ranges">
      {#each [['Selected', 'Selected'], ['UnSelected', 'Unselected'], ['ShortNote', 'Short'], ['LongNote', 'Long'], ['Hidden', 'Hidden'], ['Visible', 'Visible'], ['NoError', 'No Error'], ['Error', 'Error'], ['NotComment', 'Not Comment'], ['Comment', 'Comment']] as const as [key, fallback], index (key)}
        <button
          type="button"
          name={'find.range.' + index}
          aria-pressed={ranges[index]}
          onclick={() => (ranges = ranges.map((value, i) => (i === index ? !value : value)))}
          >{viewValue(chrome, label(key, fallback))}</button
        >
      {/each}
    </div>
    <label for="find-measure-from"
      >{viewValue(chrome, label('MeasureRange', 'Measure range'))}</label
    >
    <div class="find-range-inputs">
      <input
        id="find-measure-from"
        name="find.measureFrom"
        aria-label={viewValue(chrome, label('MeasureRange', 'Measure range') + ' / 1')}
        type="number"
        min="0"
        max="999"
        step="1"
        required
        value={measureFrom}
        oninput={(e) => (measureFrom = e.currentTarget.value)}
      />
      <span>{viewValue(chrome, label('to', '~'))}</span>
      <input
        name="find.measureTo"
        aria-label={viewValue(chrome, label('MeasureRange', 'Measure range') + ' / 2')}
        type="number"
        min="0"
        max="999"
        step="1"
        required
        value={measureTo}
        oninput={(e) => (measureTo = e.currentTarget.value)}
      />
    </div>
    <label for="find-label-from">{viewValue(chrome, label('LabelRange', 'Label range'))}</label>
    <div class="find-range-inputs">
      <input
        id="find-label-from"
        name="find.labelFrom"
        aria-label={viewValue(chrome, label('LabelRange', 'Label range') + ' / 1')}
        maxLength={2}
        required
        value={from}
        oninput={(e) => (from = e.currentTarget.value)}
      />
      <span>{viewValue(chrome, label('to', '~'))}</span>
      <input
        name="find.labelTo"
        aria-label={viewValue(chrome, label('LabelRange', 'Label range') + ' / 2')}
        maxLength={2}
        required
        value={to}
        oninput={(e) => (to = e.currentTarget.value)}
      />
    </div>
    <label for="find-value-from">{viewValue(chrome, label('ValueRange', 'Value range'))}</label>
    <div class="find-range-inputs">
      <input
        id="find-value-from"
        name="find.valueFrom"
        aria-label={viewValue(chrome, label('ValueRange', 'Value range') + ' / 1')}
        type="number"
        min="-214748.3648"
        max="214748.3647"
        step="0.0001"
        required
        value={valueFrom}
        oninput={(e) => (valueFrom = e.currentTarget.value)}
      />
      <span>{viewValue(chrome, label('to', '~'))}</span>
      <input
        name="find.valueTo"
        aria-label={viewValue(chrome, label('ValueRange', 'Value range') + ' / 2')}
        type="number"
        min="-214748.3648"
        max="214748.3647"
        step="0.0001"
        required
        value={valueTo}
        oninput={(e) => (valueTo = e.currentTarget.value)}
      />
    </div>
  </div>
  <fieldset class="find-columns">
    <legend>{viewValue(chrome, label('Column', 'Columns'))}</legend>
    <div class="find-column-options">
      <div class="find-column-list">
        {#each rows as row, index (index)}
          <div class="find-column-row">
            {#each row as column (column)}
              <button
                type="button"
                name={'find.column.' + column}
                aria-pressed={selectedColumns.includes(column - 1)}
                onclick={() => toggleColumn(column)}>{columnTitle(column)}</button
              >
            {/each}
          </div>
        {/each}
      </div>
      <div class="find-column-actions">
        <button type="button" name="find.columns.all" onclick={() => (columns = [...allColumns])}
          >{viewValue(chrome, label('SelectAll', 'Select all'))}</button
        >
        <button
          type="button"
          name="find.columns.invert"
          onclick={() =>
            (columns = allColumns.filter((column) => !selectedColumns.includes(column)))}
          >{viewValue(chrome, label('SelectInverse', 'Invert selection'))}</button
        >
        <button type="button" name="find.columns.none" onclick={() => (columns = [])}
          >{viewValue(chrome, label('UnselectAll', 'Unselect all'))}</button
        >
        <button type="button" name="find.columns.A" onclick={() => toggleGroup(niA1, niA8)}
          >{viewValue(chrome, label('ToggleA', 'Toggle A'))}</button
        >
        <button type="button" name="find.columns.D" onclick={() => toggleGroup(niD1, niD8)}
          >{viewValue(chrome, label('ToggleD', 'Toggle D'))}</button
        >
        <button type="button" name="find.columns.B" onclick={() => toggleGroup(niB, Infinity)}
          >{viewValue(chrome, label('ToggleB', 'Toggle B'))}</button
        >
      </div>
    </div>
  </fieldset>
  <fieldset class="find-operations">
    <legend>{viewValue(chrome, label('Operation', 'Operation'))}</legend>
    <div class="find-operation-options">
      <div class="find-replacements">
        <button type="button" name="find.replaceLabel" onclick={() => replace('label')}
          >{viewValue(chrome, label('ReplaceWithLabel', 'Replace with label:'))}</button
        >
        <input
          name="find.replacement"
          aria-label={viewValue(chrome, label('ReplaceWithLabel', 'Replace with label:'))}
          maxLength={2}
          value={replacement}
          oninput={(e) => (replacement = e.currentTarget.value)}
        />
        <button type="button" name="find.replaceValue" onclick={() => replace('value')}
          >{viewValue(chrome, label('ReplaceWithValue', 'Replace with value:'))}</button
        >
        <input
          name="find.replacementValue"
          aria-label={viewValue(chrome, label('ReplaceWithValue', 'Replace with value:'))}
          type="number"
          min="-214748.3648"
          max="214748.3647"
          step="0.0001"
          required
          value={replaceValue}
          oninput={(e) => (replaceValue = e.currentTarget.value)}
        />
      </div>
      <div class="find-operation-actions">
        <button type="button" name="find.select" onclick={() => find('select')}
          >{viewValue(chrome, label('Select', 'Select'))}</button
        >
        <button type="button" name="find.unselect" onclick={() => find('unselect')}
          >{viewValue(chrome, label('Unselect', 'Unselect'))}</button
        >
        <button type="button" name="find.previous" onclick={() => find('previous')}
          >{viewValue(
            chrome,
            label('Previous', webText(chrome.langFile, 'previous', {}, chrome)),
          )}</button
        >
        <button type="button" name="find.next" onclick={() => find('next')}
          >{viewValue(chrome, label('Next', webText(chrome.langFile, 'next', {}, chrome)))}</button
        >
        <button type="button" name="find.delete" onclick={() => replace('delete')}
          >{viewValue(chrome, label('Delete', 'Delete'))}</button
        >
        <button type="button" name="find.close" onclick={onClose}
          >{viewValue(chrome, label('Close', 'Close'))}</button
        >
      </div>
    </div>
  </fieldset>
</form>
