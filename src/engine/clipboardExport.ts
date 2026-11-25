import { DocumentBlock, FormulaSegment, InlineSegment, ParagraphBlock, ProcessedDocument } from './types';
import { escapeXml, mathmlToOmml } from './mathmlConverter';
import { renderLatexToSvg, sanitizePresentationMathML } from './mathjaxRenderer';
import { mathmlToUnicodeMath } from './formatConverter';

export interface ClipboardCopyResult {
  ok: boolean;
  message: string;
  method?: 'execCommand' | 'asyncApi' | 'plainOnly' | 'failed';
}

export interface ExportPair {
  html: string;
  plain: string;
}

/**
 * Wrap an HTML fragment in Microsoft Word's native Office HTML clipboard envelope.
 * Declares xmlns:m="http://schemas.microsoft.com/office/2004/12/omml" so Microsoft Word
 * Desktop recognizes <!--[if gte msEquation 12]><m:oMath>...</m:oMath><![endif]--> as
 * real, editable Word Equations, while non-Word HTML consumers render the clean
 * Presentation MathML inside <![if !msEquation]>...<![endif]>.
 */
export function wrapWordOfficeHtml(bodyFragment: string): string {
  return (
    `<html xmlns:v="urn:schemas-microsoft-com:vml"` +
    ` xmlns:o="urn:schemas-microsoft-com:office:office"` +
    ` xmlns:w="urn:schemas-microsoft-com:office:word"` +
    ` xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"` +
    ` xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head>` +
    `<meta http-equiv="Content-Type" content="text/html; charset=utf-8">` +
    `<meta name="ProgId" content="Word.Document">` +
    `<meta name="Generator" content="Microsoft Word 15">` +
    `<meta name="Originator" content="Microsoft Word 15">` +
    `<style>p.MsoNormal{margin:0 0 6pt 0;font-family:"Times New Roman",serif;font-size:13pt;line-height:1.5;}</style>` +
    `</head>` +
    `<body lang="VI" style="font-family:'Times New Roman',serif;font-size:13pt;line-height:1.5;">` +
    `<!--StartFragment-->${bodyFragment}<!--EndFragment-->` +
    `</body></html>`
  );
}

function getCleanFormulaMathML(formula: FormulaSegment): string {
  let rawMml = formula.mathml;
  if (!rawMml && formula.activeLatex && formula.validated) {
    const rendered = renderLatexToSvg(formula.activeLatex, formula.displayMode);
    if (rendered.ok) {
      rawMml = rendered.mathml;
    }
  }
  return sanitizePresentationMathML(rawMml);
}

/**
 * Build dual-compatible Word Office OMML + Presentation MathML markup for a single formula.
 * - Word Desktop reads: <!--[if gte msEquation 12]><m:oMath>...</m:oMath><![endif]-->
 * - Non-Word rich editors / browsers read: <![if !msEquation]><math ...>...</math><![endif]>
 * Never embeds SVG images or raw LaTeX when the formula is valid.
 */
export function buildFormulaWordHtmlSnippet(formula: FormulaSegment, asBlockDisplay = false): string {
  // Complex 2D structural chemistry cannot be represented as linear OMML — keep monospace layout honestly
  if (formula.ommlCompatible === false) {
    return `<pre style="font-family:Consolas,monospace;font-size:11pt;margin:6pt 0;white-space:pre;">${escapeXml(formula.activeLatex || formula.raw)}</pre>`;
  }

  const cleanMathml = getCleanFormulaMathML(formula);
  if (cleanMathml && formula.validated) {
    const useDisplayPara = asBlockDisplay && formula.displayMode;
    const omml = mathmlToOmml(cleanMathml, useDisplayPara, {
      target: 'html',
      includeNamespaces: false,
    });
    const mmlForHtml =
      useDisplayPara && !/\bdisplay\s*=/.test(cleanMathml)
        ? cleanMathml.replace('<math ', '<math display="block" ')
        : cleanMathml;

    const dualMarkup = omml
      ? `<!--[if gte msEquation 12]>${omml}<![endif]--><![if !msEquation]>${mmlForHtml}<![endif]-->`
      : mmlForHtml;

    if (useDisplayPara) {
      return `<p class="MsoNormal" align="center" style="text-align:center;margin:8pt 0;">${dualMarkup}</p>`;
    }
    return dualMarkup;
  }

  const fallbackText = formula.displayMode ? `$$${formula.activeLatex}$$` : `$${formula.activeLatex}$`;
  return `<span>${escapeXml(fallbackText)}</span>`;
}

