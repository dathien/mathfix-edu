import React, { useMemo, useState } from 'react';
import { Clock, Edit3, FolderHeart, PlusCircle, Search, Star, Trash2 } from 'lucide-react';
import { BUILTIN_FIGURE_LIBRARY, renderFigureTemplateToSvg } from '../../data/figureLibraryData';
import { FigureLibraryTemplate } from '../../engine/figureTypes';
import { FigureRecentEntry } from '../../engine/figureStorage';
import { FormulaSubject, SubjectMode } from '../../engine/types';

interface FigureLibraryBrowserProps {
  activeSubjectMode: SubjectMode;
  customTemplates: FigureLibraryTemplate[];
  favoriteIds: string[];
  recentEntries: FigureRecentEntry[];
  onInsertTemplate: (tpl: FigureLibraryTemplate) => void;
  onEditTemplateInStudio: (tpl: FigureLibraryTemplate) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteCustomTemplate: (id: string) => void;
}

type LibraryViewTab = 'all' | 'custom' | 'favorites' | 'recent';

export const FigureLibraryBrowser: React.FC<FigureLibraryBrowserProps> = ({
  activeSubjectMode,
  customTemplates,
  favoriteIds,
  recentEntries,
  onInsertTemplate,
  onEditTemplateInStudio,
  onToggleFavorite,
  onDeleteCustomTemplate,
}) => {
  const [viewTab, setViewTab] = useState<LibraryViewTab>('all');
  const [subjectFilter, setSubjectFilter] = useState<'all' | FormulaSubject>(
    activeSubjectMode === 'auto' ? 'all' : activeSubjectMode
  );
  const [gradeFilter, setGradeFilter] = useState<'all' | '10' | '11' | '12'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allTemplates = useMemo(
    () => [...customTemplates, ...BUILTIN_FIGURE_LIBRARY],
    [customTemplates]
  );

  const filteredTemplates = useMemo(() => {
    let list = allTemplates;

    if (viewTab === 'custom') {
      list = customTemplates;
    } else if (viewTab === 'favorites') {
      const favSet = new Set(favoriteIds);
      list = allTemplates.filter((t) => favSet.has(t.id));
    } else if (viewTab === 'recent') {
      const map = new Map(allTemplates.map((t) => [t.id, t]));
      list = recentEntries
        .map((r) => map.get(r.id))
        .filter((t): t is FigureLibraryTemplate => Boolean(t));
    }

    if (subjectFilter !== 'all') {
      list = list.filter((t) => t.subject === subjectFilter);
    }
    if (gradeFilter !== 'all') {
      list = list.filter((t) => t.grade === gradeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.topic.toLowerCase().includes(q) ||
          t.group.toLowerCase().includes(q)
      );
    }

    // Prioritize current subject mode when viewing 'all'
    if (subjectFilter === 'all' && activeSubjectMode !== 'auto') {
      list = [...list].sort((a, b) => {
        const aMatch = a.subject === activeSubjectMode ? 0 : 1;
        const bMatch = b.subject === activeSubjectMode ? 0 : 1;
        return aMatch - bMatch;
      });
    }

    return list;
  }, [allTemplates, customTemplates, favoriteIds, recentEntries, viewTab, subjectFilter, gradeFilter, searchQuery, activeSubjectMode]);

  const subjectBadge = (subj: FormulaSubject) => {
    if (subj === 'physics') return 'bg-amber-100 text-amber-800';
    if (subj === 'chemistry') return 'bg-emerald-100 text-emerald-800';
    return 'bg-blue-100 text-blue-800';
  };
  const subjectName = (subj: FormulaSubject) =>
    subj === 'physics' ? 'Vật lí' : subj === 'chemistry' ? 'Hóa học' : 'Toán học';

  return (
    <div className="flex flex-col h-full bg-slate-50 text-[15px]">
      {/* Filter & Search Bar */}
      <div className="p-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
          {([
            { id: 'all', label: `Tất cả (${allTemplates.length})` },
            { id: 'custom', label: `Hình cá nhân (${customTemplates.length})` },
            { id: 'favorites', label: 'Yêu thích', icon: Star },
            { id: 'recent', label: 'Gần đây', icon: Clock },
          ] as Array<{ id: LibraryViewTab; label: string; icon?: React.ComponentType<{ className?: string }> }>).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setViewTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-[14px] font-semibold transition-colors ${
                viewTab === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value as 'all' | FormulaSubject)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-[14.5px] font-medium"
        >
          <option value="all">Tất cả 3 môn</option>
          <option value="math">Toán học</option>
          <option value="physics">Vật lí</option>
          <option value="chemistry">Hóa học</option>
        </select>

        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value as 'all' | '10' | '11' | '12')}
          className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-[14.5px] font-medium"
        >
          <option value="all">Mọi khối lớp</option>
          <option value="10">Lớp 10</option>
          <option value="11">Lớp 11</option>
          <option value="12">Lớp 12</option>
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm hình: tam giác, hình chóp, mạch điện, thấu kính, benzen..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-[14.5px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-2">
            <FolderHeart className="w-10 h-10 text-slate-300" />
            <div className="text-[15.5px] font-medium">Không tìm thấy mẫu hình phù hợp với bộ lọc hiện tại.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTemplates.map((tpl) => {
              const svg = renderFigureTemplateToSvg(tpl);
              const isFav = favoriteIds.includes(tpl.id);
              return (
                <div
                  key={tpl.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex flex-col overflow-hidden"
                >
                  <div className="h-44 p-2.5 bg-slate-50/60 border-b border-slate-100 flex items-center justify-center overflow-hidden">
                    <div
                      className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto"
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                  </div>
                  <div className="p-3 flex-1 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-[14.5px] text-slate-900 leading-snug">{tpl.name}</div>
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(tpl.id)}
                        title={isFav ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
                        className={`p-1 rounded ${isFav ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                      >
                        <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                      <span className={`px-2 py-0.5 rounded font-semibold ${subjectBadge(tpl.subject)}`}>
                        {subjectName(tpl.subject)}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">Lớp {tpl.grade}</span>
                      <span className="text-slate-500 truncate">{tpl.group}</span>
                    </div>
                    <div className="mt-auto pt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onInsertTemplate(tpl)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[13.5px] font-semibold bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Chèn ngay</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditTemplateInStudio(tpl)}
                        title="Mở trong trình vẽ để tùy chỉnh trước khi chèn"
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[13.5px] font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Sửa</span>
                      </button>
                      {!tpl.isBuiltIn && (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomTemplate(tpl.id)}
                          title="Xóa mẫu hình cá nhân"
                          className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
