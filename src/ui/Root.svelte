<script lang="ts">
  import App from './App.svelte';
  import Recovery from './recovery/Recovery.svelte';
  import { webText } from '../i18n/web.ts';
  import type { ViewerController } from './viewer/controller.ts';

  export let controller: ViewerController;
  const t = (key: Parameters<typeof webText>[1]) => webText(controller.getChrome().langFile, key);
</script>

<Recovery {controller} />
<svelte:boundary>
  <App {controller} />
  {#snippet failed()}
    <main class="recovery-error" role="alert">
      <p>{t('renderError')}</p>
      <button onclick={() => controller.saveAs()}>{t('download')}</button>
      <button onclick={() => location.reload()}>{t('reload')}</button>
    </main>
  {/snippet}
</svelte:boundary>
