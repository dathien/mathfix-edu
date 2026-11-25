import React, { useMemo, useState } from 'react';
import { FileDown, Printer, X, ZoomIn, ZoomOut } from 'lucide-react';
import { FigureSegment, InlineSegment, ProcessedDocument } from '../engine/types';
import { FigureAsset } from '../engine/figureTypes';
import { sanitizeSvgMarkup } from '../engine/svgSanitizer';
import { ExamHeaderConfig, ExamStyleSettings, hasAnyHeaderContent } from '../engine/examTools';

interface PrintPreviewPanelProps {
  open: boolean;
  document: ProcessedDocument | null;
  figures?: Map<string, FigureAsset>;
  examStyle: ExamStyleSettings;
  examHeader: ExamHeaderConfig;
  onExportWord: () => void;
  onExportPdf: () => void;
  onPrint: () => void;
  onClose: () => void;
}

export const PrintPreviewPanel: React.FC<PrintPreviewPanelProps> = ({
  open,
  document,
  figures,
  examStyle,
  examHeader,
  onExportWord,
  onExportPdf,
  onPrint,
  onClose,
}) => {
  const [scale, setScale] = useState<number>(90);

  const figureNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!document) return map;
    let counter = 0;
    const visit = (segs: InlineSegment[]) => {
      for (const s of segs) {
        if (s.type === 'figure' && !map.has(s.figureId)) {
          counter += 1;
          map.set(s.figureId, counter);
        }
      }
    };
    for (const b of document.blocks) {
      if (b.type === 'paragraph') visit(b.segments);
      else {
        for (const r of b.rows) {
          for (const c of r) {
            for (const p of c.paragraphs) visit(p.segments);
          }
        }
      }
    }
    return map;
  }, [document]);

  const renderPrintFigure = (seg: FigureSegment, compact = false) => {
    const fig = figures?.get(seg.figureId);
    if (!fig) return null;
    const figNum = figureNumberMap.get(fig.id) ?? 1;
    const alignStyle =
      fig.align === 'left'
        ? 'items-start text-left'
        : fig.align === 'right'
        ? 'items-end text-right'
        : 'items-center text-center';
    const safeSvg =
      fig.kind !== 'raster_upload' && fig.svgMarkup ? sanitizeSvgMarkup(fig.svgMarkup) : '';
    const maxW = compact ? Math.min(fig.widthPx, 220) : Math.min(fig.widthPx, 540);
    const caption = fig.showNumber
      ? fig.caption?.trim()
        ? `Hình ${figNum}. ${fig.caption.trim()}`
        : `Hình ${figNum}.`
      : fig.caption?.trim() || '';

    return (
      <figure key={seg.id} className={`break-inside-avoid my-2 flex flex-col ${alignStyle}`}>
        <div style={{ width: `${maxW}px`, maxWidth: '100%' }}>
          {safeSvg ? (
            <div
              className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
              dangerouslySetInnerHTML={{ __html: safeSvg }}
            />
          ) : fig.pngDataUrl ? (
            <img src={fig.pngDataUrl} alt={caption || fig.title} className="w-full h-auto block" />
          ) : null}
          {caption && (
            <figcaption className="mt-1 text-[0.9em] italic text-slate-800">{caption}</figcaption>
          )}
        </div>
      </figure>
    );
  };

  if (!open) return null;

  const showHeader = hasAnyHeaderContent(examHeader);
  const subjectGradeLine = [
    examHeader.subject.trim() ? `Môn: ${examHeader.subject.trim()}` : '',
    examHeader.grade.trim() ? `Khối: ${examHeader.grade.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' – ');

  return (
    <section
      aria-label="Xem trước trang in khổ A4"
      className="no-print mb-3 rounded-xl border border-slate-200 bg-slate-100 shadow-xs overflow-hidden"
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">
            Xem trước khi in — Khổ giấy A4 ({examStyle.fontFamily}, {examStyle.fontSizePt}pt, giãn dòng {examStyle.lineHeight})
          </h2>
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(60, s - 10))}
              className="rounded p-1 hover:bg-white cursor-pointer"
              aria-label="Thu nhỏ bản xem trước"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[42px] text-center font-medium text-slate-700">{scale}%</span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(120, s + 10))}
              className="rounded p-1 hover:bg-white cursor-pointer"
              aria-label="Phóng to bản xem trước"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExportWord}
            disabled={!document}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B4F8A] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#093F6F] disabled:opacity-45 cursor-pointer"
          >
            <FileDown className="h-4 w-4" />
            <span>Xuất Word (.docx)</span>
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            disabled={!document}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Xuất PDF</span>
          </button>
          <button
            type="button"
            onClick={onPrint}
            disabled={!document}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>In tài liệu</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            aria-label="Đóng xem trước khi in"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable A4 Sheet Container */}
      <div className="mathfix-scroll max-h-[65vh] overflow-auto p-6 flex justify-center">
        <div
          style={{
            width: '210mm',
            minHeight: '297mm',
            paddingTop: `${examStyle.marginTopMm}mm`,
            paddingBottom: `${examStyle.marginBottomMm}mm`,
            paddingLeft: `${examStyle.marginLeftMm}mm`,
            paddingRight: `${examStyle.marginRightMm}mm`,
            fontFamily: `"${examStyle.fontFamily}", "Times New Roman", serif`,
            fontSize: `${examStyle.fontSizePt}pt`,
            lineHeight: examStyle.lineHeight,
            transform: `scale(${scale / 100})`,
            transformOrigin: 'top center',
          }}
          className="bg-white text-slate-950 shadow-lg border border-slate-300 shrink-0"
        >
          {/* Optional 2-column Vietnamese Exam Header */}
          {showHeader && (
            <div className="mb-4 grid grid-cols-12 gap-4 border-b border-slate-800 pb-3 text-center">
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
                {subjectGradeLine && <div className="font-bold">{subjectGradeLine}</div>}
                {examHeader.duration.trim() && (
                  <div className="italic">Thời gian làm bài: {examHeader.duration.trim()}</div>
                )}
                {examHeader.examCode.trim() && (
                  <div className="font-bold">Mã đề: {examHeader.examCode.trim()}</div>
                )}
              </div>
            </div>
          )}

          {/* Document Body */}
          {!document || document.blocks.length === 0 ? (
            <p className="text-center text-slate-500">Chưa có nội dung tài liệu để xem trước.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: `${examStyle.paragraphSpacingPt}pt` }}>
              {document.blocks.map((block) => {
                if (block.type === 'table') {
                  return (
                    <table key={block.id} className="my-2 w-full border-collapse">
                      <tbody>
                        {block.rows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((cell) => (
                              <td
                                key={cell.id}
                                className="border border-slate-700 px-2.5 py-1.5 align-middle"
                              >
                                {cell.paragraphs.map((p) => (
                                  <div key={p.id}>
                                    {p.segments.map((seg) =>
                                      seg.type === 'text' ? (
                                        <span key={seg.id}>{seg.text}</span>
                                      ) : seg.type === 'figure' ? (
                                        renderPrintFigure(seg, true)
                                      ) : seg.validated && seg.svg ? (
                                        <span
                                          key={seg.id}
                                          className="mathfix-svg-host mx-0.5 inline-block align-middle"
                                          dangerouslySetInnerHTML={{ __html: seg.svg }}
                                        />
                                      ) : (
                                        <span key={seg.id} className="font-mono text-xs">
                                          {seg.activeLatex}
                                        </span>
                                      )
                                    )}
                                  </div>
                                ))}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                }

                if (block.segments.length === 0) {
                  return <div key={block.id} className="h-2" />;
                }

                return (
                  <p
                    key={block.id}
                    className={block.isHeading ? 'font-bold text-slate-950' : ''}
                    style={{ margin: 0 }}
                  >
                    {block.segments.map((seg) => {
                      if (seg.type === 'text') {
                        const lead = seg.text.match(
                          /^(\s*(?:Câu\s+\d+[.:]|Bài\s+\d+[.:]|Phần\s+[IVX0-9]+[.:]?|[A-D]\.|[a-d]\)))([\s\S]*)$/
                        );
                        if (lead && !block.isHeading) {
                          return (
                            <React.Fragment key={seg.id}>
                              <strong>{lead[1]}</strong>
                              {lead[2]}
                            </React.Fragment>
                          );
                        }
                        return <React.Fragment key={seg.id}>{seg.text}</React.Fragment>;
                      }

                      if (seg.type === 'figure') {
                        return renderPrintFigure(seg, false);
                      }

                      if (seg.ommlCompatible === false) {
                        return (
                          <pre key={seg.id} className="my-1 font-mono text-xs whitespace-pre">
                            {seg.activeLatex || seg.raw}
                          </pre>
                        );
                      }

                      if (seg.validated && seg.svg) {
                        return (
                          <span
                            key={seg.id}
                            className={
                              seg.displayMode
                                ? 'mathfix-svg-host my-2 block text-center'
                                : 'mathfix-svg-host mx-0.5 inline-block align-middle'
                            }
                            dangerouslySetInnerHTML={{ __html: seg.svg }}
                          />
                        );
                      }

                      return (
                        <span key={seg.id} className="font-mono text-xs text-red-700">
                          {seg.activeLatex}
                        </span>
                      );
                    })}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
