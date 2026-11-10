<script lang="ts">
  import { textEncodingNames, type TextEncodingName } from '../../core/text/encoding.ts';
  import type { ChromeProps } from './types.ts';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  export let text: ChromeProps['text'];

  interface $$Props extends ChromeProps {}
</script>

<label class="field">
  <span>{viewValue(chrome, text.label('textEncoding'))}</span>
  <select
    name="encoding"
    value={chrome.encoding}
    onchange={(event) => controller.setEncoding(event.currentTarget.value as TextEncodingName)}
  >
    {#each textEncodingNames as name (name)}<option value={name}>
        {name === 'SJIS' ? 'Shift-JIS' : name === 'System Ansi' ? 'System ANSI (CP949)' : name}
      </option>{/each}
  </select>
</label>
