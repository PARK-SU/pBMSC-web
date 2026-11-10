<script lang="ts">
  import { webText } from '../../i18n/web.ts';
  import ZoomBox from './ZoomBox.svelte';
  import type { ChromeProps } from './types.ts';
  import { viewValue } from '../viewer/state.ts';

  export let controller: Omit<ChromeProps, 'text'>['controller'];

  export let chrome: Omit<ChromeProps, 'text'>['chrome'];
  export let slider = false;

  interface $$Props extends Omit<ChromeProps, 'text'> {
    slider?: boolean;
  }
</script>

<ZoomBox
  name="gxHeight"
  {slider}
  label={viewValue(chrome, webText(chrome.langFile, 'verticalZoom', {}, chrome))}
  glyph={'\u{2195}'}
  value={chrome.gxHeight}
  onChange={(zoom) => controller.setGxHeight(zoom)}
/>
<ZoomBox
  name="gxWidth"
  {slider}
  label={viewValue(chrome, webText(chrome.langFile, 'horizontalZoom', {}, chrome))}
  glyph={'\u{2194}'}
  value={chrome.gxWidth}
  onChange={(zoom) => controller.setGxWidth(zoom)}
/>
