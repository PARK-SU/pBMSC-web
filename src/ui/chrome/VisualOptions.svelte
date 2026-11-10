<script lang="ts">
  import type { Column } from '../../core/model/column.ts';
  import type { ThemeFont, VisualSettings } from '../../settings/theme-loader.ts';
  import { sourceLabel } from '../../i18n/source-labels.ts';
  import { webText } from '../../i18n/web.ts';
  import type { ChromeProps } from './types.ts';
  import ColorButton from './ColorButton.svelte';
  import FontButton from './FontButton.svelte';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];
  export let chrome: ChromeProps['chrome'];
  export let onClose: () => void;
  let visual = structuredClone(controller.getVisualSettings());
  let columns = controller.getView().columns.map((column) => ({ ...column }));
  $: label = viewValue(chrome, (key: string) => sourceLabel(chrome, `VisualOptions/${key}`, key));
  type ColorKey =
    | 'columnTitle'
    | 'bg'
    | 'pGrid'
    | 'pSub'
    | 'pVLine'
    | 'pMLine'
    | 'pBGMWav'
    | 'kMouseOver'
    | 'kSelected'
    | 'kMouseOverE'
    | 'selBox'
    | 'peCursor'
    | 'peHalf'
    | 'peMouseOver'
    | 'peSel'
    | 'peBPM';
  type FontKey = 'columnTitleFont' | 'kFont' | 'kMFont' | 'peBPMFont';
  type NumberKey =
    | 'kHeight'
    | 'kLabelVShift'
    | 'kLabelHShift'
    | 'kLabelHShiftL'
    | 'kOpacity'
    | 'peDeltaMouseOver'
    | 'middleDeltaRelease';
  type Row =
    | { kind: 'color'; key: ColorKey; label: string }
    | { kind: 'font'; key: FontKey; label: string }
    | { kind: 'number'; key: NumberKey; label: string; min: number; max: number; step?: number };
  const groups: readonly (readonly Row[])[] = [
    [
      { kind: 'color', key: 'columnTitle', label: 'ColumnCaption' },
      { kind: 'font', key: 'columnTitleFont', label: 'ColumnCaptionFont' },
      { kind: 'color', key: 'bg', label: 'Background' },
      { kind: 'color', key: 'pGrid', label: 'Grid' },
      { kind: 'color', key: 'pSub', label: 'SubGrid' },
      { kind: 'color', key: 'pVLine', label: 'VerticalLine' },
      { kind: 'color', key: 'pMLine', label: 'MeasureBarLine' },
      { kind: 'color', key: 'pBGMWav', label: 'BGMWaveform' },
    ],
    [
      { kind: 'number', key: 'kHeight', label: 'NoteHeight', min: 0, max: 100 },
      { kind: 'font', key: 'kFont', label: 'NoteLabel' },
      { kind: 'font', key: 'kMFont', label: 'MeasureLabel' },
      { kind: 'number', key: 'kLabelVShift', label: 'LabelVerticalShift', min: -100, max: 100 },
      { kind: 'number', key: 'kLabelHShift', label: 'LabelHorizontalShift', min: -100, max: 100 },
      {
        kind: 'number',
        key: 'kLabelHShiftL',
        label: 'LongNoteLabelHorizontalShift',
        min: -100,
        max: 100,
      },
      { kind: 'number', key: 'kOpacity', label: 'HiddenNoteOpacity', min: 0, max: 1, step: 0.01 },
      { kind: 'color', key: 'kMouseOver', label: 'NoteBorderOnMouseOver' },
      { kind: 'color', key: 'kSelected', label: 'NoteBorderOnSelection' },
      { kind: 'color', key: 'kMouseOverE', label: 'NoteBorderOnAdjustingLength' },
    ],
    [
      { kind: 'color', key: 'selBox', label: 'SelectionBoxBorder' },
      { kind: 'color', key: 'peCursor', label: 'TSCursor' },
      { kind: 'color', key: 'peHalf', label: 'TSSplitter' },
      { kind: 'number', key: 'peDeltaMouseOver', label: 'TSCursorSensitivity', min: 0, max: 20 },
      { kind: 'color', key: 'peMouseOver', label: 'TSMouseOverBorder' },
      { kind: 'color', key: 'peSel', label: 'TSFill' },
      { kind: 'color', key: 'peBPM', label: 'TSBPM' },
      { kind: 'font', key: 'peBPMFont', label: 'TSBPMFont' },
      {
        kind: 'number',
        key: 'middleDeltaRelease',
        label: 'MiddleSensitivity',
        min: 0,
        max: 1000000,
      },
    ],
  ];
  const colorRows = [
    ['Note', 'cNote'],
    ['Label', 'cText'],
    ['LongNote', 'cLNote'],
    ['LongNoteLabel', 'cLText'],
    ['Bg', 'cBG'],
  ] as const;
  const change = (value: Partial<VisualSettings>) => (visual = { ...visual, ...value });
  const columnChange = (index: number, value: Partial<Column>) =>
    (columns = columns.map((column, i) => (i === index ? { ...column, ...value } : column)));
  const apply = () => {
    controller.updateOptions({
      visual,
      columns: columns.map((column, index) => ({
        index,
        width: column.width,
        title: column.title,
        noteColor: column.cNote,
        textColor: column.cText,
        longNoteColor: column.cLNote,
        longTextColor: column.cLText,
        bg: column.cBG,
      })),
    });
    onClose();
  };
