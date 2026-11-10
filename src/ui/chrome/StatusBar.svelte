<script lang="ts">
  import type { StatusColor } from '../../editor/status.ts';
  import type { ViewerController } from '../viewer/controller.ts';
  import type { UiText } from '../viewer/text.ts';
  import Item from './Item.svelte';
  import { readable } from 'svelte/store';
  import type { ViewerChrome } from '../viewer/controller.ts';
  import TimeSelectionBar from './TimeSelectionBar.svelte';

  const statusColors: Readonly<Record<StatusColor, string>> = {
    olive: '#808000',
    blue: '#0000ff',
    red: '#ff0000',
    green: '#008000',
  };

  export let controller: ViewerController;

  export let text: UiText;
  export let chrome: ViewerChrome;

  const statusStore = readable(controller.getStatus(), (set) =>
    controller.subscribeStatus(() => set(controller.getStatus())),
  );

  $: status = $statusStore;
</script>

{#if status.strip === 'timeSelect'}<TimeSelectionBar {controller} {chrome} />{:else}<div
    class="status-strip"
  >
    <Item name="selectionInfo" title={text.text('selectionInfo')} width={170}>
      {status.selectionInfo}
    </Item>
    <Item name="column" title={text.text('columnCaption')} width={70}>
      {status.column}
    </Item>
    <Item name="noteIndex" title={text.text('noteIndex')} width={40} style={{ color: '#804000' }}>
      {status.noteIndex}
    </Item>
    <Item name="measure" title={text.text('measureIndex')} width={40} style={{ color: 'teal' }}>
      {status.measure}
    </Item>
    <Item
      name="gridResolution"
      title={text.text('gridResolution')}
      width={170}
      style={{ fontWeight: 'bold' }}
    >
      {status.gridResolution}
    </Item>
    <Item
      name="reducedResolution"
      title={text.text('reducedResolution')}
      width={85}
      style={{ fontWeight: 'bold', color: 'maroon' }}
    >
      {status.reducedResolution}
    </Item>
    <Item
      name="measureResolution"
      title={text.text('measureResolution')}
      width={170}
      style={{ fontWeight: 'bold', color: 'green' }}
    >
      {status.measureResolution}
    </Item>
    <Item name="absolutePosition" title={text.text('absolutePosition')} width={115}>
      {status.absolutePosition}
    </Item>
    <Item name="time">{status.time}</Item>
    <Item name="noteKind" style={{ color: statusColors[status.noteKind.color] }}>
      {status.noteKind.text}
    </Item>
    <Item name="error" style={{ color: statusColors.red }}>
      {status.error}
    </Item>
  </div>{/if}
