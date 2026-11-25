import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCopy,
  Copy,
  FileDown,
  FileText,
  GitCompare,
  Maximize2,
  Minimize2,
  PenTool,
  Shapes,
  WifiOff,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  DocumentBlock,
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
import { exportDocxFile, exportSingleFormulaDocx } from './engine/docxExporter';
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
import { ExportFormatId } from './engine/formatConverter';
import {
  appendEssayWritingSpace,
  appendShortAnswerBoxes,
  buildQuestionTemplate,
  DEFAULT_EXAM_STYLE,
  DEFAULT_NORMALIZATION_OPTIONS,
  EMPTY_EXAM_HEADER,
  ExamHeaderConfig,
  ExamNormalizationOptions,
  ExamStyleSettings,
  formatMultipleChoiceOptions,
  formatTrueFalseItems,
  normalizeExamText,
  OptionLayoutColumns,
  renumberQuestions,
} from './engine/examTools';
import {
  deleteCustomFormula,
  loadLibraryState,
  parseLibraryImportJson,
  RecentEntry,
  recordRecentFormulaUsage,
  saveCustomFormula,
  saveFavoriteIds,
  serializeLibraryToJson,
} from './engine/libraryStorage';
import { LibraryFormulaItem } from './data/formulaLibraryData';
import { PRACTICE_SAMPLES } from './data/samples';
import { NormalizedDocumentView } from './components/NormalizedDocumentView';
import { RibbonTabId, RibbonToolbar } from './components/RibbonToolbar';
import { FormulaStudioPanel } from './components/FormulaStudioPanel';
import { FormatConverterPanel } from './components/FormatConverterPanel';
import { FormulaLibraryPanel, LibraryTabId } from './components/FormulaLibraryPanel';
import { ExamPanelMode, ExamToolsPanel } from './components/ExamToolsPanel';
import { PrintPreviewPanel } from './components/PrintPreviewPanel';
import { GuideView } from './components/GuideView';
import { PWAInstallControl } from './components/PWAInstallControl';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import {
  DEFAULT_FIGURE_CROP,
  FigureAsset,
  FigureLibraryTemplate,
} from './engine/figureTypes';
import {
  deleteCustomFigureTemplate,
  FigureRecentEntry,
  generateFigureId,
  loadAllFigures,
  loadFigureLibraryState,
  recordRecentFigureTemplate,
  saveCustomFigureTemplate,
  saveFigureAsset,
  saveFigureFavoriteIds,
} from './engine/figureStorage';
import {
  getSvgDimensions,
  isSupportedImageFile,
  readRasterImageFile,
  sanitizeSvgMarkup,
  svgMarkupToPngDataUrl,
} from './engine/svgSanitizer';
import type { DrawingWorkspaceMode } from './components/drawing/DrawingWorkspace';

const DrawingWorkspace = React.lazy(() => import('./components/drawing/DrawingWorkspace'));

interface ToastState {
  message: string;
  tone: 'info' | 'success' | 'warning';
}

type DockedPanelId = 'none' | 'studio' | 'library' | 'converter' | 'exam' | 'preview';

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

function mergeChunkedDocuments(
  chunks: ProcessedDocument[],
  sourceType: InputSourceType,
  warnings: string[],
  subjectMode: SubjectMode
): ProcessedDocument {
  const blocks: DocumentBlock[] = [];
  let totalFormulas = 0;
  let validCount = 0;
  let autoFixedCount = 0;
  let needsReviewCount = 0;
  let unrecoverableCount = 0;
  let mathCount = 0;
  let physicsCount = 0;
  let chemistryCount = 0;

  for (const part of chunks) {
    blocks.push(...part.blocks);
    totalFormulas += part.stats.totalFormulas;
    validCount += part.stats.validCount;
    autoFixedCount += part.stats.autoFixedCount;
    needsReviewCount += part.stats.needsReviewCount;
    unrecoverableCount += part.stats.unrecoverableCount;
    mathCount += part.stats.mathCount || 0;
    physicsCount += part.stats.physicsCount || 0;
    chemistryCount += part.stats.chemistryCount || 0;
  }

  return {
    blocks,
    sourceType,
    subjectMode,
    stats: {
      totalFormulas,
      validCount,
      autoFixedCount,
      needsReviewCount,
      unrecoverableCount,
      mathCount,
      physicsCount,
      chemistryCount,
    },
    warnings,
  };
}

