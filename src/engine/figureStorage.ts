import { FigureAsset, FigureLibraryTemplate } from './figureTypes';

/**
 * Offline IndexedDB persistence for embedded document figures and the personal Figure Library.
 * Automatically falls back to an in-memory store when IndexedDB is unavailable (e.g. Vitest).
 */

const DB_NAME = 'mathfix_edu_db';
const DB_VERSION = 3;

const STORE_FIGURES = 'figures';
const STORE_CUSTOM_TEMPLATES = 'custom_figure_templates';
const STORE_FIGURE_META = 'figure_meta';

const FAVORITES_KEY = 'figure_favorites';
const RECENTS_KEY = 'figure_recents';

export interface FigureRecentEntry {
  id: string;
  usedAt: number;
}

export interface FigureLibrarySnapshot {
  customTemplates: FigureLibraryTemplate[];
  favoriteIds: string[];
  recentEntries: FigureRecentEntry[];
}

let memoryFigures = new Map<string, FigureAsset>();
let memoryCustomTemplates: FigureLibraryTemplate[] = [];
let memoryFavoriteIds: string[] = [];
let memoryRecentEntries: FigureRecentEntry[] = [];

export function resetMemoryFigureStore(): void {
  memoryFigures = new Map();
  memoryCustomTemplates = [];
  memoryFavoriteIds = [];
  memoryRecentEntries = [];
}

export function generateFigureId(): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `fig_${Date.now().toString(36)}_${rand}`;
}

function openFigureDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('custom_formulas')) {
        db.createObjectStore('custom_formulas', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('library_meta')) {
        db.createObjectStore('library_meta', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_FIGURES)) {
        db.createObjectStore(STORE_FIGURES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CUSTOM_TEMPLATES)) {
        db.createObjectStore(STORE_CUSTOM_TEMPLATES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FIGURE_META)) {
        db.createObjectStore(STORE_FIGURE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAllFigures(): Promise<Map<string, FigureAsset>> {
  try {
    const db = await openFigureDb();
    const list = await new Promise<FigureAsset[]>((resolve, reject) => {
      const tx = db.transaction(STORE_FIGURES, 'readonly');
      const req = tx.objectStore(STORE_FIGURES).getAll();
      req.onsuccess = () => resolve((req.result as FigureAsset[]) || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    const map = new Map<string, FigureAsset>();
    for (const item of list) {
      if (item && item.id) map.set(item.id, item);
    }
    return map;
  } catch {
    return new Map(memoryFigures);
  }
}

export async function saveFigureAsset(figure: FigureAsset): Promise<FigureAsset> {
  const now = Date.now();
  const normalized: FigureAsset = {
    ...figure,
    id: figure.id || generateFigureId(),
    createdAt: figure.createdAt || now,
    updatedAt: now,
  };
  try {
    const db = await openFigureDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_FIGURES, 'readwrite');
      tx.objectStore(STORE_FIGURES).put(normalized);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    memoryFigures.set(normalized.id, normalized);
  }
  return normalized;
}

export async function deleteFigureAsset(id: string): Promise<void> {
  try {
    const db = await openFigureDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_FIGURES, 'readwrite');
      tx.objectStore(STORE_FIGURES).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    memoryFigures.delete(id);
  }
}

export async function loadFigureLibraryState(): Promise<FigureLibrarySnapshot> {
  try {
    const db = await openFigureDb();
    const snapshot = await new Promise<FigureLibrarySnapshot>((resolve, reject) => {
      const tx = db.transaction([STORE_CUSTOM_TEMPLATES, STORE_FIGURE_META], 'readonly');
      const tplReq = tx.objectStore(STORE_CUSTOM_TEMPLATES).getAll();
      const favReq = tx.objectStore(STORE_FIGURE_META).get(FAVORITES_KEY);
      const recReq = tx.objectStore(STORE_FIGURE_META).get(RECENTS_KEY);
      tx.oncomplete = () => {
        const customTemplates = ((tplReq.result as FigureLibraryTemplate[]) || []).sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        );
        const favoriteIds = (favReq.result?.value as string[]) || [];
        const recentEntries = (recReq.result?.value as FigureRecentEntry[]) || [];
        resolve({ customTemplates, favoriteIds, recentEntries });
      };
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return snapshot;
  } catch {
    return {
      customTemplates: [...memoryCustomTemplates],
      favoriteIds: [...memoryFavoriteIds],
      recentEntries: [...memoryRecentEntries],
    };
  }
}

export async function saveCustomFigureTemplate(
  tpl: FigureLibraryTemplate
): Promise<FigureLibraryTemplate> {
  const now = Date.now();
  const normalized: FigureLibraryTemplate = {
    ...tpl,
    id: tpl.id || `figtpl_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    isBuiltIn: false,
    createdAt: tpl.createdAt || now,
  };
  try {
    const db = await openFigureDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CUSTOM_TEMPLATES, 'readwrite');
      tx.objectStore(STORE_CUSTOM_TEMPLATES).put(normalized);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    const idx = memoryCustomTemplates.findIndex((t) => t.id === normalized.id);
    if (idx >= 0) memoryCustomTemplates[idx] = normalized;
    else memoryCustomTemplates.unshift(normalized);
  }
  return normalized;
}

export async function deleteCustomFigureTemplate(id: string): Promise<void> {
  try {
    const db = await openFigureDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CUSTOM_TEMPLATES, 'readwrite');
      tx.objectStore(STORE_CUSTOM_TEMPLATES).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    memoryCustomTemplates = memoryCustomTemplates.filter((t) => t.id !== id);
  }
}

export async function saveFigureFavoriteIds(favoriteIds: string[]): Promise<void> {
  const unique = Array.from(new Set(favoriteIds));
  try {
    const db = await openFigureDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_FIGURE_META, 'readwrite');
      tx.objectStore(STORE_FIGURE_META).put({ key: FAVORITES_KEY, value: unique });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    memoryFavoriteIds = unique;
  }
}

export async function recordRecentFigureTemplate(id: string): Promise<FigureRecentEntry[]> {
  const state = await loadFigureLibraryState();
  const next: FigureRecentEntry[] = [
    { id, usedAt: Date.now() },
    ...state.recentEntries.filter((e) => e.id !== id),
  ].slice(0, 30);

  try {
    const db = await openFigureDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_FIGURE_META, 'readwrite');
      tx.objectStore(STORE_FIGURE_META).put({ key: RECENTS_KEY, value: next });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    memoryRecentEntries = next;
  }
  return next;
}
