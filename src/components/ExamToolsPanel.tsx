import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  FileText,
  Hash,
  Heading,
  Layers,
  ListChecks,
  PenTool,
  RotateCcw,
  SlidersHorizontal,
  Wand2,
  X,
} from 'lucide-react';
import {
  DEFAULT_EXAM_STYLE,
  DEFAULT_NORMALIZATION_OPTIONS,
  EMPTY_EXAM_HEADER,
  ExamHeaderConfig,
  ExamNormalizationOptions,
  ExamStyleSettings,
  normalizeExamText,
  OptionLayoutColumns,
} from '../engine/examTools';

export type ExamPanelMode = 'normalize' | 'tools';

interface ExamToolsPanelProps {
  open: boolean;
  mode: ExamPanelMode;
  onChangeMode: (mode: ExamPanelMode) => void;
  rawText: string;
  examStyle: ExamStyleSettings;
  onChangeExamStyle: (style: ExamStyleSettings) => void;
  examHeader: ExamHeaderConfig;
  onChangeExamHeader: (header: ExamHeaderConfig) => void;
  canRestorePreNorm: boolean;
  onApplyNormalization: (options: ExamNormalizationOptions) => void;
  onRestorePreNorm: () => void;
  onRenumberQuestions: (startNumber: number, fromCursor: boolean, prefix: 'Câu' | 'Bài') => void;
  onAlignMcqOptions: (cols: OptionLayoutColumns) => void;
  onFormatTrueFalse: () => void;
  onAppendShortAnswerBoxes: () => void;
  onAppendEssayLines: (lineCount: number) => void;
  onInsertTemplate: (kind: 'mcq' | 'true_false' | 'short_answer' | 'essay') => void;
  onOpenPrintPreview: () => void;
  onClose: () => void;
}

