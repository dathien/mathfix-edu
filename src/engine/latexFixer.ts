import { FixNote, FormulaStatus, FormulaSubject, SubjectConfidence, SubjectMode } from './types';
import { renderLatexToSvg } from './mathjaxRenderer';
import {
  classifyFormulaSubject,
  isComplexStructuralChemistry,
  normalizeChemistryLatex,
  normalizePhysicsLatex,
} from './subjectEngine';

export interface LatexFixOptions {
  subjectMode?: SubjectMode;
  contextText?: string;
}

export interface LatexFixResult {
  originalLatex: string;
  fixedLatex: string;
  status: FormulaStatus;
  subject: FormulaSubject;
  subjectConfidence: SubjectConfidence;
  ommlCompatible: boolean;
  ommlWarning?: string;
  notes: FixNote[];
  svg: string;
  mathml: string;
  validated: boolean;
  errorMessage?: string;
}

// Map Unicode mathematical alphanumeric symbols (italic/bold/script/bb) to standard ASCII/LaTeX
const UNICODE_MATH_MAP: Record<string, string> = {
  '−': '-',
  '–': '-',
  '—': '-',
  '‐': '-',
  '×': '\\times ',
  '÷': '\\div ',
  '·': '\\cdot ',
  '∙': '\\cdot ',
  '⋅': '\\cdot ',
  '±': '\\pm ',
  '∓': '\\mp ',
  '≤': '\\le ',
  '⩽': '\\le ',
  '≥': '\\ge ',
  '⩾': '\\ge ',
  '≠': '\\ne ',
  '≈': '\\approx ',
  '≡': '\\equiv ',
  '≅': '\\cong ',
  '∼': '\\sim ',
  '∞': '\\infty ',
  '→': '\\to ',
  '⟶': '\\longrightarrow ',
  '←': '\\leftarrow ',
  '↔': '\\leftrightarrow ',
  '⇒': '\\Rightarrow ',
  '⟹': '\\Longrightarrow ',
  '⇐': '\\Leftarrow ',
  '⇔': '\\Leftrightarrow ',
  '⟺': '\\Longleftrightarrow ',
  '∈': '\\in ',
  '∉': '\\notin ',
  '⊂': '\\subset ',
  '⊆': '\\subseteq ',
  '⊃': '\\supset ',
  '⊇': '\\supseteq ',
  '∪': '\\cup ',
  '∩': '\\cap ',
  '∅': '\\emptyset ',
  '∀': '\\forall ',
  '∃': '\\exists ',
  '¬': '\\neg ',
  '∧': '\\wedge ',
  '∨': '\\vee ',
  '⊥': '\\perp ',
  '∥': '\\parallel ',
  '∠': '\\angle ',
  '∡': '\\measuredangle ',
  '△': '\\triangle ',
  'Δ': '\\Delta ',
  '∆': '\\Delta ',
  '∇': '\\nabla ',
  '∂': '\\partial ',
  '∫': '\\int ',
  '∬': '\\iint ',
  '∭': '\\iiint ',
  '∮': '\\oint ',
  '∑': '\\sum ',
  '∏': '\\prod ',
  '°': '^\\circ ',
  '′': "'",
  '″': "''",
  '…': '\\ldots ',
  '⋯': '\\cdots ',
  '⋮': '\\vdots ',
  '⋱': '\\ddots ',
  'α': '\\alpha ',
  'β': '\\beta ',
  'γ': '\\gamma ',
  'δ': '\\delta ',
  'ε': '\\varepsilon ',
  'ϵ': '\\epsilon ',
  'ζ': '\\zeta ',
  'η': '\\eta ',
  'θ': '\\theta ',
  'ϑ': '\\vartheta ',
  'ι': '\\iota ',
  'κ': '\\kappa ',
  'λ': '\\lambda ',
  'μ': '\\mu ',
  'ν': '\\nu ',
  'ξ': '\\xi ',
  'π': '\\pi ',
  'ρ': '\\rho ',
  'σ': '\\sigma ',
  'τ': '\\tau ',
  'υ': '\\upsilon ',
  'φ': '\\varphi ',
  'ϕ': '\\phi ',
  'χ': '\\chi ',
  'ψ': '\\psi ',
  'ω': '\\omega ',
  'Γ': '\\Gamma ',
  'Θ': '\\Theta ',
  'Λ': '\\Lambda ',
  'Ξ': '\\Xi ',
  'Π': '\\Pi ',
  'Σ': '\\Sigma ',
  'Φ': '\\Phi ',
  'Ψ': '\\Psi ',
  'Ω': '\\Omega ',
  'ℝ': '\\mathbb{R}',
  'ℕ': '\\mathbb{N}',
  'ℤ': '\\mathbb{Z}',
  'ℚ': '\\mathbb{Q}',
  'ℂ': '\\mathbb{C}',
  '⟨': '\\langle ',
  '⟩': '\\rangle ',
  '⌊': '\\lfloor ',
  '⌋': '\\rfloor ',
  '⌈': '\\lceil ',
  '⌉': '\\rceil ',
};

const SUPERSCRIPT_CHAR_MAP: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
  '⁼': '=',
  '⁽': '(',
  '⁾': ')',
  'ⁿ': 'n',
  'ⁱ': 'i',
  'ˣ': 'x',
  'ʸ': 'y',
};

const SUBSCRIPT_CHAR_MAP: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  '₊': '+',
  '₋': '-',
  '₌': '=',
  '₍': '(',
  '₎': ')',
  'ₐ': 'a',
  'ₑ': 'e',
  'ₕ': 'h',
  'ᵢ': 'i',
  'ⱼ': 'j',
  'ₖ': 'k',
  'ₗ': 'l',
  'ₘ': 'm',
  'ₙ': 'n',
  'ₒ': 'o',
  'ₚ': 'p',
  'ᵣ': 'r',
  'ₛ': 's',
  'ₜ': 't',
  'ᵤ': 'u',
  'ᵥ': 'v',
  'ₓ': 'x',
};

