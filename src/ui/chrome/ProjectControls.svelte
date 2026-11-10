<script lang="ts">
  import { webText, type WebKey } from '../../i18n/web.ts';
  import { featureMessage } from '../../i18n/features.ts';
  import type { PickerWindow } from '../../project/export.ts';
  import type { ChromeProps } from './types.ts';
  import PwaControls from '../pwa/PwaControls.svelte';
  import { onMount } from 'svelte';
  import { viewValue } from '../viewer/state.ts';

  export let controller: ChromeProps['controller'];

  export let chrome: ChromeProps['chrome'];

  interface $$Props extends ChromeProps {}

  let details: HTMLDetailsElement | undefined = undefined;

  onMount(() => {
    const outside = (event: PointerEvent) => {
      if (details?.open && !details.contains(event.target as Node)) details.open = false;
    };
    document.addEventListener('pointerdown', outside);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && details) {
        event.preventDefault();
        details.open = false;
      }
    };
    details?.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      details?.removeEventListener('keydown', escape);
    };
  });

  let folder: HTMLInputElement | undefined = undefined;

  let files: HTMLInputElement | undefined = undefined;

  let zip: HTMLInputElement | undefined = undefined;

  const t = (key: WebKey) => webText(chrome.langFile, key, {}, chrome);

  let project = chrome.project;
  $: project = viewValue(chrome, chrome.project);

  const read = (input: HTMLInputElement) => {
    const chosen = Array.from(input.files ?? []);
    input.value = '';
    if (details) details.open = false;
    if (chosen.length) void controller.importProjectSelection(chosen);
  };
</script>

<details class="project-menu" bind:this={details}>
  <summary aria-label={viewValue(chrome, t('project'))}>
    ▣{project.busy ? ' ◌' : project.failed ? ' !' : ''}
  </summary>
  <div class="project-options">
    <div class="panel-buttons">
      <button
        name="openProjectFolder"
        disabled={project.busy}
        onclick={() => {
          if (details) details.open = false;
          if ((window as PickerWindow).showDirectoryPicker) void controller.importDirectory();
          else folder?.click();
        }}
      >
        {viewValue(chrome, t('openFolder'))}
      </button>
      <button name="openProjectZip" disabled={project.busy} onclick={() => zip?.click()}>
        {viewValue(chrome, t('openZip'))}
      </button>
      <button name="openProjectFiles" disabled={project.busy} onclick={() => files?.click()}>
        {viewValue(chrome, t('openProjectFiles'))}
      </button>
      <button
        name="saveProject"
        disabled={project.busy || chrome.saving}
        onclick={() => void controller.saveProject()}
      >
        {viewValue(chrome, t('saveProject'))}
      </button>
      <button name="downloadChart" onclick={() => controller.requestSaveAs()}>
        {viewValue(chrome, t('downloadChart'))}
      </button>
      <button
        name="exportProject"
        disabled={project.busy}
        onclick={() => void controller.exportProject()}
      >
        {viewValue(chrome, t('exportProject'))}
      </button>
      {#if project.busy}<button name="cancelProject" onclick={() => controller.cancelProject()}>
          {viewValue(chrome, t('cancel'))}
        </button>{/if}
    </div>
    {#if project.message}<p role={project.failed ? 'alert' : 'status'}>
        {viewValue(chrome, featureMessage(chrome.langFile, project.message))}
      </p>{/if}
    {#if project.name}<p>{project.name}</p>{/if}
    {#if project.charts.length > 0}<label>
        {viewValue(chrome, t('projectChart'))}
        <select
          name="projectChart"
          value={project.path}
          disabled={project.busy}
          onchange={(e) => void controller.openStoredProject(project.id, e.currentTarget.value)}
        >
          {#each project.charts as path (path)}<option value={path}>
              {path}
            </option>{/each}
        </select>
      </label>{/if}
    <label>
      {viewValue(chrome, t('recentProjects'))}
      <select
        name="recentProject"
        value=""
        disabled={project.busy}
        onchange={(e) => {
          if (e.currentTarget.value) {
            if (details) details.open = false;
            void controller.openStoredProject(e.currentTarget.value);
          }
        }}
      >
        <option value="">—</option>
        {#each project.recent as p (p.id)}<option value={p.id}>
            {p.name}
          </option>{/each}
      </select>
    </label>
    <PwaControls {controller} {chrome} />
    <input
      hidden
      type="file"
      multiple
      bind:this={files}
      data-project-files
      onchange={(e) => read(e.currentTarget)}
    />
    <input
      hidden
      type="file"
      accept=".zip"
      bind:this={zip}
      data-project-zip
      onchange={(e) => read(e.currentTarget)}
    />
    <input
      hidden
      type="file"
      multiple
      data-project-folder
      bind:this={folder}
      webkitdirectory
      onchange={(e) => read(e.currentTarget)}
    />
  </div>
</details>
