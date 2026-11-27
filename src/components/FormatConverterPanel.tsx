import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  Download,
  FileCode2,
  FileImage,
  FileText,
  Image as ImageIcon,
  Sigma,
  X,
} from 'lucide-react';
import { FormulaSegment, ProcessedDocument } from '../engine/types';
import {
  convertDocumentToFormat,
  convertFormulaToFormat,
  ExportFormatId,
} from '../engine/formatConverter';
import {
  copyForWord,
  copyFormulaAs,
  copyPlainText,
  svgToPngBlob,
} from '../engine/clipboardExport';
import { ResponsiveFormula } from './ResponsiveFormula';

interface FormatConverterPanelProps {
  open: boolean;
  initialFormat: ExportFormatId;
  selectedFormula: FormulaSegment | null;
  document: ProcessedDocument | null;
  formulaMap: Map<string, FormulaSegment>;
  onClose: () => void;
  onNotify: (message: string, tone?: 'info' | 'success' | 'warning') => void;
}

const FORMAT_TABS: Array<{
  id: ExportFormatId;
  label: string;
  shortLabel: string;
  ext: string;
  mime: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'omml',
    label: 'Word Equation (OMML)',
    shortLabel: 'OMML',
    ext: 'xml',
    mime: 'application/xml;charset=utf-8',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: 'mathml',
    label: 'MathML chuẩn',
    shortLabel: 'MathML',
    ext: 'mml',
    mime: 'application/mathml+xml;charset=utf-8',
    icon: <Code2 className="h-4 w-4" />,
  },
  {
    id: 'latex_inline',
    label: 'LaTeX nội tuyến ($...$)',
    shortLabel: 'LaTeX ($)',
    ext: 'tex',
    mime: 'text/plain;charset=utf-8',
    icon: <FileCode2 className="h-4 w-4" />,
  },
  {
    id: 'latex_display',
    label: 'LaTeX độc lập ($$...$$)',
    shortLabel: 'LaTeX ($$)',
    ext: 'tex',
    mime: 'text/plain;charset=utf-8',
    icon: <FileCode2 className="h-4 w-4" />,
  },
  {
    id: 'unicodemath',
    label: 'UnicodeMath (Word)',
    shortLabel: 'UnicodeMath',
    ext: 'txt',
    mime: 'text/plain;charset=utf-8',
    icon: <Sigma className="h-4 w-4" />,
  },
  {
    id: 'svg',
    label: 'Vector SVG',
    shortLabel: 'SVG',
    ext: 'svg',
    mime: 'image/svg+xml;charset=utf-8',
    icon: <FileImage className="h-4 w-4" />,
  },
  {
    id: 'png',
    label: 'Ảnh PNG (3x DPI)',
    shortLabel: 'PNG',
    ext: 'png',
    mime: 'image/png',
    icon: <ImageIcon className="h-4 w-4" />,
  },
];