/**
 * Render an inline SVG string to a crisp 3x high-DPI PNG Blob via HTML5 Canvas.
 */
export async function svgToPngBlob(svgMarkup: string, scale = 3): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) {
      reject(new Error('Không tìm thấy dữ liệu SVG hợp lệ'));
      return;
    }

    const viewBox = svgEl.getAttribute('viewBox')?.split(/\s+/).map(Number);
    let widthPx = 320;
    let heightPx = 96;

    if (viewBox && viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
      const ratio = viewBox[3] / viewBox[2];
      widthPx = Math.max(48, Math.min(1800, Math.round((viewBox[2] / 1000) * 24)));
      heightPx = Math.max(28, Math.round(widthPx * ratio));
    }

    svgEl.setAttribute('width', `${widthPx}px`);
    svgEl.setAttribute('height', `${heightPx}px`);
    svgEl.style.color = '#0F172A';

    const serialized = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const pad = 16;
      const canvas = document.createElement('canvas');
      canvas.width = (widthPx + pad * 2) * scale;
      canvas.height = (heightPx + pad * 2) * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Không thể khởi tạo Canvas để xuất PNG'));
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, pad, pad, widthPx, heightPx);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Không thể tạo ảnh PNG'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Lỗi chuyển đổi SVG sang ảnh PNG'));
    };
    img.src = url;
  });
}

export async function copyPlainText(text: string): Promise<boolean> {
  return copyPlainTextFallback(text);
}

async function copyPlainTextFallback(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand
    }
  }
  if (typeof document === 'undefined') return false;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

/**
 * Write unsanitized Word-compatible HTML (preserving Office OMML conditional comments
 * <!--[if gte msEquation 12]><m:oMath>...</m:oMath><![endif]-->) + text/plain fallback.
 *
 * Strategy:
 * 1. Primary: one-shot `copy` event via `document.execCommand('copy')` + `clipboardData.setData`.
 *    Why: Chromium's Async Clipboard API (`navigator.clipboard.write`) runs Blink's HTML sanitizer
 *    on `text/html` blobs, which strips `<!--...-->` comments, `xmlns:m`, and `<m:oMath>` tags.
 *    The `copy` event `clipboardData.setData('text/html', ...)` writes the Office HTML verbatim
 *    to OS CF_HTML so Microsoft Word Desktop converts `<m:oMath>` into real Word Equations.
 * 2. Fallback: `navigator.clipboard.write` with `ClipboardItem` (preserves compact MathML + plain).
 * 3. Final fallback: plain text copy.
 */
