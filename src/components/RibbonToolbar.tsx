import React, { useState } from 'react';
import {
  AlignLeft,
  Atom,
  BookMarked,
  BookOpen,
  BookmarkCheck,
  Box,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  ClipboardPaste,
  Clock,
  Code2,
  Copy,
  Download,
  Edit3,
  FileCode2,
  FileDown,
  FileImage,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  FolderOpen,
  Hash,
  Heading,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  LineChart,
  ListChecks,
  ListOrdered,
  Maximize2,
  Minimize2,
  PenTool,
  PlusSquare,
  Printer,
  Redo2,
  RefreshCw,
  Sigma,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Type,
  Undo2,
  Upload,
  Wand2,
  Zap,
} from 'lucide-react';
import { FormulaSubject, SubjectMode } from '../engine/types';
import { ExportFormatId } from '../engine/formatConverter';
import { OptionLayoutColumns } from '../engine/examTools';

export type RibbonTabId =
  | 'clipboard'
  | 'convert'
  | 'compose'
  | 'drawing'
  | 'library'
  | 'normalize'
  | 'exam_tools'
  | 'export'
  | 'utilities';

interface RibbonToolbarProps {
  activeTab: RibbonTabId;
  onChangeTab: (tab: RibbonTabId) => void;
  subjectMode: SubjectMode;
  onChangeSubjectMode: (mode: SubjectMode) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasContent: boolean;
  hasProcessedDoc: boolean;
  hasSelectedFormula: boolean;
  hasSelectedFigure: boolean;
  isProcessing: boolean;
  isFullscreen: boolean;
  // Group 1: Clipboard & Paste
  onPaste: () => void;
  onUploadFile: () => void;
  onConvertNow: () => void;
  onCopyFormula: () => void;
  onCopySelection: () => void;
  onCopyAll: () => void;
  onCopyForWord: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  // Group 2: Format Conversion
  onOpenFormatConverter: (format: ExportFormatId) => void;
  // Group 3: Compose Formula (MathLive Studio)
  onCreateNewFormula: (subject?: FormulaSubject) => void;
  onEditSelectedFormula: () => void;
  onInsertFormulaIntoText: () => void;
  // Group 3b: Drawing & Figures (Math – Physics – Chemistry)
  onOpenDrawingMode: (mode: 'vector_2d' | 'geometry_3d' | 'graph' | 'chemistry_2d' | 'library') => void;
  onEditSelectedFigure: () => void;
  onUploadImageFile: () => void;
  onPasteImageFromClipboard: () => void;
  onExportSelectedFigureSvg: () => void;
  onExportSelectedFigurePng: () => void;
  // Group 4: Formula Library
  onOpenLibrary: (tab: 'all' | 'personal' | 'favorites' | 'recent') => void;
  onImportLibrary: () => void;
  onExportLibrary: () => void;
  // Group 5: Exam Normalization
  onOpenExamNormalizer: (focusSection?: 'formulas' | 'typography' | 'structure') => void;
  onQuickNormalizeAll: () => void;
  // Group 6: Exam Tools
  onOpenExamTools: (focusSection?: 'numbering' | 'layout' | 'header') => void;
  onRenumberAll: () => void;
  onInsertQuestionTemplate: (kind: 'mcq' | 'true_false' | 'short_answer' | 'essay') => void;
  onAlignMcqOptions: (cols: OptionLayoutColumns) => void;
  // Group 7: Document Export
  onExportWord: () => void;
  onExportPdf: () => void;
  onExportSingleFormulaDocx: () => void;
  onOpenPrintPreview: () => void;
  onPrint: () => void;
  // Group 8: Utilities
  onOpenGuide: () => void;
  onToggleSamples: () => void;
  onToggleFullscreen: () => void;
  onTriggerPwaInstall: () => void;
  isPwaInstalled: boolean;
}