// Common LaTeX command misspellings (Group G)
const COMMAND_TYPOS: Record<string, string> = {
  '\\farc': '\\frac',
  '\\frca': '\\frac',
  '\\fracc': '\\frac',
  '\\dfarc': '\\dfrac',
  '\\tfarc': '\\tfrac',
  '\\sqtr': '\\sqrt',
  '\\sqt': '\\sqrt',
  '\\sqr': '\\sqrt',
  '\\inft': '\\infty',
  '\\infitny': '\\infty',
  '\\infity': '\\infty',
  '\\rigtharrow': '\\rightarrow',
  '\\righarrow': '\\rightarrow',
  '\\overrigharrow': '\\overrightarrow',
  '\\overrigtharrow': '\\overrightarrow',
  '\\overrightarrrow': '\\overrightarrow',
  '\\rigth': '\\right',
  '\\righ': '\\right',
  '\\leftt': '\\left',
  '\\alhpa': '\\alpha',
  '\\apla': '\\alpha',
  '\\btea': '\\beta',
  '\\gama': '\\gamma',
  '\\dleta': '\\delta',
  '\\Dleta': '\\Delta',
  '\\tetha': '\\theta',
  '\\lamba': '\\lambda',
  '\\lamda': '\\lambda',
  '\\sgima': '\\sigma',
  '\\omgea': '\\omega',
  '\\trangle': '\\triangle',
  '\\triange': '\\triangle',
  '\\parellel': '\\parallel',
  '\\parrallel': '\\parallel',
  '\\perpp': '\\perp',
  '\\subste': '\\subset',
  '\\substeq': '\\subseteq',
  '\\emtpyset': '\\emptyset',
  '\\beign': '\\begin',
  '\\bgein': '\\begin',
  '\\edn': '\\end',
  '\\ed': '\\end',
  '\\cdto': '\\cdot',
  '\\tiems': '\\times',
  '\\appox': '\\approx',
  '\\eqiuv': '\\equiv',
  '\\foral': '\\forall',
  '\\exits': '\\exists',
  '\\overlne': '\\overline',
  '\\widehhat': '\\widehat',
  '\\mathb': '\\mathbb',
  '\\mathr': '\\mathrm',
  '\\textt': '\\text',
  '\\bino': '\\binom',
  '\\sum_': '\\sum_',
};

// Environment name misspellings
const ENV_TYPOS: Record<string, string> = {
  'casess': 'cases',
  'case': 'cases',
  'pmatix': 'pmatrix',
  'pmatrx': 'pmatrix',
  'bmatix': 'bmatrix',
  'bmatrx': 'bmatrix',
  'vmatix': 'vmatrix',
  'vmatrx': 'vmatrix',
  'algin': 'align',
  'algin*': 'align*',
  'algined': 'aligned',
  'matix': 'matrix',
};

// Known commands that are frequently missing a leading backslash
const MISSING_BACKSLASH_CMDS = [
  'overrightarrow',
  'overleftarrow',
  'overline',
  'underline',
  'widehat',
  'widetilde',
  'Leftrightarrow',
  'Rightarrow',
  'Leftarrow',
  'rightarrow',
  'leftarrow',
  'leftrightarrow',
  'triangle',
  'parallel',
  'emptyset',
  'subseteq',
  'supseteq',
  'subseteq',
  'approx',
  'forall',
  'exists',
  'partial',
  'lambda',
  'varphi',
  'varepsilon',
  'dfrac',
  'tfrac',
  'binom',
  'alpha',
  'gamma',
  'delta',
  'Delta',
  'theta',
  'sigma',
  'Sigma',
  'omega',
  'Omega',
  'infty',
  'times',
  'notin',
  'subset',
  'supset',
  'angle',
  'equiv',
  'mathbb',
  'mathrm',
  'mathbf',
  'arcsin',
  'arccos',
  'arctan',
  'frac',
  'sqrt',
  'cdot',
  'beta',
  'perp',
  'cong',
  'prod',
  'oint',
  'iint',
  'iiint',
  'vec',
  'hat',
  'bar',
  'lim',
  'sum',
  'int',
  'sin',
  'cos',
  'tan',
  'cot',
  'csc',
  'sec',
  'log',
  'ln',
  'exp',
  'max',
  'min',
  'sup',
  'inf',
  'det',
  'deg',
  'gcd',
  'leq',
  'geq',
  'neq',
  'pm',
  'mp',
  'pi',
  'mu',
  'phi',
  'psi',
  'cup',
  'cap',
  'div',
  'sim',
];

function normalizeMathAlphanumeric(input: string): string {
  let out = '';
  for (const ch of input) {
    const cp = ch.codePointAt(0)!;
    // Mathematical Bold Capital A-Z (U+1D400 - U+1D419)
    if (cp >= 0x1d400 && cp <= 0x1d419) out += String.fromCharCode(65 + (cp - 0x1d400));
    // Mathematical Bold Small a-z (U+1D41A - U+1D433)
    else if (cp >= 0x1d41a && cp <= 0x1d433) out += String.fromCharCode(97 + (cp - 0x1d41a));
    // Mathematical Italic Capital A-Z (U+1D434 - U+1D44D)
    else if (cp >= 0x1d434 && cp <= 0x1d44d) out += String.fromCharCode(65 + (cp - 0x1d434));
    // Mathematical Italic Small a-z (U+1D44E - U+1D467)
    else if (cp >= 0x1d44e && cp <= 0x1d467) out += String.fromCharCode(97 + (cp - 0x1d44e));
    // Planck constant h (U+210E)
    else if (cp === 0x210e) out += 'h';
    // Mathematical Bold Italic A-Z, a-z
    else if (cp >= 0x1d468 && cp <= 0x1d481) out += String.fromCharCode(65 + (cp - 0x1d468));
    else if (cp >= 0x1d482 && cp <= 0x1d49b) out += String.fromCharCode(97 + (cp - 0x1d482));
    // Mathematical Sans-Serif A-Z, a-z
    else if (cp >= 0x1d5a0 && cp <= 0x1d5b9) out += String.fromCharCode(65 + (cp - 0x1d5a0));
    else if (cp >= 0x1d5ba && cp <= 0x1d5d3) out += String.fromCharCode(97 + (cp - 0x1d5ba));
    // Mathematical Bold Digits 0-9
    else if (cp >= 0x1d7ce && cp <= 0x1d7d7) out += String.fromCharCode(48 + (cp - 0x1d7ce));
    else if (cp >= 0x1d7e2 && cp <= 0x1d7eb) out += String.fromCharCode(48 + (cp - 0x1d7e2));
    else out += ch;
  }
  return out;
}

/**
 * Helper to skip over \text{...} / \mathrm{...} / \mbox{...} regions so Vietnamese text inside
 * formulas is never altered by command auto-fixing.
 */