export const ExamToolsPanel: React.FC<ExamToolsPanelProps> = ({
  open,
  mode,
  onChangeMode,
  rawText,
  examStyle,
  onChangeExamStyle,
  examHeader,
  onChangeExamHeader,
  canRestorePreNorm,
  onApplyNormalization,
  onRestorePreNorm,
  onRenumberQuestions,
  onAlignMcqOptions,
  onFormatTrueFalse,
  onAppendShortAnswerBoxes,
  onAppendEssayLines,
  onInsertTemplate,
  onOpenPrintPreview,
  onClose,
}) => {
  const [normOptions, setNormOptions] = useState<ExamNormalizationOptions>(
    DEFAULT_NORMALIZATION_OPTIONS
  );
  const [startNum, setStartNum] = useState<number>(1);
  const [prefix, setPrefix] = useState<'Câu' | 'Bài'>('Câu');
  const [fromCursor, setFromCursor] = useState<boolean>(false);
  const [essayLines, setEssayLines] = useState<number>(3);

  const normPreview = useMemo(() => {
    if (!open || mode !== 'normalize' || !rawText.trim()) return null;
    return normalizeExamText(rawText, normOptions);
  }, [open, mode, rawText, normOptions]);

  if (!open) return null;

  const toggleNormOption = (key: keyof ExamNormalizationOptions) => {
    setNormOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateHeader = (field: keyof ExamHeaderConfig, value: string | boolean) => {
    onChangeExamHeader({ ...examHeader, [field]: value });
  };

  return (
    <section
      aria-label="Chuẩn hóa và công cụ đề kiểm tra"
      className="no-print mb-3 rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
            <button
              type="button"
              onClick={() => onChangeMode('normalize')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors cursor-pointer ${
                mode === 'normalize'
                  ? 'bg-[#0B4F8A] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Wand2 className="h-4 w-4" />
              <span>Chuẩn hóa đề thi & Trình bày A4</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('tools')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors cursor-pointer ${
                mode === 'tools'
                  ? 'bg-[#0B4F8A] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Hash className="h-4 w-4" />
              <span>Công cụ đề thi & Tiêu đề đề</span>
            </button>
          </div>
          <span className="text-xs text-slate-500">
            Cam kết giữ nguyên câu chữ, số liệu, đáp án và ý nghĩa công thức gốc.
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 cursor-pointer"
          aria-label="Đóng bảng công cụ đề thi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* MODE 1: CHUẨN HÓA ĐỀ THI & TRÌNH BÀY A4 (Section XVI) */}
      {mode === 'normalize' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
          {/* Selective normalization checkboxes */}
          <div className="lg:col-span-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="text-sm font-semibold text-slate-900">
              Chọn các mục chuẩn hóa tự động
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-800">
              {(
                [
                  ['normalizeFormulas', 'Chuẩn hóa toàn bộ công thức'],
                  ['normalizeSpaces', 'Xóa khoảng trắng thừa ngoài công thức'],
                  ['removeExtraBlankLines', 'Xóa dòng trống thừa liên tiếp'],
                  ['normalizeQuestionLabels', 'Chuẩn hóa nhãn Câu X. / Bài X.'],
                  ['normalizeOptions', 'Chuẩn hóa phương án A–D và a)–d)'],
                  ['normalizeTables', 'Chuẩn hóa căn chỉnh bảng biểu'],
                ] as Array<[keyof ExamNormalizationOptions, string]>
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 cursor-pointer hover:border-[#0B4F8A]/50"
                >
                  <input
                    type="checkbox"
                    checked={normOptions[key]}
                    onChange={() => toggleNormOption(key)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0B4F8A]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {normPreview && (
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                {normPreview.changesCount > 0 ? (
                  <>
                    <div className="font-semibold text-emerald-700">
                      Dự kiến chuẩn hóa {normPreview.changesCount} vị trí văn bản:
                    </div>
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {normPreview.summary.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <span>Cấu trúc văn bản đề thi hiện đã gọn gàng (vẫn sẽ chạy chuẩn hóa lại công thức).</span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onApplyNormalization(normOptions)}
                disabled={!rawText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B4F8A] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#093F6F] disabled:opacity-45 cursor-pointer"
              >
                <Wand2 className="h-4 w-4" />
                <span>Áp dụng chuẩn hóa</span>
              </button>

              {canRestorePreNorm && (
                <button
                  type="button"
                  onClick={onRestorePreNorm}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Khôi phục trước chuẩn hóa</span>
                </button>
              )}
            </div>
          </div>

          {/* Typography & A4 Margins */}
          <div className="lg:col-span-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <SlidersHorizontal className="h-4 w-4 text-[#0B4F8A]" />
                <span>Định dạng trang A4 (áp dụng cho Xem trước, In/PDF & Word DOCX)</span>
              </div>
              <button
                type="button"
                onClick={() => onChangeExamStyle(DEFAULT_EXAM_STYLE)}
                className="text-xs font-medium text-[#0B4F8A] hover:underline cursor-pointer"
              >
                Mặc định chuẩn Việt Nam
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-sm">
              <label className="flex flex-col gap-1 col-span-2 sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">Phông chữ tài liệu</span>
                <select
                  value={examStyle.fontFamily}
                  onChange={(e) =>
                    onChangeExamStyle({
                      ...examStyle,
                      fontFamily: e.target.value as ExamStyleSettings['fontFamily'],
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                >
                  <option value="Times New Roman">Times New Roman (Chuẩn Bộ GD)</option>
                  <option value="Cambria">Cambria</option>
                  <option value="Arial">Arial</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Cỡ chữ (pt)</span>
                <select
                  value={examStyle.fontSizePt}
                  onChange={(e) =>
                    onChangeExamStyle({
                      ...examStyle,
                      fontSizePt: Number(e.target.value) as ExamStyleSettings['fontSizePt'],
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                >
                  <option value={12}>12 pt</option>
                  <option value={13}>13 pt (Chuẩn)</option>
                  <option value={14}>14 pt</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Giãn dòng</span>
                <select
                  value={examStyle.lineHeight}
                  onChange={(e) =>
                    onChangeExamStyle({
                      ...examStyle,
                      lineHeight: Number(e.target.value) as ExamStyleSettings['lineHeight'],
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                >
                  <option value={1.15}>1.15</option>
                  <option value={1.3}>1.30 (Khuyên dùng)</option>
                  <option value={1.5}>1.50</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Lề trên (mm)</span>
                <input
                  type="number"
                  min={10}
                  max={40}
                  value={examStyle.marginTopMm}
                  onChange={(e) =>
                    onChangeExamStyle({ ...examStyle, marginTopMm: Number(e.target.value) || 20 })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Lề dưới (mm)</span>
                <input
                  type="number"
                  min={10}
                  max={40}
                  value={examStyle.marginBottomMm}
                  onChange={(e) =>
                    onChangeExamStyle({ ...examStyle, marginBottomMm: Number(e.target.value) || 20 })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Lề trái (mm)</span>
                <input
                  type="number"
                  min={10}
                  max={45}
                  value={examStyle.marginLeftMm}
                  onChange={(e) =>
                    onChangeExamStyle({ ...examStyle, marginLeftMm: Number(e.target.value) || 25 })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Lề phải (mm)</span>
                <input
                  type="number"
                  min={10}
                  max={40}
                  value={examStyle.marginRightMm}
                  onChange={(e) =>
                    onChangeExamStyle({ ...examStyle, marginRightMm: Number(e.target.value) || 20 })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                />
              </label>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Khoảng cách đoạn:</span>
                {([0, 4, 6] as const).map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => onChangeExamStyle({ ...examStyle, paragraphSpacingPt: pt })}
                    className={`rounded px-2 py-0.5 font-medium cursor-pointer ${
                      examStyle.paragraphSpacingPt === pt
                        ? 'bg-[#0B4F8A] text-white'
                        : 'border border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {pt} pt
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={onOpenPrintPreview}
                className="text-xs font-semibold text-[#0B4F8A] hover:underline cursor-pointer"
              >
                Xem trước trang A4 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: CÔNG CỤ ĐỀ THI & TIÊU ĐỀ ĐỀ KIỂM TRA (Section XVII) */}
      {mode === 'tools' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
          {/* Left column: Numbering + Layouts + Templates */}
          <div className="lg:col-span-6 space-y-3">
            {/* 1. Question Renumbering */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
              <div className="text-sm font-semibold text-slate-900">
                1. Đánh số / Đánh số lại câu hỏi (tự động giữ nguyên câu chùm Câu 1–3)
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <select
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value as 'Câu' | 'Bài')}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                >
                  <option value="Câu">Nhãn: Câu</option>
                  <option value="Bài">Nhãn: Bài</option>
                </select>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                  <span>Bắt đầu từ số:</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={startNum}
                    onChange={(e) => setStartNum(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
                  />
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fromCursor}
                    onChange={(e) => setFromCursor(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#0B4F8A]"
                  />
                  <span>Chỉ từ dòng con trỏ</span>
                </label>
                <button
                  type="button"
                  onClick={() => onRenumberQuestions(startNum, fromCursor, prefix)}
                  disabled={!rawText.trim()}
                  className="rounded-lg bg-[#0B4F8A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#093F6F] disabled:opacity-45 cursor-pointer"
                >
                  Đánh số ngay
                </button>
              </div>
            </div>

            {/* 2. MCQ / True-False / Short Answer / Essay formatting */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
              <div className="text-sm font-semibold text-slate-900">
                2. Căn chỉnh phương án & Bố cục dạng câu hỏi
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {([1, 2, 4] as OptionLayoutColumns[]).map((cols) => (
                  <button
                    key={cols}
                    type="button"
                    onClick={() => onAlignMcqOptions(cols)}
                    disabled={!rawText.trim()}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 cursor-pointer"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>
                      {cols === 1 ? 'A–D: 1 cột' : cols === 2 ? 'A–D: 2 cột' : 'A–D: 4 trên 1 dòng'}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onFormatTrueFalse}
                  disabled={!rawText.trim()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 cursor-pointer"
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  <span>Chuẩn hóa Đúng/Sai a)–d)</span>
                </button>
                <button
                  type="button"
                  onClick={onAppendShortAnswerBoxes}
                  disabled={!rawText.trim()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 cursor-pointer"
                >
                  <PenTool className="h-3.5 w-3.5" />
                  <span>Thêm dòng Trả lời ngắn</span>
                </button>
                <div className="inline-flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={essayLines}
                    onChange={(e) => setEssayLines(Math.max(1, Math.min(8, Number(e.target.value) || 3)))}
                    className="w-12 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                    aria-label="Số dòng kẻ tự luận"
                  />
                  <button
                    type="button"
                    onClick={() => onAppendEssayLines(essayLines)}
                    disabled={!rawText.trim()}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Thêm dòng làm bài tự luận</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2">
                <div className="mb-1.5 text-xs font-medium text-slate-600">
                  Chèn nhanh khung mẫu câu hỏi tại vị trí con trỏ:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onInsertTemplate('mcq')}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] cursor-pointer"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span>+ Câu Trắc nghiệm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onInsertTemplate('true_false')}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] cursor-pointer"
                  >
                    <ListChecks className="h-3.5 w-3.5" />
                    <span>+ Câu Đúng/Sai</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onInsertTemplate('short_answer')}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] cursor-pointer"
                  >
                    <PenTool className="h-3.5 w-3.5" />
                    <span>+ Câu Trả lời ngắn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onInsertTemplate('essay')}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>+ Bài Tự luận</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Exam Header Builder (Section XVII.6 — NO fake default school names!) */}
          <div className="lg:col-span-6 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Heading className="h-4 w-4 text-[#0B4F8A]" />
                <span>3. Tiêu đề đề kiểm tra (tùy chọn — giáo viên tự nhập)</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={examHeader.enabled}
                    onChange={(e) => updateHeader('enabled', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#0B4F8A]"
                  />
                  <span>Hiển thị & xuất kèm Word/PDF</span>
                </label>
                <button
                  type="button"
                  onClick={() => onChangeExamHeader(EMPTY_EXAM_HEADER)}
                  className="text-xs font-medium text-slate-500 hover:text-red-700 cursor-pointer"
                >
                  Xóa trắng
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <input
                type="text"
                value={examHeader.schoolName}
                onChange={(e) => {
                  updateHeader('schoolName', e.target.value);
                  if (!examHeader.enabled && e.target.value.trim()) updateHeader('enabled', true);
                }}
                placeholder="Tên trường (để trống nếu không dùng)"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
              />
              <input
                type="text"
                value={examHeader.department}
                onChange={(e) => updateHeader('department', e.target.value)}
                placeholder="Tổ chuyên môn"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
              />
              <input
                type="text"
                value={examHeader.examTitle}
                onChange={(e) => {
                  updateHeader('examTitle', e.target.value);
                  if (!examHeader.enabled && e.target.value.trim()) updateHeader('enabled', true);
                }}
                placeholder="Kỳ kiểm tra (vd: KIỂM TRA GIỮA HỌC KÌ II)"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm sm:col-span-2"
              />
              <input
                type="text"
                value={examHeader.subject}
                onChange={(e) => updateHeader('subject', e.target.value)}
                placeholder="Môn học (vd: Toán học / Vật lí / Hóa học)"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
              />
              <input
                type="text"
                value={examHeader.grade}
                onChange={(e) => updateHeader('grade', e.target.value)}
                placeholder="Khối lớp (vd: 12)"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
              />
              <input
                type="text"
                value={examHeader.duration}
                onChange={(e) => updateHeader('duration', e.target.value)}
                placeholder="Thời gian làm bài (vd: 90 phút)"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={examHeader.examCode}
                  onChange={(e) => updateHeader('examCode', e.target.value)}
                  placeholder="Mã đề"
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                />
                <input
                  type="text"
                  value={examHeader.schoolYear}
                  onChange={(e) => updateHeader('schoolYear', e.target.value)}
                  placeholder="Năm học"
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
