import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCheck,
  Copy,
  Edit3,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import {
  DocumentBlock,
  FormulaSegment,
  FormulaSubject,
  InlineSegment,
  ParagraphBlock,
  ProcessedDocument,
  TableBlock,
} from '../engine/types';
import { buildSelectionExportPair } from '../engine/clipboardExport';
import { ExamHeaderConfig, ExamStyleSettings, hasAnyHeaderContent } from '../engine/examTools';

interface NormalizedDocumentViewProps {
  document: ProcessedDocument | null;
  compareMode: boolean;
  selectedFormulaId: string | null;
  selectedParagraphId: string | null;
  contentRef?: React.RefObject<HTMLDivElement | null>;
  examStyle?: ExamStyleSettings;
  examHeader?: ExamHeaderConfig;
  zoomPercent?: number;
  onSelectFormula: (formula: FormulaSegment, openEditor: boolean) => void;
  onSelectParagraph: (para: ParagraphBlock) => void;
  onCopyParagraph: (para: ParagraphBlock) => void;
  onAcceptFormula: (formulaId: string) => void;
  onRejectFormula: (formulaId: string) => void;
  onChangeFormulaSubject?: (formulaId: string, subject: FormulaSubject) => void;
  onAcceptAllSafe: () => void;
  onRestoreAllOriginal: () => void;
  onNotify?: (message: string, tone?: 'info' | 'success' | 'warning') => void;
}

function getSubjectLabel(subject: FormulaSubject): string {
  switch (subject) {
    case 'physics':
      return 'Vật lí';
    case 'chemistry':
      return 'Hóa học';
    default:
      return 'Toán học';
  }
}

function collectAllFormulas(doc: ProcessedDocument): FormulaSegment[] {
  const list: FormulaSegment[] = [];
  const pushFrom = (segs: InlineSegment[]) => {
    for (const s of segs) {
      if (s.type === 'formula') list.push(s);
    }
  };
  for (const b of doc.blocks) {
    if (b.type === 'paragraph') {
      pushFrom(b.segments);
    } else {
      for (const row of b.rows) {
        for (const cell of row) {
          for (const p of cell.paragraphs) {
            pushFrom(p.segments);
          }
        }
      }
    }
  }
  return list;
}

function getFormulaVisualStyle(formula: FormulaSegment, isSelected: boolean, compareMode: boolean): string {
  const base = formula.displayMode ? 'mathfix-formula-display' : 'mathfix-formula-inline';
  const ring = isSelected ? 'ring-2 ring-[#0B4F8A] bg-sky-50/70' : '';

  if (formula.status === 'unrecoverable') {
    return `${base} ${ring} bg-red-50/80 border border-red-300 cursor-pointer hover:bg-red-100/70`;
  }
  if (formula.status === 'needs_review') {
    return `${base} ${ring} bg-amber-50/85 border border-amber-300 cursor-pointer hover:bg-amber-100/75`;
  }
  if (formula.status === 'auto_fixed') {
    if (compareMode) {
      return `${base} ${ring} bg-emerald-50/80 border border-emerald-300 cursor-pointer hover:bg-emerald-100/70`;
    }
    return `${base} ${ring} border border-transparent hover:border-emerald-300 hover:bg-emerald-50/50 cursor-pointer`;
  }
  return `${base} ${ring} border border-transparent hover:border-slate-300 hover:bg-slate-100/70 cursor-pointer`;
}

function getStatusLabel(status: FormulaSegment['status']): string {
  switch (status) {
    case 'valid':
      return 'Hợp lệ';
    case 'auto_fixed':
      return 'Đã sửa tự động';
    case 'needs_review':
      return 'Cần xác nhận';
    case 'unrecoverable':
      return 'Chưa xử lý được';
  }
}

