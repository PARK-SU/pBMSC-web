import { writeZip, type ArchiveEntry, type ByteWriter } from './archive.ts';
import { projectPath } from './paths.ts';
import { type Project, ProjectStore } from './store.ts';

export interface WritableFile extends ByteWriter {
  close(): Promise<void>;
  abort(): Promise<void>;
}
export interface SaveHandle {
  createWritable(): Promise<WritableFile>;
}
export type PickerWindow = Window & {
  showDirectoryPicker?: (options: {
    mode: 'readwrite';
    startIn?: FileSystemHandle;
  }) => Promise<FileSystemDirectoryHandle>;
  showOpenFilePicker?: (options: {
    multiple: boolean;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<SaveHandle>;
};

export async function writeDirectoryFile(
  directory: FileSystemDirectoryHandle,
  path: string,
  blob: Blob,
): Promise<boolean> {
  type PermissionDirectory = FileSystemDirectoryHandle & {
    queryPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
  };
  const handle = directory as PermissionDirectory;
  if (
    handle.queryPermission &&
    (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted'
  ) {
    if (
      !handle.requestPermission ||
      (await handle.requestPermission({ mode: 'readwrite' })) !== 'granted'
    )
      return false;
  }
  const parts = projectPath(path).split('/');
  let parent = directory;
  for (const part of parts.slice(0, -1))
    parent = await parent.getDirectoryHandle(part, { create: true });
  const file = await parent.getFileHandle(parts.at(-1)!, { create: true });
  const writer = await file.createWritable();
  try {
    await writer.write(blob);
    await writer.close();
  } catch (error) {
    await writer.abort().catch(() => {});
    throw error;
  }
  return true;
}

export async function projectArchive(
  store: ProjectStore,
  project: Project,
  writer?: ByteWriter,
  signal?: AbortSignal,
  overrides: ReadonlyMap<string, Blob> = new Map(),
): Promise<Blob | undefined> {
  const keys: string[] = [];
  let parts: Blob[] = [],
    size = 0;
  const flush = async () => {
    if (!size) return;
    const key = crypto.randomUUID();
    await store.encoded.writeBlob(key, new Blob(parts));
    keys.push(key);
    parts = [];
    size = 0;
  };
  const sink: ByteWriter = writer ?? {
    write: async (bytes) => {
      parts.push(new Blob([Uint8Array.from(bytes)]));
      size += bytes.length;
      if (size >= 1024 ** 2) await flush();
    },
  };
  const entries = async function* (): AsyncGenerator<ArchiveEntry> {
    for (const file of project.files)
      yield {
        path: file.name,
        blob: overrides.get(file.name.toLowerCase()) ?? (await store.encoded.readBlob(file.key)),
      };
  };
  try {
    await writeZip(entries(), sink, signal);
    if (writer) return undefined;
    await flush();
    const blobs: Blob[] = [];
    for (const key of keys) blobs.push(await store.encoded.readBlob(key));
    return new Blob(blobs, { type: 'application/zip' });
  } finally {
    for (const key of keys) await store.encoded.deleteBlob(key);
  }
}
