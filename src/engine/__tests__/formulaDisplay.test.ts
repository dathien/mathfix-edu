import { describe, expect, it } from 'vitest';
import { BUILTIN_FORMULA_LIBRARY } from '../../data/formulaLibraryData';
import { renderLatexToSvg } from '../mathjaxRenderer';
import {
  classifyFormulaSpan,
  computeResponsiveFormulaScale,
  parseSvgExMetrics,
} from '../formulaLayout';

describe('Formula Display & Responsive Library Verification', () => {
  it('renders every built-in formula (Math, Physics, Chemistry) cleanly with valid SVG metrics and zero merror', () => {
    expect(BUILTIN_FORMULA_LIBRARY.length).toBeGreaterThanOrEqual(65);

    for (const item of BUILTIN_FORMULA_LIBRARY) {
      const rendered = renderLatexToSvg(item.latex, Boolean(item.displayMode));
      expect(rendered.ok, `Formula ${item.id} (${item.name}) failed to render`).toBe(true);
      expect(rendered.svg).toContain('<svg');
      expect(rendered.svg).not.toContain('merror');

      const metrics = parseSvgExMetrics(rendered.svg);
      expect(metrics, `Formula ${item.id} missing SVG metrics`).not.toBeNull();
      expect(metrics!.widthEx).toBeGreaterThan(0);
      expect(metrics!.heightEx).toBeGreaterThan(0);
      expect(metrics!.aspectRatio).toBeGreaterThan(0);
    }
  });

  it('contains zero raw LaTeX backslashes in user-facing formula conditions', () => {
    for (const item of BUILTIN_FORMULA_LIBRARY) {
      if (!item.conditions) continue;
      expect(
        item.conditions,
        `Formula ${item.id} has raw LaTeX in conditions: ${item.conditions}`
      ).not.toMatch(/\\[a-zA-Z]+/);
    }
  });

  it('has complete glucose fermentation equation with reactants, balanced products, catalyst above and temperature below arrow', () => {
    const glucose = BUILTIN_FORMULA_LIBRARY.find((f) => f.id === 'c12-glucose');
    expect(glucose).toBeDefined();
    expect(glucose!.latex).toContain('C}_6\\mathrm{H}_{12}\\mathrm{O}_6');
    expect(glucose!.latex).toContain('2\\mathrm{C}_2\\mathrm{H}_5\\mathrm{OH}');
    expect(glucose!.latex).toContain('2\\mathrm{CO}_2\\uparrow');
    expect(glucose!.latex).toContain('enzyme');
    expect(glucose!.latex).toContain('30\\text{--}35');
    expect(glucose!.displayMode).toBe(true);

    const rendered = renderLatexToSvg(glucose!.latex, true);
    expect(rendered.ok).toBe(true);
    const span = classifyFormulaSpan(rendered.svg, glucose!.latex);
    expect(['double', 'full']).toContain(span);
  });

  it('includes representative complex structures across Math, Physics, and Chemistry', () => {
    const ids = new Set(BUILTIN_FORMULA_LIBRARY.map((f) => f.id));
    // Nested fraction, matrix/determinant, 3-line system, long radical, integrals
    expect(ids.has('m10-harmonic-mean')).toBe(true);
    expect(ids.has('m10-matrix-det2')).toBe(true);
    expect(ids.has('m12-oxyz-line-param')).toBe(true);
    expect(ids.has('m12-oxyz-dist')).toBe(true);
    expect(ids.has('m12-newton-leibniz')).toBe(true);
    // Multi-subscript physics
    expect(ids.has('p12-heat-balance')).toBe(true);
    expect(ids.has('p10-momentum-cons')).toBe(true);
    // Chemistry: above+below arrow conditions, redox ionic equation, structural formula
    expect(ids.has('c11-haber')).toBe(true);
    expect(ids.has('c12-ester')).toBe(true);
    expect(ids.has('c12-redox-ion')).toBe(true);
    expect(ids.has('c11-ethanol')).toBe(true);
  });

  it('classifies short formulas as single-column and long equations as double or full-row spans', () => {
    const shortFormula = BUILTIN_FORMULA_LIBRARY.find((f) => f.id === 'p10-kinematics-v')!;
    const shortSvg = renderLatexToSvg(shortFormula.latex, Boolean(shortFormula.displayMode)).svg;
    expect(classifyFormulaSpan(shortSvg, shortFormula.latex)).toBe('single');

    const ester = BUILTIN_FORMULA_LIBRARY.find((f) => f.id === 'c12-ester')!;
    const esterSvg = renderLatexToSvg(ester.latex, Boolean(ester.displayMode)).svg;
    expect(classifyFormulaSpan(esterSvg, ester.latex)).toBe('full');

    const enthalpy = BUILTIN_FORMULA_LIBRARY.find((f) => f.id === 'c10-enthalpy')!;
    const enthalpySvg = renderLatexToSvg(enthalpy.latex, Boolean(enthalpy.displayMode)).svg;
    expect(['double', 'full']).toContain(classifyFormulaSpan(enthalpySvg, enthalpy.latex));
  });

  it('scales wide formulas proportionally without distortion and enforces readable minScale floor', () => {
    // Short formula fits without shrinking or enlarging
    const fitShort = computeResponsiveFormulaScale(180, 42, 340, { minScale: 0.72 });
    expect(fitShort.scale).toBe(1);
    expect(fitShort.scaledWidth).toBe(180);
    expect(fitShort.scaledHeight).toBe(42);
    expect(fitShort.needsHorizontalScroll).toBe(false);
    expect(fitShort.isScaledDown).toBe(false);

    // Medium-wide formula scales proportionally while keeping exact aspect ratio
    const fitMedium = computeResponsiveFormulaScale(420, 84, 350, { minScale: 0.72 });
    expect(fitMedium.scale).toBeCloseTo(350 / 420, 4);
    expect(fitMedium.scaledWidth).toBeCloseTo(350, 2);
    expect(fitMedium.scaledHeight / fitMedium.scaledWidth).toBeCloseTo(84 / 420, 6);
    expect(fitMedium.needsHorizontalScroll).toBe(false);
    expect(fitMedium.isScaledDown).toBe(true);

    // Extraordinarily wide formula clamps at minScale (never unreadable micro-text)
    const fitHuge = computeResponsiveFormulaScale(900, 90, 320, { minScale: 0.72 });
    expect(fitHuge.scale).toBe(0.72);
    expect(fitHuge.scaledHeight / fitHuge.scaledWidth).toBeCloseTo(90 / 900, 6);
    expect(fitHuge.needsHorizontalScroll).toBe(true);
  });

  it('preserves tall natural height for systems of equations, matrices, and nested fractions', () => {
    const sys = BUILTIN_FORMULA_LIBRARY.find((f) => f.id === 'm12-oxyz-line-param')!;
    const mat = BUILTIN_FORMULA_LIBRARY.find((f) => f.id === 'm10-matrix-det2')!;
    const nested = BUILTIN_FORMULA_LIBRARY.find((f) => f.id === 'm10-harmonic-mean')!;

    for (const item of [sys, mat, nested]) {
      const rendered = renderLatexToSvg(item.latex, true);
      const metrics = parseSvgExMetrics(rendered.svg);
      expect(metrics).not.toBeNull();
      expect(metrics!.heightEx).toBeGreaterThan(4.5);
    }
  });
});
