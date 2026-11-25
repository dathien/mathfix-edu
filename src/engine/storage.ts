/**
 * Local IndexedDB draft storage for offline work (Section 14).
 * Keeps drafts strictly on-device; never sends exam content to any server.
 */

const DB_NAME = 'mathfix_edu_db';
const DB_VERSION = 3;
const STORE_NAME = 'drafts';
const DRAFT_KEY = 'current_draft';

export interface LocalDraft {
  id: string;
  rawText: string;
  updatedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB không khả dụng'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('custom_formulas')) {
        db.createObjectStore('custom_formulas', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('library_meta')) {
        db.createObjectStore('library_meta', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('figures')) {
        db.createObjectStore('figures', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('custom_figure_templates')) {
        db.createObjectStore('custom_figure_templates', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('figure_meta')) {
        db.createObjectStore('figure_meta', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalDraft(rawText: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: LocalDraft = {
        id: DRAFT_KEY,
        rawText,
        updatedAt: Date.now(),
      };
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Non-fatal in private browsing modes
  }
}

export async function loadLocalDraft(): Promise<LocalDraft | null> {
  try {
    const db = await openDatabase();
    const draft = await new Promise<LocalDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(DRAFT_KEY);
      req.onsuccess = () => resolve((req.result as LocalDraft) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return draft;
  } catch {
    return null;
  }
}

export async function clearLocalDraft(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}