</script>

<div class="visual-options">
  <div class="visual-groups">
    {#each groups as group, index (index)}
      <div class="visual-group">
        {#each group as row (row.key)}
          <div class="visual-row">
            <span>{label(row.label)}</span>
            {#if row.kind === 'color'}
              <ColorButton
                name={'visual.' + row.key}
                label={label(row.label)}
                {chrome}
                value={visual[row.key]}
                onChange={(value) => change({ [row.key]: value })}
              />
            {:else if row.kind === 'font'}
              <FontButton
                name={'visual.' + row.key}
                label={label(row.label)}
                {chrome}
                value={visual[row.key] as ThemeFont}
                onChange={(value) => change({ [row.key]: value })}
              />
            {:else}
              <input
                name={'visual.' + row.key}
                aria-label={label(row.label)}
                type="number"
                min={row.min}
                max={row.max}
                step={row.step ?? 1}
                value={row.key === 'kOpacity' ? visual[row.key].toFixed(2) : visual[row.key]}
                onchange={(e) =>
                  change({
                    [row.key]: Math.min(row.max, Math.max(row.min, Number(e.currentTarget.value))),
                  })}
              />
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
  <div class="visual-columns">
    <table>
      <tbody>
        <tr
          ><th scope="row">{label('Width')}</th>{#each columns as column, index (index)}<td
              ><input
                name={'visual.column.' + index + '.width'}
                aria-label={label('Width') + ' ' + column.title}
                type="number"
                min="0"
                max="999"
                value={column.width}
                onchange={(e) =>
                  columnChange(index, {
                    width: Math.min(999, Math.max(0, Number(e.currentTarget.value))),
                  })}
              /></td
            >{/each}</tr
        >
        <tr
          ><th scope="row">{label('Caption')}</th>{#each columns as column, index (index)}<td
              ><input
                name={'visual.column.' + index + '.title'}
                aria-label={label('Caption') + ' ' + index}
                value={column.title}
                oninput={(e) => columnChange(index, { title: e.currentTarget.value })}
              /></td
            >{/each}</tr
        >
        {#each colorRows as [caption, key] (key)}
          <tr
            ><th scope="row">{label(caption)}</th>
            {#each columns as column, index (index)}
              <td
                ><ColorButton
                  name={'visual.column.' + index + '.' + key}
                  label={column.title + ' / ' + label(caption)}
                  {chrome}
                  value={column[key]}
                  vertical
                  background={key === 'cBG'
                    ? column.cBG
                    : key === 'cLNote' || key === 'cLText'
                      ? column.cLNote
                      : column.cNote}
                  foreground={key === 'cBG'
                    ? undefined
                    : key === 'cLNote' || key === 'cLText'
                      ? column.cLText
                      : column.cText}
                  onChange={(value) => columnChange(index, { [key]: value })}
                /></td
              >
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="settings-buttons">
    <button type="button" name="applyVisualOptions" onclick={apply}
      >{webText(chrome.langFile, 'ok', {}, chrome)}</button
    >
    <button type="button" name="cancelVisualOptions" onclick={onClose}
      >{webText(chrome.langFile, 'cancel', {}, chrome)}</button
    >
  </div>
</div>
