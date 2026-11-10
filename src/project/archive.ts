import { projectPath } from './paths.ts';

export interface ByteWriter {
  write(bytes: Uint8Array): Promise<void>;
}
export interface ArchiveEntry {
  readonly path: string;
  readonly blob: Blob;
}
export function abortCheck(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
}
export async function* byteChunks(
  blob: Blob,
  size = 65536,
): AsyncGenerator<Uint8Array<ArrayBuffer>> {
  for (let at = 0; at < blob.size; at += size)
    yield new Uint8Array(await blob.slice(at, at + size).arrayBuffer());
}

export async function extractZip(
  blob: Blob,
  consume: (entry: ArchiveEntry) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  const tail = new Uint8Array(await blob.slice(Math.max(0, blob.size - 65557)).arrayBuffer());
  const view = new DataView(tail.buffer);
  let footer = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === tail.length
    ) {
      footer = i;
      break;
    }
  }
  if (footer < 0) throw new Error('ZIP end record is missing or truncated');
  if (view.getUint16(footer + 4, true) !== 0 || view.getUint16(footer + 6, true) !== 0)
    throw new Error('Multipart ZIP archives are not supported');
  const { Unzip, UnzipInflate } = await import('fflate');
  const active = new Set<{ terminate(): void }>();
  const seen = new Set<string>();
  let pending: Promise<void>[] = [],
    failure: Error | undefined;
  const unzip = new Unzip((file) => {
    const directory = file.name.endsWith('/');
    const path = projectPath(file.name),
      key = path.toLowerCase();
    if (!directory && seen.has(key)) throw new Error(`Duplicate ZIP path: ${path}`);
    seen.add(key);
    let parts: Blob[] = [];
    active.add(file);
    file.ondata = (error, data, final) => {
      if (error) {
        failure = error;
        return;
      }
      if (!directory && data.length) parts.push(new Blob([Uint8Array.from(data)]));
      if (final) {
        active.delete(file);
        if (!directory) pending.push(consume({ path, blob: new Blob(parts) }));
        parts = [];
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    for await (const bytes of byteChunks(blob, 8192)) {
      abortCheck(signal);
      unzip.push(bytes, false);
      await Promise.all(pending);
      pending = [];
      if (failure) throw failure;
    }
    unzip.push(new Uint8Array(), true);
    await Promise.all(pending);
    if (failure) throw failure;
    if (active.size) throw new Error('ZIP entry is truncated');
    abortCheck(signal);
  } finally {
    for (const file of active) file.terminate();
  }
}

export async function writeZip(
  entries: AsyncIterable<ArchiveEntry> | Iterable<ArchiveEntry>,
  writer: ByteWriter,
  signal?: AbortSignal,
): Promise<void> {
  const { Zip, ZipPassThrough } = await import('fflate');
  let pending: Promise<void>[] = [],
    failure: Error | undefined,
    complete = false;
  const zip = new Zip((error, bytes, final) => {
    if (error) {
      failure = error;
      return;
    }
    pending.push(writer.write(bytes));
    if (final) complete = true;
  });
  try {
    for await (const entry of entries) {
      abortCheck(signal);
      const file = new ZipPassThrough(projectPath(entry.path));
      zip.add(file);
      for await (const chunk of byteChunks(entry.blob)) {
        abortCheck(signal);
        file.push(chunk, false);
        await Promise.all(pending);
        pending = [];
        if (failure) throw failure;
      }
      file.push(new Uint8Array(), true);
      await Promise.all(pending);
      pending = [];
    }
    zip.end();
    await Promise.all(pending);
    if (failure) throw failure;
    if (!complete) throw new Error('ZIP export did not finish');
    abortCheck(signal);
  } finally {
    zip.terminate();
  }
}
