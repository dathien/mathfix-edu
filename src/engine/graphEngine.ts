import { GraphPlotState, StrokeStyle } from './figureTypes';

/**
 * Safe Mathematical Function Grapher + Variation / Sign / Value Table Engine.
 * Uses a pure recursive-descent parser & evaluator — NEVER uses eval() or new Function().
 */

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================================
// 1. LATEX -> SAFE MATH EXPRESSION ADAPTER (FOR MATHLIVE INPUT)
// ============================================================================
export function latexToGraphExpression(raw: string): string {
  let s = raw.trim();
  // Strip outer $ or \( \)
  s = s.replace(/^\$+|\$+$/g, '').replace(/^\\\(|\\\)$/g, '').trim();
  // Strip leading "y=" or "f(x)="
  s = s.replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '');

  // Replace \frac{a}{b} iteratively (handles nested fractions)
  for (let pass = 0; pass < 6 && s.includes('\\frac'); pass++) {
    s = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(($1)/($2))');
  }
  // Replace \sqrt[n]{a} and \sqrt{a}
  s = s.replace(/\\sqrt\s*\[3\]\s*\{([^{}]+)\}/g, 'cbrt($1)');
  s = s.replace(/\\sqrt\s*\[([^{}\]]+)\]\s*\{([^{}]+)\}/g, '(($2)^(1/($1)))');
  for (let pass = 0; pass < 4 && s.includes('\\sqrt'); pass++) {
    s = s.replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)');
  }
  // \left| ... \right| -> abs(...)
  s = s.replace(/\\left\s*\|([^|]+)\\right\s*\|/g, 'abs($1)');
  s = s.replace(/\\left|\\right/g, '');
  s = s.replace(/\\cdot|\\times/g, '*');
  s = s.replace(/\\div/g, '/');
  s = s.replace(/\\pi\b/g, 'pi');
  s = s.replace(/\\(sin|cos|tan|cot|arcsin|arccos|arctan|ln|log|exp|abs)\b/g, '$1');
  s = s.replace(/\^\{([^{}]+)\}/g, '^($1)');
  s = s.replace(/\{/g, '(').replace(/\}/g, ')');
  s = s.replace(/−|–|—/g, '-');
  return s.trim();
}

// ============================================================================
// 2. SAFE RECURSIVE-DESCENT MATH EVALUATOR (NO eval / NO new Function)
// ============================================================================
type TokenType = 'num' | 'id' | 'op' | 'lparen' | 'rparen' | 'comma';

interface Token {
  type: TokenType;
  value: string;
}

const FUNCTIONS: Record<string, (args: number[]) => number> = {
  sin: ([a]) => Math.sin(a),
  cos: ([a]) => Math.cos(a),
  tan: ([a]) => Math.tan(a),
  cot: ([a]) => 1 / Math.tan(a),
  asin: ([a]) => Math.asin(a),
  arcsin: ([a]) => Math.asin(a),
  acos: ([a]) => Math.acos(a),
  arccos: ([a]) => Math.acos(a),
  atan: ([a]) => Math.atan(a),
  arctan: ([a]) => Math.atan(a),
  ln: ([a]) => Math.log(a),
  log: (args) => (args.length === 2 ? Math.log(args[1]) / Math.log(args[0]) : Math.log10(args[0])),
  log10: ([a]) => Math.log10(a),
  log2: ([a]) => Math.log2(a),
  sqrt: ([a]) => Math.sqrt(a),
  cbrt: ([a]) => Math.cbrt(a),
  abs: ([a]) => Math.abs(a),
  exp: ([a]) => Math.exp(a),
  floor: ([a]) => Math.floor(a),
  ceil: ([a]) => Math.ceil(a),
  sign: ([a]) => Math.sign(a),
  min: (args) => Math.min(...args),
  max: (args) => Math.max(...args),
};

