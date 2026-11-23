import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { MathML } from 'mathjax-full/js/input/mathml.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { SerializedMmlVisitor } from 'mathjax-full/js/core/MmlTree/SerializedMmlVisitor.js';
import { STATE } from 'mathjax-full/js/core/MathItem.js';

export interface RenderResult {
  svg: string;
  mathml: string;
  ok: boolean;
  error?: string;
}

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

// Filter out bussproofs and noundefined so unknown/unsupported TeX macros strictly fail validation
const packages = AllPackages.filter((pkg) => pkg !== 'bussproofs' && pkg !== 'noundefined');

const texInput = new TeX({
  packages,
  formatError: (_jax: unknown, err: { message?: string }) => {
    throw new Error(err?.message || 'Lỗi cú pháp TeX');
  },
});

const mmlInput = new MathML({});

const svgOutput = new SVG({
  fontCache: 'none', // Self-contained inline SVG paths for copy/export/offline!
});

const texDoc = mathjax.document('', {
  InputJax: texInput,
  OutputJax: svgOutput,
});

const mmlDoc = mathjax.document('', {
  InputJax: mmlInput,
  OutputJax: svgOutput,
});

const mmlVisitor = new SerializedMmlVisitor();

const renderCache = new Map<string, RenderResult>();
const MAX_CACHE_SIZE = 1500;

function extractSvgMarkup(node: unknown): string {
  const html = adaptor.outerHTML(node as Parameters<typeof adaptor.outerHTML>[0]);
  const svgMatch = html.match(/<svg[\s\S]*?<\/svg>/i);
  if (!svgMatch) return '';
  // Ensure xmlns is present for standalone SVG copy/PNG rasterization
  let svg = svgMatch[0];
  if (!svg.includes('xmlns=')) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

/**
 * Clean MathJax SerializedMmlVisitor output into compact, standard Presentation MathML 3:
 * - Removes MathJax-proprietary attributes (data-mjx-*) that can trip Word's mml2omml.xsl
 * - Strips pretty-printed newlines/indentation between tags so pasted HTML/MathML never
 *   produces stray line breaks or extra spaces in Word/rich editors
 * - Ensures xmlns="http://www.w3.org/1998/Math/MathML" is present on <math>
 */
export function sanitizePresentationMathML(rawMathml: string): string {
  if (!rawMathml) return '';
  let clean = rawMathml
    // Strip MathJax internal data-mjx-* attributes
    .replace(/\s+data-mjx-[a-z0-9-]+="[^"]*"/gi, '')
    // Collapse inter-tag pretty-print newlines and indentation without touching text inside <mtext>
    .replace(/>\s*\n\s*</g, '><')
    .trim();

  if (clean && !/\bxmlns=/.test(clean.slice(0, 120))) {
    clean = clean.replace('<math', '<math xmlns="http://www.w3.org/1998/Math/MathML"');
  }
  return clean;
}

export function renderLatexToSvg(latex: string, display: boolean): RenderResult {
  const trimmed = latex.trim();
  if (!trimmed) {
    return { svg: '', mathml: '', ok: false, error: 'Công thức trống' };
  }

  const cacheKey = `${display ? 'D' : 'I'}:${trimmed}`;
  const cached = renderCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Step 1: Parse TeX into internal MathJax MmlNode to validate syntax and serialize MathML
    const mmlNode = texDoc.convert(trimmed, {
      display,
      end: STATE.CONVERT,
    });

    let mathml = '';
    if (mmlNode && typeof mmlNode === 'object') {
      try {
        mathml = mmlVisitor.visitTree(mmlNode as Parameters<typeof mmlVisitor.visitTree>[0]);
      } catch {
        mathml = '';
      }
    }

    // Step 2: Render full SVG vector output
    const mathItem = texDoc.convert(trimmed, {
      display,
      em: 16,
      ex: 8,
      containerWidth: 1200,
    });

    const svg = extractSvgMarkup(mathItem);

    // Strictly verify there are no MathJax parse errors (<merror> or data-mjx-error)
    const hasMerror =
      /<merror\b/i.test(mathml) ||
      /data-mjx-error=/i.test(svg) ||
      !svg;

    if (hasMerror) {
      const errMatch = svg.match(/data-mjx-error="([^"]+)"/i);
      const errText = errMatch ? errMatch[1] : 'Biểu thức LaTeX chứa lỗi cú pháp hoặc lệnh không hợp lệ';
      const failedResult: RenderResult = {
        svg,
        mathml,
        ok: false,
        error: errText,
      };
      return failedResult;
    }

    // Produce clean, compact Presentation MathML 3 suitable for Word & OMML conversion
    mathml = sanitizePresentationMathML(mathml);

    const result: RenderResult = {
      svg,
      mathml,
      ok: true,
    };

    if (renderCache.size >= MAX_CACHE_SIZE) {
      const firstKey = renderCache.keys().next().value;
      if (firstKey) renderCache.delete(firstKey);
    }
    renderCache.set(cacheKey, result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi phân tích công thức LaTeX';
    return {
      svg: '',
      mathml: '',
      ok: false,
      error: message,
    };
  }
}

export function renderMathMLToSvg(mathml: string, display: boolean): RenderResult {
  const trimmed = mathml.trim();
  if (!trimmed) {
    return { svg: '', mathml: '', ok: false, error: 'MathML trống' };
  }
  try {
    const node = mmlDoc.convert(trimmed, {
      display,
      em: 16,
      ex: 8,
      containerWidth: 1200,
    });
    const svg = extractSvgMarkup(node);
    const ok = Boolean(svg) && !/data-mjx-error=/i.test(svg);
    return {
      svg,
      mathml: trimmed,
      ok,
      error: ok ? undefined : 'Không thể dựng hình từ MathML',
    };
  } catch (err) {
    return {
      svg: '',
      mathml: trimmed,
      ok: false,
      error: err instanceof Error ? err.message : 'Lỗi xử lý MathML',
    };
  }
}

export function clearRenderCache(): void {
  renderCache.clear();
}