function transformOutsideTextMacros(src: string, fn: (mathChunk: string) => string): string {
  const result: string[] = [];
  let i = 0;
  let mathStart = 0;
  const textMacros = ['\\text', '\\textrm', '\\textbf', '\\textit', '\\mathrm', '\\mbox', '\\hbox', '\\ce', '\\pu'];

  while (i < src.length) {
    let matchedMacro = '';
    for (const macro of textMacros) {
      if (src.startsWith(macro, i)) {
        const nextCh = src[i + macro.length];
        if (nextCh === '{' || nextCh === ' ') {
          matchedMacro = macro;
          break;
        }
      }
    }

    if (matchedMacro) {
      // Process preceding math chunk
      if (i > mathStart) {
        result.push(fn(src.slice(mathStart, i)));
      }
      // Find matching braces of the text macro
      let j = i + matchedMacro.length;
      while (j < src.length && src[j] === ' ') j++;
      if (src[j] === '{') {
        let depth = 0;
        const start = i;
        while (j < src.length) {
          if (src[j] === '\\' && j + 1 < src.length) {
            j += 2;
            continue;
          }
          if (src[j] === '{') depth++;
          else if (src[j] === '}') {
            depth--;
            if (depth === 0) {
              j++;
              break;
            }
          }
          j++;
        }
        result.push(src.slice(start, j));
        i = j;
        mathStart = j;
        continue;
      }
    }
    i++;
  }

  if (mathStart < src.length) {
    result.push(fn(src.slice(mathStart)));
  }

  return result.join('');
}

function convertUnicodeRadicals(src: string, notes: FixNote[]): string {
  let out = src;
  // Cube root ∛(expr) or ∛x
  if (out.includes('∛')) {
    out = out.replace(/∛\(([^()]+)\)/g, '\\sqrt[3]{$1}');
    out = out.replace(/∛([a-zA-Z0-9]+)/g, '\\sqrt[3]{$1}');
    notes.push({ code: 'unicode_cuberoot', message: 'Chuyển ký hiệu căn bậc ba ∛ sang \\sqrt[3]{...}', severity: 'safe' });
  }
  // Fourth root ∜
  if (out.includes('∜')) {
    out = out.replace(/∜\(([^()]+)\)/g, '\\sqrt[4]{$1}');
    out = out.replace(/∜([a-zA-Z0-9]+)/g, '\\sqrt[4]{$1}');
    notes.push({ code: 'unicode_fourthroot', message: 'Chuyển ký hiệu căn bậc bốn ∜ sang \\sqrt[4]{...}', severity: 'safe' });
  }
  // Square root √ with parenthesized or brace expression or single token
  if (out.includes('√')) {
    // Handle nested parentheses after √
    let result = '';
    let i = 0;
    while (i < out.length) {
      if (out[i] === '√') {
        let j = i + 1;
        while (j < out.length && out[j] === ' ') j++;
        if (out[j] === '(') {
          let depth = 0;
          const start = j + 1;
          let k = j;
          while (k < out.length) {
            if (out[k] === '(') depth++;
            else if (out[k] === ')') {
              depth--;
              if (depth === 0) break;
            }
            k++;
          }
          if (depth === 0) {
            const inner = convertUnicodeRadicals(out.slice(start, k), []);
            result += `\\sqrt{${inner}}`;
            i = k + 1;
            continue;
          }
        } else if (out[j] === '{') {
          result += '\\sqrt';
          i = j;
          continue;
        } else {
          // Capture immediate token (number or variable like 2, x, 3x)
          const tokenMatch = out.slice(j).match(/^([a-zA-Z0-9]+(?:\^[a-zA-Z0-9{}]+)?)/);
          if (tokenMatch) {
            result += `\\sqrt{${tokenMatch[1]}}`;
            i = j + tokenMatch[1].length;
            continue;
          }
        }
        result += '\\sqrt{}';
        i++;
      } else {
        result += out[i];
        i++;
      }
    }
    if (result !== out) {
      out = result;
      notes.push({ code: 'unicode_sqrt', message: 'Chuyển ký hiệu căn √ sang \\sqrt{...}', severity: 'safe' });
    }
  }
  return out;
}

function convertUnicodeScripts(src: string, notes: FixNote[]): string {
  let out = src;
  const supChars = Object.keys(SUPERSCRIPT_CHAR_MAP).join('');
  const subChars = Object.keys(SUBSCRIPT_CHAR_MAP).join('');
  const supRegex = new RegExp(`[${supChars}]+`, 'g');
  const subRegex = new RegExp(`[${subChars}]+`, 'g');

  if (supRegex.test(out)) {
    out = out.replace(supRegex, (match) => {
      const mapped = Array.from(match).map((c) => SUPERSCRIPT_CHAR_MAP[c] ?? c).join('');
      return mapped.length === 1 ? `^${mapped}` : `^{${mapped}}`;
    });
    notes.push({ code: 'unicode_sup', message: 'Chuẩn hóa ký tự số mũ Unicode sang cú pháp LaTeX', severity: 'safe' });
  }

  if (subRegex.test(out)) {
    out = out.replace(subRegex, (match) => {
      const mapped = Array.from(match).map((c) => SUBSCRIPT_CHAR_MAP[c] ?? c).join('');
      return mapped.length === 1 ? `_${mapped}` : `_{${mapped}}`;
    });
    notes.push({ code: 'unicode_sub', message: 'Chuẩn hóa ký tự chỉ số dưới Unicode sang cú pháp LaTeX', severity: 'safe' });
  }

  return out;
}

interface BraceAnalysis {
  unclosedCount: number;
  extraCloseCount: number;
  firstUnclosedIndex: number;
}

function analyzeBraces(src: string): BraceAnalysis {
  let depth = 0;
  let extraCloseCount = 0;
  const openStack: number[] = [];

  for (let i = 0; i < src.length; i++) {
    if (src[i] === '\\' && i + 1 < src.length) {
      i++; // skip escaped brace \{ or \}
      continue;
    }
    if (src[i] === '{') {
      depth++;
      openStack.push(i);
    } else if (src[i] === '}') {
      if (depth > 0) {
        depth--;
        openStack.pop();
      } else {
        extraCloseCount++;
      }
    }
  }

  return {
    unclosedCount: depth,
    extraCloseCount,
    firstUnclosedIndex: openStack.length > 0 ? openStack[0] : -1,
  };
}

