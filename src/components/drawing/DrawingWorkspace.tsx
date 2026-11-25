import React, { useState } from 'react';
import {
  ArrowLeft,
  Box,
  FlaskConical,
  FolderOpen,
  Image as ImageIcon,
  LineChart,
  Maximize2,
  Minimize2,
  PenTool,
} from 'lucide-react';
import {
  ChemStructureState,
  DEFAULT_FIGURE_CROP,
  DiagramScene,
  FigureAsset,
  FigureLibraryTemplate,
  Geometry3DState,
  GraphPlotState,
} from '../../engine/figureTypes';
import { FigureRecentEntry, generateFigureId } from '../../engine/figureStorage';
import { FormulaSubject, SubjectMode } from '../../engine/types';
import { renderFigureTemplateToSvg } from '../../data/figureLibraryData';
import { getSvgDimensions, svgMarkupToPngDataUrl } from '../../engine/svgSanitizer';
import { VectorCanvasStudio } from './VectorCanvasStudio';
import { Geometry3DStudio } from './Geometry3DStudio';
import { FunctionGraphStudio } from './FunctionGraphStudio';
import { ChemStructureStudio } from './ChemStructureStudio';
import { RasterImageEditor } from './RasterImageEditor';
import { FigureLibraryBrowser } from './FigureLibraryBrowser';

export type DrawingWorkspaceMode =
  | 'vector_2d'
  | 'geometry_3d'
  | 'graph'
  | 'chemistry_2d'
  | 'library'
  | 'raster_edit';

interface DrawingWorkspaceProps {
  initialMode: DrawingWorkspaceMode;
  activeSubjectMode: SubjectMode;
  editingFigure?: FigureAsset | null;
  customTemplates: FigureLibraryTemplate[];
  favoriteIds: string[];
  recentEntries: FigureRecentEntry[];
  onCommitFigure: (figure: FigureAsset, isUpdate: boolean) => void;
  onSaveCustomTemplate: (tpl: FigureLibraryTemplate) => void;
  onDeleteCustomTemplate: (id: string) => void;
  onToggleFavoriteTemplate: (id: string) => void;
  onRecordRecentTemplate: (id: string) => void;
  onClose: () => void;
}