function tokenizeMath(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i++];
      }
      tokens.push({ type: 'num', value: num });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i++];
      }
      tokens.push({ type: 'id', value: id.toLowerCase() });
      continue;
    }
    if ('+-*/^'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ch });
      i++;
      continue;
    }
    if (ch === '|') {
      // ignore stray pipes
      i++;
      continue;
    }
    throw new Error(`Ký tự không hợp lệ: ${ch}`);
  }

  // Insert implicit multiplication tokens: 2x -> 2*x, 2(x+1) -> 2*(x+1), (x)(x+1) -> (x)*(x+1), x sin(x) -> x*sin(x)
  const out: Token[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const cur = tokens[k];
    const prev = out[out.length - 1];
    if (prev) {
      const prevIsVal =
        prev.type === 'num' ||
        prev.type === 'rparen' ||
        (prev.type === 'id' && !(prev.value in FUNCTIONS));
      const curStartsVal = cur.type === 'id' || cur.type === 'lparen' || cur.type === 'num';
      if (prevIsVal && curStartsVal) {
        out.push({ type: 'op', value: '*' });
      }
    }
    out.push(cur);
  }
  return out;
}

function evalSimpleExpr(expr: string, x: number): number {
  const tokens = tokenizeMath(expr);
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseAddSub(): number {
    let val = parseMulDiv();
    while (peek()?.type === 'op' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = consume().value;
      const rhs = parseMulDiv();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  }

  function parseMulDiv(): number {
    let val = parseUnary();
    while (peek()?.type === 'op' && (peek()!.value === '*' || peek()!.value === '/')) {
      const op = consume().value;
      const rhs = parseUnary();
      val = op === '*' ? val * rhs : val / rhs;
    }
    return val;
  }

  function parseUnary(): number {
    if (peek()?.type === 'op' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = consume().value;
      const v = parseUnary();
      return op === '-' ? -v : v;
    }
    return parsePower();
  }

  function parsePower(): number {
    const base = parsePrimary();
    if (peek()?.type === 'op' && peek()!.value === '^') {
      consume();
      const exp = parseUnary(); // right-associative: -x^2 = -(x^2), 2^3^2 = 2^(3^2)
      return Math.pow(base, exp);
    }
    return base;
  }

  function parsePrimary(): number {
    const tok = peek();
    if (!tok) return NaN;

    if (tok.type === 'num') {
      consume();
      return parseFloat(tok.value);
    }

    if (tok.type === 'lparen') {
      consume();
      const val = parseAddSub();
      if (peek()?.type === 'rparen') consume();
      return val;
    }

    if (tok.type === 'id') {
      consume();
      const name = tok.value;
      if (name === 'x') return x;
      if (name === 'pi') return Math.PI;
      if (name === 'e') return Math.E;

      if (name in FUNCTIONS) {
        const args: number[] = [];
        if (peek()?.type === 'lparen') {
          consume();
          if (peek()?.type !== 'rparen') {
            args.push(parseAddSub());
            while (peek()?.type === 'comma') {
              consume();
              args.push(parseAddSub());
            }
          }
          if (peek()?.type === 'rparen') consume();
        } else {
          // Support shorthand like sin x
          args.push(parseUnary());
        }
        return FUNCTIONS[name](args);
      }
      return NaN;
    }

    return NaN;
  }

  const result = parseAddSub();
  return Number.isFinite(result) ? result : NaN;
}

/**
 * Evaluates a math expression at `x`, supporting simple piecewise ternary syntax:
 * e.g. `x < 0 ? -x : x^2` or `x <= 1 ? 2*x + 1 : x^2 - 1`
 */
export function evaluateMathExpression(rawExpr: string, x: number): number {
  const normalized = latexToGraphExpression(rawExpr);
  if (!normalized) return NaN;

  // Support single-level piecewise ternary: condition ? branchA : branchB
  const ternaryMatch = normalized.match(/^(.+?)\s*\?\s*(.+?)\s*:\s*(.+)$/);
  if (ternaryMatch) {
    const [, condStr, trueBranch, falseBranch] = ternaryMatch;
    const cmpMatch = condStr.match(/^(.+?)(<=|>=|<|>|=)(.+)$/);
    if (cmpMatch) {
      const lhs = evalSimpleExpr(cmpMatch[1], x);
      const op = cmpMatch[2];
      const rhs = evalSimpleExpr(cmpMatch[3], x);
      let ok = false;
      if (op === '<') ok = lhs < rhs;
      else if (op === '<=') ok = lhs <= rhs;
      else if (op === '>') ok = lhs > rhs;
      else if (op === '>=') ok = lhs >= rhs;
      else if (op === '=') ok = Math.abs(lhs - rhs) < 1e-6;
      return evaluateMathExpression(ok ? trueBranch : falseBranch, x);
    }
  }

  try {
    return evalSimpleExpr(normalized, x);
  } catch {
    return NaN;
  }
}

export function validateMathExpression(rawExpr: string): { ok: boolean; error?: string } {
  const expr = latexToGraphExpression(rawExpr);
  if (!expr) return { ok: false, error: 'Biểu thức trống' };
  const samples = [-2.3, -0.7, 0.3, 1.5, 3.1];
  let finiteCount = 0;
  try {
    for (const sx of samples) {
      const y = evaluateMathExpression(expr, sx);
      if (Number.isFinite(y)) finiteCount++;
    }
    if (finiteCount === 0) {
      return { ok: false, error: 'Không thể tính giá trị hàm số trên miền thử nghiệm' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Cú pháp hàm số không hợp lệ' };
  }
}

export function createDefaultGraphState(): GraphPlotState {
  return {
    viewMode: 'graph',
    width: 600,
    height: 420,
    xMin: -5,
    xMax: 5,
    yMin: -4,
    yMax: 4,
    showGrid: true,
    showAxes: true,
    showAsymptotes: true,
    showTicks: true,
    expressions: [
      {
        id: 'expr_1',
        label: 'y = x^3 - 3x',
        expression: 'x^3 - 3*x',
        latex: 'x^3 - 3x',
        color: '#2563eb',
        strokeWidth: 2.5,
        strokeStyle: 'solid',
        visible: true,
        domainMin: null,
        domainMax: null,
      },
    ],
    tableFuncLabel: 'y',
    tableDerivLabel: "y'",
    tableColumns: [
      { xLabel: '-∞', signOrZero: '+', yValue: '-∞', trend: 'up' },
      { xLabel: '-1', signOrZero: '0', yValue: '2', trend: 'down' },
      { xLabel: '1', signOrZero: '0', yValue: '-2', trend: 'up' },
      { xLabel: '+∞', signOrZero: '+', yValue: '+∞', trend: 'none' },
    ],
    valueTableXs: '-2, -1, 0, 1, 2',
  };
}

function strokeDash(style: StrokeStyle): string {
  if (style === 'dashed') return '7 5';
  if (style === 'dotted') return '2.2 4';
  return '';
}

function niceStep(range: number): number {
  const raw = range / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  const frac = raw / pow;
  if (frac <= 1.2) return pow;
  if (frac <= 2.5) return 2 * pow;
  if (frac <= 5.5) return 5 * pow;
  return 10 * pow;
}

function fmtTick(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  const rounded = Math.round(v * 100) / 100;
  return String(rounded);
}

// ============================================================================
// 3. SVG RENDERERS (GRAPH / VARIATION TABLE / SIGN TABLE / VALUE TABLE)
// ============================================================================
function renderCoordinateGraphSvg(state: GraphPlotState): string {
  const width = Math.max(300, state.width || 600);
  const height = Math.max(220, state.height || 420);
  const padL = 42;
  const padR = 26;
  const padT = 24;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const xMin = state.xMin < state.xMax ? state.xMin : -5;
  const xMax = state.xMin < state.xMax ? state.xMax : 5;
  const yMin = state.yMin < state.yMax ? state.yMin : -4;
  const yMax = state.yMin < state.yMax ? state.yMax : 4;

  const toSx = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
  const toSy = (y: number) => padT + ((yMax - y) / (yMax - yMin)) * plotH;

  const xStep = niceStep(xMax - xMin);
  const yStep = niceStep(yMax - yMin);

  let gridSvg = '';
  let tickSvg = '';

  const xAxisY = Math.min(Math.max(toSy(0), padT), padT + plotH);
  const yAxisX = Math.min(Math.max(toSx(0), padL), padL + plotW);

  const xStart = Math.ceil(xMin / xStep) * xStep;
  for (let gx = xStart; gx <= xMax + 1e-9; gx += xStep) {
    const sx = toSx(gx);
    if (state.showGrid) {
      gridSvg += `<line x1="${sx.toFixed(1)}" y1="${padT}" x2="${sx.toFixed(1)}" y2="${padT + plotH}" stroke="#e2e8f0" stroke-width="1" />`;
    }
    if (state.showTicks && Math.abs(gx) > 1e-6) {
      tickSvg += `<line x1="${sx.toFixed(1)}" y1="${(xAxisY - 4).toFixed(1)}" x2="${sx.toFixed(1)}" y2="${(xAxisY + 4).toFixed(1)}" stroke="#334155" stroke-width="1.2" />`;
      tickSvg += `<text x="${sx.toFixed(1)}" y="${(xAxisY + 17).toFixed(1)}" font-family="Cambria, serif" font-size="12" fill="#334155" text-anchor="middle">${escapeXml(fmtTick(gx))}</text>`;
    }
  }

  const yStart = Math.ceil(yMin / yStep) * yStep;
  for (let gy = yStart; gy <= yMax + 1e-9; gy += yStep) {
    const sy = toSy(gy);
    if (state.showGrid) {
      gridSvg += `<line x1="${padL}" y1="${sy.toFixed(1)}" x2="${padL + plotW}" y2="${sy.toFixed(1)}" stroke="#e2e8f0" stroke-width="1" />`;
    }
    if (state.showTicks && Math.abs(gy) > 1e-6) {
      tickSvg += `<line x1="${(yAxisX - 4).toFixed(1)}" y1="${sy.toFixed(1)}" x2="${(yAxisX + 4).toFixed(1)}" y2="${sy.toFixed(1)}" stroke="#334155" stroke-width="1.2" />`;
      tickSvg += `<text x="${(yAxisX - 8).toFixed(1)}" y="${(sy + 4).toFixed(1)}" font-family="Cambria, serif" font-size="12" fill="#334155" text-anchor="end">${escapeXml(fmtTick(gy))}</text>`;
    }
  }

  let axesSvg = '';
  if (state.showAxes) {
    axesSvg += `<line x1="${padL}" y1="${xAxisY.toFixed(1)}" x2="${padL + plotW + 8}" y2="${xAxisY.toFixed(1)}" stroke="#0f172a" stroke-width="1.8" marker-end="url(#mf-garrow)" />`;
    axesSvg += `<line x1="${yAxisX.toFixed(1)}" y1="${padT + plotH}" x2="${yAxisX.toFixed(1)}" y2="${padT - 8}" stroke="#0f172a" stroke-width="1.8" marker-end="url(#mf-garrow)" />`;
    axesSvg += `<text x="${padL + plotW + 14}" y="${(xAxisY + 4).toFixed(1)}" font-family="Cambria, serif" font-size="14" font-style="italic" font-weight="700" fill="#0f172a">x</text>`;
    axesSvg += `<text x="${(yAxisX - 14).toFixed(1)}" y="${padT - 6}" font-family="Cambria, serif" font-size="14" font-style="italic" font-weight="700" fill="#0f172a">y</text>`;
    if (xMin <= 0 && xMax >= 0 && yMin <= 0 && yMax >= 0) {
      axesSvg += `<text x="${(yAxisX - 10).toFixed(1)}" y="${(xAxisY + 15).toFixed(1)}" font-family="Cambria, serif" font-size="13" font-style="italic" fill="#0f172a">O</text>`;
    }
  }

  // Plot curves with pole/discontinuity splitting & vertical asymptote detection
  const sampleCount = 520;
  const ySpan = yMax - yMin;
  let curvesSvg = '';
  let asymptotesSvg = '';
  let legendSvg = '';

  const visibleExprs = state.expressions.filter((e) => e.visible && e.expression.trim());

  visibleExprs.forEach((item, idx) => {
    const domMin = item.domainMin != null ? Math.max(xMin, item.domainMin) : xMin;
    const domMax = item.domainMax != null ? Math.min(xMax, item.domainMax) : xMax;
    if (domMax <= domMin) return;

    const dx = (domMax - domMin) / sampleCount;
    const segments: string[] = [];
    let currentPts: Array<[number, number]> = [];
    let prevY: number | null = null;
    const detectedAsymptoteXs: number[] = [];

    for (let i = 0; i <= sampleCount; i++) {
      const x = domMin + i * dx;
      const y = evaluateMathExpression(item.expression, x);
      const outOfBounds = !Number.isFinite(y) || Math.abs(y) > Math.max(Math.abs(yMin), Math.abs(yMax)) + ySpan * 3;

      if (outOfBounds) {
        if (currentPts.length >= 2) {
          segments.push(
            currentPts.map((p, k) => `${k === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
          );
        }
        currentPts = [];
        prevY = null;
        continue;
      }

      if (prevY !== null && Math.abs(y - prevY) > ySpan * 0.9) {
        // Pole or jump discontinuity — split curve and optionally mark vertical asymptote
        if (Math.sign(y) !== Math.sign(prevY) && Math.abs(y - prevY) > ySpan * 1.4) {
          const asymX = x - dx / 2;
          if (!detectedAsymptoteXs.some((ax) => Math.abs(ax - asymX) < dx * 4)) {
            detectedAsymptoteXs.push(asymX);
          }
        }
        if (currentPts.length >= 2) {
          segments.push(
            currentPts.map((p, k) => `${k === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
          );
        }
        currentPts = [];
      }

      currentPts.push([toSx(x), toSy(y)]);
      prevY = y;
    }

    if (currentPts.length >= 2) {
      segments.push(
        currentPts.map((p, k) => `${k === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
      );
    }

    const dash = strokeDash(item.strokeStyle);
    const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
    if (segments.length > 0) {
      curvesSvg += `<path d="${segments.join(' ')}" fill="none" stroke="${escapeXml(item.color)}" stroke-width="${item.strokeWidth || 2.5}"${dashAttr} stroke-linejoin="round" stroke-linecap="round" />`;
    }

    if (state.showAsymptotes) {
      for (const ax of detectedAsymptoteXs) {
        const sx = toSx(ax);
        asymptotesSvg += `<line x1="${sx.toFixed(1)}" y1="${padT}" x2="${sx.toFixed(1)}" y2="${padT + plotH}" stroke="#dc2626" stroke-width="1.3" stroke-dasharray="5 5" opacity="0.75" />`;
      }
    }

    // Compact legend top-right
    const ly = padT + 14 + idx * 18;
    legendSvg += `<line x1="${padL + plotW - 140}" y1="${ly}" x2="${padL + plotW - 120}" y2="${ly}" stroke="${escapeXml(item.color)}" stroke-width="2.5"${dashAttr} />`;
    legendSvg += `<text x="${padL + plotW - 114}" y="${ly + 4}" font-family="Cambria, serif" font-size="12.5" fill="#0f172a">${escapeXml(item.label || item.expression)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <marker id="mf-garrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
      <path d="M 0 1.2 L 9.5 5 L 0 8.8 z" fill="#0f172a" />
    </marker>
    <clipPath id="mf-plot-clip">
      <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" />
    </clipPath>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
  <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
  ${gridSvg}
  ${axesSvg}
  ${tickSvg}
  <g clip-path="url(#mf-plot-clip)">
    ${asymptotesSvg}
    ${curvesSvg}
  </g>
  ${visibleExprs.length > 0 ? `<rect x="${padL + plotW - 148}" y="${padT + 2}" width="144" height="${visibleExprs.length * 18 + 10}" rx="4" fill="#ffffff" fill-opacity="0.88" stroke="#e2e8f0" />${legendSvg}` : ''}
</svg>`;
}

function renderVariationOrSignTableSvg(state: GraphPlotState, signOnly: boolean): string {
  const cols = state.tableColumns.length >= 2 ? state.tableColumns : createDefaultGraphState().tableColumns;
  const width = Math.max(520, state.width || 620);
  const rowH1 = 42;
  const rowH2 = 42;
  const rowH3 = signOnly ? 0 : 96;
  const pad = 16;
  const headerW = 74;
  const totalH = pad * 2 + rowH1 + rowH2 + rowH3;
  const bodyW = width - pad * 2 - headerW;
  const colCount = cols.length;
  const xCoords = cols.map((_, idx) => pad + headerW + (bodyW * (idx + 0.5)) / colCount);

  let content = '';
  // Outer border & horizontal dividers
  content += `<rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${rowH1 + rowH2 + rowH3}" fill="#ffffff" stroke="#0f172a" stroke-width="1.6" />`;
  content += `<line x1="${pad + headerW}" y1="${pad}" x2="${pad + headerW}" y2="${pad + rowH1 + rowH2 + rowH3}" stroke="#0f172a" stroke-width="1.6" />`;
  content += `<line x1="${pad}" y1="${pad + rowH1}" x2="${width - pad}" y2="${pad + rowH1}" stroke="#0f172a" stroke-width="1.4" />`;
  if (!signOnly) {
    content += `<line x1="${pad}" y1="${pad + rowH1 + rowH2}" x2="${width - pad}" y2="${pad + rowH1 + rowH2}" stroke="#0f172a" stroke-width="1.4" />`;
  }

  // Row headers
  content += `<text x="${pad + headerW / 2}" y="${pad + rowH1 / 2 + 5}" font-family="Cambria, serif" font-size="16" font-style="italic" font-weight="700" fill="#0f172a" text-anchor="middle">x</text>`;
  content += `<text x="${pad + headerW / 2}" y="${pad + rowH1 + rowH2 / 2 + 5}" font-family="Cambria, serif" font-size="16" font-style="italic" font-weight="700" fill="#0f172a" text-anchor="middle">${escapeXml(state.tableDerivLabel || "y'")}</text>`;
  if (!signOnly) {
    content += `<text x="${pad + headerW / 2}" y="${pad + rowH1 + rowH2 + rowH3 / 2 + 5}" font-family="Cambria, serif" font-size="16" font-style="italic" font-weight="700" fill="#0f172a" text-anchor="middle">${escapeXml(state.tableFuncLabel || 'y')}</text>`;
  }

  // Row 1 (x values) & Row 2 (y' signs & zeros)
  cols.forEach((c, idx) => {
    const cx = xCoords[idx];
    content += `<text x="${cx.toFixed(1)}" y="${pad + rowH1 / 2 + 5}" font-family="Cambria, serif" font-size="15" font-weight="600" fill="#0f172a" text-anchor="middle">${escapeXml(c.xLabel)}</text>`;

    // At critical points (0 or ||) put at cx; for intervals put sign between cx and next cx
    if (c.signOrZero === '||' || c.signOrZero === '0') {
      if (c.signOrZero === '||') {
        const yTop = pad + rowH1;
        const yBot = pad + rowH1 + rowH2 + rowH3;
        content += `<line x1="${(cx - 2.5).toFixed(1)}" y1="${yTop}" x2="${(cx - 2.5).toFixed(1)}" y2="${yBot}" stroke="#0f172a" stroke-width="1.3" />`;
        content += `<line x1="${(cx + 2.5).toFixed(1)}" y1="${yTop}" x2="${(cx + 2.5).toFixed(1)}" y2="${yBot}" stroke="#0f172a" stroke-width="1.3" />`;
      } else {
        content += `<text x="${cx.toFixed(1)}" y="${pad + rowH1 + rowH2 / 2 + 5}" font-family="Cambria, serif" font-size="15" font-weight="700" fill="#0f172a" text-anchor="middle">0</text>`;
      }
    }

    // Interval sign between col idx and col idx+1
    if (idx < cols.length - 1) {
      const midX = (cx + xCoords[idx + 1]) / 2;
      const intervalSign =
        c.trend === 'up' ? '+' : c.trend === 'down' ? '−' : c.signOrZero === '+' || c.signOrZero === '-' ? c.signOrZero : '';
      if (intervalSign) {
        content += `<text x="${midX.toFixed(1)}" y="${pad + rowH1 + rowH2 / 2 + 6}" font-family="Cambria, serif" font-size="18" font-weight="700" fill="${intervalSign === '+' ? '#1d4ed8' : '#dc2626'}" text-anchor="middle">${escapeXml(intervalSign)}</text>`;
      }
    }
  });

  // Row 3: Variation arrows & y values
  if (!signOnly) {
    const yTop = pad + rowH1 + rowH2 + 22;
    const yBot = pad + rowH1 + rowH2 + rowH3 - 18;
    const yMid = (yTop + yBot) / 2;

    const yPositions = cols.map((c, idx) => {
      if (idx === 0) return c.trend === 'up' ? yBot : c.trend === 'down' ? yTop : yMid;
      const prevTrend = cols[idx - 1].trend;
      if (prevTrend === 'up') return yTop;
      if (prevTrend === 'down') return yBot;
      return yMid;
    });

    cols.forEach((c, idx) => {
      const cx = xCoords[idx];
      const cy = yPositions[idx];
      if (c.yValue) {
        content += `<text x="${cx.toFixed(1)}" y="${(cy + 5).toFixed(1)}" font-family="Cambria, serif" font-size="15" font-weight="600" fill="#0f172a" text-anchor="middle">${escapeXml(c.yValue)}</text>`;
      }
      if (idx < cols.length - 1 && (c.trend === 'up' || c.trend === 'down')) {
        const nx = xCoords[idx + 1];
        const ny = yPositions[idx + 1];
        const x1 = cx + 22;
        const x2 = nx - 22;
        const y1 = cy + (ny > cy ? 4 : -4);
        const y2 = ny + (ny > cy ? -6 : 6);
        if (x2 > x1 + 8) {
          content += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#0f172a" stroke-width="1.6" marker-end="url(#mf-var-arrow)" />`;
        }
      }
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalH}" width="${width}" height="${totalH}">
  <defs>
    <marker id="mf-var-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
      <path d="M 0 1.2 L 9.5 5 L 0 8.8 z" fill="#0f172a" />
    </marker>
  </defs>
  <rect x="0" y="0" width="${width}" height="${totalH}" fill="#ffffff" />
  ${content}
</svg>`;
}

function renderValueTableSvg(state: GraphPlotState): string {
  const xs = (state.valueTableXs || '-2, -1, 0, 1, 2')
    .split(/[,;\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const safeXs = xs.length > 0 ? xs : [-2, -1, 0, 1, 2];
  const expr = state.expressions.find((e) => e.visible)?.expression || 'x^2';
  const pad = 14;
  const headerW = 90;
  const colW = Math.max(66, Math.floor((Math.max(460, state.width) - pad * 2 - headerW) / safeXs.length));
  const width = pad * 2 + headerW + colW * safeXs.length;
  const rowH = 42;
  const height = pad * 2 + rowH * 2;

  let svg = `<rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${rowH * 2}" fill="#ffffff" stroke="#0f172a" stroke-width="1.5" />`;
  svg += `<line x1="${pad}" y1="${pad + rowH}" x2="${width - pad}" y2="${pad + rowH}" stroke="#0f172a" stroke-width="1.3" />`;
  svg += `<text x="${pad + headerW / 2}" y="${pad + rowH / 2 + 5}" font-family="Cambria, serif" font-size="15" font-style="italic" font-weight="700" fill="#0f172a" text-anchor="middle">x</text>`;
  svg += `<text x="${pad + headerW / 2}" y="${pad + rowH + rowH / 2 + 5}" font-family="Cambria, serif" font-size="15" font-style="italic" font-weight="700" fill="#0f172a" text-anchor="middle">y = f(x)</text>`;

  safeXs.forEach((xv, idx) => {
    const xLeft = pad + headerW + idx * colW;
    const cx = xLeft + colW / 2;
    svg += `<line x1="${xLeft}" y1="${pad}" x2="${xLeft}" y2="${pad + rowH * 2}" stroke="#0f172a" stroke-width="1.2" />`;
    const yv = evaluateMathExpression(expr, xv);
    const yStr = Number.isFinite(yv) ? String(Math.round(yv * 1000) / 1000) : 'KXĐ';
    svg += `<text x="${cx}" y="${pad + rowH / 2 + 5}" font-family="Cambria, serif" font-size="15" fill="#0f172a" text-anchor="middle">${escapeXml(String(xv))}</text>`;
    svg += `<text x="${cx}" y="${pad + rowH + rowH / 2 + 5}" font-family="Cambria, serif" font-size="15" font-weight="600" fill="#1d4ed8" text-anchor="middle">${escapeXml(yStr)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
  ${svg}
</svg>`;
}

export function renderGraphPlotToSvg(state: GraphPlotState): string {
  if (state.viewMode === 'variation_table') {
    return renderVariationOrSignTableSvg(state, false);
  }
  if (state.viewMode === 'sign_table') {
    return renderVariationOrSignTableSvg(state, true);
  }
  if (state.viewMode === 'value_table') {
    return renderValueTableSvg(state);
  }
  return renderCoordinateGraphSvg(state);
}
