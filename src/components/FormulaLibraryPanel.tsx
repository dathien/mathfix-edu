import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookMarked,
  Copy,
  Download,
  Edit3,
  FileText,
  Maximize2,
  Plus,
  PlusSquare,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  BUILTIN_FORMULA_LIBRARY,
  GradeLevel,
  LibraryFormulaItem,
} from '../data/formulaLibraryData';
import { FormulaSegment, FormulaSubject } from '../engine/types';
import { RecentEntry } from '../engine/libraryStorage';
import { renderLatexToSvg } from '../engine/mathjaxRenderer';
import { copyFormulaAs } from '../engine/clipboardExport';
import { classifyFormulaSpan } from '../engine/formulaLayout';
import { ResponsiveFormula } from './ResponsiveFormula';

export type LibraryTabId = 'all' | 'personal' | 'favorites' | 'recent';

interface FormulaLibraryPanelProps {
  open: boolean;
  activeTab: LibraryTabId;
  onChangeTab: (tab: LibraryTabId) => void;
  customFormulas: LibraryFormulaItem[];
  favoriteIds: string[];
  recentEntries: RecentEntry[];
  onClose: () => void;
  onSavePersonalFormula: (item: LibraryFormulaItem) => void;
  onDeletePersonalFormula: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onRecordRecent: (id: string) => void;
  onInsertIntoStudio: (item: LibraryFormulaItem) => void;
  onInsertIntoDocument: (item: LibraryFormulaItem) => void;
  onImportJson: (rawJson: string) => void;
  onExportJson: () => void;
  onNotify: (message: string, tone?: 'info' | 'success' | 'warning') => void;
}

const SVG_CACHE = new Map<string, string>();
function getCachedFormulaSvg(latex: string, displayMode = false): string {
  const trimmed = latex.trim();
  if (!trimmed) return '';
  const cacheKey = `${displayMode ? 'D' : 'I'}::${trimmed}`;
  const cached = SVG_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;
  const rendered = renderLatexToSvg(trimmed, displayMode);
  const svg = rendered.ok ? rendered.svg : '';
  SVG_CACHE.set(cacheKey, svg);
  return svg;
}

const SUBJECT_LABELS: Record<FormulaSubject, string> = {
  math: 'Toán học',
  physics: 'Vật lí',
  chemistry: 'Hóa học',
};

const EMPTY_FORM: {
  id: string;
  name: string;
  subject: FormulaSubject;
  grade: GradeLevel;
  topic: string;
  group: string;
  latex: string;
  conditions: string;
  displayMode: boolean;
} = {
  id: '',
  name: '',
  subject: 'math',
  grade: '10',
  topic: '',
  group: '',
  latex: '',
  conditions: '',
  displayMode: false,
};

