<script lang="ts">
  import type { ViewerController } from '../viewer/controller.ts';

  export let controller: ViewerController;

  export let panel: 0 | 2;

  export let width: number;

  export let maxWidth: () => number;

  export let label: string;

  let drag: { pointerId: number; startX: number; startWidth: number } | undefined = undefined;
</script>

<div
  class="splitter"
  role="separator"
  aria-orientation="vertical"
  aria-label={label}
  data-splitter={panel}
  onpointerdown={(event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    drag = { pointerId: event.pointerId, startX: event.clientX, startWidth: width };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
  }}
  onpointermove={(event) => {
    const start = drag;
    if (start === undefined || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.startX;
    const next = panel === 0 ? start.startWidth + dx : start.startWidth - dx;
    controller.setSideWidth(panel, Math.min(Math.round(next), Math.max(0, maxWidth())));
  }}
  onpointerup={() => (drag = undefined)}
  onpointercancel={() => (drag = undefined)}
></div>
