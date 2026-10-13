// Tiny key-value wrapper over IndexedDB, with an in-memory fallback when storage is blocked.
export interface KvStore {
  volatile: boolean;
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
  clear(): Promise<void>;
}

function memoryStore(): KvStore {
  const m = new Map<string, unknown>();
  return {
    volatile: true,
    get: async <T,>(k: string) => m.get(k) as T | undefined,
    set: async (k, v) => void m.set(k, v),
    delete: async (k) => void m.delete(k),
    keys: async (p) => [...m.keys()].filter((k) => k.startsWith(p)),
    clear: async () => m.clear(),
  };
}

const req = <T,>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

export async function openStore(): Promise<KvStore> {
  try {
    if (typeof indexedDB === 'undefined') return memoryStore();
    const open = indexedDB.open('ieltslab', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    const db = await Promise.race([
      req(open),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('IndexedDB timeout')), 3000)),
    ]);
    const tx = (mode: IDBTransactionMode) => db.transaction('kv', mode).objectStore('kv');
    return {
      volatile: false,
      get: <T,>(k: string) => req(tx('readonly').get(k)) as Promise<T | undefined>,
      set: async (k, v) => void (await req(tx('readwrite').put(v, k))),
      delete: async (k) => void (await req(tx('readwrite').delete(k))),
      keys: async (p) => ((await req(tx('readonly').getAllKeys())) as string[]).filter((k) => String(k).startsWith(p)),
      clear: async () => void (await req(tx('readwrite').clear())),
    };
  } catch {
    return memoryStore();
  }
}