export async function writeRichClipboard(
  html: string,
  plain: string
): Promise<{ ok: boolean; method: 'execCommand' | 'asyncApi' | 'plainOnly' | 'failed' }> {
  // Strategy 1: copy event with raw clipboardData.setData (bypasses Blink Async Clipboard HTML sanitizer)
  if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
    let listenerTriggered = false;
    const onCopy = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      e.clipboardData.setData('text/html', html);
      e.clipboardData.setData('text/plain', plain);
      listenerTriggered = true;
    };

    // Preserve user's existing selection so copying doesn't disrupt highlight
    const selection = window.getSelection();
    const savedRanges: Range[] = [];
    if (selection && selection.rangeCount > 0) {
      for (let i = 0; i < selection.rangeCount; i++) {
        savedRanges.push(selection.getRangeAt(i).cloneRange());
      }
    }

    const tempHolder = document.createElement('div');
    tempHolder.textContent = '\u200B';
    tempHolder.style.position = 'fixed';
    tempHolder.style.left = '-9999px';
    tempHolder.style.top = '0';
    tempHolder.style.opacity = '0';
    document.body.appendChild(tempHolder);

    document.addEventListener('copy', onCopy, { capture: true });
    let execOk = false;
    try {
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(tempHolder);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      execOk = document.execCommand('copy');
    } catch {
      execOk = false;
    } finally {
      document.removeEventListener('copy', onCopy, { capture: true });
      document.body.removeChild(tempHolder);
      if (selection) {
        selection.removeAllRanges();
        for (const r of savedRanges) {
          try {
            selection.addRange(r);
          } catch {
            // Ignore detached range
          }
        }
      }
    }

    if (execOk && listenerTriggered) {
      return { ok: true, method: 'execCommand' };
    }
  }

  // Strategy 2: Async Clipboard API (supported in sandboxed contexts; writes MathML HTML + plain)
  if (typeof ClipboardItem !== 'undefined' && typeof navigator !== 'undefined' && navigator.clipboard?.write) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return { ok: true, method: 'asyncApi' };
    } catch {
      // Fall through to plain text
    }
  }

  // Strategy 3: Plain text fallback
  const okPlain = await copyPlainTextFallback(plain);
  return { ok: okPlain, method: okPlain ? 'plainOnly' : 'failed' };
}

/**
 * Build clipboard payload for a SINGLE displayed formula:
 * - text/html: Microsoft Word Office HTML containing native OMML (<m:oMath>) + Presentation MathML fallback
 * - text/plain: Clean compact Presentation MathML (<math xmlns="http://www.w3.org/1998/Math/MathML">...</math>)
 *   so even if a user pastes with "Keep Text Only" in Word Desktop, Word's built-in mml2omml.xsl
 *   still converts it into a native Word Equation (never raw LaTeX when valid).
 */
export function buildDisplayedFormulaExportPair(formula: FormulaSegment): ExportPair {
  if (formula.ommlCompatible === false) {
    const raw = formula.activeLatex || formula.raw;
    return {
      html: wrapWordOfficeHtml(
        `<pre style="font-family:Consolas,monospace;font-size:11pt;white-space:pre;">${escapeXml(raw)}</pre>`
      ),
      plain: raw,
    };
  }
  const cleanMathml = getCleanFormulaMathML(formula);
  if (cleanMathml && formula.validated) {
    const snippet = buildFormulaWordHtmlSnippet(formula, formula.displayMode);
    const body = formula.displayMode ? snippet : `<p class="MsoNormal">${snippet}</p>`;
    return {
      html: wrapWordOfficeHtml(body),
      plain: cleanMathml,
    };
  }
  const fallback = formula.displayMode ? `$$${formula.activeLatex}$$` : `$${formula.activeLatex}$`;
  return {
    html: wrapWordOfficeHtml(`<p class="MsoNormal">${escapeXml(fallback)}</p>`),
    plain: fallback,
  };
}

