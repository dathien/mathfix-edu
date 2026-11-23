import * as pdfjsLib from 'pdfjs-dist';

// Point PDF.js worker to our locally bundled offline worker (zero CDN!)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export interface PdfImportResult {
  text: string;
  pageCount: number;
  hasTextLayer: boolean;
  warnings: string[];
}

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function importPdfFromArrayBuffer(buffer: ArrayBuffer): Promise<PdfImportResult> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const warnings: string[] = [];
  const pageTexts: string[] = [];
  let totalChars = 0;

  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    const items: PositionedItem[] = [];
    for (const rawItem of content.items) {
      if (!('str' in rawItem) || !rawItem.str) continue;
      const transform = rawItem.transform as number[];
      const x = transform[4] ?? 0;
      const y = transform[5] ?? 0;
      const height = Math.abs(transform[3] ?? transform[0] ?? 12);
      const width = rawItem.width ?? 0;
      items.push({ str: rawItem.str, x, y, width, height });
      totalChars += rawItem.str.trim().length;
    }

    if (items.length === 0) continue;

    // Group items by baseline Y coordinate (top-to-bottom), detecting superscripts/subscripts closely aligned
    items.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 4.5) return b.y - a.y;
      return a.x - b.x;
    });

    const lines: PositionedItem[][] = [];
    for (const item of items) {
      const lastLine = lines[lines.length - 1];
      if (!lastLine) {
        lines.push([item]);
        continue;
      }
      const refY = lastLine[0].y;
      const refH = Math.max(lastLine[0].height, 10);
      if (Math.abs(item.y - refY) <= refH * 0.6) {
        lastLine.push(item);
      } else {
        lines.push([item]);
      }
    }

    const reconstructedLines = lines.map((line) => {
      line.sort((a, b) => a.x - b.x);
      let lineStr = '';
      let prevEndX = line[0].x;
      const baseY = line[0].y;

      for (let idx = 0; idx < line.length; idx++) {
        const cur = line[idx];
        const gap = cur.x - prevEndX;
        if (idx > 0 && gap > 2.5 && !lineStr.endsWith(' ') && !cur.str.startsWith(' ')) {
          lineStr += ' ';
        }
        // Detect small raised superscript token (e.g. x² in PDF where '2' sits higher)
        const isSmallSup =
          idx > 0 &&
          cur.y - baseY > 2.2 &&
          cur.height < line[0].height * 0.85 &&
          /^[0-9a-zA-Z+\-n]+$/.test(cur.str.trim()) &&
          gap < 8;

        if (isSmallSup) {
          const val = cur.str.trim();
          lineStr += val.length === 1 ? `^${val}` : `^{${val}}`;
        } else {
          lineStr += cur.str;
        }
        prevEndX = cur.x + cur.width;
      }
      return lineStr.trim();
    });

    pageTexts.push(reconstructedLines.filter(Boolean).join('\n'));
  }

  const hasTextLayer = totalChars > 0;
  if (!hasTextLayer) {
    warnings.push(
      'Tệp PDF này là bản quét (ảnh) không có lớp văn bản. MathFix EDU không giả lập OCR offline; vui lòng sử dụng PDF có lớp văn bản, tệp DOCX hoặc dán trực tiếp nội dung.'
    );
  } else {
    warnings.push(
      'Đã trích xuất văn bản từ lớp text PDF. Với các phân số hoặc ma trận phức tạp bị tách dòng trong PDF, giáo viên nên rà soát lại ở Chế độ đối chiếu hoặc sửa nhanh bằng MathLive.'
    );
  }

  return {
    text: pageTexts.join('\n\n').trim(),
    pageCount,
    hasTextLayer,
    warnings,
  };
}
