import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import {
  computeResponsiveFormulaScale,
  parseSvgExMetrics,
} from '../engine/formulaLayout';

export interface ResponsiveFormulaProps {
  /** Rendered MathJax SVG markup (never mutated). */
  svg: string;
  /** Optional fallback text if SVG is empty. */
  fallbackText?: string;
  /** Render inline within flowing text (preserves baseline alignment). */
  inline?: boolean;
  /** Base font size for the MathJax SVG host (e.g. '1.25rem', '1.4em', '1.75rem'). */
  baseFontSize?: string;
  /** Minimum readable uniform scale before flagging overflow / fullscreen affordance. */
  minScale?: number;
  /** Horizontal alignment inside the container ('center' or 'left'). */
  align?: 'center' | 'left';
  /**
   * When true (library cards), strictly eliminates horizontal scrollbars inside the container
   * by fitting cleanly to available width (with a secondary compact floor on narrow screens).
   */
  noScrollbar?: boolean;
  /** Optional callback to open an inline fullscreen formula view for very wide formulas. */
  onExpandFullscreen?: () => void;
  /** Extra classes for the outer container. */
  className?: string;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Shared responsive formula renderer for MathFix EDU.
 *
 * - Measures real container width via ResizeObserver (reacts to viewport/panel resizes).
 * - Computes exact natural pixel size from MathJax `ex` metrics + a zero-height `10ex` probe
 *   so scaling never creates measurement feedback loops.
 * - Scales proportionally while keeping exact SVG `viewBox` aspect ratio (zero distortion).
 * - Uses `margin-inline: auto` instead of `flex justify-center overflow-x-auto` so the left
 *   side of wide formulas is NEVER clipped.
 * - Automatically expands container height for tall fractions, nested radicals, matrices,
 *   and systems of equations.
 */
export const ResponsiveFormula: React.FC<ResponsiveFormulaProps> = ({
  svg,
  fallbackText,
  inline = false,
  baseFontSize,
  minScale = 0.72,
  align = 'center',
  noScrollbar = false,
  onExpandFullscreen,
  className = '',
}) => {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const inlineRef = useRef<HTMLSpanElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);

  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [pxPerEx, setPxPerEx] = useState<number>(0);

  const metrics = useMemo(() => parseSvgExMetrics(svg), [svg]);