export const FormulaLibraryPanel: React.FC<FormulaLibraryPanelProps> = ({
  open,
  activeTab,
  onChangeTab,
  customFormulas,
  favoriteIds,
  recentEntries,
  onClose,
  onSavePersonalFormula,
  onDeletePersonalFormula,
  onToggleFavorite,
  onRecordRecent,
  onInsertIntoStudio,
  onInsertIntoDocument,
  onImportJson,
  onExportJson,
  onNotify,
}) => {
  const [subjectFilter, setSubjectFilter] = useState<'all' | FormulaSubject>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeLevel>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [query, setQuery] = useState<string>('');
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [fullscreenItem, setFullscreenItem] = useState<LibraryFormulaItem | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const allItems = useMemo(
    () => [...customFormulas, ...BUILTIN_FORMULA_LIBRARY],
    [customFormulas]
  );

  const itemById = useMemo(() => {
    const map = new Map<string, LibraryFormulaItem>();
    for (const item of allItems) map.set(item.id, item);
    return map;
  }, [allItems]);

  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    for (const item of allItems) {
      if (subjectFilter !== 'all' && item.subject !== subjectFilter) continue;
      if (gradeFilter !== 'all' && item.grade !== gradeFilter) continue;
      set.add(item.topic);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [allItems, subjectFilter, gradeFilter]);

  const filteredItems = useMemo(() => {
    let base: LibraryFormulaItem[];
    if (activeTab === 'personal') {
      base = customFormulas;
    } else if (activeTab === 'favorites') {
      base = allItems.filter((item) => favoriteSet.has(item.id));
    } else if (activeTab === 'recent') {
      base = recentEntries
        .map((r) => itemById.get(r.id))
        .filter((x): x is LibraryFormulaItem => Boolean(x));
    } else {
      base = allItems;
    }

    const q = query.trim().toLowerCase();
    return base.filter((item) => {
      if (subjectFilter !== 'all' && item.subject !== subjectFilter) return false;
      if (gradeFilter !== 'all' && item.grade !== gradeFilter) return false;
      if (topicFilter !== 'all' && item.topic !== topicFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.latex.toLowerCase().includes(q) ||
        (item.conditions || '').toLowerCase().includes(q)
      );
    });
  }, [
    activeTab,
    allItems,
    customFormulas,
    favoriteSet,
    recentEntries,
    itemById,
    subjectFilter,
    gradeFilter,
    topicFilter,
    query,
  ]);

  const formPreviewSvg = useMemo(
    () =>
      formState.latex.trim()
        ? getCachedFormulaSvg(formState.latex, formState.displayMode)
        : '',
    [formState.latex, formState.displayMode]
  );

  if (!open) return null;

  const openCreateForm = () => {
    setFormState({
      ...EMPTY_FORM,
      subject: subjectFilter === 'all' ? 'math' : subjectFilter,
      grade: gradeFilter === 'all' ? '10' : gradeFilter,
    });
    setFormOpen(true);
  };

  const openEditForm = (item: LibraryFormulaItem) => {
    setFormState({
      id: item.isBuiltIn ? '' : item.id,
      name: item.isBuiltIn ? `${item.name} (Bản sao)` : item.name,
      subject: item.subject,
      grade: item.grade,
      topic: item.topic,
      group: item.group,
      latex: item.latex,
      conditions: item.conditions || '',
      displayMode: Boolean(item.displayMode),
    });
    setFormOpen(true);
  };

  const handleDuplicate = (item: LibraryFormulaItem) => {
    const copy: LibraryFormulaItem = {
      ...item,
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${item.name} (Bản sao)`,
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onSavePersonalFormula(copy);
    onNotify(`Đã nhân bản "${item.name}" vào thư viện cá nhân.`, 'success');
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const name = formState.name.trim();
    const latex = formState.latex.trim();
    if (!name || !latex) {
      onNotify('Vui lòng nhập đầy đủ Tên công thức và Biểu thức công thức.', 'warning');
      return;
    }
    const saved: LibraryFormulaItem = {
      id: formState.id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      subject: formState.subject,
      grade: formState.grade,
      topic: formState.topic.trim() || 'Cá nhân',
      group: formState.group.trim() || 'Công thức giáo viên',
      latex,
      conditions: formState.conditions.trim() || undefined,
      displayMode: formState.displayMode,
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onSavePersonalFormula(saved);
    setFormOpen(false);
    setFormState(EMPTY_FORM);
    onChangeTab('personal');
  };

  const handleCopyWord = async (item: LibraryFormulaItem) => {
    const rendered = renderLatexToSvg(item.latex, Boolean(item.displayMode));
    const seg: FormulaSegment = {
      id: `lib_${item.id}`,
      type: 'formula',
      raw: item.latex,
      originalLatex: item.latex,
      fixedLatex: item.latex,
      activeLatex: item.latex,
      displayMode: Boolean(item.displayMode),
      sourceFormat: 'mathlive',
      subject: item.subject,
      status: 'valid',
      userDecision: 'accepted',
      notes: [],
      svg: rendered.svg,
      mathml: rendered.mathml,
      validated: rendered.ok,
    };
    const res = await copyFormulaAs(seg, 'display');
    onRecordRecent(item.id);
    onNotify(res.message, res.ok ? 'success' : 'warning');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      onImportJson(text);
    } catch {
      onNotify('Không thể đọc tệp JSON thư viện.', 'warning');
    }
  };

  // Dedicated solid fullscreen view for inspecting very long formulas (NO dimmed popup modal)
  if (fullscreenItem) {
    const fullSvg = getCachedFormulaSvg(fullscreenItem.latex, true);
    const isFav = favoriteSet.has(fullscreenItem.id);
    return (
      <section
        aria-label={`Xem toàn màn hình công thức: ${fullscreenItem.name}`}
        className="no-print fixed inset-0 z-40 flex flex-col bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setFullscreenItem(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[15px] font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại thư viện</span>
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-semibold text-slate-950">
                {fullscreenItem.name}
              </h2>
              <p className="text-[15px] text-slate-600">
                {SUBJECT_LABELS[fullscreenItem.subject]} · Lớp {fullscreenItem.grade} · {fullscreenItem.topic}
                {!fullscreenItem.isBuiltIn && ' · Cá nhân'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(fullscreenItem.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[15px] font-medium cursor-pointer ${
                isFav
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-amber-400'
              }`}
            >
              <Star className={`h-4 w-4 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
              <span>{isFav ? 'Đã yêu thích' : 'Yêu thích'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onRecordRecent(fullscreenItem.id);
                onInsertIntoDocument(fullscreenItem);
                setFullscreenItem(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B4F8A] px-4 py-2 text-[15px] font-semibold text-white hover:bg-[#093F6F] cursor-pointer"
            >
              <PlusSquare className="h-4 w-4" />
              <span>Chèn văn bản</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onRecordRecent(fullscreenItem.id);
                onInsertIntoStudio(fullscreenItem);
                setFullscreenItem(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[15px] font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] cursor-pointer"
            >
              <Edit3 className="h-4 w-4" />
              <span>Sửa trực quan</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopyWord(fullscreenItem)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[15px] font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] cursor-pointer"
            >
              <FileText className="h-4 w-4" />
              <span>Sao chép Word</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
          <div className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-slate-50/70 px-6 py-12">
            <ResponsiveFormula
              svg={fullSvg}
              fallbackText={fullscreenItem.latex}
              baseFontSize="2.1rem"
              minScale={0.68}
              align="center"
            />
          </div>

          {fullscreenItem.conditions && (
            <p className="mt-5 max-w-4xl text-center text-[16px] text-slate-700">
              <span className="font-semibold text-slate-900">Điều kiện:</span>{' '}
              {fullscreenItem.conditions}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Thư viện công thức chuẩn hóa"
      className="no-print mb-3 rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-[#0B4F8A]" />
            <h2 className="text-[16px] font-semibold text-slate-900">
              Thư viện công thức GDPT 2018 ({allItems.length} công thức)
            </h2>
          </div>

          <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5 text-[15px]">
            {(
              [
                ['all', `Tất cả (${allItems.length})`],
                ['personal', `Cá nhân (${customFormulas.length})`],
                ['favorites', `Yêu thích (${favoriteIds.length})`],
                ['recent', `Gần đây (${recentEntries.length})`],
              ] as Array<[LibraryTabId, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onChangeTab(id)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === id
                    ? 'bg-[#0B4F8A] text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B4F8A] px-3.5 py-2 text-[15px] font-semibold text-white hover:bg-[#093F6F] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm công thức</span>
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[15px] font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>Nhập JSON</span>
          </button>
          <button
            type="button"
            onClick={onExportJson}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[15px] font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Xuất JSON</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 cursor-pointer"
            aria-label="Đóng thư viện công thức"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Inline Add / Edit Personal Formula Form */}
      {formOpen && (
        <form
          onSubmit={handleSubmitForm}
          className="border-b border-slate-200 bg-sky-50/40 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold text-slate-900">
              {formState.id
                ? 'Chỉnh sửa công thức cá nhân'
                : 'Thêm công thức mới vào thư viện cá nhân'}
            </h3>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-[15px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Đóng biểu mẫu
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <input
              type="text"
              value={formState.name}
              onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
              placeholder="Tên công thức *"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 focus:border-[#0B4F8A] focus:outline-none sm:col-span-2"
              required
            />
            <select
              value={formState.subject}
              onChange={(e) =>
                setFormState((s) => ({ ...s, subject: e.target.value as FormulaSubject }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 focus:border-[#0B4F8A] focus:outline-none"
            >
              <option value="math">Môn: Toán học</option>
              <option value="physics">Môn: Vật lí</option>
              <option value="chemistry">Môn: Hóa học</option>
            </select>
            <select
              value={formState.grade}
              onChange={(e) =>
                setFormState((s) => ({ ...s, grade: e.target.value as GradeLevel }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 focus:border-[#0B4F8A] focus:outline-none"
            >
              <option value="10">Lớp 10</option>
              <option value="11">Lớp 11</option>
              <option value="12">Lớp 12</option>
            </select>

            <input
              type="text"
              value={formState.topic}
              onChange={(e) => setFormState((s) => ({ ...s, topic: e.target.value }))}
              placeholder="Chủ đề (vd: Giải tích, Điện trường...)"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 focus:border-[#0B4F8A] focus:outline-none"
            />
            <input
              type="text"
              value={formState.group}
              onChange={(e) => setFormState((s) => ({ ...s, group: e.target.value }))}
              placeholder="Nhóm công thức"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 focus:border-[#0B4F8A] focus:outline-none"
            />
            <input
              type="text"
              value={formState.conditions}
              onChange={(e) => setFormState((s) => ({ ...s, conditions: e.target.value }))}
              placeholder="Điều kiện áp dụng (nếu có)"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 focus:border-[#0B4F8A] focus:outline-none sm:col-span-2"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <label className="block text-[15px] font-medium text-slate-700 mb-1">
                Mã công thức (LaTeX) *
              </label>
              <input
                type="text"
                value={formState.latex}
                onChange={(e) => setFormState((s) => ({ ...s, latex: e.target.value }))}
                placeholder="Ví dụ: \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[15px] text-slate-900 focus:border-[#0B4F8A] focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[15px] font-medium text-slate-700 mb-1">
                Xem trước hiển thị chuẩn
              </label>
              <div className="flex min-h-[58px] items-center rounded-lg border border-slate-200 bg-white px-3 py-2">
                {formPreviewSvg ? (
                  <ResponsiveFormula
                    svg={formPreviewSvg}
                    baseFontSize="1.22rem"
                    minScale={0.72}
                    align="center"
                    noScrollbar
                  />
                ) : (
                  <span className="mx-auto text-[15px] text-slate-400">
                    Nhập công thức để xem trước
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-[15px] text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formState.displayMode}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, displayMode: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-[#0B4F8A]"
              />
              <span>Hiển thị dạng công thức độc lập (căn giữa dòng riêng)</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[15px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#0B4F8A] px-4 py-2 text-[15px] font-semibold text-white hover:bg-[#093F6F] cursor-pointer"
              >
                Lưu công thức
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Search & Filter Row */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-100 px-4 py-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên công thức, chủ đề, nhóm, ký hiệu..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-[15px] text-slate-900 focus:border-[#0B4F8A] focus:outline-none"
          />
        </div>

        <select
          aria-label="Lọc theo môn học"
          value={subjectFilter}
          onChange={(e) => {
            setSubjectFilter(e.target.value as 'all' | FormulaSubject);
            setTopicFilter('all');
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-800 focus:border-[#0B4F8A] focus:outline-none"
        >
          <option value="all">Tất cả môn học</option>
          <option value="math">Toán học</option>
          <option value="physics">Vật lí</option>
          <option value="chemistry">Hóa học</option>
        </select>

        <select
          aria-label="Lọc theo khối lớp"
          value={gradeFilter}
          onChange={(e) => {
            setGradeFilter(e.target.value as 'all' | GradeLevel);
            setTopicFilter('all');
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-800 focus:border-[#0B4F8A] focus:outline-none"
        >
          <option value="all">Tất cả khối lớp</option>
          <option value="10">Khối 10</option>
          <option value="11">Khối 11</option>
          <option value="12">Khối 12</option>
        </select>

        <select
          aria-label="Lọc theo chủ đề"
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          className="max-w-[260px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-800 focus:border-[#0B4F8A] focus:outline-none"
        >
          <option value="all">Tất cả chủ đề</option>
          {availableTopics.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </select>
      </div>

      {/* Responsive Adaptive Formula Grid — short=1 col, medium-long=2 cols, very long=full row */}
      <div className="mathfix-scroll max-h-[540px] overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="py-10 text-center text-[15px] text-slate-500">
            Không tìm thấy công thức phù hợp trong mục này.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 grid-flow-row-dense gap-3.5">
            {filteredItems.map((item) => {
              const svg = getCachedFormulaSvg(item.latex, Boolean(item.displayMode));
              const span = classifyFormulaSpan(svg, item.latex);
              const spanClass =
                span === 'full'
                  ? 'md:col-span-2 xl:col-span-3'
                  : span === 'double'
                  ? 'md:col-span-2'
                  : '';
              const isFav = favoriteSet.has(item.id);
              const isLongCard = span !== 'single';

              return (
                <article
                  key={item.id}
                  data-formula-span={span}
                  className={`flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-[#0B4F8A]/60 transition-colors ${spanClass}`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[16px] font-semibold text-slate-900 leading-snug">
                          {item.name}
                        </h3>
                        <div className="mt-1 text-[15px] text-slate-600">
                          {SUBJECT_LABELS[item.subject]} · Lớp {item.grade} · {item.topic}
                          {!item.isBuiltIn && ' · Cá nhân'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setFullscreenItem(item)}
                          title="Mở chế độ xem toàn màn hình"
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0B4F8A] transition-colors cursor-pointer"
                          aria-label={`Xem toàn màn hình công thức ${item.name}`}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(item.id)}
                          title={isFav ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
                          className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                            isFav
                              ? 'text-amber-500 hover:bg-amber-50'
                              : 'text-slate-400 hover:bg-slate-100 hover:text-amber-500'
                          }`}
                          aria-label={isFav ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
                        >
                          <Star className={`h-4 w-4 ${isFav ? 'fill-amber-400' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Responsive Visual Formula Preview — auto-scaled, centered, ZERO horizontal scrollbar */}
                    <div className="my-3 flex min-h-[68px] items-center rounded-lg border border-slate-200/80 bg-slate-50/75 px-3.5 py-3">
                      <ResponsiveFormula
                        svg={svg}
                        fallbackText={item.latex}
                        baseFontSize={isLongCard ? '1.3rem' : '1.26rem'}
                        minScale={0.72}
                        align="center"
                        noScrollbar
                        onExpandFullscreen={
                          isLongCard ? () => setFullscreenItem(item) : undefined
                        }
                      />
                    </div>

                    {item.conditions && (
                      <p className="mb-3 text-[15px] text-slate-700 leading-relaxed">
                        <span className="font-semibold text-slate-800">Điều kiện:</span>{' '}
                        {item.conditions}
                      </p>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        onRecordRecent(item.id);
                        onInsertIntoDocument(item);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B4F8A] px-3 py-1.5 text-[15px] font-semibold text-white hover:bg-[#093F6F] cursor-pointer"
                    >
                      <PlusSquare className="h-4 w-4" />
                      <span>Chèn văn bản</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onRecordRecent(item.id);
                        onInsertIntoStudio(item);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[15px] font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] cursor-pointer"
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>Sửa trực quan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyWord(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[15px] font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] cursor-pointer"
                      title="Sao chép cho Microsoft Word (OMML + MathML)"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Word</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicate(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[15px] font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                      title="Nhân bản vào thư viện cá nhân"
                      aria-label={`Nhân bản ${item.name}`}
                    >
                      <Copy className="h-4 w-4" />
                    </button>

                    {!item.isBuiltIn && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditForm(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                          title="Chỉnh sửa thông tin công thức cá nhân"
                        >
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePersonalFormula(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[15px] font-medium text-red-600 hover:border-red-300 hover:bg-red-50 cursor-pointer"
                          title="Xóa công thức cá nhân"
                          aria-label={`Xóa ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
