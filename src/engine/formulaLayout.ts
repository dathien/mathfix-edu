export interface SvgExMetrics {
  widthEx: number;
  heightEx: number;
  verticalAlignEx: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
  aspectRatio: number;
}

export type FormulaGridSpan = 'single' | 'double' | 'full';

export interface ResponsiveScaleResult {
  scale: number;
  scaledWidth: number;
  scaledHeight: number;
  needsHorizontalScroll: boolean;
  isScaledDown: boolean;
}

const MATHJAX_UNITS_PER_EX = 442;

/**
 * Extracts exact intrinsic metrics from a MathJax SVG string.
 * MathJax emits `width="...ex"`, `height="...ex"`, `viewBox="minX minY w h"`,
 * and `style="vertical-align: ...ex;"`.
 */
export function parseSvgExMetrics(svg: string): SvgExMetrics | null {
  if (!svg || !svg.includes('<svg')) return null;

  const openTagMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openTagMatch) return null;
  const openTag = openTagMatch[0];

  const widthExMatch = openTag.match(/\bwidth\s*=\s*"([\d.]+)ex"/i);
  const heightExMatch = openTag.match(/\bheight\s*=\s*"([\d.]+)ex"/i);
  const viewBoxMatch = openTag.match(/\bviewBox\s*=\s*"([^"]+)"/i);
  const vAlignMatch = openTag.match(/vertical-align\s*:\s*([+-]?[\d.]+)ex/i);

  let viewBoxWidth = 0;
  let viewBoxHeight = 0;
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3])) {
      viewBoxWidth = Math.max(0, parts[2]);
      viewBoxHeight = Math.max(0, parts[3]);
    }
  }

  let widthEx = widthExMatch ? parseFloat(widthExMatch[1]) : 0;
  let heightEx = heightExMatch ? parseFloat(heightExMatch[1]) : 0;

  if ((!widthEx || !Number.isFinite(widthEx)) && viewBoxWidth > 0) {
    widthEx = viewBoxWidth / MATHJAX_UNITS_PER_EX;
  }
  if ((!heightEx || !Number.isFinite(heightEx)) && viewBoxHeight > 0) {
    heightEx = viewBoxHeight / MATHJAX_UNITS_PER_EX;
  }

  if (!Number.isFinite(widthEx) || !Number.isFinite(heightEx) || widthEx <= 0 || heightEx <= 0) {
    return null;
  }

  const verticalAlignEx = vAlignMatch ? parseFloat(vAlignMatch[1]) : 0;
  const aspectRatio =
    viewBoxWidth > 0 && viewBoxHeight > 0 ? viewBoxHeight / viewBoxWidth : heightEx / widthEx;

  return {
    widthEx,
    heightEx,
    verticalAlignEx: Number.isFinite(verticalAlignEx) ? verticalAlignEx : 0,
    viewBoxWidth: viewBoxWidth || widthEx * MATHJAX_UNITS_PER_EX,
    viewBoxHeight: viewBoxHeight || heightEx * MATHJAX_UNITS_PER_EX,
    aspectRatio,
  };
}

/**
 * Classifies how many grid columns a formula card should span in the library grid
 * so long equations (e.g. chemical reactions, matrices, multi-term expressions)
 * automatically expand horizontally instead of getting clipped or scrolled.
 */
export function classifyFormulaSpan(svg: string, latex = ''): FormulaGridSpan {
  const metrics = parseSvgExMetrics(svg);
  const widthEx = metrics?.widthEx ?? 0;

  if (widthEx > 40) {
    return 'full';
  }
  if (widthEx > 24) {
    return 'double';
  }

  // Fallback heuristics for wide chemical reaction arrows or multi-column structures
  // if SVG metrics were unavailable.
  if (!metrics) {
    if (latex.length > 78) return 'full';
    if (latex.length > 44) return 'double';
  }

  return 'single';
}

/**
 * Computes a uniform, distortion-free scale factor that fits a formula inside its
 * container while enforcing a readable minimum scale floor.
 *
 * - Keeps exact aspect ratio (scaledHeight / scaledWidth === naturalHeight / naturalWidth).
 * - Never enlarges short formulas past maxScale (default 1.0).
 * - Never shrinks formulas below minScale (default 0.72) unless hardFitFloor is provided.
 */
export function computeResponsiveFormulaScale(
  naturalWidthPx: number,
  naturalHeightPx: number,
  containerWidthPx: number,
  options?: {
    minScale?: number;
    maxScale?: number;
    paddingPx?: number;
  }
): ResponsiveScaleResult {
  const minScale = options?.minScale ?? 0.72;
  const maxScale = options?.maxScale ?? 1;
  const paddingPx = options?.paddingPx ?? 0;

  if (
    !Number.isFinite(naturalWidthPx) ||
    !Number.isFinite(naturalHeightPx) ||
    naturalWidthPx <= 0 ||
    naturalHeightPx <= 0
  ) {
    return {
      scale: 1,
      scaledWidth: 0,
      scaledHeight: 0,
      needsHorizontalScroll: false,
      isScaledDown: false,
    };
  }

  if (!Number.isFinite(containerWidthPx) || containerWidthPx <= 0) {
    return {
      scale: 1,
      scaledWidth: naturalWidthPx,
      scaledHeight: naturalHeightPx,
      needsHorizontalScroll: false,
      isScaledDown: false,
    };
  }

  const availableWidth = Math.max(48, containerWidthPx - paddingPx);
  const rawScale = availableWidth / naturalWidthPx;

  if (rawScale >= maxScale) {
    return {
      scale: maxScale,
      scaledWidth: naturalWidthPx * maxScale,
      scaledHeight: naturalHeightPx * maxScale,
      needsHorizontalScroll: false,
      isScaledDown: false,
    };
  }

  if (rawScale >= minScale) {
    return {
      scale: rawScale,
      scaledWidth: naturalWidthPx * rawScale,
      scaledHeight: naturalHeightPx * rawScale,
      needsHorizontalScroll: false,
      isScaledDown: true,
    };
  }

  return {
    scale: minScale,
    scaledWidth: naturalWidthPx * minScale,
    scaledHeight: naturalHeightPx * minScale,
    needsHorizontalScroll: true,
    isScaledDown: true,
  };
}
