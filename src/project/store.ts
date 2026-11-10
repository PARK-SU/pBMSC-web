import { AudioAssets, resolveAudio, type AudioAsset, type AssetSource } from '../audio/assets.ts';
import { readDuration } from '../audio/durationIndex.ts';
import { isAudioFile, pathKey, relativeFile } from './paths.ts';

export interface ProjectFile extends AudioAsset {
  readonly type: string;
  readonly modified: number;
}
export interface Project {
  readonly id: string;
  name: string;
  readonly kind: 'folder' | 'zip' | 'files';
  files: ProjectFile[];
  directory?: FileSystemDirectoryHandle;
  lastChart?: string;
  opened: number;
}
export interface ProjectLink {
  readonly id: string;
  readonly path: string;
}

export class ProjectStore {
  readonly encoded = new AudioAssets();
  private db: Promise<IDBDatabase> | undefined;
  private readonly cache = new Map<string, Project>();
  private database(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const r = indexedDB.open('pbmsc-web:projects', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('projects', { keyPath: 'id' });
      r.onsuccess = () => {
        r.result.onversionchange = () => r.result.close();
        resolve(r.result);
      };
      r.onerror = () => reject(r.error ?? new Error('Project storage unavailable'));
    });
    return this.db;
  }
  private async access(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest,
  ): Promise<unknown> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', mode),
        r = operation(tx.objectStore('projects'));
      let result: unknown,
        failure: DOMException | null = null;
      r.onsuccess = () => {
        result = r.result;
      };
      r.onerror = () => {
        failure = r.error;
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () =>
        reject(failure ?? tx.error ?? new Error('Project storage failed'));
    });
  }
  create(name: string, kind: Project['kind'], directory?: FileSystemDirectoryHandle): Project {
    return {
      id: crypto.randomUUID(),
      name,
      kind,
      files: [],
      opened: Date.now(),
      ...(directory ? { directory } : {}),
    };
  }
  async get(id: string): Promise<Project> {
    let project = this.cache.get(id);
    if (!project) {
      project = (await this.access('readonly', (s) => s.get(id))) as Project | undefined;
      if (!project) throw new Error('Project is no longer stored');
      this.cache.set(id, project);
    }
    return project;
  }
  async list(): Promise<Project[]> {
    const values = (await this.access('readonly', (s) => s.getAll())) as Project[];
    return values.sort((a, b) => b.opened - a.opened);
  }
  async publish(project: Project): Promise<void> {
    this.cache.set(project.id, project);
    await this.access('readwrite', (s) => s.put(project));
  }
  async addFile(
    project: Project,
    name: string,
    blob: Blob,
    modified = Date.now(),
  ): Promise<ProjectFile> {
    const previous = project.files.find((f) => pathKey(f.name) === pathKey(name));
    const key = crypto.randomUUID();
    await this.encoded.writeBlob(key, blob);
    const file: ProjectFile = {
      key,
      name,
      bytes: blob.size,
      type: blob.type,
      modified,
      duration: undefined,
    };
    project.files = [...project.files.filter((f) => f !== previous), file];
    if (previous) await this.encoded.deleteBlob(previous.key);
    return file;
  }
  async saveFile(project: Project, name: string, blob: Blob): Promise<void> {
    await this.addFile(project, name, blob);
    project.opened = Date.now();
    await this.publish(project);
  }
  find(project: Project, name: string): ProjectFile | undefined {
    const key = pathKey(name);
    return project.files.find((f) => pathKey(f.name) === key);
  }
  source(project: Project, chart: string): AssetSource {
    const resolved = new Map<string, AudioAsset | undefined>();
    return {
      resolve: (name) => {
        if (!resolved.has(name)) {
          let path = name;
          try {
            path = relativeFile(chart, name);
          } catch {
            return undefined;
          }
          resolved.set(name, resolveAudio(project.files, path));
        }
        return resolved.get(name);
      },
      read: (asset) => this.encoded.readBlob(asset.key),
    };
  }
  async indexDurations(project: Project, changed: () => void = () => {}): Promise<void> {
    for (const file of project.files) {
      if (!isAudioFile(file.name) || file.duration !== undefined) continue;
      const duration = await readDuration(await this.encoded.readBlob(file.key));
      if (project.files.includes(file)) file.duration = duration;
    }
    await this.publish(project);
    changed();
  }
  async discard(project: Project): Promise<void> {
    await this.access('readwrite', (s) => s.delete(project.id));
    this.cache.delete(project.id);
    for (const file of project.files) await this.encoded.deleteBlob(file.key);
  }
}