export async function copyFormulaAs(
  formula: FormulaSegment,
  format: 'display' | 'latex' | 'mathml' | 'unicodemath' | 'svg' | 'png'
): Promise<ClipboardCopyResult> {
  try {
    if (format === 'display') {
      const { html, plain } = buildDisplayedFormulaExportPair(formula);
      const res = await writeRichClipboard(html, plain);
      if (!res.ok) {
        return {
          ok: false,
          method: res.method,
          message:
            'Trình duyệt chặn ghi clipboard. Vui lòng thử nhấn Ctrl+C hoặc dùng nút "Xuất Word (.docx)" để chèn Word Equation chuẩn.',
        };
      }
      if (res.method === 'plainOnly') {
        return {
          ok: true,
          method: res.method,
          message:
            'Đã sao chép công thức ở dạng MathML thuần (trình duyệt không hỗ trợ ghi HTML). Dán vào Word Desktop bằng Ctrl+V hoặc dùng "Xuất Word (.docx)".',
        };
      }
      return {
        ok: true,
        method: res.method,
        message:
          'Đã sao chép công thức (Office OMML + MathML). Dán vào Microsoft Word bằng Ctrl+V. Nếu phiên bản Word không tự nhận thành Equation, hãy dùng nút "Xuất Word (.docx)".',
      };
    }

    if (format === 'latex') {
      const text = formula.displayMode ? `$$${formula.activeLatex}$$` : `$${formula.activeLatex}$`;
      const ok = await copyPlainTextFallback(text);
      return {
        ok,
        method: ok ? 'plainOnly' : 'failed',
        message: ok ? 'Đã sao chép mã LaTeX chuẩn' : 'Không thể sao chép mã LaTeX vào clipboard',
      };
    }

    if (format === 'mathml') {
      const cleanMathml = getCleanFormulaMathML(formula);
      if (!cleanMathml) {
        return { ok: false, method: 'failed', message: 'Công thức chưa có MathML hợp lệ để sao chép' };
      }
      // IMPORTANT: Write ONLY text/plain (NO text/html flavor!) so Microsoft Word Desktop invokes
      // its built-in MathML-to-OMML converter (mml2omml.xsl) when the teacher presses Ctrl+V!
      const ok = await copyPlainTextFallback(cleanMathml);
      return {
        ok,
        method: ok ? 'plainOnly' : 'failed',
        message: ok
          ? 'Đã sao chép mã MathML chuẩn (text/plain). Dán vào Word Desktop bằng Ctrl+V (hoặc Keep Text Only) để Word tự chuyển thành Equation; nếu không tương thích, hãy dùng "Xuất Word (.docx)".'
          : 'Không thể sao chép MathML vào clipboard',
      };
    }

    if (format === 'unicodemath') {
      if (formula.ommlCompatible === false) {
        return {
          ok: false,
          method: 'failed',
          message:
            'Công thức cấu tạo 2D phức tạp không hỗ trợ chuyển đổi tuyến tính sang UnicodeMath.',
        };
      }
      const cleanMathml = getCleanFormulaMathML(formula);
      if (!cleanMathml) {
        return { ok: false, method: 'failed', message: 'Công thức chưa hợp lệ để chuyển sang UnicodeMath' };
      }
      const um = mathmlToUnicodeMath(cleanMathml);
      if (!um.supported) {
        return {
          ok: false,
          method: 'failed',
          message: um.warning || 'Cấu trúc công thức này chưa được hỗ trợ đầy đủ trong UnicodeMath',
        };
      }
      const ok = await copyPlainTextFallback(um.output);
      return {
        ok,
        method: ok ? 'plainOnly' : 'failed',
        message: ok
          ? 'Đã sao chép công thức dạng UnicodeMath. Trong Word, mở Equation (Alt+=) rồi dán và nhấn Space để định dạng.'
          : 'Không thể sao chép UnicodeMath vào clipboard',
      };
    }

    if (format === 'svg') {
      if (!formula.svg) {
        return { ok: false, method: 'failed', message: 'Công thức chưa có hình vector SVG' };
      }
      const ok = await copyPlainTextFallback(formula.svg);
      return {
        ok,
        method: ok ? 'plainOnly' : 'failed',
        message: ok ? 'Đã sao chép mã hình vector SVG' : 'Không thể sao chép SVG',
      };
    }

    if (format === 'png') {
      if (!formula.svg) {
        return { ok: false, method: 'failed', message: 'Công thức chưa có dữ liệu hiển thị để tạo PNG' };
      }
      const blob = await svgToPngBlob(formula.svg, 3);
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        return { ok: true, method: 'asyncApi', message: 'Đã sao chép ảnh công thức PNG sắc nét (3x DPI)' };
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cong-thuc-mathfix.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return {
        ok: true,
        method: 'plainOnly',
        message: 'Trình duyệt không hỗ trợ copy ảnh trực tiếp — đã tải xuống tệp PNG',
      };
    }

    return { ok: false, method: 'failed', message: 'Định dạng không hỗ trợ' };
  } catch (err) {
    return {
      ok: false,
      method: 'failed',
      message: err instanceof Error ? err.message : 'Lỗi khi sao chép công thức',
    };
  }
}

