<script lang="ts">
  import { webText } from '../../i18n/web.ts';
  import type { ChromeProps } from './types.ts';
  import SaveDialog from './SaveDialog.svelte';
  import CloseDialog from './CloseDialog.svelte';
  import PromptDialog from './PromptDialog.svelte';
  import MessageDialog from './MessageDialog.svelte';
  import ProjectChartDialog from './ProjectChartDialog.svelte';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  export let text: ChromeProps['text'];

  interface $$Props extends ChromeProps {}
</script>

{#if chrome.projectSelection}
  <ProjectChartDialog {controller} {chrome} />
{:else if chrome.saveDialog}
  <SaveDialog {controller} {chrome} {text} />
{:else if chrome.closingTab !== undefined}
  <CloseDialog {controller} {chrome} {text} />
{:else if chrome.saving}
  <div class="save-progress" role="status">
    {viewValue(chrome, webText(chrome.langFile, 'saving', {}, chrome))}
  </div>
{:else if chrome.prompt !== undefined}
  <PromptDialog
    request={chrome.prompt}
    langFile={chrome.langFile}
    {text}
    onAnswer={(answer) => controller.answerPrompt(answer)}
  />
{:else if chrome.message !== undefined}
  <MessageDialog
    message={chrome.message}
    {text}
    langFile={chrome.langFile}
    onClose={() => controller.dismissMessage()}
  />
{/if}