export default function App() {
  const isOnline = useOnlineStatus();
  const { isInstalled: isPwaInstalled } = usePWAInstall();
  const [pwaTriggerCount, setPwaTriggerCount] = useState(0);

  // Undo / Redo history for source text
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIdx, setHistoryIdx] = useState<number>(0);
  const rawText = history[historyIdx] ?? '';

  const [sourceType, setSourceType] = useState<InputSourceType>('plain');
  const [subjectMode, setSubjectMode] = useState<SubjectMode>('auto');
  const [processedDoc, setProcessedDoc] = useState<ProcessedDocument | null>(null);
  const [processingState, setProcessingState] = useState<'idle' | 'processing' | 'done'>('idle');
  const [processingProgress, setProcessingProgress] = useState<number | null>(null);
  const [extraWarnings, setExtraWarnings] = useState<string[]>([]);

  // Workspace view & Ribbon state
  const [viewMode, setViewMode] = useState<'workspace' | 'guide' | 'drawing'>('workspace');
  const [drawingMode, setDrawingMode] = useState<DrawingWorkspaceMode>('vector_2d');
  const [ribbonTab, setRibbonTab] = useState<RibbonTabId>('clipboard');
  const [ribbonCollapsed, setRibbonCollapsed] = useState<boolean>(false);
  const [activePanel, setActivePanel] = useState<DockedPanelId>('none');

  // Scientific Figures & Figure Library state (IndexedDB v3 offline persistence)
  const [figuresMap, setFiguresMap] = useState<Map<string, FigureAsset>>(() => new Map());
  const [selectedFigureId, setSelectedFigureId] = useState<string | null>(null);
  const [editingFigureId, setEditingFigureId] = useState<string | null>(null);
  const [customFigureTemplates, setCustomFigureTemplates] = useState<FigureLibraryTemplate[]>([]);
  const [figureFavoriteIds, setFigureFavoriteIds] = useState<string[]>([]);
  const [figureRecents, setFigureRecents] = useState<FigureRecentEntry[]>([]);

  // Panel-specific states
  const [studioMode, setStudioMode] = useState<'create' | 'edit'>('create');
  const [studioSubject, setStudioSubject] = useState<FormulaSubject>('math');
  const [studioInitialLatex, setStudioInitialLatex] = useState<string>('');
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null);

  const [converterFormat, setConverterFormat] = useState<ExportFormatId>('omml');
  const [libraryTab, setLibraryTab] = useState<LibraryTabId>('all');
  const [examPanelMode, setExamPanelMode] = useState<ExamPanelMode>('normalize');

  // Exam style, header & pre-normalization restore snapshot
  const [examStyle, setExamStyle] = useState<ExamStyleSettings>(DEFAULT_EXAM_STYLE);
  const [examHeader, setExamHeader] = useState<ExamHeaderConfig>(EMPTY_EXAM_HEADER);
  const [preNormSnapshot, setPreNormSnapshot] = useState<string | null>(null);

  // Formula Library offline persistence (IndexedDB)
  const [customFormulas, setCustomFormulas] = useState<LibraryFormulaItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);

  // Selection, compare, zoom, menus
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(null);
  const [selectedParagraphId, setSelectedParagraphId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [samplesOpen, setSamplesOpen] = useState<boolean>(false);
  const [copyFormulaMenuOpen, setCopyFormulaMenuOpen] = useState<boolean>(false);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'source' | 'result'>('source');

  // Optional local draft preference (IndexedDB)
  const [autoSaveDraft, setAutoSaveDraft] = useState<boolean>(false);
  const [hasSavedDraft, setHasSavedDraft] = useState<boolean>(false);

  // Resizable split pane ratio
  const [splitPercent, setSplitPercent] = useState<number>(47);
  const isDraggingRef = useRef<boolean>(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const libraryImportRef = useRef<HTMLInputElement | null>(null);
  const normalizedContentRef = useRef<HTMLDivElement | null>(null);
  const conversionJobRef = useRef<number>(0);

  // Toast feedback
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const notify = useCallback((message: string, tone: 'info' | 'success' | 'warning' = 'info') => {
    setToast({ message, tone });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  // Load saved local draft availability, Formula Library & Scientific Figures on mount
  useEffect(() => {
    loadLocalDraft().then((draft) => {
      if (draft && draft.rawText.trim().length > 0) {
        setHasSavedDraft(true);
      }
    });
    loadLibraryState().then((snap) => {
      setCustomFormulas(snap.customFormulas);
      setFavoriteIds(snap.favoriteIds);
      setRecentEntries(snap.recentEntries);
    });
    loadAllFigures().then((figs) => {
      if (figs.size > 0) {
        setFiguresMap(new Map(figs));
      }
    });
    loadFigureLibraryState().then((snap) => {
      setCustomFigureTemplates(snap.customTemplates);
      setFigureFavoriteIds(snap.favoriteIds);
      setFigureRecents(snap.recentEntries);
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
        const next = [...sliced, nextText].slice(-50);
        setHistoryIdx(next.length - 1);
        return next;
      });
      if (detectedSource) setSourceType(detectedSource);
    },
    [historyIdx]
  );

  // Chunked non-blocking document conversion with cancellation support (Section XXIII)
  const runConversion = useCallback(
    (
      textToConvert: string,
      srcType: InputSourceType = sourceType,
      warnings: string[] = extraWarnings,
      mode: SubjectMode = subjectMode
    ) => {
      const jobId = ++conversionJobRef.current;

      if (!textToConvert.trim()) {
        setProcessedDoc(null);
        setProcessingState('idle');
        setProcessingProgress(null);
        setSelectedFormulaId(null);
        setSelectedParagraphId(null);
        return;
      }

      setProcessingState('processing');
      const lines = textToConvert.replace(/\r\n/g, '\n').split('\n');

      const finishDoc = (doc: ProcessedDocument) => {
        if (conversionJobRef.current !== jobId) return;
        setProcessedDoc(doc);
        setProcessingState('done');
        setProcessingProgress(null);

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
        setSelectedFormulaId((prev) => prev || firstFormula);
      };

      // Small/medium documents: instant single frame pass
      if (lines.length <= 60) {
        setProcessingProgress(null);
        requestAnimationFrame(() => {
          if (conversionJobRef.current !== jobId) return;
          const doc = processDocumentText(textToConvert, srcType, warnings, mode);
          finishDoc(doc);
        });
        return;
      }

      // Large documents (> 60 lines): process in safe 40-line chunks without splitting multi-line math/tables
      const chunkTexts: string[] = [];
      let buf: string[] = [];
      let inDisplayMath = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (/^\$\$|^\\\[|^\\begin\{/.test(trimmed) && !/\$\$$|\\\]$|\\end\{/.test(trimmed)) {
          inDisplayMath = true;
        } else if (inDisplayMath && (/\$\$|\\\]|\\end\{/.test(trimmed))) {
          inDisplayMath = false;
        }
        buf.push(line);
        const isTableLine = /^\s*\|.+\|\s*$/.test(line);
        if (buf.length >= 40 && !inDisplayMath && !isTableLine) {
          chunkTexts.push(buf.join('\n'));
          buf = [];
        }
      }
      if (buf.length > 0) chunkTexts.push(buf.join('\n'));

      const partialDocs: ProcessedDocument[] = [];
      let chunkIdx = 0;
      setProcessingProgress(5);

      const processNextChunk = () => {
        if (conversionJobRef.current !== jobId) return;
        const part = processDocumentText(chunkTexts[chunkIdx], srcType, [], mode);
        partialDocs.push(part);
        chunkIdx++;
        const pct = Math.min(99, Math.round((chunkIdx / chunkTexts.length) * 100));
        setProcessingProgress(pct);

        if (chunkIdx < chunkTexts.length) {
          requestAnimationFrame(processNextChunk);
        } else {
          const merged = mergeChunkedDocuments(partialDocs, srcType, warnings, mode);
          finishDoc(merged);
        }
      };

      requestAnimationFrame(processNextChunk);
    },
    [sourceType, extraWarnings, subjectMode]
  );

  const handleCancelConversion = () => {
    conversionJobRef.current++;
    setProcessingState(processedDoc ? 'done' : 'idle');
    setProcessingProgress(null);
    notify('Đã hủy tiến trình xử lý tài liệu lớn.', 'info');
  };

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
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isEditingInput =
        document.activeElement === textareaRef.current ||
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeTag === 'math-field';

      if (e.key === 'Enter' && viewMode === 'workspace') {
        e.preventDefault();
        runConversion(rawText);
        return;
      }
      if (!isEditingInput && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        !isEditingInput &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRedo, handleUndo, rawText, runConversion, viewMode]);

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

  // Helper: insert snippet at textarea cursor position and auto-convert
  const insertTextAtCursor = useCallback(
    (snippet: string, notice?: string) => {
      const ta = textareaRef.current;
      const start = ta?.selectionStart ?? rawText.length;
      const end = ta?.selectionEnd ?? rawText.length;
      const before = rawText.slice(0, start);
      const after = rawText.slice(end);
      const needsSpaceBefore =
        before.length > 0 && !/\s$/.test(before) && !snippet.startsWith('\n');
      const needsSpaceAfter =
        after.length > 0 && !/^\s/.test(after) && !snippet.endsWith('\n');
      const merged = `${before}${needsSpaceBefore ? ' ' : ''}${snippet}${
        needsSpaceAfter ? ' ' : ''
      }${after}`;

      updateRawText(merged, sourceType);
      runConversion(merged, sourceType, extraWarnings);
      if (notice) notify(notice, 'success');

      window.setTimeout(() => {
        if (textareaRef.current) {
          const caret = start + (needsSpaceBefore ? 1 : 0) + snippet.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(caret, caret);
        }
      }, 30);
    },
    [rawText, sourceType, extraWarnings, updateRawText, runConversion, notify]
  );

  // Import a local or clipboard image file (PNG, JPG, WebP, or strictly sanitized SVG)
  const importImageFile = useCallback(
    async (file: File, baseTextOverride?: string) => {
      const check = isSupportedImageFile(file);
      if (!check.ok) {
        notify(check.error || 'Tệp hình ảnh không được hỗ trợ.', 'warning');
        return null;
      }

      const isSvg =
        file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
      const now = Date.now();
      const baseTitle = file.name.replace(/\.[^.]+$/, '') || 'Hình ảnh tải lên';
      const defaultSubject: FormulaSubject = subjectMode === 'auto' ? 'math' : subjectMode;

      try {
        let asset: FigureAsset;
        if (isSvg) {
          const rawSvg = await file.text();
          const cleanSvg = sanitizeSvgMarkup(rawSvg);
          if (!cleanSvg) {
            notify(
              'Tệp SVG không hợp lệ hoặc không chứa nội dung vector an toàn.',
              'warning'
            );
            return null;
          }
          const dims = getSvgDimensions(cleanSvg);
          const pngDataUrl = (await svgMarkupToPngDataUrl(cleanSvg, 1120)) || undefined;
          asset = {
            id: generateFigureId(),
            kind: 'svg_upload',
            subject: defaultSubject,
            title: baseTitle,
            caption: '',
            showNumber: true,
            align: 'center',
            widthPx: Math.min(480, Math.max(220, Math.round(dims.width))),
            aspectRatio: dims.width > 0 ? dims.height / dims.width : 0.68,
            rotationDeg: 0,
            crop: DEFAULT_FIGURE_CROP,
            svgMarkup: cleanSvg,
            pngDataUrl,
            createdAt: now,
            updatedAt: now,
          };
        } else {
          const raster = await readRasterImageFile(file);
          asset = {
            id: generateFigureId(),
            kind: 'raster_upload',
            subject: defaultSubject,
            title: baseTitle,
            caption: '',
            showNumber: true,
            align: 'center',
            widthPx: Math.min(480, Math.max(200, Math.round(raster.width))),
            aspectRatio: raster.width > 0 ? raster.height / raster.width : 0.68,
            rotationDeg: 0,
            crop: DEFAULT_FIGURE_CROP,
            pngDataUrl: raster.dataUrl,
            createdAt: now,
            updatedAt: now,
          };
        }

        await saveFigureAsset(asset);
        setFiguresMap((prev) => {
          const next = new Map(prev);
          next.set(asset.id, asset);
          return next;
        });
        setSelectedFigureId(asset.id);

        const token = `[[HINH:${asset.id}]]`;
        if (typeof baseTextOverride === 'string') {
          const merged = `${baseTextOverride}\n${token}\n`;
          updateRawText(merged, sourceType);
          runConversion(merged, sourceType, extraWarnings);
        } else {
          const ta = textareaRef.current;
          const pos = ta?.selectionStart ?? rawText.length;
          const lineStart = rawText.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
          const prefixOnLine = rawText.slice(lineStart, pos);
          const isInsideMcqOption = /^\s*[A-D]\.\s*$/.test(prefixOnLine);
          insertTextAtCursor(
            isInsideMcqOption ? token : `\n${token}\n`,
            isSvg
              ? `Đã chèn hình vector SVG "${file.name}" vào tài liệu.`
              : `Đã chèn hình ảnh "${file.name}" vào câu hỏi. Nhấp vào hình để căn lề, cắt hoặc thay đổi kích thước.`
          );
        }
        setMobileTab('result');
        return asset;
      } catch (err) {
        notify(
          err instanceof Error ? `Không thể đọc hình ảnh: ${err.message}` : 'Không thể đọc tệp hình ảnh đã chọn.',
          'warning'
        );
        return null;
      }
    },
    [subjectMode, sourceType, extraWarnings, rawText, updateRawText, runConversion, insertTextAtCursor, notify]
  );

  // Structured paste handler on textarea (supports text, formulas, images, and mixed content)
  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    const imageItem = Array.from(e.clipboardData.items).find(
      (i) => i.kind === 'file' && i.type.startsWith('image/')
    );
    const imageFile = imageItem ? imageItem.getAsFile() : null;

    if (imageFile && !html && !plain) {
      e.preventDefault();
      void importImageFile(imageFile);
      return;
    }

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
      if (imageFile) {
        void importImageFile(imageFile, merged);
      } else {
        updateRawText(merged, extracted.sourceType);
        runConversion(merged, extracted.sourceType, []);
        notify(
          `Đã dán nội dung có cấu trúc từ ${SOURCE_LABELS[extracted.sourceType]} và tự động chuẩn hóa.`,
          'success'
        );
      }
      return;
    }

    if (plain) {
      const detected: InputSourceType = /\\\[|\\\(/.test(plain)
        ? 'chatgpt'
        : /\$\$/.test(plain)
        ? 'gemini'
        : 'plain';
      setTimeout(() => {
        const value = textareaRef.current?.value ?? plain;
        setExtraWarnings([]);
        if (imageFile) {
          void importImageFile(imageFile, value);
        } else {
          updateRawText(value, detected);
          runConversion(value, detected, []);
        }
      }, 20);
    }
  };

  // Explicit "Dán hình từ clipboard" button handler
  const handlePasteImageFromClipboard = async () => {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
        textareaRef.current?.focus();
        notify(
          'Trình duyệt không hỗ trợ đọc ảnh trực tiếp qua nút bấm. Hãy nhấn Ctrl+V (Windows) hoặc Cmd+V (macOS) trực tiếp vào khung Văn bản gốc.',
          'info'
        );
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find((t) =>
          ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(t)
        );
        if (imgType) {
          const blob = await item.getType(imgType);
          const ext = imgType === 'image/jpeg' ? 'jpg' : imgType === 'image/webp' ? 'webp' : imgType === 'image/svg+xml' ? 'svg' : 'png';
          const file = new File([blob], `hinh-dan-${Date.now()}.${ext}`, { type: imgType });
          await importImageFile(file);
          return;
        }
      }
      notify(
        'Clipboard hiện không có hình ảnh (PNG/JPG/WebP/SVG). Hãy chụp màn hình hoặc sao chép hình ảnh rồi dán lại.',
        'info'
      );
    } catch {
      textareaRef.current?.focus();
      notify(
        'Trình duyệt chưa cấp quyền đọc ảnh từ clipboard. Thầy cô hãy nhấn Ctrl+V (Windows) hoặc Cmd+V (macOS) ngay trong khung Văn bản gốc.',
        'info'
      );
    }
  };

  // Explicit "Dán" button handler (handles both text/formulas and clipboard images)
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
      await handlePasteImageFromClipboard();
      return;
    }

    let nextText = res.text || '';
    let detected: InputSourceType = 'plain';

    if (
      res.html &&
      /<math\b|katex|mjx-container|math\/tex|data-math|data-latex|<table\b/i.test(res.html)
    ) {
      const extracted = extractStructuredInputFromHtml(res.html);
      nextText = extracted.text;
      detected = extracted.sourceType;
    } else if (/\\\[|\\\(/.test(nextText)) {
      detected = 'chatgpt';
    } else if (/\$\$/.test(nextText)) {
      detected = 'gemini';
    }

    if (!nextText.trim()) {
      notify('Clipboard hiện không có văn bản, công thức hoặc hình ảnh.', 'info');
      return;
    }

    setExtraWarnings([]);
    updateRawText(nextText, detected);
    runConversion(nextText, detected, []);
    notify('Đã dán từ clipboard và tự động chuẩn hóa công thức.', 'success');
  };

  // Image file input & drag-and-drop handlers
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await importImageFile(file);
  };

  const handleTextareaDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.svg')
    );
    if (!file) return;
    e.preventDefault();
    void importImageFile(file);
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

  // Load practice sample
  const handleSelectSample = (sampleContent: string, sampleTitle: string) => {
    setSamplesOpen(false);
    setViewMode('workspace');
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
    setProcessingProgress(null);
    setSelectedFormulaId(null);
    setSelectedParagraphId(null);
    setEditingFormulaId(null);
    notify('Đã xóa nội dung làm việc.', 'info');
  };

  // Lookup maps for processedDoc
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

  const selectedFormula = useMemo(
    () => (selectedFormulaId ? formulaMap.get(selectedFormulaId) ?? null : null),
    [formulaMap, selectedFormulaId]
  );

  const editingFormula = useMemo(
    () => (editingFormulaId ? formulaMap.get(editingFormulaId) ?? null : null),
    [formulaMap, editingFormulaId]
  );

  const selectedParagraph = useMemo((): ParagraphBlock | null => {
    if (!selectedParagraphId || !processedDoc) return null;
    const found = processedDoc.blocks.find(
      (b): b is ParagraphBlock => b.type === 'paragraph' && b.id === selectedParagraphId
    );
    return found ?? null;
  }, [processedDoc, selectedParagraphId]);

  // First figure referenced in current document (fallback for Ribbon edit/export buttons)
  const firstDocumentFigureId = useMemo(() => {
    if (!processedDoc) return null;
    for (const b of processedDoc.blocks) {
      if (b.type === 'paragraph') {
        const seg = b.segments.find((s) => s.type === 'figure');
        if (seg && seg.type === 'figure') return seg.figureId;
      } else {
        for (const r of b.rows) {
          for (const c of r) {
            for (const p of c.paragraphs) {
              const seg = p.segments.find((s) => s.type === 'figure');
              if (seg && seg.type === 'figure') return seg.figureId;
            }
          }
        }
      }
    }
    return null;
  }, [processedDoc]);

  const activeFigure = useMemo(() => {
    const id = selectedFigureId || firstDocumentFigureId;
    return id ? figuresMap.get(id) ?? null : null;
  }, [selectedFigureId, firstDocumentFigureId, figuresMap]);

  const editingFigure = useMemo(
    () => (editingFigureId ? figuresMap.get(editingFigureId) ?? null : null),
    [editingFigureId, figuresMap]
  );

  // Drawing Workspace actions (Dedicated full workspace — NO dimmed modal!)
  const openDrawingMode = (mode: DrawingWorkspaceMode, figureToEdit?: FigureAsset | null) => {
    setEditingFigureId(figureToEdit ? figureToEdit.id : null);
    setDrawingMode(mode);
    setViewMode('drawing');
  };

  const handleEditFigure = (figure: FigureAsset) => {
    setSelectedFigureId(figure.id);
    if (figure.kind === 'vector_2d') {
      openDrawingMode('vector_2d', figure);
    } else if (figure.kind === 'geometry_3d') {
      openDrawingMode('geometry_3d', figure);
    } else if (figure.kind === 'graph') {
      openDrawingMode('graph', figure);
    } else if (figure.kind === 'chemistry_2d') {
      openDrawingMode('chemistry_2d', figure);
    } else {
      openDrawingMode('raster_edit', figure);
    }
  };

  const handleCommitFigure = async (figure: FigureAsset, isUpdate: boolean) => {
    await saveFigureAsset(figure);
    setFiguresMap((prev) => {
      const next = new Map(prev);
      next.set(figure.id, figure);
      return next;
    });
    setSelectedFigureId(figure.id);
    setEditingFigureId(null);
    setViewMode('workspace');
    setMobileTab('result');

    if (isUpdate) {
      // Force re-render of document so updated caption/dimensions show immediately
      if (rawText.trim()) runConversion(rawText, sourceType, extraWarnings);
      notify(`Đã cập nhật hình "${figure.title}" trong tài liệu.`, 'success');
    } else {
      const token = `[[HINH:${figure.id}]]`;
      const ta = textareaRef.current;
      const pos = ta?.selectionStart ?? rawText.length;
      const lineStart = rawText.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
      const prefixOnLine = rawText.slice(lineStart, pos);
      const isInsideMcqOption = /^\s*[A-D]\.\s*$/.test(prefixOnLine);
      insertTextAtCursor(
        isInsideMcqOption ? token : `\n${token}\n`,
        `Đã chèn hình "${figure.title}" vào câu hỏi.`
      );
    }
  };

  const handleUpdateFigureInline = async (updated: FigureAsset) => {
    await saveFigureAsset(updated);
    setFiguresMap((prev) => {
      const next = new Map(prev);
      next.set(updated.id, updated);
      return next;
    });
  };

  const handleRemoveFigureFromDoc = (figureId: string) => {
    const escaped = figureId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nextText = rawText
      .replace(new RegExp(`\\n?\\[\\[HINH:${escaped}\\]\\]\\n?`, 'g'), '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (selectedFigureId === figureId) setSelectedFigureId(null);
    updateRawText(nextText, sourceType);
    runConversion(nextText, sourceType, extraWarnings);
    notify('Đã gỡ hình khỏi tài liệu.', 'info');
  };

  const handleExportFigureFile = async (figure: FigureAsset, format: 'svg' | 'png') => {
    const safeName = (figure.title || figure.id).replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF_-]+/g, '-');
    if (format === 'svg') {
      if (!figure.svgMarkup || figure.kind === 'raster_upload') {
        notify('Hình ảnh tải lên ở định dạng ảnh raster (PNG/JPG/WebP) — hãy dùng "Xuất hình PNG".', 'info');
        return;
      }
      const cleanSvg = sanitizeSvgMarkup(figure.svgMarkup) || figure.svgMarkup;
      const blob = new Blob([cleanSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MathFix-${safeName}.svg`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(`Đã xuất hình vector SVG "${figure.title}".`, 'success');
      return;
    }
    try {
      const pngUrl =
        figure.pngDataUrl ||
        (figure.svgMarkup ? (await svgMarkupToPngDataUrl(figure.svgMarkup, 1120)) || '' : '');
      if (!pngUrl) {
        notify('Không có dữ liệu ảnh PNG cho hình này.', 'warning');
        return;
      }
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `MathFix-${safeName}.png`;
      a.click();
      notify(`Đã xuất hình ảnh PNG độ phân giải cao "${figure.title}".`, 'success');
    } catch {
      notify('Không thể xuất ảnh PNG cho hình này.', 'warning');
    }
  };

  // Custom Figure Library persistence handlers
  const handleSaveCustomFigureTemplate = async (tpl: FigureLibraryTemplate) => {
    const saved = await saveCustomFigureTemplate(tpl);
    setCustomFigureTemplates((prev) => {
      const idx = prev.findIndex((x) => x.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
    notify(`Đã lưu mẫu hình "${saved.name}" vào thư viện hình cá nhân (offline).`, 'success');
  };

  const handleDeleteCustomFigureTemplate = async (id: string) => {
    await deleteCustomFigureTemplate(id);
    setCustomFigureTemplates((prev) => prev.filter((x) => x.id !== id));
    notify('Đã xóa mẫu hình khỏi thư viện cá nhân.', 'info');
  };

  const handleToggleFavoriteFigureTemplate = async (id: string) => {
    const next = figureFavoriteIds.includes(id)
      ? figureFavoriteIds.filter((x) => x !== id)
      : [id, ...figureFavoriteIds];
    setFigureFavoriteIds(next);
    await saveFigureFavoriteIds(next);
  };

  const handleRecordRecentFigureTemplate = async (id: string) => {
    const next = await recordRecentFigureTemplate(id);
    setFigureRecents(next);
  };

  // Studio actions (Docked MathLive Editor — never dims/blocks workspace!)
  const openStudioCreate = (subj: FormulaSubject = 'math', seedLatex = '') => {
    setViewMode('workspace');
    setEditingFormulaId(null);
    setStudioMode('create');
    setStudioSubject(subj);
    setStudioInitialLatex(seedLatex);
    setActivePanel('studio');
  };

  const openStudioEdit = (formula: FormulaSegment) => {
    setViewMode('workspace');
    setSelectedFormulaId(formula.id);
    setEditingFormulaId(formula.id);
    setStudioMode('edit');
    setStudioSubject(formula.subject);
    setStudioInitialLatex(formula.activeLatex || formula.raw);
    setActivePanel('studio');
  };

  const handleApplyStudioEdit = (
    formulaId: string,
    newLatex: string,
    nextSubject: FormulaSubject
  ) => {
    if (!processedDoc) return;
    const updated = mapFormulasInDocument(processedDoc, (f) =>
      f.id === formulaId ? applyManualLatexEdit(f, newLatex, nextSubject) : f
    );
    setProcessedDoc(updated);
    setSelectedFormulaId(formulaId);
    setEditingFormulaId(null);
    setActivePanel('none');
    notify('Đã cập nhật công thức trực tiếp vào tài liệu.', 'success');
  };

  const handleInsertFormulaFromStudio = (
    latex: string,
    displayMode: boolean,
    _subject: FormulaSubject
  ) => {
    const wrapped = displayMode ? `\n$$${latex}$$\n` : `$${latex}$`;
    insertTextAtCursor(
      wrapped,
      displayMode
        ? 'Đã chèn công thức độc lập vào văn bản và tự động chuẩn hóa.'
        : 'Đã chèn công thức nội tuyến vào vị trí con trỏ.'
    );
  };

  // Formula Library CRUD & Persistence
  const handleSavePersonalFormula = async (
    item: LibraryFormulaItem | Omit<LibraryFormulaItem, 'id' | 'isBuiltIn'>
  ) => {
    const fullItem: LibraryFormulaItem = {
      ...item,
      id:
        'id' in item && item.id
          ? item.id
          : `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      isBuiltIn: false,
    };
    const saved = await saveCustomFormula(fullItem);
    setCustomFormulas((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
    notify(`Đã lưu "${saved.name}" vào thư viện cá nhân (offline).`, 'success');
  };

  const handleDeletePersonalFormula = async (id: string) => {
    await deleteCustomFormula(id);
    setCustomFormulas((prev) => prev.filter((c) => c.id !== id));
    notify('Đã xóa công thức khỏi thư viện cá nhân.', 'info');
  };

  const handleToggleFavorite = async (id: string) => {
    const next = favoriteIds.includes(id)
      ? favoriteIds.filter((x) => x !== id)
      : [id, ...favoriteIds];
    setFavoriteIds(next);
    await saveFavoriteIds(next);
  };

  const handleRecordRecent = async (id: string) => {
    const next = await recordRecentFormulaUsage(id);
    setRecentEntries(next);
  };

  const handleImportLibraryJson = async (rawJson: string) => {
    const parsed = parseLibraryImportJson(rawJson);
    if (!parsed.ok) {
      notify(parsed.error || 'Tệp JSON thư viện không hợp lệ.', 'warning');
      return;
    }
    for (const item of parsed.formulas) {
      await saveCustomFormula(item);
    }
    const mergedFavs = Array.from(new Set([...favoriteIds, ...parsed.favoriteIds]));
    await saveFavoriteIds(mergedFavs);
    const snap = await loadLibraryState();
    setCustomFormulas(snap.customFormulas);
    setFavoriteIds(snap.favoriteIds);
    notify(`Đã nhập thành công ${parsed.formulas.length} công thức vào thư viện cá nhân.`, 'success');
  };

  const handleExportLibraryJson = () => {
    const json = serializeLibraryToJson(customFormulas, favoriteIds);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MathFix-EDU-Thu-Vien-Cong-Thuc.json';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(
      `Đã xuất thư viện cá nhân (${customFormulas.length} công thức, ${favoriteIds.length} yêu thích).`,
      'success'
    );
  };

  const handleLibraryImportInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      await handleImportLibraryJson(text);
    } catch {
      notify('Không thể đọc tệp JSON thư viện.', 'warning');
    }
  };

  // Exam Normalization & Exam Tools actions (Sections XVI & XVII)
  const handleApplyNormalization = (options: ExamNormalizationOptions) => {
    if (!rawText.trim()) return;
    setPreNormSnapshot(rawText);
    const report = normalizeExamText(rawText, options);
    updateRawText(report.text, sourceType);
    runConversion(report.text, sourceType, extraWarnings);
    if (report.changesCount > 0) {
      notify(
        `Đã chuẩn hóa đề thi (${report.changesCount} vị trí: ${report.summary.join('; ')}). Có thể khôi phục bất kỳ lúc nào.`,
        'success'
      );
    } else {
      notify('Đã chạy chuẩn hóa lại toàn bộ công thức và giữ nguyên nguyên văn nội dung đề.', 'success');
    }
  };

  const handleRestorePreNorm = () => {
    if (preNormSnapshot === null) return;
    updateRawText(preNormSnapshot, sourceType);
    runConversion(preNormSnapshot, sourceType, extraWarnings);
    setPreNormSnapshot(null);
    notify('Đã khôi phục văn bản trước khi chuẩn hóa.', 'info');
  };

  const handleRenumberQuestions = (
    startNumber: number,
    fromCursor: boolean,
    prefix: 'Câu' | 'Bài'
  ) => {
    if (!rawText.trim()) return;
    let fromLineIndex = 0;
    if (fromCursor && textareaRef.current) {
      const pos = textareaRef.current.selectionStart ?? 0;
      fromLineIndex = rawText.slice(0, pos).split('\n').length - 1;
    }
    const res = renumberQuestions(rawText, { startNumber, fromLineIndex, prefix });
    if (res.renumberedCount === 0) {
      notify(`Không tìm thấy dòng nào bắt đầu bằng "${prefix} <số>." để đánh số lại.`, 'info');
      return;
    }
    updateRawText(res.text, sourceType);
    runConversion(res.text, sourceType, extraWarnings);
    notify(
      `Đã đánh số lại ${res.renumberedCount} câu bắt đầu từ ${prefix} ${startNumber}. (Giữ nguyên các câu chùm).`,
      'success'
    );
  };

  const handleAlignMcqOptions = (cols: OptionLayoutColumns) => {
    if (!rawText.trim()) return;
    const res = formatMultipleChoiceOptions(rawText, cols);
    if (res.blocksFormatted === 0) {
      notify('Không tìm thấy cụm phương án A. B. C. D. đầy đủ nào để căn chỉnh.', 'info');
      return;
    }
    updateRawText(res.text, sourceType);
    runConversion(res.text, sourceType, extraWarnings);
    notify(`Đã căn chỉnh ${res.blocksFormatted} câu trắc nghiệm theo bố cục ${cols} cột.`, 'success');
  };

  const handleFormatTrueFalse = () => {
    const res = formatTrueFalseItems(rawText);
    updateRawText(res.text, sourceType);
    runConversion(res.text, sourceType, extraWarnings);
    notify(
      res.formattedCount > 0
        ? `Đã chuẩn hóa ${res.formattedCount} mục Đúng/Sai a) b) c) d).`
        : 'Các mục Đúng/Sai a) b) c) d) đã đúng định dạng.',
      'success'
    );
  };

  const handleAppendShortAnswerBoxes = () => {
    const res = appendShortAnswerBoxes(rawText);
    if (res.insertedCount === 0) {
      notify('Không có câu hỏi trả lời ngắn mới nào cần thêm dòng đáp án.', 'info');
      return;
    }
    updateRawText(res.text, sourceType);
    runConversion(res.text, sourceType, extraWarnings);
    notify(`Đã chèn ${res.insertedCount} dòng trả lời ngắn.`, 'success');
  };

  const handleAppendEssayLines = (lineCount: number) => {
    const res = appendEssayWritingSpace(rawText, lineCount);
    if (res.insertedCount === 0) {
      notify('Không có bài tự luận mới nào cần thêm dòng làm bài.', 'info');
      return;
    }
    updateRawText(res.text, sourceType);
    runConversion(res.text, sourceType, extraWarnings);
    notify(`Đã thêm vùng kẻ làm bài cho ${res.insertedCount} bài tự luận.`, 'success');
  };

  const handleInsertQuestionTemplate = (kind: 'mcq' | 'true_false' | 'short_answer' | 'essay') => {
    const existingCount = (rawText.match(/^\s*(?:Câu|Bài)\s+\d+\./gim) || []).length;
    const tpl = `\n${buildQuestionTemplate(kind, existingCount + 1)}\n`;
    insertTextAtCursor(tpl, 'Đã chèn khung mẫu câu hỏi tại vị trí con trỏ.');
  };

  // Formula verification decisions
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
    notify(
      'Đã chấp nhận tất cả các thay đổi an toàn. Các công thức mơ hồ vẫn được giữ lại để thầy cô kiểm tra.',
      'success'
    );
  };

  const handleRestoreAllOriginal = () => {
    if (!processedDoc) return;
    setProcessedDoc(
      mapFormulasInDocument(processedDoc, (f) => applyFormulaDecision(f, 'reject'))
    );
    notify('Đã khôi phục toàn bộ công thức về nguyên bản gốc.', 'info');
  };

  // Copy & Export actions
  const handleCopyFormula = async (
    format: 'display' | 'latex' | 'mathml' | 'unicodemath' | 'svg' | 'png'
  ) => {
    setCopyFormulaMenuOpen(false);
    const targetFormula =
      selectedFormula || (formulaMap.size > 0 ? formulaMap.values().next().value ?? null : null);
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
      // Ensure every figure referenced in the document has a crisp PNG fallback for Word 2016/2019/365
      const hydratedFigures = new Map<string, FigureAsset>(figuresMap);
      for (const [id, fig] of figuresMap.entries()) {
        if (!fig.pngDataUrl && fig.svgMarkup) {
          try {
            const pngDataUrl = await svgMarkupToPngDataUrl(fig.svgMarkup, 1120);
            if (pngDataUrl) {
              hydratedFigures.set(id, { ...fig, pngDataUrl });
            }
          } catch {
            // Keep existing asset if canvas rasterization fails
          }
        }
      }

      await exportDocxFile(processedDoc, 'MathFix-EDU-Tai-Lieu.docx', {
        style: examStyle,
        header: examHeader,
        figures: hydratedFigures,
      });
      notify(
        'Đã xuất tệp Word (.docx) gồm văn bản, công thức Word Equation (OMML) chỉnh sửa được và hình minh họa sắc nét theo chuẩn A4.',
        'success'
      );
    } catch (err) {
      notify(
        err instanceof Error ? `Lỗi xuất DOCX: ${err.message}` : 'Không thể xuất tệp DOCX.',
        'warning'
      );
    }
  };

  const handleExportSingleFormulaDocx = async () => {
    const target =
      selectedFormula || (formulaMap.size > 0 ? formulaMap.values().next().value ?? null : null);
    if (!target) {
      notify('Vui lòng chọn một công thức để xuất riêng ra tệp Word Equation.', 'warning');
      return;
    }
    try {
      await exportSingleFormulaDocx(target, 'MathFix-EDU-Cong-Thuc.docx');
      notify('Đã xuất công thức đang chọn thành tệp Word (.docx) chỉnh sửa được.', 'success');
    } catch (err) {
      notify(
        err instanceof Error ? `Lỗi xuất DOCX: ${err.message}` : 'Không thể xuất công thức.',
        'warning'
      );
    }
  };

  const handleExportPdf = () => {
    if (!processedDoc) {
      notify('Chưa có kết quả chuẩn hóa để xuất PDF.', 'warning');
      return;
    }
    notify('Đang mở hộp thoại in/lưu PDF khổ A4 với đầy đủ dấu tiếng Việt và công thức vector.', 'info');
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
    mathCount: 0,
    physicsCount: 0,
    chemistryCount: 0,
  };
  const remainingIssues = stats.needsReviewCount + stats.unrecoverableCount;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Hidden global file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.pdf,.txt,.html,.htm,.md,.tex"
        onChange={handleFileUpload}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
        onChange={handleImageFileUpload}
        className="hidden"
      />
      <input
        ref={libraryImportRef}
        type="file"
        accept=".json,application/json"
        onChange={handleLibraryImportInput}
        className="hidden"
      />

      {/* HEADER — Clean 3-zone bar (Section XXIV branding) */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand Zone */}
          <button
            type="button"
            onClick={() => setViewMode('workspace')}
            className="flex items-center gap-2.5 text-left shrink-0 cursor-pointer"
          >
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
                Sao chép – Soạn thảo – Chuyển đổi – Sử dụng ngay
              </span>
            </div>
          </button>

          {/* Center Nav */}
          <nav className="hidden md:flex items-center gap-6 text-[15px] font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setViewMode('workspace')}
              className={`inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'workspace' && !compareMode && activePanel !== 'library'
                  ? 'text-[#0B4F8A] font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              <PenTool className="h-4 w-4" aria-hidden="true" />
              <span>Soạn thảo</span>
            </button>
            <button
              type="button"
              onClick={() =>
                viewMode === 'drawing' ? setViewMode('workspace') : openDrawingMode('vector_2d')
              }
              className={`inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'drawing' ? 'text-[#0B4F8A] font-semibold' : 'hover:text-slate-900'
              }`}
            >
              <Shapes className="h-4 w-4" aria-hidden="true" />
              <span>Vẽ hình</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('workspace');
                setCompareMode((v) => !v);
              }}
              className={`inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'workspace' && compareMode
                  ? 'text-[#0B4F8A] font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              <GitCompare className="h-4 w-4" aria-hidden="true" />
              <span>Đối chiếu</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('workspace');
                setActivePanel((p) => (p === 'library' ? 'none' : 'library'));
              }}
              className={`inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'workspace' && activePanel === 'library'
                  ? 'text-[#0B4F8A] font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              <BookMarked className="h-4 w-4" aria-hidden="true" />
              <span>Thư viện</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === 'guide' ? 'workspace' : 'guide'))}
              className={`inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'guide' ? 'text-[#0B4F8A] font-semibold' : 'hover:text-slate-900'
              }`}
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span>Hướng dẫn</span>
            </button>
          </nav>

          {/* Right Action Zone */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportWord}
              disabled={!processedDoc}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B4F8A] px-3.5 py-1.5 text-[15px] font-semibold text-white hover:bg-[#093F6F] disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              <span>Xuất Word (.docx)</span>
            </button>
            <PWAInstallControl externalTriggerCount={pwaTriggerCount} />
            <button
              type="button"
              onClick={toggleFullscreen}
              className="hidden sm:inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
              aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* TOAST FEEDBACK */}
      {toast && (
        <div className="no-print fixed bottom-16 right-4 z-50 max-w-md rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          <div className="flex items-start gap-2.5">
            {toast.tone === 'success' && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* DEDICATED FULL-PAGE GUIDE VIEW (Section XXI) OR DEDICATED DRAWING WORKSPACE */}
      {viewMode === 'guide' ? (
        <GuideView
          onBack={() => setViewMode('workspace')}
          onTrySample={handleSelectSample}
          onOpenStudio={(subj) => openStudioCreate(subj)}
          onOpenLibrary={() => {
            setLibraryTab('all');
            setActivePanel('library');
          }}
        />
      ) : viewMode === 'drawing' ? (
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center p-10 text-base text-slate-600">
              Đang tải Không gian Vẽ hình khoa học MathFix EDU...
            </div>
          }
        >
          <DrawingWorkspace
            key={`${drawingMode}-${editingFigure?.id || 'new'}`}
            initialMode={drawingMode}
            activeSubjectMode={subjectMode}
            editingFigure={editingFigure}
            customTemplates={customFigureTemplates}
            favoriteIds={figureFavoriteIds}
            recentEntries={figureRecents}
            onCommitFigure={handleCommitFigure}
            onSaveCustomTemplate={handleSaveCustomFigureTemplate}
            onDeleteCustomTemplate={handleDeleteCustomFigureTemplate}
            onToggleFavoriteTemplate={handleToggleFavoriteFigureTemplate}
            onRecordRecentTemplate={handleRecordRecentFigureTemplate}
            onClose={() => {
              setEditingFigureId(null);
              setViewMode('workspace');
            }}
          />
        </Suspense>
      ) : (
        <>
          {/* MICROSOFT WORD–STYLE RIBBON TOOLBAR (9 GROUPS INCL. DRAWING & FIGURES) */}
          <RibbonToolbar
            activeTab={ribbonTab}
            onChangeTab={setRibbonTab}
            subjectMode={subjectMode}
            onChangeSubjectMode={handleChangeSubjectMode}
            collapsed={ribbonCollapsed}
            onToggleCollapse={() => setRibbonCollapsed((c) => !c)}
            canUndo={canUndo}
            canRedo={canRedo}
            hasContent={Boolean(rawText.trim())}
            hasProcessedDoc={Boolean(processedDoc)}
            hasSelectedFormula={Boolean(selectedFormula || formulaMap.size > 0)}
            hasSelectedFigure={Boolean(activeFigure)}
            isProcessing={processingState === 'processing'}
            isFullscreen={isFullscreen}
            // Group 1
            onPaste={handlePasteButton}
            onUploadFile={() => fileInputRef.current?.click()}
            onConvertNow={() => {
              runConversion(rawText);
              setMobileTab('result');
            }}
            onCopyFormula={() => handleCopyFormula('display')}
            onCopySelection={() => handleCopySelectedParagraph()}
            onCopyAll={handleCopyAll}
            onCopyForWord={handleCopyForWord}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClearAll}
            // Group 2
            onOpenFormatConverter={(fmt) => {
              setConverterFormat(fmt);
              setActivePanel('converter');
            }}
            // Group 3
            onCreateNewFormula={(subj) => openStudioCreate(subj || 'math')}
            onEditSelectedFormula={() => {
              const target =
                selectedFormula ||
                (formulaMap.size > 0 ? formulaMap.values().next().value ?? null : null);
              if (target) openStudioEdit(target);
              else openStudioCreate('math');
            }}
            onInsertFormulaIntoText={() => openStudioCreate(subjectMode === 'auto' ? 'math' : subjectMode)}
            // Group 3b: Drawing & Figures
            onOpenDrawingMode={(mode) => openDrawingMode(mode, null)}
            onEditSelectedFigure={() => {
              if (activeFigure) handleEditFigure(activeFigure);
              else notify('Vui lòng nhấp chọn một hình trong tài liệu để chỉnh sửa.', 'info');
            }}
            onUploadImageFile={() => imageInputRef.current?.click()}
            onPasteImageFromClipboard={handlePasteImageFromClipboard}
            onExportSelectedFigureSvg={() => {
              if (activeFigure) void handleExportFigureFile(activeFigure, 'svg');
            }}
            onExportSelectedFigurePng={() => {
              if (activeFigure) void handleExportFigureFile(activeFigure, 'png');
            }}
            // Group 4
            onOpenLibrary={(tab) => {
              setLibraryTab(tab);
              setActivePanel('library');
            }}
            onImportLibrary={() => libraryImportRef.current?.click()}
            onExportLibrary={handleExportLibraryJson}
            // Group 5
            onOpenExamNormalizer={() => {
              setExamPanelMode('normalize');
              setActivePanel('exam');
            }}
            onQuickNormalizeAll={() => handleApplyNormalization(DEFAULT_NORMALIZATION_OPTIONS)}
            // Group 6
            onOpenExamTools={() => {
              setExamPanelMode('tools');
              setActivePanel('exam');
            }}
            onRenumberAll={() => handleRenumberQuestions(1, false, 'Câu')}
            onInsertQuestionTemplate={handleInsertQuestionTemplate}
            onAlignMcqOptions={handleAlignMcqOptions}
            // Group 7
            onExportWord={handleExportWord}
            onExportPdf={handleExportPdf}
            onExportSingleFormulaDocx={handleExportSingleFormulaDocx}
            onOpenPrintPreview={() => setActivePanel('preview')}
            onPrint={handleExportPdf}
            // Group 8
            onOpenGuide={() => setViewMode('guide')}
            onToggleSamples={() => setSamplesOpen((v) => !v)}
            onToggleFullscreen={toggleFullscreen}
            onTriggerPwaInstall={() => setPwaTriggerCount((c) => c + 1)}
            isPwaInstalled={isPwaInstalled}
          />

          {/* MOBILE TWO-TAB SWITCHER */}
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

          {/* MAIN WORKSPACE */}
          <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-3 sm:px-6">
            {/* Large-document chunked progress indicator with Cancel button (Section XXIII) */}
            {processingState === 'processing' && processingProgress !== null && (
              <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-slate-800">
                <div className="flex flex-1 items-center gap-3 min-w-[200px]">
                  <span className="font-medium text-[#0B4F8A]">
                    Đang chuẩn hóa tài liệu lớn ({processingProgress}%)...
                  </span>
                  <div className="h-2 flex-1 max-w-xs overflow-hidden rounded-full bg-sky-200">
                    <div
                      className="h-full bg-[#0B4F8A] transition-all duration-150"
                      style={{ width: `${processingProgress}%` }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelConversion}
                  className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Hủy xử lý</span>
                </button>
              </div>
            )}

            {/* Optional local draft restore prompt */}
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

            {/* DOCKED PANELS (Never darken or block the document workspace!) */}
            <FormulaStudioPanel
              open={activePanel === 'studio'}
              mode={studioMode}
              formula={editingFormula}
              initialSubject={studioSubject}
              initialLatex={studioInitialLatex}
              onClose={() => {
                setActivePanel('none');
                setEditingFormulaId(null);
              }}
              onApplyEdit={handleApplyStudioEdit}
              onInsertIntoDocument={handleInsertFormulaFromStudio}
              onSaveToLibrary={handleSavePersonalFormula}
              onNotify={notify}
            />

            <FormulaLibraryPanel
              open={activePanel === 'library'}
              activeTab={libraryTab}
              onChangeTab={setLibraryTab}
              customFormulas={customFormulas}
              favoriteIds={favoriteIds}
              recentEntries={recentEntries}
              onClose={() => setActivePanel('none')}
              onSavePersonalFormula={handleSavePersonalFormula}
              onDeletePersonalFormula={handleDeletePersonalFormula}
              onToggleFavorite={handleToggleFavorite}
              onRecordRecent={handleRecordRecent}
              onInsertIntoStudio={(item) => openStudioCreate(item.subject, item.latex)}
              onInsertIntoDocument={(item) => {
                const wrapped = item.displayMode ? `\n$$${item.latex}$$\n` : `$${item.latex}$`;
                insertTextAtCursor(wrapped, `Đã chèn "${item.name}" vào văn bản.`);
              }}
              onImportJson={handleImportLibraryJson}
              onExportJson={handleExportLibraryJson}
              onNotify={notify}
            />

            <FormatConverterPanel
              open={activePanel === 'converter'}
              initialFormat={converterFormat}
              selectedFormula={selectedFormula}
              document={processedDoc}
              formulaMap={formulaMap}
              onClose={() => setActivePanel('none')}
              onNotify={notify}
            />

            <ExamToolsPanel
              open={activePanel === 'exam'}
              mode={examPanelMode}
              onChangeMode={setExamPanelMode}
              rawText={rawText}
              examStyle={examStyle}
              onChangeExamStyle={setExamStyle}
              examHeader={examHeader}
              onChangeExamHeader={setExamHeader}
              canRestorePreNorm={preNormSnapshot !== null}
              onApplyNormalization={handleApplyNormalization}
              onRestorePreNorm={handleRestorePreNorm}
              onRenumberQuestions={handleRenumberQuestions}
              onAlignMcqOptions={handleAlignMcqOptions}
              onFormatTrueFalse={handleFormatTrueFalse}
              onAppendShortAnswerBoxes={handleAppendShortAnswerBoxes}
              onAppendEssayLines={handleAppendEssayLines}
              onInsertTemplate={handleInsertQuestionTemplate}
              onOpenPrintPreview={() => setActivePanel('preview')}
              onClose={() => setActivePanel('none')}
            />

            <PrintPreviewPanel
              open={activePanel === 'preview'}
              document={processedDoc}
              figures={figuresMap}
              examStyle={examStyle}
              examHeader={examHeader}
              onExportWord={handleExportWord}
              onExportPdf={handleExportPdf}
              onPrint={handleExportPdf}
              onClose={() => setActivePanel('none')}
            />

            {/* TWO-PANE DOCUMENT WORKSPACE */}
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
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="text-[15px] font-semibold text-slate-900 whitespace-nowrap">
                      Văn bản gốc
                    </h1>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="truncate text-xs sm:text-sm text-slate-500">
                      {SOURCE_LABELS[sourceType]}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Practice Samples Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setSamplesOpen((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Ví dụ thực hành</span>
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      </button>

                      {samplesOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setSamplesOpen(false)}
                          />
                          <div className="absolute right-0 top-full z-40 mt-1.5 w-[330px] sm:w-[390px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
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
                                  <span className="text-sm font-medium text-slate-900">
                                    {s.title}
                                  </span>
                                  <span className="text-xs text-slate-500">{s.description}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => runConversion(rawText)}
                      className="rounded-md bg-[#0B4F8A]/10 px-2.5 py-1 text-xs font-semibold text-[#0B4F8A] hover:bg-[#0B4F8A] hover:text-white transition-colors cursor-pointer"
                    >
                      Chuyển đổi
                    </button>
                  </div>
                </div>

                <textarea
                  ref={textareaRef}
                  value={rawText}
                  onChange={(e) => updateRawText(e.target.value)}
                  onPaste={handleTextareaPaste}
                  onDragOver={(e) => {
                    if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
                  }}
                  onDrop={handleTextareaDrop}
                  spellCheck={false}
                  placeholder={`Dán công thức, đoạn văn, hình ảnh hoặc toàn bộ đề kiểm tra Toán – Vật lí – Hóa học vào đây (Ctrl+V / Cmd+V hoặc kéo thả ảnh)...\n\nVí dụ:\n- Toán học: \\frac{x^2+1}{2}, \\int_0^1 x^2 dx, \\begin{cases} x+y=3 \\\\ x-y=1 \\end{cases}\n- Vật lí: \\vec{F} = m\\vec{a}, W_d = \\frac12mv^2, F_ms = \\mu N, v = 10 m/s\n- Hóa học: H2SO4, Fe3+, SO4^2-, 2H2 + O2 ->[t°] 2H2O, CaCO3 ->[t°] CaO + CO2 ↑\n\nMở thẻ "Vẽ hình & Chèn hình" để vẽ hình 2D, 3D, đồ thị, bảng biến thiên, mạch điện hoặc công thức cấu tạo Hóa học.`}
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
                {/* Right Pane Header + Quick Copy & Zoom Controls */}
                <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <h2 className="text-[15px] font-semibold text-slate-900 whitespace-nowrap">
                      Văn bản đã chuẩn hóa
                    </h2>
                    {processedDoc && (
                      <span className="text-xs text-slate-600 whitespace-nowrap">
                        {stats.totalFormulas} công thức
                        {stats.totalFormulas > 0 && (
                          <>
                            {' '}
                            (Toán {stats.mathCount ?? 0} · Lí {stats.physicsCount ?? 0} · Hóa{' '}
                            {stats.chemistryCount ?? 0})
                          </>
                        )}
                        {remainingIssues > 0 && (
                          <span className="ml-1.5 font-semibold text-amber-700">
                            · {remainingIssues} cần kiểm tra
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Quick Copy & Zoom Toolbar */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyForWord}
                      disabled={!processedDoc}
                      className="inline-flex items-center gap-1 rounded-md bg-[#0B4F8A] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#093F6F] disabled:opacity-45 cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Sao chép cho Word</span>
                    </button>

                    {/* Copy Formula Multi-Format Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCopyFormulaMenuOpen((v) => !v)}
                        disabled={!processedDoc || stats.totalFormulas === 0}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Chép công thức</span>
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      </button>

                      {copyFormulaMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setCopyFormulaMenuOpen(false)}
                          />
                          <div className="absolute right-0 top-full z-40 mt-1 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                            <button
                              type="button"
                              onClick={() => handleCopyFormula('display')}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-900 hover:bg-sky-50 cursor-pointer"
                            >
                              <span>Công thức chuẩn Word (OMML + MathML)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyFormula('mathml')}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              <span>Sao chép MathML thuần</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyFormula('latex')}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              <span>Sao chép mã LaTeX</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyFormula('unicodemath')}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              <span>Sao chép UnicodeMath</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyFormula('svg')}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              <span>Sao chép Vector SVG</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyFormula('png')}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              <span>Sao chép ảnh PNG (3x DPI)</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopySelectedParagraph()}
                      disabled={!processedDoc}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 cursor-pointer"
                      title="Sao chép vùng đang bôi đen hoặc đoạn văn đang chọn"
                    >
                      <ClipboardCopy className="h-3.5 w-3.5" />
                      <span className="hidden xl:inline">Chép đoạn</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyAll}
                      disabled={!processedDoc}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-[#0B4F8A] hover:text-[#0B4F8A] disabled:opacity-45 cursor-pointer"
                      title="Sao chép toàn bộ tài liệu đã chuẩn hóa"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span className="hidden xl:inline">Chép tất cả</span>
                    </button>

                    {/* Reading Zoom Controls (Section XX) */}
                    <div className="inline-flex items-center rounded-md border border-slate-200 bg-white px-1 py-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setZoomPercent((z) => Math.max(80, z - 10))}
                        className="rounded p-0.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
                        title="Thu nhỏ công thức"
                        aria-label="Thu nhỏ cỡ hiển thị"
                      >
                        <ZoomOut className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomPercent(100)}
                        className="px-1 font-medium text-slate-700 cursor-pointer"
                        title="Đặt lại 100%"
                      >
                        {zoomPercent}%
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomPercent((z) => Math.min(150, z + 10))}
                        className="rounded p-0.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
                        title="Phóng to công thức"
                        aria-label="Phóng to cỡ hiển thị"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Normalized Document Scroll Area */}
                <div className="mathfix-scroll flex-1 overflow-y-auto p-4 sm:p-6 lg:max-h-[76vh]">
                  <NormalizedDocumentView
                    document={processedDoc}
                    figures={figuresMap}
                    compareMode={compareMode}
                    selectedFormulaId={selectedFormulaId}
                    selectedFigureId={selectedFigureId}
                    selectedParagraphId={selectedParagraphId}
                    contentRef={normalizedContentRef}
                    examStyle={examStyle}
                    examHeader={examHeader}
                    zoomPercent={zoomPercent}
                    onSelectFormula={(formula, openEditor) => {
                      setSelectedFormulaId(formula.id);
                      if (openEditor) {
                        openStudioEdit(formula);
                      }
                    }}
                    onSelectFigure={(figId) => setSelectedFigureId(figId)}
                    onEditFigure={handleEditFigure}
                    onUpdateFigure={handleUpdateFigureInline}
                    onRemoveFigure={handleRemoveFigureFromDoc}
                    onExportFigure={(fig, fmt) => void handleExportFigureFile(fig, fmt)}
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

                {/* Compact Bottom Utility Strip inside right pane (Local draft opt-in & offline indicator) */}
                <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-1.5 text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <span>Nhấp công thức để sửa trực quan · Bôi đen + Ctrl+C để chép nhanh</span>
                    {!isOnline && (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                        <WifiOff className="h-3.5 w-3.5" />
                        Đang chạy ngoại tuyến
                      </span>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={autoSaveDraft}
                      onChange={(e) => setAutoSaveDraft(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[#0B4F8A]"
                    />
                    <span>Tự lưu nháp cục bộ (IndexedDB)</span>
                  </label>
                </div>
              </section>
            </div>
          </main>
        </>
      )}

      {/* FOOTER — Section XXIV Strict Requirement: ONLY copyright line */}
      <footer className="no-print border-t border-slate-200 bg-white py-3 text-center text-sm text-slate-600">
        Copyright © 2026 – Phát triển bởi Thầy Hồ Nguyễn Đa Thiện
      </footer>
    </div>
  );
}