/**
 * Extract Word-compatible HTML (Office OMML + Presentation MathML) + plain text fallback
 * from a user's mouse DOM selection inside the normalized document pane.
 */
export function buildSelectionExportPair(
  selection: Selection | null,
  container: HTMLElement | null,
  formulaMap: Map<string, FormulaSegment>
): ExportPair | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !container) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  // Handle selection completely inside a single formula element
  const ancestorEl =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as Element)
      : range.commonAncestorContainer.parentElement;
  const enclosingFormulaEl = ancestorEl?.closest?.('[data-formula-id]');
  if (enclosingFormulaEl) {
    const fId = enclosingFormulaEl.getAttribute('data-formula-id');
    const formula = fId ? formulaMap.get(fId) : undefined;
    if (formula) {
      return buildDisplayedFormulaExportPair(formula);
    }
  }

  const fragment = range.cloneContents();
  const wrapper = document.createElement('div');
  wrapper.appendChild(fragment);

  // Strip UI-only helper buttons (e.g. hover "Chép đoạn" buttons) from copied payload
  wrapper.querySelectorAll('.no-print').forEach((el) => el.remove());

  const plainClone = wrapper.cloneNode(true) as HTMLDivElement;

  // Replace every [data-formula-id] with a unique placeholder token first, then splice raw
  // Office OMML + MathML markup (so DOM innerHTML parsing never strips <!--[if gte msEquation 12]>)
  const formulaPlaceholders: Array<{ token: string; markup: string }> = [];
  let idx = 0;

  wrapper.querySelectorAll('[data-formula-id]').forEach((el) => {
    const fId = el.getAttribute('data-formula-id');
    const formula = fId ? formulaMap.get(fId) : undefined;
    if (!formula) return;
    const token = `__MATHFIX_FORMULA_${idx++}__`;
    formulaPlaceholders.push({
      token,
      markup: buildFormulaWordHtmlSnippet(formula, formula.displayMode),
    });
    el.replaceWith(document.createTextNode(token));
  });

  plainClone.querySelectorAll('[data-formula-id]').forEach((el) => {
    const fId = el.getAttribute('data-formula-id');
    const formula = fId ? formulaMap.get(fId) : undefined;
    if (!formula) return;
    const tex = formula.displayMode ? `$$${formula.activeLatex}$$` : `$${formula.activeLatex}$`;
    el.replaceWith(document.createTextNode(tex));
  });

  const plain = (plainClone.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  let htmlFragment = wrapper.innerHTML.trim();
  for (const item of formulaPlaceholders) {
    htmlFragment = htmlFragment.replace(item.token, item.markup);
  }

  if (!plain && !htmlFragment) return null;

  return {
    html: wrapWordOfficeHtml(htmlFragment),
    plain,
  };
}

export async function copyExportPair(
  pair: ExportPair,
  successMessage = 'Đã sao chép vùng chọn (Office OMML + MathML kèm văn bản dự phòng)'
): Promise<ClipboardCopyResult> {
  const res = await writeRichClipboard(pair.html, pair.plain);
  return {
    ok: res.ok,
    method: res.method,
    message: res.ok
      ? successMessage
      : 'Không thể sao chép vùng chọn vào clipboard. Vui lòng thử nhấn Ctrl+C hoặc dùng nút Xuất Word (.docx).',
  };
}

function segmentsToWordHtml(segments: InlineSegment[]): string {
  return segments
    .map((seg) => {
      if (seg.type === 'text') {
        return escapeXml(seg.text);
      }
      return buildFormulaWordHtmlSnippet(seg, false);
    })
    .join('');
}

function segmentsToPlainText(segments: InlineSegment[]): string {
  return segments
    .map((seg) => {
      if (seg.type === 'text') return seg.text;
      return seg.displayMode ? `$$${seg.activeLatex}$$` : `$${seg.activeLatex}$`;
    })
    .join('');
}

