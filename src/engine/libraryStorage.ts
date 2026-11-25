import { LibraryFormulaItem } from '../data/formulaLibraryData';
import { FormulaSubject } from './types';

/**
 * Offline IndexedDB storage for the Formula Library (Section XV):
 * - Personal custom formulas (CRUD, duplicate, import/export JSON)
 * - Favorites (any built-in or personal formula)
 * - Recent usage log (ordered newest first, max 30 entries)
 * Uses an automatic in-memory fallback when IndexedDB is unavailable (e.g. Node/Vitest or private mode).
 */

export const MATHFIX_DB_NAME = 'mathfix_edu_db';
export const MATHFIX_DB_VERSION = 3;

const STORE_DRAFTS = 'drafts';
const STORE_CUSTOM = 'custom_formulas';
const STORE_META = 'library_meta';

const FAVORITES_KEY = 'favorites_list';
const RECENTS_KEY = 'recents_list';

export interface RecentEntry {
  id: string;
  usedAt: number;
}

export interface LibrarySnapshot {
  customFormulas: LibraryFormulaItem[];
  favoriteIds: string[];
  recentEntries: RecentEntry[];
}

// Graceful fallback store when IndexedDB is unavailable (e.g. Vitest Node environment)
let memoryCustom: LibraryFormulaItem[] = [];
let memoryFavorites: string[] = [];
let memoryRecents: RecentEntry[] = [];

export function resetMemoryLibraryStore(): void {
  memoryCustom = [];
  memoryFavorites = [];
  memoryRecents = [];
}

function openMathfixDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(MATHFIX_DB_NAME, MATHFIX_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CUSTOM)) {
        db.createObjectStore(STORE_CUSTOM, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadLibraryState(): Promise<LibrarySnapshot> {
  try {
    const db = await openMathfixDb();
    const snapshot = await new Promise<LibrarySnapshot>((resolve, reject) => {
      const tx = db.transaction([STORE_CUSTOM, STORE_META], 'readonly');
      const customReq = tx.objectStore(STORE_CUSTOM).getAll();
      const favReq = tx.objectStore(STORE_META).get(FAVORITES_KEY);
      const recReq = tx.objectStore(STORE_META).get(RECENTS_KEY);

      tx.oncomplete = () => {
        const customFormulas = ((customReq.result as LibraryFormulaItem[]) || []).sort(
          (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
        );
        const favoriteIds = (favReq.result?.value as string[]) || [];
        const recentEntries = (recReq.result?.value as RecentEntry[]) || [];
        resolve({ customFormulas, favoriteIds, recentEntries });
      };
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return snapshot;
  } catch {
    return {
      customFormulas: [...memoryCustom],
      favoriteIds: [...memoryFavorites],
      recentEntries: [...memoryRecents],
    };
  }
}

export async function saveCustomFormula(item: LibraryFormulaItem): Promise<LibraryFormulaItem> {
  const now = Date.now();
  const normalized: LibraryFormulaItem = {
    ...item,
    id: item.id || `custom_${now}_${Math.random().toString(36).slice(2, 7)}`,
    isBuiltIn: false,
    createdAt: item.createdAt || now,
    updatedAt: now,
  };

  try {
    const db = await openMathfixDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CUSTOM, 'readwrite');
      tx.objectStore(STORE_CUSTOM).put(normalized);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    const idx = memoryCustom.findIndex((c) => c.id === normalized.id);
    if (idx >= 0) memoryCustom[idx] = normalized;
    else memoryCustom.unshift(normalized);
  }
  return normalized;
}

export async function deleteCustomFormula(id: string): Promise<void> {
  try {
    const db = await openMathfixDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CUSTOM, 'readwrite');
      tx.objectStore(STORE_CUSTOM).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    memoryCustom = memoryCustom.filter((c) => c.id !== id);
  }
}

export async function saveFavoriteIds(favoriteIds: string[]): Promise<void> {
  const unique = Array.from(new Set(favoriteIds));
  try {
    const db = await openMathfixDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key: FAVORITES_KEY, value: unique });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    memoryFavorites = unique;
  }
}

export async function recordRecentFormulaUsage(id: string): Promise<RecentEntry[]> {
  const state = await loadLibraryState();
  const next: RecentEntry[] = [
    { id, usedAt: Date.now() },
    ...state.recentEntries.filter((e) => e.id !== id),
  ].slice(0, 30);

  try {
    const db = await openMathfixDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key: RECENTS_KEY, value: next });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    memoryRecents = next;
  }
  return next;
}

export interface LibraryExportBundle {
  app: 'MathFix EDU';
  schemaVersion: 1;
  exportedAt: string;
  customFormulas: LibraryFormulaItem[];
  favoriteIds: string[];
}

export function serializeLibraryToJson(
  customFormulas: LibraryFormulaItem[],
  favoriteIds: string[]
): string {
  const bundle: LibraryExportBundle = {
    app: 'MathFix EDU',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    customFormulas,
    favoriteIds,
  };
  return JSON.stringify(bundle, null, 2);
}

export function parseLibraryImportJson(rawJson: string): {
  ok: boolean;
  formulas: LibraryFormulaItem[];
  favoriteIds: string[];
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawJson);
    const list: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.customFormulas)
      ? parsed.customFormulas
      : [];

    const validSubjects = new Set<FormulaSubject>(['math', 'physics', 'chemistry']);
    const validGrades = new Set(['10', '11', '12']);
    const formulas: LibraryFormulaItem[] = [];

    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const name = typeof r.name === 'string' ? r.name.trim() : '';
      const latex = typeof r.latex === 'string' ? r.latex.trim() : '';
      if (!name || !latex) continue;

      const subject: FormulaSubject = validSubjects.has(r.subject as FormulaSubject)
        ? (r.subject as FormulaSubject)
        : 'math';
      const grade = validGrades.has(String(r.grade)) ? (String(r.grade) as '10' | '11' | '12') : '10';

      formulas.push({
        id:
          typeof r.id === 'string' && r.id.startsWith('custom_')
            ? r.id
            : `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        subject,
        grade,
        topic: typeof r.topic === 'string' && r.topic.trim() ? r.topic.trim() : 'Cá nhân',
        group: typeof r.group === 'string' && r.group.trim() ? r.group.trim() : 'Công thức nhập',
        latex,
        displayMode: Boolean(r.displayMode),
        conditions: typeof r.conditions === 'string' ? r.conditions.trim() : undefined,
        isBuiltIn: false,
        createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
        updatedAt: Date.now(),
      });
    }

    const favoriteIds: string[] = Array.isArray(parsed?.favoriteIds)
      ? parsed.favoriteIds.filter((x: unknown): x is string => typeof x === 'string')
      : [];

    if (formulas.length === 0 && favoriteIds.length === 0) {
      return {
        ok: false,
        formulas: [],
        favoriteIds: [],
        error: 'Tệp JSON không chứa công thức hợp lệ nào.',
      };
    }

    return { ok: true, formulas, favoriteIds };
  } catch {
    return {
      ok: false,
      formulas: [],
      favoriteIds: [],
      error: 'Định dạng tệp JSON thư viện không hợp lệ.',
    };
  }
}