export const DrawingWorkspace: React.FC<DrawingWorkspaceProps> = ({
  initialMode,
  activeSubjectMode,
  editingFigure,
  customTemplates,
  favoriteIds,
  recentEntries,
  onCommitFigure,
  onSaveCustomTemplate,
  onDeleteCustomTemplate,
  onToggleFavoriteTemplate,
  onRecordRecentTemplate,
  onClose,
}) => {
  const [mode, setMode] = useState<DrawingWorkspaceMode>(initialMode);
  const [fullscreen, setFullscreen] = useState(false);

  // Allow opening a library template directly inside its corresponding studio
  const [studioSeed, setStudioSeed] = useState<{
    title?: string;
    subject?: FormulaSubject;
    vectorScene?: DiagramScene;
    geo3dState?: Geometry3DState;
    graphState?: GraphPlotState;
    chemState?: ChemStructureState;
  }>({});

  const defaultSubject: FormulaSubject =
    editingFigure?.subject || (activeSubjectMode === 'auto' ? 'math' : activeSubjectMode);

  const isEditing = Boolean(editingFigure);

  const buildAsset = (params: {
    kind: FigureAsset['kind'];
    subject: FormulaSubject;
    title: string;
    caption: string;
    svgMarkup: string;
    pngDataUrl: string;
    sourceData: FigureAsset['sourceData'];
  }): FigureAsset => {
    const dims = getSvgDimensions(params.svgMarkup);
    const ratio = dims.width > 0 ? dims.height / dims.width : 0.68;
    const now = Date.now();
    return {
      id: editingFigure?.id || generateFigureId(),
      kind: params.kind,
      subject: params.subject,
      title: params.title,
      caption: params.caption,
      showNumber: editingFigure?.showNumber ?? true,
      align: editingFigure?.align ?? 'center',
      widthPx: editingFigure?.widthPx ?? 420,
      aspectRatio: ratio,
      rotationDeg: 0,
      crop: DEFAULT_FIGURE_CROP,
      svgMarkup: params.svgMarkup,
      pngDataUrl: params.pngDataUrl,
      sourceData: params.sourceData,
      createdAt: editingFigure?.createdAt || now,
      updatedAt: now,
    };
  };

  const handleInsertLibraryTemplate = async (tpl: FigureLibraryTemplate) => {
    onRecordRecentTemplate(tpl.id);
    const svgMarkup = renderFigureTemplateToSvg(tpl);
    const pngDataUrl = (await svgMarkupToPngDataUrl(svgMarkup, 1120)) || '';
    const asset = buildAsset({
      kind: tpl.kind,
      subject: tpl.subject,
      title: tpl.name,
      caption: tpl.name,
      svgMarkup,
      pngDataUrl,
      sourceData: structuredClone(tpl.sourceData),
    });
    onCommitFigure(asset, isEditing);
  };

  const handleEditLibraryTemplate = (tpl: FigureLibraryTemplate) => {
    onRecordRecentTemplate(tpl.id);
    if (tpl.kind === 'vector_2d') {
      setStudioSeed({ title: tpl.name, subject: tpl.subject, vectorScene: structuredClone(tpl.sourceData as DiagramScene) });
      setMode('vector_2d');
    } else if (tpl.kind === 'geometry_3d') {
      setStudioSeed({ title: tpl.name, subject: 'math', geo3dState: structuredClone(tpl.sourceData as Geometry3DState) });
      setMode('geometry_3d');
    } else if (tpl.kind === 'graph') {
      setStudioSeed({ title: tpl.name, subject: 'math', graphState: structuredClone(tpl.sourceData as GraphPlotState) });
      setMode('graph');
    } else if (tpl.kind === 'chemistry_2d') {
      setStudioSeed({ title: tpl.name, subject: 'chemistry', chemState: structuredClone(tpl.sourceData as ChemStructureState) });
      setMode('chemistry_2d');
    }
  };

  return (
    <section
      aria-label="Không gian vẽ hình khoa học MathFix EDU"
      className={
        fullscreen
          ? 'fixed inset-0 z-50 bg-slate-50 flex flex-col'
          : 'flex-1 min-h-[680px] flex flex-col bg-slate-50 border-t border-slate-200'
      }
    >
      {/* Dedicated Workspace Header (NO dimmed modal overlay!) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900 text-white">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[14.5px] font-medium border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại tài liệu</span>
          </button>

          <div className="h-5 w-px bg-slate-700 mx-1" />

          {mode !== 'raster_edit' && (
            <div className="flex flex-wrap items-center gap-1">
              {([
                { id: 'vector_2d', label: 'Vẽ hình 2D', icon: PenTool },
                { id: 'geometry_3d', label: 'Hình học 3D', icon: Box },
                { id: 'graph', label: 'Đồ thị & BBT', icon: LineChart },
                { id: 'chemistry_2d', label: 'Cấu tạo Hóa học', icon: FlaskConical },
                { id: 'library', label: 'Thư viện hình', icon: FolderOpen },
              ] as Array<{ id: DrawingWorkspaceMode; label: string; icon: React.ComponentType<{ className?: string }> }>).map(
                (tab) => {
                  const Icon = tab.icon;
                  const active = mode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMode(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14.5px] font-semibold transition-colors ${
                        active
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800/60 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                }
              )}
            </div>
          )}

          {mode === 'raster_edit' && (
            <div className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-blue-300">
              <ImageIcon className="w-4 h-4" />
              <span>Chỉnh sửa hình ảnh tải lên (PNG/JPG/WebP)</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFullscreen((f) => !f)}
          title={fullscreen ? 'Thu gọn khỏi toàn màn hình' : 'Mở rộng toàn màn hình'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[14px] font-medium border border-slate-700"
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          <span>{fullscreen ? 'Thu gọn' : 'Toàn màn hình'}</span>
        </button>
      </div>

      {/* Studio Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === 'vector_2d' && (
          <VectorCanvasStudio
            initialScene={
              studioSeed.vectorScene ||
              (editingFigure?.kind === 'vector_2d' ? (editingFigure.sourceData as DiagramScene) : undefined)
            }
            initialSubject={studioSeed.subject || defaultSubject}
            initialTitle={studioSeed.title || editingFigure?.title || 'Hình vẽ 2D'}
            initialCaption={editingFigure?.caption || ''}
            isEditingExisting={isEditing}
            onCommit={({ scene, svgMarkup, pngDataUrl, title, caption, subject }) =>
              onCommitFigure(
                buildAsset({ kind: 'vector_2d', subject, title, caption, svgMarkup, pngDataUrl, sourceData: scene }),
                isEditing
              )
            }
            onSaveToLibrary={({ name, subject, topic, group, scene }) =>
              onSaveCustomTemplate({
                id: `figtpl_${Date.now().toString(36)}`,
                name,
                subject,
                grade: '11',
                topic,
                group,
                kind: 'vector_2d',
                isBuiltIn: false,
                sourceData: scene,
                createdAt: Date.now(),
              })
            }
            onCancel={onClose}
          />
        )}

        {mode === 'geometry_3d' && (
          <Geometry3DStudio
            initialState={
              studioSeed.geo3dState ||
              (editingFigure?.kind === 'geometry_3d' ? (editingFigure.sourceData as Geometry3DState) : undefined)
            }
            initialTitle={studioSeed.title || editingFigure?.title}
            initialCaption={editingFigure?.caption || ''}
            isEditingExisting={isEditing}
            onCommit={({ state, svgMarkup, pngDataUrl, title, caption }) =>
              onCommitFigure(
                buildAsset({ kind: 'geometry_3d', subject: 'math', title, caption, svgMarkup, pngDataUrl, sourceData: state }),
                isEditing
              )
            }
            onSaveToLibrary={({ name, state }) =>
              onSaveCustomTemplate({
                id: `figtpl_${Date.now().toString(36)}`,
                name,
                subject: 'math',
                grade: '11',
                topic: 'Hình học không gian 3D',
                group: 'Hình cá nhân',
                kind: 'geometry_3d',
                isBuiltIn: false,
                sourceData: state,
                createdAt: Date.now(),
              })
            }
            onCancel={onClose}
          />
        )}

        {mode === 'graph' && (
          <FunctionGraphStudio
            initialState={
              studioSeed.graphState ||
              (editingFigure?.kind === 'graph' ? (editingFigure.sourceData as GraphPlotState) : undefined)
            }
            initialTitle={studioSeed.title || editingFigure?.title || 'Đồ thị hàm số'}
            initialCaption={editingFigure?.caption || ''}
            isEditingExisting={isEditing}
            onCommit={({ state, svgMarkup, pngDataUrl, title, caption }) =>
              onCommitFigure(
                buildAsset({ kind: 'graph', subject: 'math', title, caption, svgMarkup, pngDataUrl, sourceData: state }),
                isEditing
              )
            }
            onSaveToLibrary={({ name, state }) =>
              onSaveCustomTemplate({
                id: `figtpl_${Date.now().toString(36)}`,
                name,
                subject: 'math',
                grade: '12',
                topic: 'Đồ thị & Bảng biến thiên',
                group: 'Hình cá nhân',
                kind: 'graph',
                isBuiltIn: false,
                sourceData: state,
                createdAt: Date.now(),
              })
            }
            onCancel={onClose}
          />
        )}

        {mode === 'chemistry_2d' && (
          <ChemStructureStudio
            initialState={
              studioSeed.chemState ||
              (editingFigure?.kind === 'chemistry_2d' ? (editingFigure.sourceData as ChemStructureState) : undefined)
            }
            initialTitle={studioSeed.title || editingFigure?.title || 'Công thức cấu tạo Hóa học'}
            initialCaption={editingFigure?.caption || ''}
            isEditingExisting={isEditing}
            onCommit={({ state, svgMarkup, pngDataUrl, title, caption }) =>
              onCommitFigure(
                buildAsset({ kind: 'chemistry_2d', subject: 'chemistry', title, caption, svgMarkup, pngDataUrl, sourceData: state }),
                isEditing
              )
            }
            onSaveToLibrary={({ name, state }) =>
              onSaveCustomTemplate({
                id: `figtpl_${Date.now().toString(36)}`,
                name,
                subject: 'chemistry',
                grade: '11',
                topic: 'Hóa học Hữu cơ',
                group: 'Hình cá nhân',
                kind: 'chemistry_2d',
                isBuiltIn: false,
                sourceData: state,
                createdAt: Date.now(),
              })
            }
            onCancel={onClose}
          />
        )}

        {mode === 'library' && (
          <FigureLibraryBrowser
            activeSubjectMode={activeSubjectMode}
            customTemplates={customTemplates}
            favoriteIds={favoriteIds}
            recentEntries={recentEntries}
            onInsertTemplate={handleInsertLibraryTemplate}
            onEditTemplateInStudio={handleEditLibraryTemplate}
            onToggleFavorite={onToggleFavoriteTemplate}
            onDeleteCustomTemplate={onDeleteCustomTemplate}
          />
        )}

        {mode === 'raster_edit' && editingFigure && (
          <RasterImageEditor
            figure={editingFigure}
            onCommit={(updated) => onCommitFigure(updated, true)}
            onCancel={onClose}
          />
        )}
      </div>
    </section>
  );
};
export default DrawingWorkspace;
