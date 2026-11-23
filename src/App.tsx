import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ClipboardPaste,
  Copy,
  FileDown,
  FileText,
  GitCompare,
  Maximize2,
  Minimize2,
  Printer,
  Redo2,
  RefreshCw,
  Trash2,
  Undo2,
  Upload,
  WifiOff,
} from 'lucide-react';
import {
  FormulaSegment,
  FormulaSubject,
  InputSourceType,
  ParagraphBlock,
  ProcessedDocument,
  SubjectMode,
} from './engine/types';
import {
  applyFormulaDecision,
  applyManualLatexEdit,
  applyManualSubjectOverride,
  extractStructuredInputFromHtml,
  mapFormulasInDocument,
  processDocumentText,
} from './engine/parser';
import { exportDocxFile } from './engine/docxExporter';
import { importDocxFromArrayBuffer } from './engine/docxImporter';
import { importPdfFromArrayBuffer } from './engine/pdfImporter';
import {
  buildSelectionExportPair,
  copyExportPair,
  copyForWord,
  copyFormulaAs,
  copyParagraph,
  copyWholeDocument,
  readClipboardStructured,
} from './engine/clipboardExport';
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from './engine/storage';
import { PRACTICE_SAMPLES } from './data/samples';
import { NormalizedDocumentView } from './components/NormalizedDocumentView';
import { MathLiveEditorModal } from './components/MathLiveEditorModal';
import { GuideModal } from './components/GuideModal';
import { PWAInstallControl } from './components/PWAInstallControl';
import { useOnlineStatus } from './hooks/usePWAInstall';

interface ToastState {
  message: string;
  tone: 'info' | 'success' | 'warning';
}

const SOURCE_LABELS: Record<InputSourceType, string> = {
  plain: 'Văn bản thuần / LaTeX',
  html: 'HTML có cấu trúc',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  word: 'Microsoft Word',
  google_docs: 'Google Docs',
  docx: 'Tệp DOCX',
  pdf: 'Tệp PDF',
  web: 'Trang web',
};

const SUBJECT_MODES: Array<{ id: SubjectMode; label: string }> = [
  { id: 'auto', label: 'Tự động nhận diện' },
  { id: 'math', label: 'Toán học' },
  { id: 'physics', label: 'Vật lí' },
  { id: 'chemistry', label: 'Hóa học' },
];