function paragraphToWordBodyHtml(para: ParagraphBlock): string {
  if (para.segments.length === 0) {
    return '<p class="MsoNormal">&nbsp;</p>';
  }

  const hasDisplay = para.segments.some((s) => s.type === 'formula' && s.displayMode);
  if (!hasDisplay) {
    return `<p class="MsoNormal" style="font-family:'Times New Roman',serif;font-size:13pt;line-height:1.5;">${segmentsToWordHtml(para.segments)}</p>`;
  }

  // Split display formulas into dedicated centered equation paragraphs just like Word
  const parts: string[] = [];
  let inlineBuf: InlineSegment[] = [];

  const flushInline = () => {
    const hasContent = inlineBuf.some((s) => s.type === 'formula' || s.text.trim().length > 0);
    if (hasContent) {
      parts.push(
        `<p class="MsoNormal" style="font-family:'Times New Roman',serif;font-size:13pt;line-height:1.5;">${segmentsToWordHtml(inlineBuf)}</p>`
      );
    }
    inlineBuf = [];
  };

  for (const seg of para.segments) {
    if (seg.type === 'formula' && seg.displayMode) {
      flushInline();
      parts.push(buildFormulaWordHtmlSnippet(seg, true));
    } else {
      inlineBuf.push(seg);
    }
  }
  flushInline();
  return parts.join('\n');
}

export function paragraphToExportPair(para: ParagraphBlock): ExportPair {
  // If paragraph is a single standalone formula (no surrounding prose), export with MathML plain fallback too
  const nonEmptySegments = para.segments.filter(
    (s) => s.type === 'formula' || s.text.trim().length > 0
  );
  if (nonEmptySegments.length === 1 && nonEmptySegments[0].type === 'formula') {
    return buildDisplayedFormulaExportPair(nonEmptySegments[0]);
  }

  const body = paragraphToWordBodyHtml(para);
  const plain = segmentsToPlainText(para.segments);
  return { html: wrapWordOfficeHtml(body), plain };
}

export function documentToExportPair(doc: ProcessedDocument): ExportPair {
  // If the entire document is a single standalone formula (e.g. teacher pasted only "\frac{x^2+1}{2}"),
  // use buildDisplayedFormulaExportPair so BOTH text/html (Office OMML + MathML) AND text/plain (MathML)
  // convert seamlessly into a Word Equation!
  if (doc.blocks.length === 1 && doc.blocks[0].type === 'paragraph') {
    const nonEmpty = doc.blocks[0].segments.filter(
      (s) => s.type === 'formula' || s.text.trim().length > 0
    );
    if (nonEmpty.length === 1 && nonEmpty[0].type === 'formula') {
      return buildDisplayedFormulaExportPair(nonEmpty[0]);
    }
  }

  const htmlParts: string[] = [];
  const plainParts: string[] = [];

  for (const block of doc.blocks as DocumentBlock[]) {
    if (block.type === 'paragraph') {
      htmlParts.push(paragraphToWordBodyHtml(block));
      plainParts.push(segmentsToPlainText(block.segments));
    } else {
      const rowsHtml = block.rows
        .map(
          (r) =>
            `<tr>${r
              .map(
                (c) =>
                  `<td style="border:1px solid #94A3B8;padding:6px 10px;">${c.paragraphs
                    .map((p) => segmentsToWordHtml(p.segments))
                    .join('<br/>')}</td>`
              )
              .join('')}</tr>`
        )
        .join('');
      htmlParts.push(`<table style="border-collapse:collapse;margin:8pt 0;">${rowsHtml}</table>`);
      const rowsPlain = block.rows
        .map((r) => `| ${r.map((c) => c.paragraphs.map((p) => segmentsToPlainText(p.segments)).join(' ')).join(' | ')} |`)
        .join('\n');
      plainParts.push(rowsPlain);
    }
  }

  return {
    html: wrapWordOfficeHtml(htmlParts.join('\n')),
    plain: plainParts.join('\n'),
  };
}

export async function copyParagraph(para: ParagraphBlock): Promise<ClipboardCopyResult> {
  const pair = paragraphToExportPair(para);
  const res = await writeRichClipboard(pair.html, pair.plain);
  return {
    ok: res.ok,
    method: res.method,
    message: res.ok
      ? 'Đã sao chép đoạn văn (Office OMML + MathML kèm văn bản dự phòng). Nếu Word không nhận công thức qua clipboard, hãy dùng "Xuất Word (.docx)".'
      : 'Không thể sao chép đoạn văn vào clipboard',
  };
}

