<script lang="ts">
  import MenuItem from './MenuItem.svelte';
  import type { ChromeProps } from './types.ts';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  export let text: ChromeProps['text'];

  interface $$Props extends ChromeProps {}
</script>

<MenuItem disabled={!chrome.canUndo} onSelect={() => controller.undo()}>
  {viewValue(chrome, text.menu('undo'))}
</MenuItem>
<MenuItem disabled={!chrome.canRedo} onSelect={() => controller.redo()}>
  {viewValue(chrome, text.menu('redo'))}
</MenuItem>
<MenuItem onSelect={() => void controller.menuClipboard('cut')}
  >{viewValue(chrome, text.menu('cut'))}</MenuItem
>
<MenuItem onSelect={() => void controller.menuClipboard('copy')}>
  {viewValue(chrome, text.menu('copy'))}
</MenuItem>
<MenuItem onSelect={() => void controller.menuClipboard('paste')}>
  {viewValue(chrome, text.menu('paste'))}
</MenuItem>
<MenuItem onSelect={() => void controller.pastePattern()}>
  <span lang={viewValue(chrome, chrome.lang?.t('Menu/Edit/PastePattern', '') ? undefined : 'en')}>
    {viewValue(
      chrome,
      chrome.lang?.t('Menu/Edit/PastePattern', 'Paste Pattern') ?? 'Paste Pattern',
    )}
  </span>
</MenuItem>
<MenuItem onSelect={() => controller.deleteSelected()}
  >{viewValue(chrome, text.menu('delete'))}</MenuItem
>
<MenuItem onSelect={() => controller.selectAll()}
  >{viewValue(chrome, text.menu('selectAll'))}</MenuItem
>