export const FormatConverterPanel: React.FC<FormatConverterPanelProps> = ({
  open,
  initialFormat,
  selectedFormula,
  document,
  formulaMap,
  onClose,
  onNotify,
}) => {
  const [format, setFormat] = useState<ExportFormatId>(initialFormat);
  const [scope, setScope] = useState<'formula' | 'document'>('formula');
  const [pngPreviewUrl, setPngPreviewUrl] = useState<string | null>(null);
  const [pngError, setPngError] = useState<string | null>(null);
  const [copiedFlag, setCopiedFlag] = useState(false);

  useEffect(() => {
    setFormat(initialFormat);
  }, [initialFormat]);

  // Default to first available formula if none selected explicitly
  const activeFormula = useMemo(() => {
    if (selectedFormula) return selectedFormula;
    if (formulaMap.size > 0) return formulaMap.values().next().value ?? null;
    return null;
  }, [selectedFormula, formulaMap]);

  const effectiveScope: 'formula' | 'document' =
    format === 'svg' || format === 'png'
      ? 'formula'
      : scope === 'formula' && !activeFormula && document
      ? 'document'
      : scope;

  const conversion = useMemo(() => {
    if (!open) return null;
    if (effectiveScope === 'formula') {
      if (!activeFormula) {
        return {
          format,
          output: '',
          supported: false,
          warning: 'Chưa có công thức nào được chọn hoặc chuẩn hóa để chuyển đổi.',
        };
      }
      return convertFormulaToFormat(activeFormula, format);
    }
    if (!document) {
      return {
        format,
        output: '',
        supported: false,
        warning: 'Chưa có tài liệu nào được chuẩn hóa.',
      };
    }
    return convertDocumentToFormat(document, format);
  }, [open, effectiveScope, activeFormula, document, format]);

  // Generate real PNG preview blob when PNG tab is selected
  useEffect(() => {
    if (!open || format !== 'png' || !activeFormula?.svg) {
      setPngPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPngError(null);
      return;
    }

    let cancelled = false;
    svgToPngBlob(activeFormula.svg, 3)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPngPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setPngError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setPngError(err instanceof Error ? err.message : 'Không thể tạo ảnh PNG từ SVG.');
      });

    return () => {
      cancelled = true;
    };
  }, [open, format, activeFormula]);

  if (!open) return null;

  const activeMeta = FORMAT_TABS.find((t) => t.id === format) ?? FORMAT_TABS[0];

  const markCopied = () => {
    setCopiedFlag(true);
    window.setTimeout(() => setCopiedFlag(false), 1800);
  };

  const handleCopyOutput = async () => {
    if (!conversion) return;

    if (effectiveScope === 'formula' && activeFormula) {
      if (format === 'png') {
        const res = await copyFormulaAs(activeFormula, 'png');
        if (res.ok) markCopied();
        onNotify(res.message, res.ok ? 'success' : 'warning');
        return;
      }
      if (format === 'svg') {
        const res = await copyFormulaAs(activeFormula, 'svg');
        if (res.ok) markCopied();
        onNotify(res.message, res.ok ? 'success' : 'warning');
        return;
      }
      if (format === 'mathml') {
        const res = await copyFormulaAs(activeFormula, 'mathml');
        if (res.ok) markCopied();
        onNotify(res.message, res.ok ? 'success' : 'warning');
        return;
      }
      if (format === 'unicodemath') {
        const res = await copyFormulaAs(activeFormula, 'unicodemath');
        if (res.ok) markCopied();
        onNotify(res.message, res.ok ? 'success' : 'warning');
        return;
      }
    }

    if (!conversion.output) {
      onNotify('Không có nội dung hợp lệ để sao chép.', 'warning');
      return;
    }
    const ok = await copyPlainText(conversion.output);
    if (ok) {
      markCopied();
      onNotify(`Đã sao chép định dạng ${activeMeta.label} vào clipboard.`, 'success');
    } else {
      onNotify('Trình duyệt không cho phép ghi clipboard.', 'warning');
    }
  };

  const handleCopyWordDirect = async () => {
    if (effectiveScope === 'formula' && activeFormula) {
      const res = await copyFormulaAs(activeFormula, 'display');
      onNotify(res.message, res.ok ? 'success' : 'warning');
      return;
    }
    if (document) {
      const res = await copyForWord(document, null, null, formulaMap);
      onNotify(res.message, res.ok ? 'success' : 'warning');
    }
  };

  const handleDownload = async () => {
    if (!conversion) return;
    if (format === 'png' && activeFormula?.svg) {
      try {
        const blob = await svgToPngBlob(activeFormula.svg, 3);
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = 'mathfix-cong-thuc.png';
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        onNotify('Đã tải xuống ảnh công thức PNG (3x DPI).', 'success');
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'Lỗi tải xuống PNG.', 'warning');
      }
      return;
    }
    if (!conversion.output) {
      onNotify('Chưa có nội dung để tải xuống.', 'warning');
      return;
    }
    const blob = new Blob([conversion.output], { type: activeMeta.mime });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `mathfix-${effectiveScope === 'formula' ? 'cong-thuc' : 'tai-lieu'}.${activeMeta.ext}`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotify(`Đã tải tệp ${activeMeta.shortLabel}.`, 'success');
  };

  return (
    <section
      aria-label="Chuyển đổi định dạng công thức"
      className="no-print mb-3 rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden"
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">
            Chuyển đổi định dạng công thức (7 định dạng chuẩn)
          </h2>

          {/* Scope switcher */}
          <div
            role="group"
            aria-label="Phạm vi chuyển đổi"
            className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm"
          >
            <button
              type="button"
              onClick={() => setScope('formula')}
              disabled={!activeFormula}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer disabled:opacity-45 ${
                effectiveScope === 'formula'
                  ? 'bg-[#0B4F8A] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              Công thức đang chọn
            </button>
            <button
              type="button"
              onClick={() => setScope('document')}
              disabled={!document || format === 'svg' || format === 'png'}
              title={
                format === 'svg' || format === 'png'
                  ? 'SVG và PNG áp dụng cho từng công thức riêng lẻ'
                  : 'Chuyển đổi toàn bộ tài liệu'
              }
              className={`rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer disabled:opacity-45 ${
                effectiveScope === 'document'
                  ? 'bg-[#0B4F8A] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              Toàn bộ tài liệu
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 cursor-pointer"
          aria-label="Đóng bảng chuyển đổi định dạng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Format Tabs */}
      <div className="mathfix-scroll flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 bg-white px-4 py-2">
        {FORMAT_TABS.map((t) => {
          const active = t.id === format;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setFormat(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#0B4F8A] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A]'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {conversion?.warning && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <span>{conversion.warning}</span>
          </div>
        )}

        {/* Live preview for Formula */}
        {effectiveScope === 'formula' && activeFormula && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Rendered visual preview */}
            <div className="lg:col-span-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3 flex flex-col justify-between">
              <div className="text-xs font-medium text-slate-500 mb-2">
                Công thức nguồn đang chọn
              </div>
              <div className="flex min-h-[76px] items-center rounded-md bg-white border border-slate-200 p-3">
                {format === 'png' && pngPreviewUrl ? (
                  <img
                    src={pngPreviewUrl}
                    alt="Xem trước ảnh PNG công thức"
                    className="mx-auto max-h-28 max-w-full object-contain"
                  />
                ) : activeFormula.validated && activeFormula.svg ? (
                  <ResponsiveFormula
                    svg={activeFormula.svg}
                    baseFontSize="1.24rem"
                    minScale={0.72}
                    align="center"
                  />
                ) : (
                  <span className="mx-auto font-mono text-sm text-red-700">
                    {activeFormula.activeLatex || activeFormula.raw}
                  </span>
                )}
              </div>
              {pngError && <p className="mt-1.5 text-xs text-red-600">{pngError}</p>}
              {format === 'unicodemath' && (
                <p className="mt-2 text-xs text-slate-600">
                  Mẹo Word: Nhấn <strong>Alt + =</strong> để mở khung Equation, dán chuỗi UnicodeMath rồi nhấn <strong>Space</strong> để dựng công thức.
                </p>
              )}
            </div>

            {/* Output code / info */}
            <div className="lg:col-span-8 flex flex-col">
              <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                <span>Đầu ra: {activeMeta.label}</span>
                {conversion && (
                  <span className={conversion.supported ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                    {conversion.supported ? 'Tương thích đầy đủ' : 'Hạn chế / Cảnh báo'}
                  </span>
                )}
              </div>
              {format === 'png' ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-700">
                  <p>Ảnh PNG được dựng trực tiếp trên trình duyệt với độ phân giải cao (3x DPI, nền trắng sạch).</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Khuyến nghị: Chỉ dùng ảnh PNG khi chèn vào slide hoặc biểu mẫu không hỗ trợ công thức. Để chỉnh sửa trong Word, hãy dùng <strong>Word Equation (OMML)</strong> hoặc <strong>Xuất Word (.docx)</strong>.
                  </p>
                </div>
              ) : (
                <textarea
                  readOnly
                  value={conversion?.output ?? ''}
                  rows={5}
                  className="mathfix-scroll w-full flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs sm:text-sm text-slate-800 focus:outline-none"
                  aria-label={`Mã đầu ra ${activeMeta.label}`}
                />
              )}
            </div>
          </div>
        )}

        {/* Document-wide conversion output */}
        {effectiveScope === 'document' && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
              <span>Đầu ra toàn bộ tài liệu ({activeMeta.label})</span>
              {conversion && (
                <span className={conversion.supported ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                  {conversion.supported ? 'Tất cả công thức tương thích' : 'Có công thức hạn chế'}
                </span>
              )}
            </div>
            <textarea
              readOnly
              value={conversion?.output ?? ''}
              rows={7}
              className="mathfix-scroll w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs sm:text-sm text-slate-800 focus:outline-none"
              aria-label={`Mã đầu ra toàn tài liệu ${activeMeta.label}`}
            />
          </div>
        )}

        {/* Action row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyOutput}
              disabled={!conversion?.output && format !== 'png'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B4F8A] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#093F6F] disabled:opacity-45 cursor-pointer"
            >
              {copiedFlag ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiedFlag ? 'Đã sao chép' : `Sao chép ${activeMeta.shortLabel}`}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWordDirect}
              disabled={!activeFormula && !document}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 cursor-pointer"
            >
              <FileText className="h-4 w-4" />
              <span>Sao chép cho Word</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!conversion?.output && format !== 'png'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Tải tệp (.{activeMeta.ext})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </section>
  );
};