export async function copyWholeDocument(doc: ProcessedDocument): Promise<ClipboardCopyResult> {
  const pair = documentToExportPair(doc);
  const res = await writeRichClipboard(pair.html, pair.plain);
  return {
    ok: res.ok,
    method: res.method,
    message: res.ok
      ? 'Đã sao chép toàn bộ tài liệu (Office OMML + MathML và bản văn bản dự phòng). Để đảm bảo Word Equation chỉnh sửa 100% trên mọi phiên bản Word, khuyến nghị dùng nút "Xuất Word (.docx)".'
      : 'Không thể sao chép tài liệu vào clipboard',
  };
}

/**
 * Dedicated "Sao chép cho Word" action:
 * - Prioritizes active mouse selection inside normalized pane if present; otherwise exports entire document
 *   (or single standalone formula if the document contains only 1 formula).
 * - Preserves Vietnamese text, exact order of prose and formulas, zero images, zero math mutations.
 * - Writes Microsoft Word Office HTML (OMML conditional comments + clean Presentation MathML fallback)
 *   + plain text fallback via raw copy event first, with honest compatibility notice.
 */
export async function copyForWord(
  doc: ProcessedDocument,
  selection: Selection | null,
  container: HTMLElement | null,
  formulaMap: Map<string, FormulaSegment>
): Promise<ClipboardCopyResult> {
  const selPair = buildSelectionExportPair(selection, container, formulaMap);
  const pair = selPair ?? documentToExportPair(doc);
  const isSelection = Boolean(selPair);

  const res = await writeRichClipboard(pair.html, pair.plain);
  if (!res.ok) {
    return {
      ok: false,
      method: res.method,
      message:
        'Trình duyệt không cho phép ghi dữ liệu Word vào clipboard. Hãy dùng nút "Xuất Word (.docx)" để tải tệp chứa Word Equation chỉnh sửa chuẩn 100%.',
    };
  }

  if (res.method === 'plainOnly') {
    return {
      ok: true,
      method: res.method,
      message:
        'Trình duyệt chỉ cho phép ghi văn bản thuần (không hỗ trợ HTML/OMML). Nếu dán vào Word bị lỗi định dạng, hãy dùng nút "Xuất Word (.docx)" để đảm bảo Word Equation chuẩn.',
    };
  }

  return {
    ok: true,
    method: res.method,
    message: isSelection
      ? 'Đã sao chép vùng chọn cho Microsoft Word (Office OMML + MathML, giữ nguyên tiếng Việt). Lưu ý: Word Web hoặc phiên bản Word cũ có thể không nhận OMML qua clipboard — khi đó hãy dùng "Xuất Word (.docx)".'
      : 'Đã sao chép cho Microsoft Word (Office OMML + MathML, giữ nguyên tiếng Việt và thứ tự công thức). Nếu dán trên Word Web/Word cũ không chỉnh sửa được Equation, hãy dùng "Xuất Word (.docx)".',
  };
}

export async function readClipboardStructured(): Promise<{
  ok: boolean;
  html?: string;
  text?: string;
  hasImage?: boolean;
  permissionDenied?: boolean;
}> {
  if (navigator.clipboard?.read) {
    try {
      const items = await navigator.clipboard.read();
      let html = '';
      let text = '';
      let hasImage = false;
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          html = await blob.text();
        }
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          text = await blob.text();
        }
        if (item.types.some((t) => t.startsWith('image/'))) {
          hasImage = true;
        }
      }
      if (html || text || hasImage) {
        return { ok: true, html, text, hasImage };
      }
    } catch {
      // Try readText next
    }
  }

  if (navigator.clipboard?.readText) {
    try {
      const text = await navigator.clipboard.readText();
      return { ok: true, text };
    } catch {
      return { ok: false, permissionDenied: true };
    }
  }

  return { ok: false, permissionDenied: true };
}
