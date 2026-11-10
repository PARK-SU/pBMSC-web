<script lang="ts">
  import type { EditTool } from '../../editor/edit-state.ts';
  import type { ChromeProps } from './types.ts';
  import { keepFocus } from '../input/focus.ts';
  import type { EditorKey } from '../viewer/text.ts';
  import { viewValue } from '../viewer/state.ts';
  import Icon from './Icon.svelte';

  const tools: readonly {
    tool: EditTool;
    icon: string;
    tip: EditorKey;
    name: string;
  }[] = [
    { tool: 'timeSelect', icon: 'TimeSelection', tip: 'timeSelectTool', name: 'toolTimeSelect' },
    { tool: 'select', icon: 'Select', tip: 'selectTool', name: 'toolSelect' },
    { tool: 'write', icon: 'Write', tip: 'writeTool', name: 'toolWrite' },
  ];

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  export let text: ChromeProps['text'];

  interface $$Props extends ChromeProps {}
</script>

<div class="field tools" role="group">
  {#each tools as { tool, icon, tip, name } (tool)}<button
      type="button"
      {name}
      class="toggle"
      title={viewValue(chrome, text.text(tip))}
      aria-label={viewValue(chrome, text.text(tip))}
      aria-pressed={chrome.tool === tool}
      onmousedown={keepFocus}
      onclick={() => controller.setTool(tool)}
    >
      <Icon name={icon} />
    </button>{/each}
  <button
    type="button"
    name="undo"
    class="toggle"
    title={viewValue(chrome, text.text('undoButton'))}
    aria-label={viewValue(chrome, text.text('undoButton'))}
    disabled={!chrome.canUndo}
    onmousedown={keepFocus}
    onclick={() => controller.undo()}
  >
    <Icon name="Undo" />
  </button>
  <button
    type="button"
    name="redo"
    class="toggle"
    title={viewValue(chrome, text.text('redoButton'))}
    aria-label={viewValue(chrome, text.text('redoButton'))}
    disabled={!chrome.canRedo}
    onmousedown={keepFocus}
    onclick={() => controller.redo()}
  >
    <Icon name="Redo" />
  </button>
</div>
