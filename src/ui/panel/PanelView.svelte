<script lang="ts">
  import type { PanelIndex } from '../../editor/view.ts';
  import type { ViewerController } from '../viewer/controller.ts';
  import { bindPanel } from './bind-panel.ts';
  import { styleText, type CssStyle } from '../style.ts';
  import { onMount } from 'svelte';

  interface PanelViewProps {
    readonly controller: ViewerController;
    readonly panel: PanelIndex;
    readonly label: string;
    readonly className?: string;
    readonly style?: CssStyle;
  }

  export let controller: PanelViewProps['controller'];

  export let panel: PanelViewProps['panel'];

  export let label: PanelViewProps['label'];

  export let className: PanelViewProps['className'] = undefined;

  export let style: PanelViewProps['style'] = undefined;

  let root: HTMLDivElement | undefined = undefined;

  let area: HTMLDivElement | undefined = undefined;

  let staticCanvas: HTMLCanvasElement | undefined = undefined;

  let dynamicCanvas: HTMLCanvasElement | undefined = undefined;

  let vScrollBar: HTMLDivElement | undefined = undefined;

  let vSpacer: HTMLDivElement | undefined = undefined;

  let vThumb: HTMLDivElement | undefined = undefined;

  let hScrollBar: HTMLDivElement | undefined = undefined;

  let hSpacer: HTMLDivElement | undefined = undefined;

  let hThumb: HTMLDivElement | undefined = undefined;

  onMount(() => {
    if (
      !root ||
      !area ||
      !staticCanvas ||
      !dynamicCanvas ||
      !vScrollBar ||
      !vSpacer ||
      !vThumb ||
      !hScrollBar ||
      !hSpacer ||
      !hThumb
    ) {
      return;
    }
    area.tabIndex = 0;
    return bindPanel(controller, panel, {
      root: root,
      area: area,
      staticCanvas: staticCanvas,
      dynamicCanvas: dynamicCanvas,
      vScrollBar: vScrollBar,
      vSpacer: vSpacer,
      vThumb: vThumb,
      hScrollBar: hScrollBar,
      hSpacer: hSpacer,
      hThumb: hThumb,
    });
  });
</script>

<div
  bind:this={root}
  class={className === undefined ? 'panel' : `panel ${className}`}
  style={styleText(style)}
  data-panel={panel}
>
  <div class="panel-main">
    <div bind:this={area} class="panel-area" role="region" aria-label={label}>
      <canvas bind:this={staticCanvas} class="panel-static"></canvas>
      <canvas bind:this={dynamicCanvas} class="panel-dynamic"></canvas>
    </div>
    <div class="scroll-rail">
      <div bind:this={vScrollBar} class="panel-vscroll" tabindex="-1">
        <div bind:this={vSpacer}></div>
      </div>
      <div bind:this={vThumb} class="scroll-thumb" hidden></div>
    </div>
  </div>
  <div class="scroll-rail">
    <div bind:this={hScrollBar} class="panel-hscroll" tabindex="-1">
      <div bind:this={hSpacer}></div>
    </div>
    <div bind:this={hThumb} class="scroll-thumb" hidden></div>
  </div>
</div>