  // Measure available container width & exact 1ex pixel ratio in the active font context
  useIsomorphicLayoutEffect(() => {
    const measureHost = inline ? inlineRef.current?.parentElement ?? inlineRef.current : outerRef.current;
    if (!measureHost) return;

    const updateMeasurements = () => {
      const targetEl = inline
        ? inlineRef.current?.closest('.doc-block, td, p, div') ?? measureHost
        : outerRef.current;
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const style = window.getComputedStyle(targetEl);
        const padLeft = parseFloat(style.paddingLeft) || 0;
        const padRight = parseFloat(style.paddingRight) || 0;
        const innerW = Math.max(0, rect.width - padLeft - padRight);
        setContainerWidth((prev) => (Math.abs(prev - innerW) > 0.5 ? innerW : prev));
      }

      if (probeRef.current) {
        const probeW = probeRef.current.getBoundingClientRect().width;
        if (probeW > 0) {
          const nextEx = probeW / 10;
          setPxPerEx((prev) => (Math.abs(prev - nextEx) > 0.05 ? nextEx : prev));
        }
      }
    };

    updateMeasurements();

    if (typeof ResizeObserver !== 'undefined') {
      const observed = inline
        ? (inlineRef.current?.closest('.doc-block, td, div') as Element | null) ?? measureHost
        : outerRef.current;
      if (observed) {
        const ro = new ResizeObserver(() => {
          updateMeasurements();
        });
        ro.observe(observed);
        return () => ro.disconnect();
      }
    }

    window.addEventListener('resize', updateMeasurements);
    return () => window.removeEventListener('resize', updateMeasurements);
  }, [inline, svg, baseFontSize]);

  if (!svg) {
    return fallbackText ? (
      <span className="font-mono text-sm text-slate-700 break-all">{fallbackText}</span>
    ) : null;
  }

  const naturalWidthPx = metrics && pxPerEx > 0 ? metrics.widthEx * pxPerEx : 0;
  const naturalHeightPx =
    metrics && pxPerEx > 0
      ? metrics.aspectRatio > 0
        ? naturalWidthPx * metrics.aspectRatio
        : metrics.heightEx * pxPerEx
      : 0;

  // Primary readable scale calculation
  const primaryFit = computeResponsiveFormulaScale(
    naturalWidthPx,
    naturalHeightPx,
    containerWidth,
    {
      minScale,
      maxScale: 1,
      paddingPx: inline ? 12 : 4,
    }
  );

  // For library cards with `noScrollbar`, prevent horizontal scrollbars even on narrow phones
  // by allowing proportional shrink down to a 0.56 safety floor while surfacing the fullscreen button.
  const effectiveFit =
    noScrollbar && primaryFit.needsHorizontalScroll
      ? computeResponsiveFormulaScale(naturalWidthPx, naturalHeightPx, containerWidth, {
          minScale: 0.56,
          maxScale: 1,
          paddingPx: 4,
        })
      : primaryFit;

  const hasMeasuredScale =
    effectiveFit.scaledWidth > 0 &&
    effectiveFit.scaledHeight > 0 &&
    effectiveFit.isScaledDown;

  // Inline mode (for formulas flowing inside Vietnamese sentences)
  if (inline) {
    const inlineStyle: React.CSSProperties = baseFontSize ? { fontSize: baseFontSize } : {};
    const scaledBoxStyle: React.CSSProperties | undefined = hasMeasuredScale
      ? {
          width: `${effectiveFit.scaledWidth}px`,
          height: `${effectiveFit.scaledHeight}px`,
          verticalAlign: metrics ? `${metrics.verticalAlignEx * effectiveFit.scale}ex` : 'middle',
        }
      : undefined;

    return (
      <span
        ref={inlineRef}
        className={`mathfix-responsive-inline ${className}`}
        style={inlineStyle}
      >
        <span
          ref={probeRef}
          aria-hidden="true"
          className="mathfix-ex-probe"
        />
        <span
          className={`mathfix-svg-host ${hasMeasuredScale ? 'mathfix-svg-scaled' : ''}`}
          style={scaledBoxStyle}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </span>
    );
  }

  // Block / Card / Display mode
  const blockFontStyle: React.CSSProperties = baseFontSize ? { fontSize: baseFontSize } : {};
  const scaledWrapperStyle: React.CSSProperties | undefined = hasMeasuredScale
    ? {
        width: `${effectiveFit.scaledWidth}px`,
        height: `${effectiveFit.scaledHeight}px`,
      }
    : undefined;

  const shouldOfferFullscreen = Boolean(
    onExpandFullscreen && (primaryFit.needsHorizontalScroll || (metrics && metrics.widthEx > 38))
  );

  return (
    <div
      ref={outerRef}
      className={`mathfix-responsive-block w-full ${
        !noScrollbar && effectiveFit.needsHorizontalScroll ? 'overflow-x-auto mathfix-scroll' : 'overflow-visible'
      } ${className}`}
      style={blockFontStyle}
    >
      <span ref={probeRef} aria-hidden="true" className="mathfix-ex-probe" />
      <div
        className={`mathfix-responsive-stage ${
          align === 'left' ? 'mathfix-align-left' : 'mathfix-align-center'
        }`}
      >
        <span
          className={`mathfix-svg-host ${hasMeasuredScale ? 'mathfix-svg-scaled' : ''}`}
          style={scaledWrapperStyle}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      {shouldOfferFullscreen && (
        <div className="mt-1.5 flex justify-end no-print">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpandFullscreen?.();
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[13px] font-medium text-[#0B4F8A] hover:border-[#0B4F8A] hover:bg-sky-50 transition-colors cursor-pointer"
            title="Mở chế độ xem toàn màn hình cho công thức dài"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Xem toàn màn hình</span>
          </button>
        </div>
      )}
    </div>
  );
};