const RIBBON_TABS: Array<{ id: RibbonTabId; label: string }> = [
  { id: 'clipboard', label: 'Sao chép – Dán' },
  { id: 'convert', label: 'Chuyển đổi chuẩn hóa' },
  { id: 'compose', label: 'Soạn công thức' },
  { id: 'drawing', label: 'Vẽ hình & Chèn hình' },
  { id: 'library', label: 'Thao tác thư viện' },
  { id: 'normalize', label: 'Chuẩn hóa đề thi' },
  { id: 'exam_tools', label: 'Công cụ đề thi' },
  { id: 'export', label: 'Xuất tài liệu' },
  { id: 'utilities', label: 'Tiện ích' },
];

const SUBJECT_MODES: Array<{ id: SubjectMode; label: string }> = [
  { id: 'auto', label: 'Tự động' },
  { id: 'math', label: 'Toán học' },
  { id: 'physics', label: 'Vật lí' },
  { id: 'chemistry', label: 'Hóa học' },
];

interface RibbonBtnProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  title?: string;
}

const RibbonBtn: React.FC<RibbonBtnProps> = ({
  icon,
  label,
  onClick,
  disabled,
  primary,
  danger,
  title,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title || label}
    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[15px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
      primary
        ? 'bg-[#0B4F8A] text-white hover:bg-[#093F6F]'
        : danger
        ? 'border border-slate-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50'
        : 'border border-slate-200 bg-white text-slate-800 hover:border-[#0B4F8A] hover:bg-sky-50/50 hover:text-[#0B4F8A]'
    }`}
  >
    <span className="shrink-0" aria-hidden="true">
      {icon}
    </span>
    <span>{label}</span>
  </button>
);

export const RibbonToolbar: React.FC<RibbonToolbarProps> = (props) => {
  const [mcqMenuOpen, setMcqMenuOpen] = useState(false);

  return (
    <div className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        {/* Top Row: 8 Ribbon Tabs + Subject Mode Switcher + Collapse Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-1.5">
          <div
            role="tablist"
            aria-label="Thanh công cụ Ribbon 8 nhóm"
            className="mathfix-scroll flex items-center gap-1 overflow-x-auto py-0.5"
          >
            {RIBBON_TABS.map((tab) => {
              const isActive = props.activeTab === tab.id && !props.collapsed;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  onClick={() => {
                    if (props.collapsed) props.onToggleCollapse();
                    props.onChangeTab(tab.id);
                  }}
                  className={`rounded-md px-3 py-1.5 text-[15px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#0B4F8A]/10 text-[#0B4F8A] font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Subject Auto-Detect / Manual Mode Selector (Section V) */}
            <div
              role="group"
              aria-label="Chế độ nhận diện môn học"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            >
              {SUBJECT_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => props.onChangeSubjectMode(m.id)}
                  className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    props.subjectMode === m.id
                      ? 'bg-[#0B4F8A] text-white'
                      : 'text-slate-700 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={props.onToggleCollapse}
              title={props.collapsed ? 'Mở rộng thanh Ribbon' : 'Thu gọn thanh Ribbon'}
              className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              aria-label={props.collapsed ? 'Mở rộng thanh công cụ' : 'Thu gọn thanh công cụ'}
            >
              {props.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Active Ribbon Panel Content (Compact single/wrap row, never blocks workspace) */}
        {!props.collapsed && (
          <div className="flex flex-wrap items-center gap-2 py-2.5">
            {props.activeTab === 'clipboard' && (
              <>
                <RibbonBtn icon={<ClipboardPaste className="h-4 w-4" />} label="Dán từ clipboard" onClick={props.onPaste} />
                <RibbonBtn icon={<Upload className="h-4 w-4" />} label="Tải tệp" onClick={props.onUploadFile} title="Tải tệp DOCX, PDF, TXT, HTML" />
                <RibbonBtn
                  icon={<RefreshCw className={`h-4 w-4 ${props.isProcessing ? 'animate-spin' : ''}`} />}
                  label="Chuyển đổi nhanh"
                  onClick={props.onConvertNow}
                  primary
                />
                <div className="h-6 w-px bg-slate-200 mx-0.5 hidden sm:block" aria-hidden="true" />
                <RibbonBtn
                  icon={<Copy className="h-4 w-4" />}
                  label="Sao chép công thức"
                  onClick={props.onCopyFormula}
                  disabled={!props.hasProcessedDoc}
                />
                <RibbonBtn
                  icon={<ClipboardCopy className="h-4 w-4" />}
                  label="Sao chép đoạn chọn"
                  onClick={props.onCopySelection}
                  disabled={!props.hasProcessedDoc}
                />
                <RibbonBtn
                  icon={<Copy className="h-4 w-4" />}
                  label="Sao chép tất cả"
                  onClick={props.onCopyAll}
                  disabled={!props.hasProcessedDoc}
                />
                <RibbonBtn
                  icon={<FileText className="h-4 w-4" />}
                  label="Sao chép cho Word"
                  onClick={props.onCopyForWord}
                  disabled={!props.hasProcessedDoc}
                  primary
                />
                <div className="h-6 w-px bg-slate-200 mx-0.5 hidden sm:block" aria-hidden="true" />
                <RibbonBtn icon={<Undo2 className="h-4 w-4" />} label="Hoàn tác" onClick={props.onUndo} disabled={!props.canUndo} title="Ctrl+Z / Cmd+Z" />
                <RibbonBtn icon={<Redo2 className="h-4 w-4" />} label="Làm lại" onClick={props.onRedo} disabled={!props.canRedo} title="Ctrl+Y / Cmd+Shift+Z" />
                <RibbonBtn icon={<Trash2 className="h-4 w-4" />} label="Xóa nội dung" onClick={props.onClear} disabled={!props.hasContent} danger />
              </>
            )}

            {props.activeTab === 'convert' && (
              <>
                <RibbonBtn
                  icon={<FileText className="h-4 w-4" />}
                  label="Word Equation (OMML)"
                  onClick={() => props.onOpenFormatConverter('omml')}
                  disabled={!props.hasProcessedDoc}
                  primary
                />
                <RibbonBtn
                  icon={<Code2 className="h-4 w-4" />}
                  label="MathML"
                  onClick={() => props.onOpenFormatConverter('mathml')}
                  disabled={!props.hasProcessedDoc}
                />
                <RibbonBtn
                  icon={<FileCode2 className="h-4 w-4" />}
                  label="LaTeX nội tuyến ($...$)"
                  onClick={() => props.onOpenFormatConverter('latex_inline')}
                  disabled={!props.hasProcessedDoc}
                />
                <RibbonBtn
                  icon={<FileCode2 className="h-4 w-4" />}
                  label="LaTeX độc lập ($$...$$)"
                  onClick={() => props.onOpenFormatConverter('latex_display')}
                  disabled={!props.hasProcessedDoc}
                />
                <RibbonBtn
                  icon={<Sigma className="h-4 w-4" />}
                  label="UnicodeMath"
                  onClick={() => props.onOpenFormatConverter('unicodemath')}
                  disabled={!props.hasProcessedDoc}
                />
                <RibbonBtn
                  icon={<FileImage className="h-4 w-4" />}
                  label="SVG"
                  onClick={() => props.onOpenFormatConverter('svg')}
                  disabled={!props.hasProcessedDoc}
                />
                <RibbonBtn
                  icon={<ImageIcon className="h-4 w-4" />}
                  label="PNG"
                  onClick={() => props.onOpenFormatConverter('png')}
                  disabled={!props.hasProcessedDoc}
                />
              </>
            )}

            {props.activeTab === 'compose' && (
              <>
                <RibbonBtn
                  icon={<FilePlus2 className="h-4 w-4" />}
                  label="Tạo công thức mới"
                  onClick={() => props.onCreateNewFormula('math')}
                  primary
                />
                <RibbonBtn
                  icon={<Edit3 className="h-4 w-4" />}
                  label="Chỉnh sửa công thức"
                  onClick={props.onEditSelectedFormula}
                  disabled={!props.hasSelectedFormula}
                />
                <RibbonBtn
                  icon={<PlusSquare className="h-4 w-4" />}
                  label="Chèn công thức vào văn bản"
                  onClick={props.onInsertFormulaIntoText}
                />
                <div className="h-6 w-px bg-slate-200 mx-0.5 hidden sm:block" aria-hidden="true" />
                <RibbonBtn
                  icon={<Sigma className="h-4 w-4" />}
                  label="Soạn công thức Toán học"
                  onClick={() => props.onCreateNewFormula('math')}
                />
                <RibbonBtn
                  icon={<Atom className="h-4 w-4" />}
                  label="Soạn công thức Vật lí"
                  onClick={() => props.onCreateNewFormula('physics')}
                />
                <RibbonBtn
                  icon={<FlaskConical className="h-4 w-4" />}
                  label="Soạn công thức Hóa học"
                  onClick={() => props.onCreateNewFormula('chemistry')}
                />
              </>
            )}

            {props.activeTab === 'drawing' && (
              <>
                <RibbonBtn
                  icon={<PenTool className="h-4 w-4" />}
                  label="Vẽ hình mới"
                  onClick={() => props.onOpenDrawingMode('vector_2d')}
                  title="Mở bảng vẽ vector 2D cho Toán học, Vật lí và Hóa học"
                  primary
                />
                <RibbonBtn
                  icon={<FolderOpen className="h-4 w-4" />}
                  label="Thư viện hình"
                  onClick={() => props.onOpenDrawingMode('library')}
                  title="Mở thư viện hình mẫu chuẩn khoa học (Toán – Vật lí – Hóa học)"
                />
                <RibbonBtn
                  icon={<Edit3 className="h-4 w-4" />}
                  label="Chỉnh sửa hình"
                  onClick={props.onEditSelectedFigure}
                  disabled={!props.hasSelectedFigure}
                  title="Chỉnh sửa lại hình vẽ đang chọn trong tài liệu"
                />
                <div className="h-6 w-px bg-slate-200 mx-0.5 hidden sm:block" aria-hidden="true" />
                <RibbonBtn
                  icon={<Upload className="h-4 w-4" />}
                  label="Chèn hình từ máy"
                  onClick={props.onUploadImageFile}
                  title="Chèn ảnh PNG, JPG, WebP hoặc SVG an toàn từ máy tính vào vị trí con trỏ"
                />
                <RibbonBtn
                  icon={<ClipboardPaste className="h-4 w-4" />}
                  label="Dán hình từ clipboard"
                  onClick={props.onPasteImageFromClipboard}
                  title="Dán hình ảnh trực tiếp từ clipboard vào câu hỏi"
                />
                <div className="h-6 w-px bg-slate-200 mx-0.5 hidden sm:block" aria-hidden="true" />
                <RibbonBtn
                  icon={<LineChart className="h-4 w-4" />}
                  label="Vẽ đồ thị hàm số"
                  onClick={() => props.onOpenDrawingMode('graph')}
                  title="Vẽ đồ thị hàm số, bảng biến thiên, bảng xét dấu và bảng giá trị"
                />
                <RibbonBtn
                  icon={<Box className="h-4 w-4" />}
                  label="Hình học không gian 3D"
                  onClick={() => props.onOpenDrawingMode('geometry_3d')}
                  title="Vẽ 14 khối hình học không gian 3D xoay góc nhìn tự do, tự động nét đứt khuất"
                />
                <RibbonBtn
                  icon={<FlaskConical className="h-4 w-4" />}
                  label="Công thức cấu tạo Hóa học"
                  onClick={() => props.onOpenDrawingMode('chemistry_2d')}
                  title="Vẽ công thức cấu tạo Hóa học 2D (vòng benzen, mạch thẳng/nhánh, công thức Lewis)"
                />
                <RibbonBtn
                  icon={<Zap className="h-4 w-4" />}
                  label="Mạch điện & Thí nghiệm"
                  onClick={() => props.onOpenDrawingMode('vector_2d')}
                  title="Vẽ sơ đồ mạch điện IEC, quang hình, cơ học Vật lí và dụng cụ thí nghiệm Hóa học"
                />
                <div className="h-6 w-px bg-slate-200 mx-0.5 hidden sm:block" aria-hidden="true" />
                <RibbonBtn
                  icon={<FileImage className="h-4 w-4" />}
                  label="Xuất hình SVG"
                  onClick={props.onExportSelectedFigureSvg}
                  disabled={!props.hasSelectedFigure}
                  title="Tải xuống hình vector đang chọn ở định dạng SVG sắc nét"
                />
                <RibbonBtn
                  icon={<ImageIcon className="h-4 w-4" />}
                  label="Xuất hình PNG"
                  onClick={props.onExportSelectedFigurePng}
                  disabled={!props.hasSelectedFigure}
                  title="Tải xuống hình đang chọn ở định dạng ảnh PNG độ phân giải cao"
                />
              </>
            )}

            {props.activeTab === 'library' && (
              <>
                <RibbonBtn
                  icon={<BookMarked className="h-4 w-4" />}
                  label="Thư viện công thức"
                  onClick={() => props.onOpenLibrary('all')}
                  primary
                />
                <RibbonBtn
                  icon={<BookmarkCheck className="h-4 w-4" />}
                  label="Công thức cá nhân"
                  onClick={() => props.onOpenLibrary('personal')}
                />
                <RibbonBtn
                  icon={<Star className="h-4 w-4" />}
                  label="Công thức yêu thích"
                  onClick={() => props.onOpenLibrary('favorites')}
                />
                <RibbonBtn
                  icon={<Clock className="h-4 w-4" />}
                  label="Sử dụng gần đây"
                  onClick={() => props.onOpenLibrary('recent')}
                />
                <div className="h-6 w-px bg-slate-200 mx-0.5 hidden sm:block" aria-hidden="true" />
                <RibbonBtn icon={<Upload className="h-4 w-4" />} label="Nhập thư viện" onClick={props.onImportLibrary} />
                <RibbonBtn icon={<Download className="h-4 w-4" />} label="Xuất thư viện" onClick={props.onExportLibrary} />
              </>
            )}

            {props.activeTab === 'normalize' && (
              <>
                <RibbonBtn
                  icon={<Wand2 className="h-4 w-4" />}
                  label="Chuẩn hóa toàn bộ tài liệu"
                  onClick={props.onQuickNormalizeAll}
                  disabled={!props.hasContent}
                  primary
                />
                <RibbonBtn
                  icon={<Sparkles className="h-4 w-4" />}
                  label="Chuẩn hóa công thức"
                  onClick={() => props.onOpenExamNormalizer('formulas')}
                />
                <RibbonBtn
                  icon={<Type className="h-4 w-4" />}
                  label="Phông chữ & Cỡ chữ"
                  onClick={() => props.onOpenExamNormalizer('typography')}
                />
                <RibbonBtn
                  icon={<SlidersHorizontal className="h-4 w-4" />}
                  label="Khoảng cách & Lề trang"
                  onClick={() => props.onOpenExamNormalizer('typography')}
                />
                <RibbonBtn
                  icon={<ListChecks className="h-4 w-4" />}
                  label="Chuẩn hóa câu hỏi"
                  onClick={() => props.onOpenExamNormalizer('structure')}
                />
                <RibbonBtn
                  icon={<AlignLeft className="h-4 w-4" />}
                  label="Chuẩn hóa phương án trả lời"
                  onClick={() => props.onOpenExamNormalizer('structure')}
                />
              </>
            )}

            {props.activeTab === 'exam_tools' && (
              <>
                <RibbonBtn
                  icon={<Hash className="h-4 w-4" />}
                  label="Đánh số câu"
                  onClick={() => props.onOpenExamTools('numbering')}
                  primary
                />
                <RibbonBtn
                  icon={<ListOrdered className="h-4 w-4" />}
                  label="Đánh số lại câu"
                  onClick={props.onRenumberAll}
                  disabled={!props.hasContent}
                />
                <div className="h-6 w-px bg-slate-200 mx-0.5 hidden sm:block" aria-hidden="true" />
                <RibbonBtn
                  icon={<CheckSquare className="h-4 w-4" />}
                  label="Định dạng trắc nghiệm"
                  onClick={() => props.onInsertQuestionTemplate('mcq')}
                />
                <RibbonBtn
                  icon={<ListChecks className="h-4 w-4" />}
                  label="Định dạng đúng/sai"
                  onClick={() => props.onInsertQuestionTemplate('true_false')}
                />
                <RibbonBtn
                  icon={<PenTool className="h-4 w-4" />}
                  label="Định dạng trả lời ngắn"
                  onClick={() => props.onInsertQuestionTemplate('short_answer')}
                />
                <RibbonBtn
                  icon={<FileText className="h-4 w-4" />}
                  label="Định dạng tự luận"
                  onClick={() => props.onInsertQuestionTemplate('essay')}
                />

                {/* Option alignment dropdown */}
                <div className="relative">
                  <RibbonBtn
                    icon={<Layers className="h-4 w-4" />}
                    label="Căn chỉnh phương án"
                    onClick={() => setMcqMenuOpen((v) => !v)}
                    disabled={!props.hasContent}
                  />
                  {mcqMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMcqMenuOpen(false)} />
                      <div className="absolute left-0 top-full z-40 mt-1 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                        {([1, 2, 4] as OptionLayoutColumns[]).map((cols) => (
                          <button
                            key={cols}
                            type="button"
                            onClick={() => {
                              setMcqMenuOpen(false);
                              props.onAlignMcqOptions(cols);
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[15px] text-slate-800 hover:bg-slate-50 cursor-pointer"
                          >
                            <span>
                              {cols === 1
                                ? '1 cột (mỗi phương án 1 dòng)'
                                : cols === 2
                                ? '2 cột (A–B / C–D)'
                                : '4 phương án trên 1 dòng'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <RibbonBtn
                  icon={<Heading className="h-4 w-4" />}
                  label="Tạo tiêu đề đề thi"
                  onClick={() => props.onOpenExamTools('header')}
                />
              </>
            )}

            {props.activeTab === 'export' && (
              <>
                <RibbonBtn
                  icon={<FileDown className="h-4 w-4" />}
                  label="Xuất Word (.docx)"
                  onClick={props.onExportWord}
                  disabled={!props.hasProcessedDoc}
                  primary
                />
                <RibbonBtn
                  icon={<Printer className="h-4 w-4" />}
                  label="Xuất PDF"
                  onClick={props.onExportPdf}
                  disabled={!props.hasProcessedDoc}
                />
                <RibbonBtn
                  icon={<FileSpreadsheet className="h-4 w-4" />}
                  label="Xuất công thức"
                  onClick={props.onExportSingleFormulaDocx}
                  disabled={!props.hasSelectedFormula}
                />
                <RibbonBtn
                  icon={<BookOpen className="h-4 w-4" />}
                  label="Xem trước khi in (A4)"
                  onClick={props.onOpenPrintPreview}
                  disabled={!props.hasProcessedDoc}
                />
                <RibbonBtn
                  icon={<Printer className="h-4 w-4" />}
                  label="In tài liệu"
                  onClick={props.onPrint}
                  disabled={!props.hasProcessedDoc}
                />
              </>
            )}

            {props.activeTab === 'utilities' && (
              <>
                <RibbonBtn
                  icon={<HelpCircle className="h-4 w-4" />}
                  label="Hướng dẫn sử dụng"
                  onClick={props.onOpenGuide}
                  primary
                />
                <RibbonBtn
                  icon={<FileText className="h-4 w-4" />}
                  label="Ví dụ thực hành"
                  onClick={props.onToggleSamples}
                />
                <RibbonBtn
                  icon={props.isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  label={props.isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
                  onClick={props.onToggleFullscreen}
                />
                {!props.isPwaInstalled && (
                  <RibbonBtn
                    icon={<Download className="h-4 w-4" />}
                    label="Cài ứng dụng dùng offline"
                    onClick={props.onTriggerPwaInstall}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
