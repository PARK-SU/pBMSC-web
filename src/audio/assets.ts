import { readDuration } from './durationIndex.ts';

export interface AudioAsset {
  readonly key: string;
  readonly name: string;
  readonly bytes: number;
  duration: number | undefined;
}
export interface AssetSource {
  resolve(name: string): AudioAsset | undefined;
  read(asset: AudioAsset): Promise<Blob>;
}

interface ChunkedBlob {
  readonly kind: 'audio-chunks';
  readonly parts: number;
  readonly type: string;
}

export function audioPath(name: string): string {
  return name.replaceAll('\\', '/').replace(/^\.\//, '').toLowerCase();
}

export function resolveAudio(assets: readonly AudioAsset[], name: string): AudioAsset | undefined {
  const key = audioPath(name);
  const paths = [
    key,
    ...['wav', 'ogg', 'mp3', 'flac', 'aiff', 'aif'].map((ext) =>
      key.replace(/\.[^/.]*$|$/, `.${ext}`),
    ),
  ];
  for (const path of paths) {
    const exact = assets.find((asset) => audioPath(asset.name) === path);
    if (exact) return exact;
  }
  return undefined;
}

export class AudioAssets {
  private db: Promise<IDBDatabase> | undefined;
  private readonly groups = new Map<number, AudioAsset[]>();
  private blobStorage: boolean | undefined;

  private database(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const r = indexedDB.open('pbmsc-web:audio', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('blobs');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error ?? new Error('Audio storage unavailable'));
    });
    return this.db;
  }

  private async transaction(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest,
  ): Promise<unknown> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', mode);
      const request = operation(tx.objectStore('blobs'));
      let result: unknown;
      let failure: DOMException | null = null;
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => {
        failure = request.error;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(failure ?? tx.error ?? new Error('Audio storage failed'));
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Audio storage aborted'));
    });
  }

  async writeBlob(key: string, blob: Blob): Promise<void> {
    if (this.blobStorage !== false) {
      try {
        await this.transaction('readwrite', (store) => store.put(blob, key));
        this.blobStorage = true;
        return;
      } catch (error) {
        if (
          !(error instanceof DOMException) ||
          !['UnknownError', 'DataCloneError'].includes(error.name)
        )
          throw error;
        this.blobStorage = false;
      }
    }
    let parts = 0;
    try {
      for (let at = 0; at < blob.size; at += 65536) {
        const bytes = await blob.slice(at, at + 65536).arrayBuffer();
        const part = `${key}:${parts}`;
        await this.transaction('readwrite', (store) => store.put(bytes, part));
        parts++;
      }
      const record: ChunkedBlob = { kind: 'audio-chunks', parts, type: blob.type };
      await this.transaction('readwrite', (store) => store.put(record, key));
    } catch (error) {
      for (let i = 0; i < parts; i++)
        await this.transaction('readwrite', (store) => store.delete(`${key}:${i}`)).catch(() => {});
      throw error;
    }
  }

  async readBlob(key: string): Promise<Blob> {
    const value = await this.transaction('readonly', (store) => store.get(key));
    if (value instanceof Blob) return value;
    const record = value as ChunkedBlob | undefined;
    if (record?.kind !== 'audio-chunks') throw new Error('Missing encoded audio data');
    const parts: Blob[] = [];
    for (let i = 0; i < record.parts; i++) {
      const bytes = await this.transaction('readonly', (store) => store.get(`${key}:${i}`));
      if (!(bytes instanceof ArrayBuffer)) throw new Error('Missing encoded audio chunk');
      parts.push(new Blob([bytes]));
    }
    return new Blob(parts, { type: record.type });
  }

  async deleteBlob(key: string): Promise<void> {
    const record = (await this.transaction('readonly', (store) => store.get(key))) as
      ChunkedBlob | undefined;
    if (record?.kind === 'audio-chunks') {
      for (let i = 0; i < record.parts; i++)
        await this.transaction('readwrite', (store) => store.delete(`${key}:${i}`));
    }
    await this.transaction('readwrite', (store) => store.delete(key));
  }

  async importFiles(tab: number, files: readonly File[]): Promise<readonly AudioAsset[]> {
    const current = [...(this.groups.get(tab) ?? [])];
    for (const file of files) {
      const relative = file.webkitRelativePath;
      const name = relative ? relative.slice(relative.indexOf('/') + 1) : file.name;
      const key = crypto.randomUUID();
      const duration = await readDuration(file);
      await this.writeBlob(key, file);
      const asset: AudioAsset = { key, name, bytes: file.size, duration };
      const old = current.findIndex((a) => audioPath(a.name) === audioPath(name));
      if (old !== -1) {
        const previous = current[old]!;
        current.splice(old, 1);
        await this.deleteBlob(previous.key);
      }
      current.push(asset);
      this.groups.set(tab, [...current]);
    }
    return current;
  }

  source(tab: number): AssetSource {
    const assets = [...(this.groups.get(tab) ?? [])];
    const resolved = new Map<string, AudioAsset | undefined>();
    return {
      resolve: (name) => {
        if (!resolved.has(name)) resolved.set(name, resolveAudio(assets, name));
        return resolved.get(name);
      },
      read: (asset) => this.readBlob(asset.key),
    };
  }

  count(tab: number): number {
    return this.groups.get(tab)?.length ?? 0;
  }

  async discard(tab: number): Promise<void> {
    const assets = this.groups.get(tab) ?? [];
    this.groups.delete(tab);
    for (const asset of assets) await this.deleteBlob(asset.key);
  }
}
