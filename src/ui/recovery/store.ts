import type { RecoverySnapshot } from '../viewer/controller.ts';

const database = 'pbmsc-web:recovery';

async function access(mode: IDBTransactionMode, value?: RecoverySnapshot | null): Promise<unknown> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('session');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Recovery database could not open'));
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('session', mode);
      const store = tx.objectStore('session');
      const request =
        mode === 'readonly'
          ? store.get('open-tabs')
          : value === null
            ? store.delete('open-tabs')
            : store.put(value, 'open-tabs');
      let result: unknown;
      request.onsuccess = () => {
        result = request.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? new Error('Recovery transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('Recovery transaction aborted'));
    });
  } finally {
    db.close();
  }
}

export async function readRecovery(): Promise<RecoverySnapshot | undefined> {
  const value = (await access('readonly')) as RecoverySnapshot | undefined;
  if (value === undefined) return undefined;
  if (
    value.version !== 1 ||
    !Array.isArray(value.tabs) ||
    value.tabs.length === 0 ||
    value.tabs.some((t) => !t.doc?.chart?.notes || !t.doc.undo?.sUndo)
  )
    return undefined;
  return value;
}

export async function writeRecovery(value: RecoverySnapshot | null): Promise<void> {
  await access('readwrite', value);
}