export const NormalizedDocumentView: React.FC<NormalizedDocumentViewProps> = ({
  document,
  compareMode,
  selectedFormulaId,
  selectedParagraphId,
  contentRef,
  examStyle,
  examHeader,
  zoomPercent = 100,
  onSelectFormula,
  onSelectParagraph,
  onCopyParagraph,
  onAcceptFormula,
  onRejectFormula,
  onChangeFormulaSubject,
  onAcceptAllSafe,
  onRestoreAllOriginal,
  onNotify,
}) => {
  const allFormulas = useMemo(
    () => (document ? collectAllFormulas(document) : []),
    [document]
  );

  const formulaMap = useMemo(() => {
    const map = new Map<string, FormulaSegment>();
    for (const f of allFormulas) map.set(f.id, f);
    return map;
  }, [allFormulas]);

  if (!document || document.blocks.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-base font-semibold text-slate-800">
          Chưa có nội dung được chuyển đổi
        </p>
        <p className="mt-1.5 max-w-md text-[15px] text-slate-500">
          Dán công thức, đoạn văn hoặc đề kiểm tra vào khung <strong>Văn bản gốc</strong> bên trái (hoặc chọn một <em>Ví dụ thực hành</em>), sau đó nhấn <strong>Chuyển đổi</strong>.
        </p>
      </div>
    );
  }

  const changedOrFlagged = allFormulas.filter(
    (f) => f.status !== 'valid' || f.originalLatex !== f.activeLatex
  );
  const safePendingCount = allFormulas.filter((f) => f.status === 'auto_fixed').length;

  // Handle native Ctrl+C / Cmd+C on mouse-selected content: write rich HTML/MathML + plain text fallback
  const handleNativeCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const container = contentRef?.current || e.currentTarget;
    const selection = window.getSelection();
    const pair = buildSelectionExportPair(selection, container, formulaMap);
    if (!pair) return;

    e.preventDefault();
    e.clipboardData.setData('text/html', pair.html);
    e.clipboardData.setData('text/plain', pair.plain);
    onNotify?.(
      'Đã sao chép vùng bôi đen (Office OMML + MathML kèm văn bản dự phòng). Nếu phiên bản Word không tự nhận Equation qua clipboard, hãy dùng "Xuất Word (.docx)".',
      'success'
    );
  };

  const renderFormulaNode = (seg: FormulaSegment) => {
    const isSelected = seg.id === selectedFormulaId;
    const cls = getFormulaVisualStyle(seg, isSelected, compareMode);
    const subjLabel = getSubjectLabel(seg.subject);
    const titleHint =
      seg.notes.length > 0
        ? `[${subjLabel}] ${getStatusLabel(seg.status)}: ${seg.notes.map((n) => n.message).join('; ')} — Nhấp để chỉnh sửa bằng MathLive`
        : `[${subjLabel}] ${getStatusLabel(seg.status)} — Nhấp để chỉnh sửa bằng MathLive`;

    // Complex 2D structural chemistry diagram (explicitly marked non-OMML)
    if (seg.ommlCompatible === false && seg.subject === 'chemistry') {
      return (
        <div
          key={seg.id}
          data-formula-id={seg.id}
          className="my-2 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-left"
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>Công thức cấu tạo 2D/vòng (Hóa học) — không tương thích Word Equation OMML tuyến tính</span>
          </div>
          <pre className="overflow-x-auto font-mono text-sm leading-snug text-slate-900 whitespace-pre">
            {seg.activeLatex || seg.raw}
          </pre>
        </div>
      );
    }

    return (
      <span
        key={seg.id}
        data-formula-id={seg.id}
        role="button"
        tabIndex={0}
        title={titleHint}
        onClick={(e) => {
          // Do not open editor if user was dragging mouse to highlight text/formulas
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
            return;
          }
          e.stopPropagation();
          onSelectFormula(seg, true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectFormula(seg, true);
          }
        }}
        className={cls}
      >
        {seg.validated && seg.svg ? (
          <span
            className="mathfix-svg-host"
            dangerouslySetInnerHTML={{ __html: seg.svg }}
          />
        ) : (
          <span className="inline-flex items-center gap-1.5 font-mono text-sm text-red-700">
            <XCircle className="h-4 w-4 shrink-0 no-print" aria-hidden="true" />
            <span>{seg.activeLatex || seg.raw}</span>
          </span>
        )}
        {seg.status === 'needs_review' && (
          <span
            className="no-print ml-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-amber-800"
            aria-label="Cần giáo viên xác nhận"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </span>
        )}
      </span>
    );
  };

  const renderParagraph = (para: ParagraphBlock, inTable = false) => {
    if (para.segments.length === 0) {
      return <div key={para.id} className="h-3" aria-hidden="true" />;
    }

    const isSelectedPara = !inTable && para.id === selectedParagraphId;

    return (
      <div
        key={para.id}
        onClick={() => !inTable && onSelectParagraph(para)}
        className={`doc-block group relative rounded-lg transition-colors ${
          inTable
            ? 'py-1'
            : `px-3 py-2 -mx-3 ${
                isSelectedPara ? 'bg-sky-50/70 ring-1 ring-sky-200' : 'hover:bg-slate-50/80'
              }`
        }`}
      >
        <div
          className={`text-[1em] leading-[2.15] text-slate-900 break-words ${
            para.isHeading ? 'font-semibold text-slate-950 tracking-[-0.01em]' : ''
          }`}
        >
          {para.segments.map((seg) => {
            if (seg.type === 'text') {
              // Bold leading question labels cleanly while keeping exact original text
              const lead = seg.text.match(
                /^(\s*(?:Câu\s+\d+[.:]|Bài\s+\d+[.:]|Phần\s+[IVX0-9]+[.:]?|[A-D]\.|[a-d]\)))([\s\S]*)$/
              );
              if (lead && !para.isHeading) {
                return (
                  <React.Fragment key={seg.id}>
                    <strong className="font-semibold text-slate-950">{lead[1]}</strong>
                    {lead[2]}
                  </React.Fragment>
                );
              }
              return <React.Fragment key={seg.id}>{seg.text}</React.Fragment>;
            }
            return renderFormulaNode(seg);
          })}
        </div>

        {!inTable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectParagraph(para);
              onCopyParagraph(para);
            }}
            title="Sao chép đoạn này (HTML/MathML kèm văn bản dự phòng)"
            className="no-print absolute right-2 top-2 opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-xs hover:border-[#0B4F8A] hover:text-[#0B4F8A] transition-opacity cursor-pointer"
          >
            <Copy className="h-3 w-3" />
            <span>Chép đoạn</span>
          </button>
        )}
      </div>
    );
  };

  const renderTable = (table: TableBlock) => (
    <div key={table.id} className="doc-block my-4 overflow-x-auto">
      <table className="w-full border-collapse text-[15px] text-slate-900">
        <tbody>
          {table.rows.map((row, rIdx) => (
            <tr key={`${table.id}-r-${rIdx}`} className={rIdx === 0 ? 'bg-slate-50 font-medium' : 'bg-white'}>
              {row.map((cell) => (
                <td key={cell.id} className="border border-slate-300 px-3 py-2.5 align-middle">
                  {cell.paragraphs.map((p) => renderParagraph(p, true))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Document-level warnings (e.g. PDF structure / scanned PDF notice) */}
      {document.warnings.length > 0 && (
        <div className="no-print rounded-lg border border-amber-200 bg-amber-50/75 px-4 py-3 text-sm text-amber-900 space-y-1">
          {document.warnings.map((w, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Compare / Verification Panel (Section 12) */}
      {compareMode && (
        <div className="no-print rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                Đối chiếu trước và sau ({changedOrFlagged.length} công thức có thay đổi hoặc cần kiểm tra)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Các thay đổi mơ hồ không bao giờ được tự động chấp nhận. Thầy cô có thể chấp nhận, từ chối hoặc mở MathLive để chỉnh sửa.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAcceptAllSafe}
                disabled={safePendingCount === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                <CheckCheck className="h-4 w-4" />
                Chấp nhận thay đổi an toàn ({safePendingCount})
              </button>
              <button
                type="button"
                onClick={onRestoreAllOriginal}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Khôi phục bản gốc
              </button>
            </div>
          </div>

          {changedOrFlagged.length === 0 ? (
            <p className="text-sm text-slate-600">
              Tất cả công thức hiện đều hợp lệ và không có thay đổi nào đang chờ đối chiếu.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto mathfix-scroll divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {changedOrFlagged.map((f, idx) => (
                <div key={f.id} className="p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span className="font-mono text-slate-500">#{idx + 1}</span>
                      <span aria-hidden="true">·</span>
                      {onChangeFormulaSubject ? (
                        <select
                          aria-label={`Chọn môn cho công thức #${idx + 1}`}
                          value={f.subject}
                          onChange={(e) => onChangeFormulaSubject(f.id, e.target.value as FormulaSubject)}
                          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-800 hover:border-[#0B4F8A] focus:outline-none cursor-pointer"
                        >
                          <option value="math">Toán học</option>
                          <option value="physics">Vật lí</option>
                          <option value="chemistry">Hóa học</option>
                        </select>
                      ) : (
                        <span className="text-slate-700">{getSubjectLabel(f.subject)}</span>
                      )}
                      {f.subjectConfidence === 'low' && !f.subjectManualOverride && (
                        <span className="text-amber-700">(chưa chắc chắn)</span>
                      )}
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          f.status === 'auto_fixed'
                            ? 'text-emerald-700'
                            : f.status === 'needs_review'
                            ? 'text-amber-700'
                            : f.status === 'unrecoverable'
                            ? 'text-red-700'
                            : 'text-slate-700'
                        }
                      >
                        {getStatusLabel(f.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {f.validated && f.status !== 'valid' && (
                        <button
                          type="button"
                          onClick={() => onAcceptFormula(f.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Chấp nhận
                        </button>
                      )}
                      {f.activeLatex !== f.originalLatex && (
                        <button
                          type="button"
                          onClick={() => onRejectFormula(f.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Từ chối
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectFormula(f, true)}
                        className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-medium text-[#0B4F8A] hover:bg-sky-100 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Sửa MathLive
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-sm">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-xs text-slate-500 mb-1">Trước (gốc)</div>
                      <div className="font-mono text-xs sm:text-sm text-slate-800 break-all">
                        {f.originalLatex}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                      <div className="text-xs text-slate-500 mb-1">Sau (chuẩn hóa)</div>
                      <div className="overflow-x-auto py-0.5">
                        {f.validated && f.svg ? (
                          <div
                            className="mathfix-svg-host"
                            dangerouslySetInnerHTML={{ __html: f.svg }}
                          />
                        ) : (
                          <span className="font-mono text-xs text-red-700">{f.errorMessage || f.activeLatex}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {f.notes.length > 0 && (
                    <ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5">
                      {f.notes.map((n, nIdx) => (
                        <li key={nIdx}>{n.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Normalized Document Surface (supports mouse drag selection + Ctrl/Cmd+C rich HTML/MathML copy & PDF print) */}
      <div
        ref={contentRef}
        onCopy={handleNativeCopy}
        style={{
          fontSize: `${Math.round(16 * (zoomPercent / 100))}px`,
          fontFamily: examStyle
            ? `"${examStyle.fontFamily}", "Plus Jakarta Sans", serif`
            : undefined,
        }}
        className="print-only-document select-text space-y-2 pb-6"
      >
        {examHeader && hasAnyHeaderContent(examHeader) && (
          <div className="mb-4 grid grid-cols-12 gap-4 border-b border-slate-700 pb-3 text-center text-[15px] text-slate-950">
            <div className="col-span-5 space-y-0.5">
              {examHeader.schoolName.trim() && (
                <div className="font-bold uppercase">{examHeader.schoolName.trim()}</div>
              )}
              {examHeader.department.trim() && (
                <div className="font-bold">{examHeader.department.trim()}</div>
              )}
              {examHeader.schoolYear.trim() && (
                <div>Năm học: {examHeader.schoolYear.trim()}</div>
              )}
            </div>
            <div className="col-span-7 space-y-0.5">
              {examHeader.examTitle.trim() && (
                <div className="font-bold uppercase">{examHeader.examTitle.trim()}</div>
              )}
              {(examHeader.subject.trim() || examHeader.grade.trim()) && (
                <div className="font-bold">
                  {[
                    examHeader.subject.trim() ? `Môn: ${examHeader.subject.trim()}` : '',
                    examHeader.grade.trim() ? `Khối: ${examHeader.grade.trim()}` : '',
                  ]
                    .filter(Boolean)
                    .join(' – ')}
                </div>
              )}
              {examHeader.duration.trim() && (
                <div className="italic">Thời gian làm bài: {examHeader.duration.trim()}</div>
              )}
              {examHeader.examCode.trim() && (
                <div className="font-bold">Mã đề: {examHeader.examCode.trim()}</div>
              )}
            </div>
          </div>
        )}
        {document.blocks.map((block: DocumentBlock) =>
          block.type === 'paragraph' ? renderParagraph(block) : renderTable(block)
        )}
      </div>
    </div>
  );
};