export default function App() {
  const isOnline = useOnlineStatus();

  // Undo / Redo history for source text
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIdx, setHistoryIdx] = useState<number>(0);
  const rawText = history[historyIdx] ?? '';

  const [sourceType, setSourceType] = useState<InputSourceType>('plain');
  const [subjectMode, setSubjectMode] = useState<SubjectMode>('auto');
  const [processedDoc, setProcessedDoc] = useState<ProcessedDocument | null>(null);
  const [processingState, setProcessingState] = useState<'idle' | 'processing' | 'done'>('idle');
  const [extraWarnings, setExtraWarnings] = useState<string[]>([]);

  // Selection & Modals
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(null);
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null);
  const [selectedParagraphId, setSelectedParagraphId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [guideOpen, setGuideOpen] = useState<boolean>(false);
  const [samplesOpen, setSamplesOpen] = useState<boolean>(false);
  const [copyFormulaMenuOpen, setCopyFormulaMenuOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'source' | 'result'>('source');

  // Local draft preference (explicit user awareness, never unexpected storage)
  const [autoSaveDraft, setAutoSaveDraft] = useState<boolean>(false);
  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(false);

  // Resizable split pane ratio (left pane percentage on desktop)
  const [splitPercent, setSplitPercent] = useState<number>(48);
  const isDraggingRef = useRef<boolean>(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedContentRef = useRef<HTMLDivElement | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const notify = useCallback((message: string, tone: 'info' | 'success' | 'warning' = 'info') => {
    setToast({ message, tone });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  // Check if a local draft exists in IndexedDB on mount (do not silently overwrite without notice)
  useEffect(() => {
    loadLocalDraft().then((draft) => {
      if (draft && draft.rawText.trim().length > 0) {
        setHasSavedDraft(true);
      }
    });
  }, []);

  // Save draft to IndexedDB only when user enabled local draft saving
  useEffect(() => {
    if (!autoSaveDraft) return;
    const timer = window.setTimeout(() => {
      if (rawText.trim()) {
        saveLocalDraft(rawText).then(() => setHasSavedDraft(true));
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [rawText, autoSaveDraft]);

  // Push new text snapshot into undo/redo stack
  const updateRawText = useCallback(
    (nextText: string, detectedSource?: InputSourceType) => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIdx + 1);
        if (sliced[sliced.length - 1] === nextText) return sliced;
        const next = [...sliced, nextText].slice(-40);
        setHistoryIdx(next.length - 1);
        return next;
      });
      if (detectedSource) setSourceType(detectedSource);
    },
    [historyIdx]
  );

  // Convert raw text into normalized document
  const runConversion = useCallback(
    (
      textToConvert: string,
      srcType: InputSourceType = sourceType,
      warnings: string[] = extraWarnings,
      mode: SubjectMode = subjectMode
    ) => {
      if (!textToConvert.trim()) {
        setProcessedDoc(null);
        setProcessingState('idle');
        setSelectedFormulaId(null);
        setSelectedParagraphId(null);
        return;
      }
      setProcessingState('processing');
      // Run synchronously via microtask so button feedback stays instant (<200ms)
      requestAnimationFrame(() => {
        const doc = processDocumentText(textToConvert, srcType, warnings, mode);
        setProcessedDoc(doc);
        setProcessingState('done');

        // Auto-select first formula if none selected
        let firstFormula: string | null = null;
        for (const b of doc.blocks) {
          if (b.type === 'paragraph') {
            const f = b.segments.find((s) => s.type === 'formula');
            if (f) {
              firstFormula = f.id;
              break;
            }
          }
        }
        setSelectedFormulaId(firstFormula);
      });
    },
    [sourceType, extraWarnings, subjectMode]
  );

  const handleChangeSubjectMode = (nextMode: SubjectMode) => {
    setSubjectMode(nextMode);
    if (rawText.trim()) {
      runConversion(rawText, sourceType, extraWarnings, nextMode);
    }
  };

  // Undo / Redo handlers
  const canUndo = historyIdx > 0;
  const canRedo = historyIdx < history.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const nextIdx = historyIdx - 1;
    setHistoryIdx(nextIdx);
    runConversion(history[nextIdx], sourceType, []);
  }, [canUndo, history, historyIdx, runConversion, sourceType]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const nextIdx = historyIdx + 1;
    setHistoryIdx(nextIdx);
    runConversion(history[nextIdx], sourceType, []);
  }, [canRedo, history, historyIdx, runConversion, sourceType]);

  // Global keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl/Cmd+Enter)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const isEditingTextarea = document.activeElement === textareaRef.current;

      if (e.key === 'Enter') {
        e.preventDefault();
        runConversion(rawText);
        return;
      }
      if (!isEditingTextarea && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        !isEditingTextarea &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRedo, handleUndo, rawText, runConversion]);

  // Fullscreen toggle synced with browser fullscreen state
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      notify('Trình duyệt không hỗ trợ bật chế độ toàn màn hình trong khung này.', 'warning');
    }
  };

  // Drag splitter for desktop 2-pane resize
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.max(28, Math.min(72, pct)));
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Structured paste handler on textarea (prioritizes HTML/MathML > plain text/LaTeX > Unicode)
  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    const hasImageOnly = !html && !plain && Array.from(e.clipboardData.items).some((i) => i.type.startsWith('image/'));

    if (hasImageOnly) {
      e.preventDefault();
      notify(
        'Bạn vừa dán một hình ảnh. MathFix EDU không giả lập OCR offline; vui lòng dán văn bản/công thức hoặc tải tệp DOCX/PDF có lớp văn bản.',
        'warning'
      );
      return;
    }

    // Check if HTML contains structured math (MathML, KaTeX, MathJax, Word HTML, tables)
    const hasStructuredMathHtml =
      Boolean(html) &&
      /<math\b|katex|mjx-container|math\/tex|data-math|data-latex|<table\b/i.test(html);

    if (hasStructuredMathHtml) {
      e.preventDefault();
      const extracted = extractStructuredInputFromHtml(html);
      const ta = e.currentTarget;
      const start = ta.selectionStart ?? rawText.length;
      const end = ta.selectionEnd ?? rawText.length;
      const merged = `${rawText.slice(0, start)}${extracted.text}${rawText.slice(end)}`;
      setExtraWarnings([]);
      updateRawText(merged, extracted.sourceType);
      runConversion(merged, extracted.sourceType, []);
      notify(`Đã dán nội dung có cấu trúc từ ${SOURCE_LABELS[extracted.sourceType]} và tự động chuẩn hóa.`, 'success');
      return;
    }

    // Otherwise let native paste happen cleanly AND auto-convert immediately after!
    if (plain) {
      const detected: InputSourceType = /\\\[|\\\(/.test(plain)
        ? 'chatgpt'
        : /\$\$/.test(plain)
        ? 'gemini'
        : 'plain';
      setTimeout(() => {
        const value = textareaRef.current?.value ?? plain;
        setExtraWarnings([]);
        updateRawText(value, detected);
        runConversion(value, detected, []);
      }, 20);
    }
  };

  // Explicit "Dán" button handler with graceful permission fallback (Section 2)
  const handlePasteButton = async () => {
    const res = await readClipboardStructured();
    if (!res.ok) {
      textareaRef.current?.focus();
      notify(
        'Trình duyệt không cho phép đọc clipboard trực tiếp. Vui lòng nhấn Ctrl+V (Windows) hoặc Cmd+V (macOS) vào ô Văn bản gốc.',
        'info'
      );
      return;
    }

    if (res.hasImage && !res.html && !res.text) {
      notify(
        'Clipboard đang chứa hình ảnh. MathFix EDU không giả lập OCR offline — vui lòng sao chép công thức/văn bản hoặc nhập tệp DOCX/PDF.',
        'warning'
      );
      return;
    }

    let nextText = res.text || '';
    let detected: InputSourceType = 'plain';

    if (res.html && /<math\b|katex|mjx-container|math\/tex|data-math|data-latex|<table\b/i.test(res.html)) {
      const extracted = extractStructuredInputFromHtml(res.html);
      nextText = extracted.text;
      detected = extracted.sourceType;
    } else if (/\\\[|\\\(/.test(nextText)) {
      detected = 'chatgpt';
    } else if (/\$\$/.test(nextText)) {
      detected = 'gemini';
    }

    if (!nextText.trim()) {
      notify('Clipboard hiện không có văn bản hoặc công thức.', 'info');
      return;
    }

    setExtraWarnings([]);
    updateRawText(nextText, detected);
    runConversion(nextText, detected, []);
    notify('Đã dán từ clipboard và tự động chuẩn hóa công thức.', 'success');
  };

  // File upload handler: DOCX, PDF, TXT, HTML
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    setProcessingState('processing');

    try {
      if (ext === 'docx') {
        const buffer = await file.arrayBuffer();
        const imported = await importDocxFromArrayBuffer(buffer);
        setExtraWarnings(imported.warnings);
        updateRawText(imported.text, 'docx');
        runConversion(imported.text, 'docx', imported.warnings);
        notify(
          `Đã đọc tệp DOCX "${file.name}" (${imported.ommlCount} công thức Word Equation, ${imported.tableCount} bảng).`,
          'success'
        );
      } else if (ext === 'pdf') {
        const buffer = await file.arrayBuffer();
        const imported = await importPdfFromArrayBuffer(buffer);
        setExtraWarnings(imported.warnings);
        updateRawText(imported.text, 'pdf');
        runConversion(imported.text, 'pdf', imported.warnings);
        if (!imported.hasTextLayer) {
          notify(
            `PDF "${file.name}" không có lớp văn bản (bản quét ảnh). Không thể trích xuất tự động khi không có OCR.`,
            'warning'
          );
        } else {
          notify(`Đã trích xuất ${imported.pageCount} trang từ tệp PDF "${file.name}".`, 'success');
        }
      } else if (ext === 'html' || ext === 'htm') {
        const html = await file.text();
        const extracted = extractStructuredInputFromHtml(html);
        setExtraWarnings([]);
        updateRawText(extracted.text, 'html');
        runConversion(extracted.text, 'html', []);
        notify(`Đã nhập nội dung HTML từ "${file.name}".`, 'success');
      } else if (ext === 'txt' || ext === 'md' || ext === 'tex') {
        const text = await file.text();
        setExtraWarnings([]);
        updateRawText(text, 'plain');
        runConversion(text, 'plain', []);
        notify(`Đã nhập tệp văn bản "${file.name}".`, 'success');
      } else {
        setProcessingState(processedDoc ? 'done' : 'idle');
        notify('Định dạng tệp chưa hỗ trợ. Vui lòng chọn tệp DOCX, PDF, TXT hoặc HTML.', 'warning');
      }
    } catch (err) {
      setProcessingState(processedDoc ? 'done' : 'idle');
      notify(
        err instanceof Error ? `Không thể đọc tệp: ${err.message}` : 'Không thể đọc tệp đã chọn.',
        'warning'
      );
    }
  };

  // Load practice sample explicitly (never auto-mixed with teacher's document)
  const handleSelectSample = (sampleContent: string, sampleTitle: string) => {
    setSamplesOpen(false);
    setExtraWarnings([]);
    updateRawText(sampleContent, 'plain');
    runConversion(sampleContent, 'plain', []);
    setMobileTab('result');
    notify(`Đã nạp ${sampleTitle} (Ví dụ thực hành).`, 'info');
  };

  const handleClearAll = () => {
    setExtraWarnings([]);
    updateRawText('', 'plain');
    setProcessedDoc(null);
    setProcessingState('idle');
    setSelectedFormulaId(null);
    setSelectedParagraphId(null);
    setEditingFormulaId(null);
    notify('Đã xóa nội dung làm việc.', 'info');
  };

  // Find selected/editing formula & selected paragraph from processedDoc
  const findFormulaById = useCallback(
    (id: string | null): FormulaSegment | null => {
      if (!id || !processedDoc) return null;
      for (const b of processedDoc.blocks) {
        if (b.type === 'paragraph') {
          const found = b.segments.find((s): s is FormulaSegment => s.type === 'formula' && s.id === id);
          if (found) return found;
        } else {
          for (const r of b.rows) {
            for (const c of r) {
              for (const p of c.paragraphs) {
                const found = p.segments.find((s): s is FormulaSegment => s.type === 'formula' && s.id === id);
                if (found) return found;
              }
            }
          }
        }
      }
      return null;
    },
    [processedDoc]
  );

  const selectedFormula = useMemo(() => findFormulaById(selectedFormulaId), [findFormulaById, selectedFormulaId]);
  const editingFormula = useMemo(() => findFormulaById(editingFormulaId), [findFormulaById, editingFormulaId]);

  const selectedParagraph = useMemo((): ParagraphBlock | null => {
    if (!selectedParagraphId || !processedDoc) return null;
    const found = processedDoc.blocks.find(
      (b): b is ParagraphBlock => b.type === 'paragraph' && b.id === selectedParagraphId
    );
    return found ?? null;
  }, [processedDoc, selectedParagraphId]);

  // Formula actions (MathLive apply, Subject override, Accept, Reject, Batch safe accept, Restore)
  const handleApplyMathLive = (formulaId: string, newLatex: string, nextSubject?: FormulaSubject) => {
    if (!processedDoc) return;
    const updated = mapFormulasInDocument(processedDoc, (f) =>
      f.id === formulaId ? applyManualLatexEdit(f, newLatex, nextSubject) : f
    );
    setProcessedDoc(updated);
    setEditingFormulaId(null);
    setSelectedFormulaId(formulaId);
    notify('Đã cập nhật công thức từ trình soạn thảo MathLive.', 'success');
  };

  const handleChangeFormulaSubject = (formulaId: string, nextSubject: FormulaSubject) => {
    if (!processedDoc) return;
    const updated = mapFormulasInDocument(processedDoc, (f) =>
      f.id === formulaId ? applyManualSubjectOverride(f, nextSubject) : f
    );
    setProcessedDoc(updated);
    notify(
      `Đã chuyển phân loại công thức sang môn ${
        nextSubject === 'physics' ? 'Vật lí' : nextSubject === 'chemistry' ? 'Hóa học' : 'Toán học'
      }.`,
      'info'
    );
  };

  const handleAcceptFormula = (formulaId: string) => {
    if (!processedDoc) return;
    setProcessedDoc(
      mapFormulasInDocument(processedDoc, (f) =>
        f.id === formulaId ? applyFormulaDecision(f, 'accept') : f
      )
    );
  };

  const handleRejectFormula = (formulaId: string) => {
    if (!processedDoc) return;
    setProcessedDoc(
      mapFormulasInDocument(processedDoc, (f) =>
        f.id === formulaId ? applyFormulaDecision(f, 'reject') : f
      )
    );
  };

  const handleAcceptAllSafe = () => {
    if (!processedDoc) return;
    setProcessedDoc(
      mapFormulasInDocument(processedDoc, (f) =>
        f.status === 'auto_fixed' ? applyFormulaDecision(f, 'accept') : f
      )
    );
    notify('Đã chấp nhận tất cả các thay đổi an toàn. Các công thức mơ hồ vẫn được giữ lại để thầy cô kiểm tra.', 'success');
  };

  const handleRestoreAllOriginal = () => {
    if (!processedDoc) return;
    setProcessedDoc(
      mapFormulasInDocument(processedDoc, (f) => applyFormulaDecision(f, 'reject'))
    );
    notify('Đã khôi phục toàn bộ công thức về nguyên bản gốc.', 'info');
  };

  // Build lookup map of all formulas in the current processed document (for mouse selection copy)
  const formulaMap = useMemo(() => {
    const map = new Map<string, FormulaSegment>();
    if (!processedDoc) return map;
    for (const b of processedDoc.blocks) {
      if (b.type === 'paragraph') {
        for (const s of b.segments) {
          if (s.type === 'formula') map.set(s.id, s);
        }
      } else {
        for (const r of b.rows) {
          for (const c of r) {
            for (const p of c.paragraphs) {
              for (const s of p.segments) {
                if (s.type === 'formula') map.set(s.id, s);
              }
            }
          }
        }
      }
    }
    return map;
  }, [processedDoc]);

  // Export & Copy handlers
  const handleCopyFormula = async (format: 'display' | 'latex' | 'mathml' | 'svg' | 'png') => {
    setCopyFormulaMenuOpen(false);
    const targetFormula = selectedFormula || (formulaMap.size > 0 ? formulaMap.values().next().value ?? null : null);
    if (!targetFormula) {
      notify('Vui lòng nhấp chọn một công thức ở khung bên phải trước khi sao chép.', 'warning');
      return;
    }
    const res = await copyFormulaAs(targetFormula, format);
    notify(res.message, res.ok ? 'success' : 'warning');
  };

  const handleCopyForWord = async () => {
    if (!processedDoc) {
      notify('Chưa có kết quả chuẩn hóa để sao chép cho Word.', 'warning');
      return;
    }
    const res = await copyForWord(
      processedDoc,
      window.getSelection(),
      normalizedContentRef.current,
      formulaMap
    );
    notify(res.message, res.ok ? 'success' : 'warning');
  };

  const handleCopySelectedParagraph = async (para?: ParagraphBlock) => {
    // First check if the teacher highlighted text/formulas with mouse inside the normalized pane
    if (!para) {
      const selPair = buildSelectionExportPair(
        window.getSelection(),
        normalizedContentRef.current,
        formulaMap
      );
      if (selPair) {
        const res = await copyExportPair(
          selPair,
          'Đã sao chép vùng bôi đen (Office OMML + MathML kèm văn bản dự phòng). Nếu Word không nhận Equation qua clipboard, hãy dùng "Xuất Word (.docx)".'
        );
        notify(res.message, res.ok ? 'success' : 'warning');
        return;
      }
    }

    const target = para || selectedParagraph;
    if (!target) {
      notify(
        'Hãy bôi đen bằng chuột hoặc nhấp chọn một đoạn văn ở khung Văn bản đã chuẩn hóa để sao chép.',
        'info'
      );
      return;
    }
    const res = await copyParagraph(target);
    notify(res.message, res.ok ? 'success' : 'warning');
  };

  const handleCopyAll = async () => {
    if (!processedDoc) {
      notify('Chưa có kết quả chuẩn hóa để sao chép.', 'warning');
      return;
    }
    const res = await copyWholeDocument(processedDoc);
    notify(res.message, res.ok ? 'success' : 'warning');
  };

  const handleExportWord = async () => {
    if (!processedDoc) {
      notify('Chưa có kết quả chuẩn hóa để xuất tệp Word.', 'warning');
      return;
    }
    try {
      await exportDocxFile(processedDoc, 'MathFix-EDU-Tai-Lieu.docx');
      notify('Đã xuất tệp Word (.docx) chứa công thức Word Equation (OMML) chỉnh sửa được.', 'success');
    } catch (err) {
      notify(
        err instanceof Error ? `Lỗi xuất DOCX: ${err.message}` : 'Không thể xuất tệp DOCX.',
        'warning'
      );
    }
  };

  const handleExportPdf = () => {
    if (!processedDoc) {
      notify('Chưa có kết quả chuẩn hóa để xuất PDF.', 'warning');
      return;
    }
    notify('Đang mở hộp thoại in/lưu PDF với đầy đủ dấu tiếng Việt và công thức vector SVG sắc nét.', 'info');
    setTimeout(() => window.print(), 150);
  };

  const handleLoadDraft = async () => {
    const draft = await loadLocalDraft();
    if (draft?.rawText) {
      updateRawText(draft.rawText, 'plain');
      runConversion(draft.rawText, 'plain', []);
      notify('Đã khôi phục bản nháp lưu cục bộ trên máy.', 'success');
    }
  };

  const handleClearDraft = async () => {
    await clearLocalDraft();
    setHasSavedDraft(false);
    setAutoSaveDraft(false);
    notify('Đã xóa bản nháp lưu trong trình duyệt.', 'info');
  };

  const stats = processedDoc?.stats ?? {
    totalFormulas: 0,
    validCount: 0,
    autoFixedCount: 0,
    needsReviewCount: 0,
    unrecoverableCount: 0,
  };
  const remainingIssues = stats.needsReviewCount + stats.unrecoverableCount;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* HEADER — Clean 3-zone contract */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand Zone */}
          <div className="flex items-center gap-2.5 shrink-0">
            <img
              src="/icon.svg"
              alt="Logo MathFix EDU"
              className="h-9 w-9 rounded-lg shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
                MathFix EDU
              </span>
              <span className="hidden sm:block text-xs font-medium text-slate-500 whitespace-nowrap">
                Toán – Vật lí – Hóa học
              </span>
            </div>
          </div>

          {/* Center Nav / Controls */}
          <nav className="hidden md:flex items-center gap-6 text-[15px] font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setCompareMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                compareMode ? 'text-[#0B4F8A] font-semibold' : 'hover:text-slate-900'
              }`}
            >
              <GitCompare className="h-4 w-4" aria-hidden="true" />
              <span>Đối chiếu trước / sau</span>
            </button>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span>Hướng dẫn</span>
            </button>
          </nav>

          {/* Right Action Zone */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="md:hidden inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
            >
              <BookOpen className="h-4 w-4" />
              <span>Hướng dẫn</span>
            </button>
            <PWAInstallControl />
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={isFullscreen ? 'Thoát toàn màn hình' : 'Mở toàn màn hình'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ACTION BAR (Thanh thao tác) */}
      <div className="no-print border-b border-slate-200 bg-slate-50/90">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePasteButton}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[15px] font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
              <span>Dán</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf,.txt,.html,.htm,.md,.tex"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[15px] font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>Tải tệp</span>
            </button>

            {/* Practice Samples Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSamplesOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[15px] font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                <span>Ví dụ thực hành</span>
                <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </button>

              {samplesOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setSamplesOpen(false)} />
                  <div className="absolute left-0 top-full z-40 mt-1.5 w-[340px] sm:w-[400px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {PRACTICE_SAMPLES.length} Ví dụ thực hành (Toán – Lí – Hóa)
                      </p>
                      <p className="text-xs text-slate-500">
                        Dữ liệu mẫu độc lập, không tự động trộn vào tài liệu của giáo viên.
                      </p>
                    </div>
                    <div className="mathfix-scroll max-h-80 overflow-y-auto py-1">
                      {PRACTICE_SAMPLES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectSample(s.content, s.title)}
                          className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <span className="text-sm font-medium text-slate-900">{s.title}</span>
                          <span className="text-xs text-slate-500">{s.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Subject Mode Selector (Section II: Tự động nhận diện / Toán học / Vật lí / Hóa học) */}
            <div
              role="group"
              aria-label="Chế độ môn học"
              className="inline-flex flex-wrap items-center rounded-lg border border-slate-300 bg-white p-0.5"
            >
              {SUBJECT_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleChangeSubjectMode(m.id)}
                  className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    subjectMode === m.id
                      ? 'bg-[#0B4F8A] text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                runConversion(rawText);
                setMobileTab('result');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B4F8A] px-4 py-2 text-[15px] font-semibold text-white hover:bg-[#093F6F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`h-4 w-4 ${processingState === 'processing' ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Chuyển đổi</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
              title="Hoàn tác (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Hoàn tác</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
              title="Làm lại (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Làm lại</span>
            </button>
            <button
              type="button"
              onClick={() => setCompareMode((v) => !v)}
              className={`md:hidden inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[15px] font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                compareMode
                  ? 'border-[#0B4F8A] bg-sky-50 text-[#0B4F8A]'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              <GitCompare className="h-4 w-4" />
              <span>Đối chiếu</span>
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={!rawText && !processedDoc}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] font-medium text-red-700 hover:border-red-300 hover:bg-red-50 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Xóa nội dung</span>
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE TWO-TAB SWITCHER (Section 3: Trên màn hình nhỏ, chuyển thành hai tab) */}
      <div className="no-print lg:hidden border-b border-slate-200 bg-white px-4 py-2">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMobileTab('source')}
            className={`rounded-md py-2 text-[15px] font-medium transition-colors cursor-pointer ${
              mobileTab === 'source'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Văn bản gốc
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('result')}
            className={`rounded-md py-2 text-[15px] font-medium transition-colors cursor-pointer ${
              mobileTab === 'result'
                ? 'bg-white text-[#0B4F8A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Kết quả chuẩn ({stats.totalFormulas})
          </button>
        </div>
      </div>

      {/* TOAST FEEDBACK */}
      {toast && (
        <div className="no-print fixed bottom-20 right-4 z-50 max-w-md rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          <div className="flex items-start gap-2.5">
            {toast.tone === 'success' && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* MAIN TWO-PANE WORKSPACE (Khu vực làm việc) */}
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-3 sm:px-6">
        {/* Optional local draft restore prompt if user saved a draft previously */}
        {hasSavedDraft && !rawText && (
          <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700">
            <span>Có một bản nháp đã lưu cục bộ trong trình duyệt này (IndexedDB).</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadDraft}
                className="rounded-md bg-[#0B4F8A] px-3 py-1 text-xs font-medium text-white hover:bg-[#093F6F] cursor-pointer"
              >
                Mở bản nháp
              </button>
              <button
                type="button"
                onClick={handleClearDraft}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Xóa bản nháp
              </button>
            </div>
          </div>
        )}

        <div
          ref={workspaceRef}
          className="flex flex-1 flex-col lg:flex-row min-h-[540px] lg:min-h-[600px] rounded-xl border border-slate-200 bg-white overflow-hidden"
        >
          {/* LEFT PANE: VĂN BẢN GỐC */}
          <section
            style={{ flexBasis: `${splitPercent}%` }}
            className={`no-print flex flex-col border-slate-200 lg:border-r min-w-0 ${
              mobileTab === 'source' ? 'flex-1 lg:flex-none' : 'hidden lg:flex'
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-[15px] font-semibold text-slate-900 whitespace-nowrap">
                  Văn bản gốc
                </h1>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="truncate text-xs sm:text-sm text-slate-500">
                  Nguồn: {SOURCE_LABELS[sourceType]}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handlePasteButton}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 cursor-pointer"
                >
                  Dán
                </button>
                <button
                  type="button"
                  onClick={() => runConversion(rawText)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-[#0B4F8A] hover:bg-sky-100/70 cursor-pointer"
                >
                  Chuyển đổi
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                >
                  Xóa
                </button>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={rawText}
              onChange={(e) => updateRawText(e.target.value)}
              onPaste={handleTextareaPaste}
              spellCheck={false}
              placeholder={`Dán công thức, đoạn văn hoặc toàn bộ đề kiểm tra Toán – Vật lí – Hóa học vào đây (Ctrl+V / Cmd+V)...\n\nVí dụ: \\frac{x^2+1}{2} · \\vec{F}=m\\vec{a} · W_d=\\frac12mv^2 · H2SO4 · 2H2 + O2 -> 2H2O\nHỗ trợ dán trực tiếp từ: ChatGPT, Gemini, Microsoft Word, Google Docs, PDF, SGK điện tử.`}
              className="mathfix-scroll flex-1 w-full min-h-[460px] lg:max-h-[76vh] resize-none bg-white p-4 sm:p-5 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none"
              aria-label="Khung nhập văn bản gốc và công thức Toán – Vật lí – Hóa học"
            />
          </section>

          {/* DESKTOP DRAGGABLE SPLITTER */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Thay đổi độ rộng hai khung"
            onMouseDown={() => {
              isDraggingRef.current = true;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
            className="no-print hidden lg:flex w-1.5 cursor-col-resize items-center justify-center bg-slate-100 hover:bg-[#0B4F8A]/30 transition-colors shrink-0"
          >
            <div className="h-10 w-0.5 rounded-full bg-slate-300" />
          </div>

          {/* RIGHT PANE: VĂN BẢN ĐÃ CHUẨN HÓA */}
          <section
            style={{ flexBasis: `${100 - splitPercent}%` }}
            className={`flex flex-col min-w-0 flex-1 ${
              mobileTab === 'result' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <div className="no-print flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-[15px] font-semibold text-slate-900 whitespace-nowrap">
                  Văn bản đã chuẩn hóa
                </h2>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="truncate text-xs sm:text-sm text-slate-500">
                  Nhấp công thức để sửa MathLive · Bôi đen & Ctrl+C để sao chép
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCompareMode((v) => !v)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  compareMode
                    ? 'bg-[#0B4F8A] text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {compareMode ? 'Tắt đối chiếu' : 'Đối chiếu'}
              </button>
            </div>

            {/* Direct Copy Toolbar inside Normalized Pane (Word-ready + 5 copy buttons) */}
            <div className="no-print flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-white px-4 py-2">
              <button
                type="button"
                onClick={handleCopyForWord}
                disabled={!processedDoc}
                title="Sao chép nội dung chuẩn tương thích tối đa cho Microsoft Word (Office OMML + MathML, giữ tiếng Việt & thứ tự công thức)"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0B4F8A] px-2.5 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-[#093F6F] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sao chép cho Word</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyFormula('display')}
                disabled={!selectedFormula && formulaMap.size === 0}
                title="Sao chép công thức hiển thị có cấu trúc toán học (Office OMML + MathML, không sao chép SVG hay mã LaTeX thô)"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#0B4F8A]/35 bg-sky-50/70 px-2.5 py-1.5 text-xs sm:text-sm font-medium text-[#0B4F8A] hover:bg-sky-100 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sao chép công thức</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopySelectedParagraph()}
                disabled={!processedDoc}
                title="Sao chép vùng đang bôi đen hoặc đoạn văn đang chọn (Office OMML + MathML kèm văn bản dự phòng)"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sao chép đoạn được chọn</span>
              </button>
              <button
                type="button"
                onClick={handleCopyAll}
                disabled={!processedDoc}
                title="Sao chép toàn bộ văn bản kèm công thức Office OMML + MathML"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                <span>Sao chép tất cả</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyFormula('latex')}
                disabled={!selectedFormula && formulaMap.size === 0}
                title="Sao chép mã LaTeX chuẩn của công thức đang chọn"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                <span>Sao chép LaTeX</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyFormula('mathml')}
                disabled={!selectedFormula && formulaMap.size === 0}
                title="Sao chép mã MathML thuần (text/plain) — dán vào Word Desktop bằng Ctrl+V để Word chuyển thành Equation"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                <span>Sao chép MathML</span>
              </button>
            </div>

            <div className="mathfix-scroll flex-1 overflow-y-auto lg:max-h-[76vh] p-4 sm:p-6">
              <NormalizedDocumentView
                document={processedDoc}
                compareMode={compareMode}
                selectedFormulaId={selectedFormulaId}
                selectedParagraphId={selectedParagraphId}
                contentRef={normalizedContentRef}
                onSelectFormula={(formula, openEditor) => {
                  setSelectedFormulaId(formula.id);
                  if (openEditor) setEditingFormulaId(formula.id);
                }}
                onSelectParagraph={(para) => setSelectedParagraphId(para.id)}
                onCopyParagraph={(para) => handleCopySelectedParagraph(para)}
                onAcceptFormula={handleAcceptFormula}
                onRejectFormula={handleRejectFormula}
                onChangeFormulaSubject={handleChangeFormulaSubject}
                onAcceptAllSafe={handleAcceptAllSafe}
                onRestoreAllOriginal={handleRestoreAllOriginal}
                onNotify={notify}
              />
            </div>
          </section>
        </div>

        {/* RESULTS SUMMARY BAR (Thanh kết quả — unboxed tabular metadata, zero pill clutter) */}
        <div className="no-print mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-700 tabular-nums">
            <span>
              Tổng công thức: <strong className="font-semibold text-slate-900">{stats.totalFormulas}</strong>
            </span>
            {stats.totalFormulas > 0 && (
              <>
                <span className="text-slate-300" aria-hidden="true">|</span>
                <span className="text-slate-600">
                  Toán: <strong className="font-semibold text-slate-900">{stats.mathCount ?? 0}</strong> · Vật lí:{' '}
                  <strong className="font-semibold text-slate-900">{stats.physicsCount ?? 0}</strong> · Hóa học:{' '}
                  <strong className="font-semibold text-slate-900">{stats.chemistryCount ?? 0}</strong>
                </span>
              </>
            )}
            <span className="text-slate-300" aria-hidden="true">|</span>
            <span className="text-emerald-700">
              Hợp lệ: <strong className="font-semibold">{stats.validCount}</strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-[#0B4F8A]">
              Đã sửa tự động: <strong className="font-semibold">{stats.autoFixedCount}</strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-amber-700">
              Cần xác nhận: <strong className="font-semibold">{stats.needsReviewCount}</strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-red-700">
              Chưa xử lý được: <strong className="font-semibold">{stats.unrecoverableCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-600">
            {!isOnline && (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
                <WifiOff className="h-4 w-4" aria-hidden="true" />
                <span>Chế độ ngoại tuyến</span>
              </span>
            )}
            <span>
              {processingState === 'processing'
                ? 'Đang phân tích...'
                : processedDoc
                ? remainingIssues === 0
                  ? 'Sẵn sàng sao chép hoặc xuất Word'
                  : `Còn ${remainingIssues} công thức cần kiểm tra`
                : 'Sẵn sàng dán nội dung'}
            </span>
          </div>
        </div>

        {/* EXPORT BAR (Thanh xuất) */}
        <div className="no-print mt-2.5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Copy Formula Dropdown (LaTeX, MathML, SVG, PNG) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCopyFormulaMenuOpen((v) => !v)}
                disabled={!selectedFormula}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[15px] font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span>Sao chép công thức</span>
                <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </button>

              {copyFormulaMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setCopyFormulaMenuOpen(false)} />
                  <div className="absolute bottom-full left-0 z-40 mb-1.5 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={() => handleCopyFormula('display')}
                      className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-sky-50 cursor-pointer"
                    >
                      <span className="text-sm font-semibold text-[#0B4F8A]">Công thức cho Word (OMML + MathML)</span>
                      <span className="text-xs text-slate-500">Ưu tiên Word Equation kèm MathML dự phòng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyFormula('latex')}
                      className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-slate-50 cursor-pointer"
                    >
                      <span className="text-sm font-medium text-slate-900">LaTeX chuẩn</span>
                      <span className="text-xs text-slate-500">Dùng cho Overleaf, Word, web</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyFormula('mathml')}
                      className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-slate-50 cursor-pointer"
                    >
                      <span className="text-sm font-medium text-slate-900">MathML chuẩn (text/plain)</span>
                      <span className="text-xs text-slate-500">Dán trực tiếp vào Word Desktop (Ctrl+V)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyFormula('svg')}
                      className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-slate-50 cursor-pointer"
                    >
                      <span className="text-sm font-medium text-slate-900">Hình vector SVG</span>
                      <span className="text-xs text-slate-500">Phóng to không vỡ nét</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyFormula('png')}
                      className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-slate-50 cursor-pointer"
                    >
                      <span className="text-sm font-medium text-slate-900">Ảnh PNG độ nét cao</span>
                      <span className="text-xs text-slate-500">Chèn vào PowerPoint, Zalo, slide</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleCopySelectedParagraph()}
              disabled={!processedDoc}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[15px] font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span>Sao chép đoạn</span>
            </button>

            <button
              type="button"
              onClick={handleCopyAll}
              disabled={!processedDoc}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[15px] font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span>Sao chép tất cả</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportWord}
              disabled={!processedDoc}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B4F8A] px-4 py-2 text-[15px] font-semibold text-white hover:bg-[#093F6F] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              <span>Xuất Word (.docx)</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={!processedDoc}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-[15px] font-medium text-slate-800 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span>Xuất PDF</span>
            </button>
          </div>
        </div>
      </main>

      {/* FOOTER (Section 13 exact copyright + explicit user-controlled IndexedDB draft toggle) */}
      <footer className="no-print mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-slate-600 sm:px-6">
          <p>Copyright © 2026 – Phát triển bởi Thầy Hồ Nguyễn Đa Thiện</p>
          <div className="flex items-center gap-4 text-xs sm:text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSaveDraft}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setAutoSaveDraft(enabled);
                  if (!enabled) clearLocalDraft().then(() => setHasSavedDraft(false));
                }}
                className="h-4 w-4 rounded border-slate-300 accent-[#0B4F8A]"
              />
              <span>Lưu bản nháp cục bộ (IndexedDB)</span>
            </label>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      <MathLiveEditorModal
        formula={editingFormula}
        onClose={() => setEditingFormulaId(null)}
        onApply={handleApplyMathLive}
        onNotify={notify}
      />

      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