function balanceLeftRight(src: string, notes: FixNote[]): { text: string; ambiguous: boolean } {
  const tokenRegex = /\\left\s*(?:\\{|\\}|\\langle|\\rangle|\\lfloor|\\rfloor|\\lceil|\\rceil|\\vert|\\Vert|[()[\]|.])|\\right\s*(?:\\{|\\}|\\langle|\\rangle|\\lfloor|\\rfloor|\\lceil|\\rceil|\\vert|\\Vert|[()[\]|.])/g;
  const tokens: Array<{ kind: 'left' | 'right'; index: number; raw: string; delim: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(src)) !== null) {
    const raw = match[0];
    const kind = raw.startsWith('\\left') ? 'left' : 'right';
    const delim = raw.replace(/^\\(left|right)\s*/, '');
    tokens.push({ kind, index: match.index, raw, delim });
  }

  let balance = 0;
  let extraRight = 0;
  const leftDelims: string[] = [];

  for (const t of tokens) {
    if (t.kind === 'left') {
      balance++;
      leftDelims.push(t.delim);
    } else {
      if (balance > 0) {
        balance--;
        leftDelims.pop();
      } else {
        extraRight++;
      }
    }
  }

  if (balance === 0 && extraRight === 0) {
    return { text: src, ambiguous: false };
  }

  let updated = src;
  let ambiguous = false;

  if (balance > 0 && extraRight === 0) {
    const closeMap: Record<string, string> = {
      '(': ')',
      '[': ']',
      '\\{': '\\}',
      '|': '|',
      '.': '.',
      '\\langle': '\\rangle',
      '\\lfloor': '\\rfloor',
      '\\lceil': '\\rceil',
    };
    const closings = leftDelims
      .reverse()
      .map((d) => `\\right${closeMap[d] ?? '.'}`)
      .join('');
    updated = `${updated}${closings}`;
    notes.push({
      code: 'unbalanced_left_right',
      message: `Bổ sung ${balance} lệnh \\right bị thiếu để cân bằng dấu ngoặc co giãn`,
      severity: balance === 1 ? 'safe' : 'ambiguous',
    });
    if (balance > 1) ambiguous = true;
  } else if (extraRight > 0 && balance === 0) {
    // Strip stray \right. or replace \right) with )
    updated = updated.replace(/\\right(\.|[()[\]|]|\\}|\\rangle|\\rfloor|\\rceil)/g, (_m, d) => (d === '.' ? '' : d));
    notes.push({
      code: 'extra_right',
      message: 'Xử lý lệnh \\right thừa không có \\left tương ứng',
      severity: 'ambiguous',
    });
    ambiguous = true;
  } else {
    ambiguous = true;
  }

  return { text: updated, ambiguous };
}

/**
 * Detect ambiguous structures that must NEVER be silently guessed (Section 4 & 5):
 * - Double superscripts/subscripts like x^2^3 or a_i_j
 * - Ambiguous \sqrt scope like \sqrt a+b (could be \sqrt{a}+b or \sqrt{a+b})
 * - Ambiguous ungrouped division with addition like a+b/c+d inside bare expression
 * - Incomplete \frac with only 1 argument
 */
function detectAmbiguities(src: string, notes: FixNote[]): boolean {
  let hasAmbiguity = false;

  // Double superscript e.g. x^2^3
  if (/\^(?:[a-zA-Z0-9]|\{[^{}]*\})\s*\^/.test(src)) {
    hasAmbiguity = true;
    notes.push({
      code: 'double_superscript',
      message: 'Phát hiện số mũ kép không có ngoặc nhóm (ví dụ a^b^c), có nhiều cách hiểu — cần giáo viên xác nhận',
      severity: 'ambiguous',
    });
  }

  // Double subscript e.g. a_i_j
  if (/_(?:[a-zA-Z0-9]|\{[^{}]*\})\s*_/.test(src)) {
    hasAmbiguity = true;
    notes.push({
      code: 'double_subscript',
      message: 'Phát hiện chỉ số dưới kép không có ngoặc nhóm (ví dụ a_i_j) — cần giáo viên xác nhận',
      severity: 'ambiguous',
    });
  }

  // \frac with missing second argument at end e.g. \frac{a+b}
  const fracRegex = /\\(?:d|t)?frac\b/g;
  let fm: RegExpExecArray | null;
  while ((fm = fracRegex.exec(src)) !== null) {
    let idx = fm.index + fm[0].length;
    while (idx < src.length && src[idx] === ' ') idx++;
    // Skip first argument
    if (src[idx] === '{') {
      let depth = 0;
      while (idx < src.length) {
        if (src[idx] === '\\') { idx += 2; continue; }
        if (src[idx] === '{') depth++;
        else if (src[idx] === '}') { depth--; if (depth === 0) { idx++; break; } }
        idx++;
      }
    } else if (idx < src.length) {
      idx++;
    }
    while (idx < src.length && src[idx] === ' ') idx++;
    if (idx >= src.length || src[idx] === '}' || src[idx] === ')') {
      hasAmbiguity = true;
      notes.push({
        code: 'incomplete_frac',
        message: 'Phân số \\frac thiếu mẫu số — không tự điền giá trị, cần giáo viên kiểm tra',
        severity: 'ambiguous',
      });
    }
  }

  // Unclosed \begin{env} without matching \end{env}
  const begins = Array.from(src.matchAll(/\\begin\{([a-zA-Z*]+)\}/g)).map((m) => m[1]);
  const ends = Array.from(src.matchAll(/\\end\{([a-zA-Z*]+)\}/g)).map((m) => m[1]);
  if (begins.length !== ends.length) {
    hasAmbiguity = true;
    notes.push({
      code: 'unbalanced_env',
      message: 'Cấu trúc \\begin{...} và \\end{...} không khớp nhau — cần xác nhận',
      severity: 'ambiguous',
    });
  }

  return hasAmbiguity;
}

const MULTILINE_ENV_NAMES = new Set([
  'cases',
  'dcases',
  'pmatrix',
  'bmatrix',
  'Bmatrix',
  'vmatrix',
  'Vmatrix',
  'matrix',
  'smallmatrix',
  'aligned',
  'align',
  'align*',
  'array',
  'gather',
  'gather*',
  'gathered',
  'split',
  'eqnarray',
  'eqnarray*',
]);

const KNOWN_ESCAPE_COMMANDS = new Set([
  ...MISSING_BACKSLASH_CMDS,
  'begin',
  'end',
  'left',
  'right',
  'big',
  'Big',
  'bigg',
  'Bigg',
  'text',
  'textrm',
  'textbf',
  'textit',
  'mbox',
  'hbox',
  'displaystyle',
  'textstyle',
  'scriptstyle',
  'quad',
  'qquad',
  'hspace',
  'vspace',
  'hline',
  'cline',
  'not',
  'mid',
  'setminus',
  'circ',
  'bullet',
  'star',
  'ldots',
  'cdots',
  'vdots',
  'ddots',
  'dots',
  'overset',
  'underset',
  'stackrel',
  'frown',
  'smile',
  'hat',
  'tilde',
  'check',
  'dot',
  'ddot',
  'bar',
  'cancel',
  'boxed',
  'color',
  'textcolor',
  'limits',
  'nolimits',
  'operatorname',
  'DeclareMathOperator',
  'le',
  'ge',
  'ne',
  'to',
  'gets',
  'iff',
  'implies',
  'impliedby',
  'land',
  'lor',
  'neg',
  'lnot',
  'wedge',
  'vee',
  'oplus',
  'otimes',
  'nabla',
  'rangle',
  'langle',
  'lfloor',
  'rfloor',
  'lceil',
  'rceil',
  'vert',
  'Vert',
  'tg',
  'cotg',
  'ctg',
  'arctg',
  'cosec',
  'R',
  'N',
  'Z',
  'Q',
  'C',
  'ce',
  'pu',
  'xrightarrow',
  'xrightleftharpoons',
  'rightleftharpoons',
  'longrightarrow',
  'downarrow',
  'uparrow',
  // Common typos so double-escaped typos like \\farc also get caught cleanly
  'farc',
  'frca',
  'sqtr',
  'sqr',
  'inft',
  'infitny',
  'rigtharrow',
  'overrigharrow',
  'beign',
  'edn',
]);

