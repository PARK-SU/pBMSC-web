import { parseBMS } from '../core/bms/parse.ts';
import { decodeText, type TextEncodingName } from '../core/text/encoding.ts';
import { VbError } from '../core/vb.ts';
import { abortCheck, extractZip, type ArchiveEntry } from './archive.ts';
import { fileName, isAudioFile, isChartFile, pathKey, projectPath, relativeFile } from './paths.ts';
import { ProjectStore, type Project } from './store.ts';

export type ImportProgress = (files: number, bytes: number, path: string) => void;
export type ImportEntries = AsyncIterable<ArchiveEntry> | Iterable<ArchiveEntry>;

async function sameBytes(a: Blob, b: Blob): Promise<boolean> {
  if (a.size !== b.size) return false;
  const [left, right] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const bytes = new Uint8Array(right);
  return new Uint8Array(left).every((value, i) => value === bytes[i]);
}

export async function findStoredChart(
  store: ProjectStore,
  file: File,
  handle?: FileSystemFileHandle,
): Promise<{ project: Project; path: string } | undefined> {
  let match: { project: Project; path: string } | undefined;
  for (const project of await store.list()) {
    const resolved = handle && project.directory ? await project.directory.resolve(handle) : null;
    if (handle ? !resolved : !project.files.some((f) => isAudioFile(f.name))) continue;
    for (const entry of project.files) {
      if (
        fileName(entry.name).toLowerCase() !== file.name.toLowerCase() ||
        (resolved && pathKey(entry.name) !== pathKey(resolved.join('/'))) ||
        entry.bytes !== file.size
      )
        continue;
      let same = false;
      try {
        same = await sameBytes(await store.encoded.readBlob(entry.key), file);
      } catch (error) {
        if (!(error instanceof DOMException)) throw error;
      }
      if (same) {
        if (handle) return { project: await store.get(project.id), path: entry.name };
        if (match) return undefined;
        match = { project: await store.get(project.id), path: entry.name };
      }
    }
  }
  return match;
}

export async function matchingChartPath(
  entries: readonly ArchiveEntry[],
  file: File,
): Promise<string | undefined> {
  let match: string | undefined;
  for (const entry of entries) {
    if (
      fileName(entry.path).toLowerCase() === file.name.toLowerCase() &&
      (await sameBytes(entry.blob, file))
    ) {
      if (match !== undefined) return undefined;
      match = entry.path;
    }
  }
  return match;
}

export function chartFiles(project: Project): string[] {
  const paths = project.files
    .filter((f) => isChartFile(f.name))
    .map((f) => f.name)
    .sort(
      (a, b) =>
        Number(/\.txt$/i.test(a)) - Number(/\.txt$/i.test(b)) || (a < b ? -1 : a > b ? 1 : 0),
    );
  return paths;
}

export async function importProject(
  store: ProjectStore,
  name: string,
  entries: ImportEntries,
  kind: Project['kind'],
  progress: ImportProgress,
  signal?: AbortSignal,
  directory?: FileSystemDirectoryHandle,
): Promise<Project> {
  const project = store.create(name, kind, directory),
    seen = new Set<string>();
  let bytes = 0;
  try {
    for await (const entry of entries) {
      abortCheck(signal);
      const path = projectPath(entry.path),
        key = pathKey(path);
      if (seen.has(key)) throw new Error(`Duplicate project path: ${path}`);
      seen.add(key);
      await store.addFile(project, path, entry.blob);
      bytes += entry.blob.size;
      progress(project.files.length, bytes, path);
    }
    abortCheck(signal);
    if (!chartFiles(project).length) throw new Error('No BMS chart was found in the project');
    await store.publish(project);
    return project;
  } catch (error) {
    await store.discard(project).catch(() => {});
    throw error;
  }
}

export async function importArchive(
  store: ProjectStore,
  file: File,
  progress: ImportProgress,
  signal?: AbortSignal,
): Promise<Project> {
  const project = store.create(file.name.replace(/\.zip$/i, ''), 'zip');
  let bytes = 0;
  try {
    await extractZip(
      file,
      async ({ path, blob }) => {
        abortCheck(signal);
        await store.addFile(project, path, blob);
        bytes += blob.size;
        progress(project.files.length, bytes, path);
      },
      signal,
    );
    if (!chartFiles(project).length) throw new Error('No BMS chart was found in the ZIP');
    await store.publish(project);
    return project;
  } catch (error) {
    await store.discard(project).catch(() => {});
    throw error;
  }
}

export function* selectedFiles(files: readonly File[]): Generator<ArchiveEntry> {
  for (const file of files) {
    const path = file.webkitRelativePath;
    yield { path: path ? path.slice(path.indexOf('/') + 1) : file.name, blob: file };
  }
}
export async function* directoryFiles(
  root: FileSystemDirectoryHandle,
  prefix = '',
): AsyncGenerator<ArchiveEntry> {
  for await (const child of root.values()) {
    const path = prefix + child.name;
    if (child.kind === 'directory') yield* directoryFiles(child, path + '/');
    else yield { path, blob: await child.getFile() };
  }
}

export async function readProjectChart(
  store: ProjectStore,
  project: Project,
  path: string,
  encoding: TextEncodingName,
  ntInput: boolean,
) {
  const file = store.find(project, path);
  if (!file) throw new Error(`Chart not found: ${path}`);
  const bytes = new Uint8Array(await (await store.encoded.readBlob(file.key)).arrayBuffer());
  const wanted = new Set<string>();
  const result = parseBMS(decodeText(bytes, encoding), {
    ntInput,
    host: {
      readTemplate: (name) => {
        wanted.add(name);
        return '';
      },
    },
  });
  if (!result.ok) throw result.error;
  const templates = new Map<string, Uint8Array>();
  for (const name of wanted) {
    const template = store.find(project, relativeFile(path, name));
    if (!template) throw new VbError('IO');
    templates.set(
      name,
      new Uint8Array(await (await store.encoded.readBlob(template.key)).arrayBuffer()),
    );
  }
  return { bytes, templates, name: fileName(path) };
}

async function* legacyFiles(entry: FileSystemEntry, prefix = ''): AsyncGenerator<ArchiveEntry> {
  if (entry.isFile) {
    const blob = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    yield { path: prefix + entry.name, blob };
  } else {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (!batch.length) break;
      for (const child of batch) yield* legacyFiles(child, prefix + entry.name + '/');
    }
  }
}

export function droppedFiles(data: DataTransfer): Promise<{
  name: string;
  entries: ImportEntries;
  directory?: FileSystemDirectoryHandle;
}> {
  type HandleItem = DataTransferItem & {
    getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
  };
  const items = Array.from(data.items).filter((i) => i.kind === 'file') as HandleItem[];
  const handles = items.map((item) => item.getAsFileSystemHandle?.() ?? Promise.resolve(null));
  const legacy = items.map((item) => item.webkitGetAsEntry?.());
  const files = Array.from(data.files);
  return (async () => {
    const roots = (await Promise.all(handles)).filter((h): h is FileSystemHandle => !!h);
    if (roots.length === 1 && roots[0]!.kind === 'directory') {
      const directory = roots[0] as FileSystemDirectoryHandle;
      return { name: directory.name, entries: directoryFiles(directory), directory };
    }
    if (legacy.some((e) => e?.isDirectory)) {
      return {
        name: legacy[0]?.name ?? 'Dropped project',
        entries: (async function* () {
          for (const entry of legacy) if (entry) yield* legacyFiles(entry);
        })(),
      };
    }
    return { name: files[0]?.name ?? 'Dropped project', entries: selectedFiles(files) };
  })();
}