/**
 * Carefully unescape over-escaped double backslashes (e.g. \\frac, \\sqrt, \\begin{cases})
 * while STRICTLY preserving valid row-break `\\` inside matrices, cases, and multiline environments.
 */
function normalizeOverEscapedBackslashes(src: string, notes: FixNote[]): string {
  if (!src.includes('\\\\')) return src;

  // Case A: Entire multiline environment was double-escaped (e.g., \\begin{cases} a \\\\ b \\end{cases})
  if (/\\\\begin\{[a-zA-Z*]+\}/.test(src) && /\\\\end\{[a-zA-Z*]+\}/.test(src)) {
    const candidate = src
      // Preserve 4-backslash row breaks as 2-backslash row breaks using a placeholder first
      .replace(/\\\\\\\\/g, '__MATHFIX_ROWBREAK__')
      // Unescape double-escaped commands (\\begin, \\frac, \\end, etc.)
      .replace(/\\\\([a-zA-Z]+)/g, '\\$1')
      // Unescape double-escaped braces/spacing (\\{, \\}, \\,, \\;)
      .replace(/\\\\([{},;!:| ])/g, '\\$1')
      .replace(/__MATHFIX_ROWBREAK__/g, '\\\\');

    if (candidate !== src) {
      notes.push({
        code: 'unescape_double_backslash_env',
        message: 'Loại bỏ dấu gạch chéo ngược thừa (\\\\ → \\) trong môi trường nhiều dòng, giữ nguyên dấu ngắt dòng \\\\',
        severity: 'safe',
      });
      return candidate;
    }
  }

  // Case B: Split around valid single-escaped multiline environments so valid `\\` row breaks are untouched
  const envBlockRegex = /\\begin\{([a-zA-Z*]+)\}[\s\S]*?\\end\{\1\}/g;
  let result = '';
  let lastIndex = 0;
  let changedOutside = false;
  let changedInsideRowStart = false;
  let match: RegExpExecArray | null;

  const unescapeKnownCommands = (segment: string): string => {
    let out = segment.replace(/(?<!\\)\\\\([a-zA-Z]+)/g, (full, cmd) => {
      if (KNOWN_ESCAPE_COMMANDS.has(cmd)) {
        changedOutside = true;
        return `\\${cmd}`;
      }
      return full;
    });
    // Also unescape double-escaped braces/spacing outside multiline environments: \\{ -> \{, \\} -> \}
    out = out.replace(/(?<!\\)\\\\([{},;!])/g, (_full, sym) => {
      changedOutside = true;
      return `\\${sym}`;
    });
    return out;
  };

  while ((match = envBlockRegex.exec(src)) !== null) {
    // Process chunk BEFORE the multiline environment
    if (match.index > lastIndex) {
      result += unescapeKnownCommands(src.slice(lastIndex, match.index));
    }

    const envName = match[1];
    let envBody = match[0];

    if (MULTILINE_ENV_NAMES.has(envName)) {
      // Inside a valid multiline environment:
      // NEVER touch `\\` followed by whitespace, digits, variables, or newline (valid row breaks!).
      // Only unescape `\\cmd` when it immediately follows `\begin{env}` or `&`, `=`, `+`, `-`, `(`, `{`
      // (positions where a row break `\\` cannot syntactically occur before a known command).
      const fixedEnv = envBody.replace(
        /((?:\\begin\{[a-zA-Z*]+\}|[&=+\-({,])\s*)\\\\([a-zA-Z]+)/g,
        (full, prefix, cmd) => {
          if (KNOWN_ESCAPE_COMMANDS.has(cmd)) {
            changedInsideRowStart = true;
            return `${prefix}\\${cmd}`;
          }
          return full;
        }
      );
      envBody = fixedEnv;
    } else {
      envBody = unescapeKnownCommands(envBody);
    }

    result += envBody;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < src.length) {
    result += unescapeKnownCommands(src.slice(lastIndex));
  }

  if (changedOutside || changedInsideRowStart) {
    notes.push({
      code: 'unescape_double_backslash',
      message: 'Loại bỏ dấu gạch chéo ngược thừa (\\\\ → \\) trước lệnh LaTeX hợp lệ',
      severity: 'safe',
    });
  }

  return result;
}

export function fixLatex(
  rawLatex: string,
  displayMode = false,
  options?: LatexFixOptions
): LatexFixResult {
  const subjectMode: SubjectMode = options?.subjectMode ?? 'auto';
  const contextText = options?.contextText ?? '';
  const fallbackSubject: FormulaSubject = subjectMode === 'auto' ? 'math' : subjectMode;
  const originalLatex = rawLatex.trim();
  if (!originalLatex) {
    return {
      originalLatex,
      fixedLatex: '',
      status: 'unrecoverable',
      subject: fallbackSubject,
      subjectConfidence: 'low',
      ommlCompatible: false,
      notes: [{ code: 'empty', message: 'Biểu thức rỗng', severity: 'error' }],
      svg: '',
      mathml: '',
      validated: false,
      errorMessage: 'Biểu thức rỗng',
    };
  }

  const notes: FixNote[] = [];
  let work = originalLatex;

  // 1. Clean invisible/control characters & line breaks broken during copy-paste (Group G)
  const cleanedInvisible = work
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .replace(/\u00A0/g, ' ');
  if (cleanedInvisible !== work) {
    work = cleanedInvisible;
    notes.push({
      code: 'invisible_chars',
      message: 'Loại bỏ ký tự ẩn không tương thích khi sao chép',
      severity: 'safe',
    });
  }

  // Detect complex 2D structural chemistry BEFORE flattening line breaks!
  const isComplexChem =
    (subjectMode === 'auto' || subjectMode === 'chemistry') && isComplexStructuralChemistry(work);

  // Join accidental single line breaks inside formulas while preserving \\ (row breaks in matrices/cases)
  if (!isComplexChem && /\r?\n/.test(work)) {
    const joined = work
      .replace(/\r\n/g, '\n')
      .replace(/(?<!\\)\n+/g, ' ')
      .replace(/\\\\\s*\n\s*/g, '\\\\ ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (joined !== work) {
      work = joined;
      notes.push({
        code: 'broken_newlines',
        message: 'Ghép lại công thức bị ngắt dòng ngoài ý muốn khi sao chép',
        severity: 'safe',
      });
    }
  }

  // 1b. Carefully normalize over-escaped double backslashes (\\frac -> \frac) while preserving valid \\ row breaks
  work = normalizeOverEscapedBackslashes(work, notes);

  // 2. Normalize Unicode Mathematical Alphanumeric Symbols (e.g. 𝑥, 𝑦, 𝑎 from ChatGPT/PDF)
  const normalizedAlpha = normalizeMathAlphanumeric(work);
  if (normalizedAlpha !== work) {
    work = normalizedAlpha;
    notes.push({
      code: 'unicode_math_alpha',
      message: 'Chuyển ký tự toán học Unicode (𝑥, 𝑦, ...) về ký tự chuẩn LaTeX',
      severity: 'safe',
    });
  }

  // 2b. Per-formula subject classification (Section II)
  const classification =
    subjectMode === 'auto'
      ? classifyFormulaSubject(work, contextText)
      : {
          subject: subjectMode as FormulaSubject,
          confidence: 'high' as SubjectConfidence,
          reason: 'Chế độ môn học được chọn thủ công',
        };
  const subject: FormulaSubject = classification.subject;
  const subjectConfidence: SubjectConfidence = classification.confidence;

  // 2c. Dedicated Chemistry pipeline (Section V) — runs BEFORE math ->/\to and math typo transforms!
  if (subject === 'chemistry') {
    const chemRes = normalizeChemistryLatex(work, notes);
    const dedupChemNotes: FixNote[] = [];
    const seenChem = new Set<string>();
    for (const n of notes) {
      const key = `${n.code}:${n.message}`;
      if (!seenChem.has(key)) {
        seenChem.add(key);
        dedupChemNotes.push(n);
      }
    }

    if (!chemRes.ommlCompatible) {
      return {
        originalLatex,
        fixedLatex: chemRes.latex,
        status: 'needs_review',
        subject: 'chemistry',
        subjectConfidence,
        ommlCompatible: false,
        ommlWarning: chemRes.ommlWarning,
        notes: dedupChemNotes,
        svg: '',
        mathml: '',
        validated: false,
        errorMessage: chemRes.ommlWarning,
      };
    }

    const chemRender = renderLatexToSvg(chemRes.latex, displayMode);
    if (chemRender.ok) {
      const wasChanged = chemRes.latex !== originalLatex;
      return {
        originalLatex,
        fixedLatex: chemRes.latex,
        status: wasChanged || dedupChemNotes.length > 0 ? 'auto_fixed' : 'valid',
        subject: 'chemistry',
        subjectConfidence,
        ommlCompatible: true,
        notes: dedupChemNotes,
        svg: chemRender.svg,
        mathml: chemRender.mathml,
        validated: true,
      };
    }

    // Fallback to untouched original if mhchem/chem normalization failed MathJax
    const origChemRender = renderLatexToSvg(originalLatex, displayMode);
    if (origChemRender.ok) {
      return {
        originalLatex,
        fixedLatex: originalLatex,
        status: 'valid',
        subject: 'chemistry',
        subjectConfidence,
        ommlCompatible: true,
        notes: [],
        svg: origChemRender.svg,
        mathml: origChemRender.mathml,
        validated: true,
      };
    }

    return {
      originalLatex,
      fixedLatex: chemRes.latex,
      status: 'unrecoverable',
      subject: 'chemistry',
      subjectConfidence,
      ommlCompatible: false,
      notes: [
        ...dedupChemNotes,
        {
          code: 'mathjax_validation_failed',
          message: chemRender.error || 'Công thức hóa học chưa hợp lệ về cú pháp',
          severity: 'error',
        },
      ],
      svg: chemRender.svg,
      mathml: chemRender.mathml,
      validated: false,
      errorMessage: chemRender.error,
    };
  }

  // 2d. Physics pre-normalization (Ohm/micro/°C/vec(...)) before generic Unicode conversion
  if (subject === 'physics') {
    work = transformOutsideTextMacros(work, (chunk) => normalizePhysicsLatex(chunk, notes));
  }

  // 3. Convert Unicode radicals, superscripts/subscripts, and Unicode operators outside \text{}
  work = transformOutsideTextMacros(work, (chunk) => {
    let c = convertUnicodeRadicals(chunk, notes);
    c = convertUnicodeScripts(c, notes);

    // Replace Unicode operators & Greek symbols
    let replacedUnicode = false;
    let mapped = '';
    for (const ch of c) {
      if (UNICODE_MATH_MAP[ch]) {
        mapped += UNICODE_MATH_MAP[ch];
        replacedUnicode = true;
      } else {
        mapped += ch;
      }
    }
    if (replacedUnicode) {
      c = mapped;
      notes.push({
        code: 'unicode_symbols',
        message: 'Chuyển đổi ký hiệu toán học Unicode sang lệnh LaTeX chuẩn',
        severity: 'safe',
      });
    }
    return c;
  });

  // 4. Fix misspelled LaTeX commands & environment names (Group G)
  work = transformOutsideTextMacros(work, (chunk) => {
    let c = chunk;
    for (const [typo, correct] of Object.entries(COMMAND_TYPOS)) {
      const escaped = typo.replace(/\\/g, '\\\\');
      const regex = new RegExp(`${escaped}(?![a-zA-Z])`, 'g');
      if (regex.test(c)) {
        c = c.replace(regex, correct);
        notes.push({
          code: 'command_typo',
          message: `Sửa lỗi chính tả lệnh ${typo} thành ${correct}`,
          severity: 'safe',
        });
      }
    }
    // Environment typos
    c = c.replace(/\\(begin|end)\{([a-zA-Z*]+)\}/g, (full, cmd, env) => {
      if (ENV_TYPOS[env]) {
        notes.push({
          code: 'env_typo',
          message: `Sửa tên môi trường ${env} thành ${ENV_TYPOS[env]}`,
          severity: 'safe',
        });
        return `\\${cmd}{${ENV_TYPOS[env]}}`;
      }
      return full;
    });
    return c;
  });

  // 5. Fix missing backslashes on common LaTeX commands (Group A, B, D, E, F, G)
  work = transformOutsideTextMacros(work, (chunk) => {
    let c = chunk;
    // Special ASCII shorthand operators inside math
    const shorthandReplacements: Array<[RegExp, string, string]> = [
      [/<=>/g, '\\Leftrightarrow ', 'Chuyển <=> sang \\Leftrightarrow'],
      [/=>/g, '\\Rightarrow ', 'Chuyển => sang \\Rightarrow'],
      [/->/g, '\\to ', 'Chuyển -> sang \\to'],
      [/<=/g, '\\le ', 'Chuyển <= sang \\le'],
      [/>=/g, '\\ge ', 'Chuyển >= sang \\ge'],
      [/!=/g, '\\ne ', 'Chuyển != sang \\ne'],
      [/\+-/g, '\\pm ', 'Chuyển +- sang \\pm'],
    ];
    for (const [rx, rep, msg] of shorthandReplacements) {
      if (rx.test(c)) {
        c = c.replace(rx, rep);
        notes.push({ code: 'ascii_operator', message: msg, severity: 'safe' });
      }
    }

    // Missing backslash before known LaTeX commands (avoiding already escaped or inside longer words)
    const cmdPattern = new RegExp(
      `(?<![\\\\a-zA-Z])(${MISSING_BACKSLASH_CMDS.join('|')})(?![a-zA-Z])`,
      'g'
    );
    const beforeCmdFix = c;
    c = c.replace(cmdPattern, (match, cmd, offset, fullStr) => {
      // Avoid converting single-letter/short words that are clearly variables unless followed by math syntax
      // e.g. 'in' only if surrounded by spaces/sets; 'max'/'min' safe; 'sin','cos','tan','log','ln','lim','frac','sqrt','vec','int','sum' always commands in math mode
      const after = fullStr.slice(offset + match.length);
      if (cmd === 'div' && !/\s/.test(after)) return match;
      if (cmd === 'pi' || cmd === 'mu') {
        return `\\${cmd}`;
      }
      return `\\${cmd}`;
    });
    if (c !== beforeCmdFix) {
      notes.push({
        code: 'missing_backslash',
        message: 'Bổ sung dấu gạch chéo ngược (\\) còn thiếu trước lệnh LaTeX',
        severity: 'safe',
      });
    }

    // Fix sqrt(expr) -> \sqrt{expr} (Group B)
    const sqrtParenRegex = /\\sqrt\s*\(([^()]+)\)/g;
    if (sqrtParenRegex.test(c)) {
      c = c.replace(sqrtParenRegex, '\\sqrt{$1}');
      notes.push({
        code: 'sqrt_parens',
        message: 'Chuẩn hóa \\sqrt(...) thành \\sqrt{...}',
        severity: 'safe',
      });
    }

    // Fix x^(n+1) -> x^{n+1} and a_(n+1) -> a_{n+1} (Group C)
    const expParenRegex = /\^\(([^()]+)\)/g;
    if (expParenRegex.test(c)) {
      c = c.replace(expParenRegex, '^{$1}');
      notes.push({
        code: 'exp_parens',
        message: 'Chuẩn hóa số mũ ^(...) thành ^{...}',
        severity: 'safe',
      });
    }
    const subParenRegex = /_\(([^()]+)\)/g;
    if (subParenRegex.test(c)) {
      c = c.replace(subParenRegex, '_{$1}');
      notes.push({
        code: 'sub_parens',
        message: 'Chuẩn hóa chỉ số dưới _(...) thành _{...}',
        severity: 'safe',
      });
    }

    // Fix \frac12 -> \frac{1}{2} and \frac12mv^2 -> \frac{1}{2}mv^2 (Group A + Physics W_d=\frac12mv^2)
    const shortFracRegex = /\\(d|t)?frac([0-9a-zA-Z])([0-9a-zA-Z])(?![a-zA-Z0-9])/g;
    const digitPairFracRegex = /\\(d|t)?frac([0-9])([0-9])(?=[a-zA-Z\\(])/g;
    if (shortFracRegex.test(c) || digitPairFracRegex.test(c)) {
      c = c.replace(shortFracRegex, '\\$1frac{$2}{$3}');
      c = c.replace(digitPairFracRegex, '\\$1frac{$2}{$3}');
      notes.push({
        code: 'short_frac',
        message: 'Chuẩn hóa phân số viết tắt \\fracab thành \\frac{a}{b}',
        severity: 'safe',
      });
    }

    // Fix \frac(a)(b) -> \frac{a}{b} (Group A)
    const parenFracRegex = /\\(d|t)?frac\s*\(([^()]+)\)\s*\(([^()]+)\)/g;
    if (parenFracRegex.test(c)) {
      c = c.replace(parenFracRegex, '\\$1frac{$2}{$3}');
      notes.push({
        code: 'paren_frac',
        message: 'Chuẩn hóa phân số ngoặc tròn \\frac(a)(b) thành \\frac{a}{b}',
        severity: 'safe',
      });
    }

    // Fix \sqrt2 -> \sqrt{2}, \sqrt x -> \sqrt{x} ONLY if standalone single token before operator/end
    const shortSqrtRegex = /\\sqrt(?:\[([^\]]+)\])?\s*([0-9a-zA-Z])(?=$|[\s+\-=,;.)\]}])/g;
    if (shortSqrtRegex.test(c)) {
      c = c.replace(shortSqrtRegex, (_m, deg, arg) => (deg ? `\\sqrt[${deg}]{${arg}}` : `\\sqrt{${arg}}`));
      notes.push({
        code: 'short_sqrt',
        message: 'Chuẩn hóa căn thức thiếu ngoặc nhọn thành \\sqrt{...}',
        severity: 'safe',
      });
    }

    // Fix common shorthand lim_{x \to 0} without braces: \lim_x \to 0 -> ambiguous if unclear, handle \lim_{x->0} already done via ->
    // Fix \vec AB -> \overrightarrow{AB} if 2 uppercase letters (Group D — Vietnamese geometry!)
    const vecTwoLetters = /\\vec\s*\{([A-Z]{2})\}/g;
    if (vecTwoLetters.test(c)) {
      c = c.replace(vecTwoLetters, '\\overrightarrow{$1}');
      notes.push({
        code: 'vector_two_points',
        message: 'Chuẩn hóa vectơ hai điểm \\vec{AB} thành \\overrightarrow{AB}',
        severity: 'safe',
      });
    }

    // Fix unsupported legacy commands like \tg -> \tan, \cotg -> \cot, \arctg -> \arctan, \arccotg -> \operatorname{arccot}, \R -> \mathbb{R}
    const legacyMap: Array<[RegExp, string, string]> = [
      [/\\tg(?![a-zA-Z])/g, '\\tan', 'Chuyển lệnh cũ \\tg sang \\tan'],
      [/\\cotg(?![a-zA-Z])/g, '\\cot', 'Chuyển lệnh cũ \\cotg sang \\cot'],
      [/\\ctg(?![a-zA-Z])/g, '\\cot', 'Chuyển lệnh cũ \\ctg sang \\cot'],
      [/\\arctg(?![a-zA-Z])/g, '\\arctan', 'Chuyển lệnh cũ \\arctg sang \\arctan'],
      [/\\cosec(?![a-zA-Z])/g, '\\csc', 'Chuyển lệnh cũ \\cosec sang \\csc'],
      [/\\R(?![a-zA-Z])/g, '\\mathbb{R}', 'Chuyển ký hiệu \\R sang \\mathbb{R}'],
      [/\\N(?![a-zA-Z])/g, '\\mathbb{N}', 'Chuyển ký hiệu \\N sang \\mathbb{N}'],
      [/\\Z(?![a-zA-Z])/g, '\\mathbb{Z}', 'Chuyển ký hiệu \\Z sang \\mathbb{Z}'],
      [/\\Q(?![a-zA-Z])/g, '\\mathbb{Q}', 'Chuyển ký hiệu \\Q sang \\mathbb{Q}'],
      [/\\C(?![a-zA-Z])/g, '\\mathbb{C}', 'Chuyển ký hiệu \\C sang \\mathbb{C}'],
    ];
    for (const [rx, rep, msg] of legacyMap) {
      if (rx.test(c)) {
        c = c.replace(rx, rep);
        notes.push({ code: 'legacy_cmd', message: msg, severity: 'safe' });
      }
    }

    return c;
  });

  // 6. Check ambiguities BEFORE structural auto-closing
  let hasAmbiguity = detectAmbiguities(work, notes);

  // 7. Balance \left and \right
  const lrResult = balanceLeftRight(work, notes);
  work = lrResult.text;
  if (lrResult.ambiguous) {
    hasAmbiguity = true;
  }

  // 8. Balance curly braces `{` and `}` using a real stack
  const braceInfo = analyzeBraces(work);
  if (braceInfo.unclosedCount > 0 && braceInfo.extraCloseCount === 0) {
    // Only auto-close up to 2 trailing missing braces; more than 2 is ambiguous
    if (braceInfo.unclosedCount <= 2) {
      work = work + '}'.repeat(braceInfo.unclosedCount);
      notes.push({
        code: 'missing_close_brace',
        message: `Tự động đóng ${braceInfo.unclosedCount} dấu ngoặc nhọn '}' còn thiếu ở cuối biểu thức`,
        severity: braceInfo.unclosedCount === 1 ? 'safe' : 'ambiguous',
      });
      if (braceInfo.unclosedCount > 1) hasAmbiguity = true;
    } else {
      hasAmbiguity = true;
      notes.push({
        code: 'many_unclosed_braces',
        message: `Thiếu ${braceInfo.unclosedCount} dấu ngoặc nhọn '}' — không tự đoán vị trí đóng, cần giáo viên sửa`,
        severity: 'error',
      });
    }
  } else if (braceInfo.extraCloseCount > 0 && braceInfo.unclosedCount === 0) {
    // Remove trailing unmatched '}' if it sits at the end
    let removed = 0;
    let temp = work;
    while (removed < braceInfo.extraCloseCount && temp.endsWith('}') && !temp.endsWith('\\}')) {
      temp = temp.slice(0, -1);
      removed++;
    }
    if (removed === braceInfo.extraCloseCount) {
      work = temp;
      notes.push({
        code: 'extra_close_brace',
        message: `Loại bỏ ${removed} dấu ngoặc nhọn '}' thừa ở cuối biểu thức`,
        severity: 'safe',
      });
    } else {
      hasAmbiguity = true;
      notes.push({
        code: 'stray_close_brace',
        message: 'Phát hiện dấu ngoặc nhọn thừa bên trong công thức — cần giáo viên kiểm tra',
        severity: 'error',
      });
    }
  } else if (braceInfo.unclosedCount > 0 && braceInfo.extraCloseCount > 0) {
    hasAmbiguity = true;
    notes.push({
      code: 'mismatched_braces',
      message: 'Dấu ngoặc nhọn đóng/mở bị lệch cấu trúc — cần giáo viên kiểm tra',
      severity: 'error',
    });
  }

  // Clean extra spaces before punctuation or inside commands
  work = work.replace(/\s{2,}/g, ' ').trim();

  // Deduplicate notes by code+message
  const dedupNotes: FixNote[] = [];
  const seenNote = new Set<string>();
  for (const n of notes) {
    const key = `${n.code}:${n.message}`;
    if (!seenNote.has(key)) {
      seenNote.add(key);
      dedupNotes.push(n);
    }
  }

  // 9. Strictly verify the candidate LaTeX via MathJax!
  const render = renderLatexToSvg(work, displayMode);

  // Also check if original was already valid and unchanged
  const wasChanged = work !== originalLatex;

  if (!render.ok) {
    // Try rendering the untouched original in case our fix broke something subtle
    if (wasChanged) {
      const origRender = renderLatexToSvg(originalLatex, displayMode);
      if (origRender.ok && !hasAmbiguity) {
        return {
          originalLatex,
          fixedLatex: originalLatex,
          status: 'valid',
          subject,
          subjectConfidence,
          ommlCompatible: true,
          notes: [],
          svg: origRender.svg,
          mathml: origRender.mathml,
          validated: true,
        };
      }
    }

    return {
      originalLatex,
      fixedLatex: work,
      status: 'unrecoverable',
      subject,
      subjectConfidence,
      ommlCompatible: false,
      notes: [
        ...dedupNotes,
        {
          code: 'mathjax_validation_failed',
          message: render.error || 'Biểu thức vẫn còn lỗi cú pháp chưa thể khôi phục chắc chắn',
          severity: 'error',
        },
      ],
      svg: render.svg,
      mathml: render.mathml,
      validated: false,
      errorMessage: render.error,
    };
  }

  // Verified valid by MathJax!
  let status: FormulaStatus;
  if (hasAmbiguity || dedupNotes.some((n) => n.severity === 'ambiguous')) {
    status = 'needs_review';
  } else if (wasChanged || dedupNotes.length > 0) {
    status = 'auto_fixed';
  } else {
    status = 'valid';
  }

  return {
    originalLatex,
    fixedLatex: work,
    status,
    subject,
    subjectConfidence,
    ommlCompatible: true,
    notes: dedupNotes,
    svg: render.svg,
    mathml: render.mathml,
    validated: true,
  };
}
