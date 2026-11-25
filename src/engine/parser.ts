import {
  DocumentBlock,
  DocumentStats,
  FormulaSegment,
  FormulaSourceFormat,
  FormulaSubject,
  InlineSegment,
  InputSourceType,
  ParagraphBlock,
  ProcessedDocument,
  SubjectMode,
  TableBlock,
  TableCellData,
} from './types';
import { fixLatex } from './latexFixer';
import { mathmlToLatex } from './mathmlConverter';
import { renderLatexToSvg } from './mathjaxRenderer';
import { classifyFormulaSubject, isComplexStructuralChemistry, isValidChemicalSpecies } from './subjectEngine';

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

export function detectSourceType(text: string, html?: string): InputSourceType {
  if (html) {
    if (/urn:schemas-microsoft-com:office:word|MsoNormal|mso-/i.test(html)) return 'word';
    if (/docs-internal-guid/i.test(html)) return 'google_docs';
    if (/katex|chatgpt|markdown/i.test(html)) return 'chatgpt';
    if (/gemini|bard|math-inline|math-block/i.test(html)) return 'gemini';
    return 'html';
  }
  if (/\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/.test(text)) return 'chatgpt';
  if (/\$\$[\s\S]+?\$\$/.test(text)) return 'gemini';
  return 'plain';
}

/**
 * Safely extract structured text + LaTeX placeholders from pasted HTML
 * using DOMParser (never executes scripts or untrusted event handlers).
 */
export function extractStructuredInputFromHtml(html: string): {
  text: string;
  sourceType: InputSourceType;
  hasTables: boolean;
} {
  const sourceType = detectSourceType('', html);
  if (typeof DOMParser === 'undefined') {
    // Structured fallback in non-DOM environments (Node/Vitest): handle KaTeX annotations, MathML, and tables
    let working = html
      .replace(/<script(?![^>]*math)[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');

    // Extract KaTeX TeX annotations
    working = working.replace(
      /<span[^>]*class="[^"]*katex[^"]*"[^>]*>[\s\S]*?<annotation[^>]*encoding="[^"]*tex[^"]*"[^>]*>([\s\S]*?)<\/annotation>[\s\S]*?<\/span>/gi,
      (_m, tex: string) => `$${tex.trim()}$`
    );

    // Convert <math>...</math> to LaTeX via mathmlToLatex
    working = working.replace(/<math\b[\s\S]*?<\/math>/gi, (mml: string) => {
      const tex = mathmlToLatex(mml);
      if (!tex) return '';
      const isDisplay = /display\s*=\s*["']block["']/i.test(mml);
      return isDisplay ? `\n$$${tex}$$\n` : `$${tex}$`;
    });

    // Convert <table>...</table> to markdown pipe rows
    working = working.replace(/<table\b[\s\S]*?<\/table>/gi, (tbl: string) => {
      const rowMatches = Array.from(tbl.matchAll(/<tr\b[\s\S]*?<\/tr>/gi));
      const rows = rowMatches.map((rm) => {
        const cellMatches = Array.from(rm[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi));
        const cells = cellMatches.map((cm) => cm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
        return `| ${cells.join(' | ')} |`;
      });
      return `\n${rows.join('\n')}\n`;
    });

    const stripped = working
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n');
    return { text: stripped.trim(), sourceType, hasTables: /<table/i.test(html) };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove dangerous or non-content tags strictly
  doc.querySelectorAll('script:not([type*="math"]), style, iframe, object, embed, noscript, meta, link').forEach((el) =>
    el.remove()
  );

  // Replace KaTeX containers with their exact LaTeX annotation
  doc.querySelectorAll('.katex-display, .katex').forEach((el) => {
    const ann = el.querySelector('annotation[encoding*="tex"]');
    if (ann?.textContent) {
      const isDisplay = el.classList.contains('katex-display') || Boolean(el.closest('.katex-display'));
      const tex = ann.textContent.trim();
      el.replaceWith(doc.createTextNode(isDisplay ? `\n$$${tex}$$\n` : `$${tex}$`));
    }
  });

  // Replace MathJax v3 / v2 assistive MathML or script[type="math/tex"]
  doc.querySelectorAll('mjx-container').forEach((el) => {
    const mml = el.querySelector('math');
    if (mml) {
      const isDisplay = el.getAttribute('display') === 'true';
      const tex = mathmlToLatex(mml.outerHTML);
      if (tex) {
        el.replaceWith(doc.createTextNode(isDisplay ? `\n$$${tex}$$\n` : `$${tex}$`));
      }
    }
  });

  doc.querySelectorAll('script[type*="math/tex"]').forEach((el) => {
    const isDisplay = /mode=display/i.test(el.getAttribute('type') || '');
    const tex = (el.textContent || '').trim();
    el.replaceWith(doc.createTextNode(isDisplay ? `\n$$${tex}$$\n` : `$${tex}$`));
  });

  // Replace raw <math> elements (e.g., from Word HTML, Wikipedia, Google Docs)
  doc.querySelectorAll('math').forEach((el) => {
    const isDisplay = el.getAttribute('display') === 'block';
    const tex = mathmlToLatex(el.outerHTML);
    if (tex) {
      el.replaceWith(doc.createTextNode(isDisplay ? `\n$$${tex}$$\n` : `$${tex}$`));
    }
  });

  // Gemini / web math attributes (data-math / data-latex)
  doc.querySelectorAll('[data-math], [data-latex]').forEach((el) => {
    const tex = (el.getAttribute('data-math') || el.getAttribute('data-latex') || '').trim();
    if (tex) {
      const isDisplay = el.classList.contains('math-block') || el.tagName === 'DIV';
      el.replaceWith(doc.createTextNode(isDisplay ? `\n$$${tex}$$\n` : `$${tex}$`));
    }
  });

  const hasTables = Boolean(doc.querySelector('table'));

  // Walk DOM to preserve clean paragraph breaks & simple markdown-style pipe tables
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') return '\n';

    if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr')).map((tr) => {
        const cells = Array.from(tr.querySelectorAll('th, td')).map((cell) =>
          walk(cell).replace(/\s*\n\s*/g, ' ').trim()
        );
        return `| ${cells.join(' | ')} |`;
      });
      return `\n${rows.join('\n')}\n`;
    }

    const inner = Array.from(el.childNodes).map(walk).join('');
    if (['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(tag)) {
      return `\n${inner}\n`;
    }
    return inner;
  }

  const rawText = walk(doc.body)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text: rawText, sourceType, hasTables };
}

function buildFormulaSegment(
  raw: string,
  extractedLatex: string,
  displayMode: boolean,
  sourceFormat: FormulaSourceFormat,
  subjectMode: SubjectMode = 'auto',
  contextText = ''
): FormulaSegment {
  const fix = fixLatex(extractedLatex, displayMode, { subjectMode, contextText });
  return {
    id: nextId('f'),
    type: 'formula',
    raw,
    originalLatex: fix.originalLatex,
    fixedLatex: fix.fixedLatex,
    activeLatex: fix.fixedLatex,
    displayMode,
    sourceFormat,
    subject: fix.subject,
    subjectConfidence: fix.subjectConfidence,
    ommlCompatible: fix.ommlCompatible,
    ommlWarning: fix.ommlWarning,
    status: fix.status,
    userDecision: 'pending',
    notes: fix.notes,
    svg: fix.svg,
    mathml: fix.mathml,
    validated: fix.validated,
    errorMessage: fix.errorMessage,
  };
}

interface BarePatternDef {
  regex: RegExp;
  format: FormulaSourceFormat;
  modes?: SubjectMode[];
  validate?: (candidate: string, fullLine: string) => boolean;
}

/**
 * Vietnamese-safe heuristic to detect bare (undelimited) LaTeX, UnicodeMath,
 * Physics equations, and Chemistry formulas/reactions inside plain prose.
 * Carefully avoids touching normal Vietnamese words.
 */
const BARE_MATH_TOKEN_PATTERNS: BarePatternDef[] = [
  // Raw embedded <math>...</math>
  { regex: /<math[\s\S]*?<\/math>/gi, format: 'mathml' },
  // Explicit mhchem \ce{...} / \pu{...} (and \chemfig{...})
  {
    regex: /\\{1,2}(?:ce|pu|chemfig)\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,
    format: 'mhchem',
  },
  // Bare \begin{env}...\end{env} or double-escaped \\begin{env}...\\end{env}
  {
    regex: /\\{1,2}begin\{(cases|dcases|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|matrix|aligned|align\*?|equation\*?|array|gather\*?)\}[\s\S]*?\\{1,2}end\{\1\}/g,
    format: 'bare_latex',
  },
  // Bare Chemical Reaction Equations (e.g. "2H2 + O2 -> 2H2O", "CaCO3 ->[t°] CaO + CO2 ↑", "N2 + 3H2 <=> 2NH3")
  {
    regex:
      /(?<![a-zA-ZÀ-ỹ0-9_])(?:(?:\d+(?:[.,]\d+)?\s*)?[A-Z][a-zA-Z0-9₀-₉()\[\]·.^_+\-{}]*(?:\s*\((?:aq|s|l|g|r|k|dd)\))?(?:\s*[↓↑])?(?:\s*\+\s*(?:\d+(?:[.,]\d+)?\s*)?[A-Z][a-zA-Z0-9₀-₉()\[\]·.^_+\-{}]*(?:\s*\((?:aq|s|l|g|r|k|dd)\))?(?:\s*[↓↑])?)*)\s*(?:\\xrightarrow(?:\[[^\]]*\])?\{[^}]*\}|\\xrightleftharpoons(?:\[[^\]]*\])?\{[^}]*\}|\\rightleftharpoons|\\longrightarrow|<=>\[[^\]]*\]|->\[[^\]]*\]|<=>|<->|⇌|⇄|⟶|→|->)\s*(?:(?:\d+(?:[.,]\d+)?\s*)?[A-Z][a-zA-Z0-9₀-₉()\[\]·.^_+\-{}]*(?:\s*\((?:aq|s|l|g|r|k|dd)\))?(?:\s*[↓↑])?(?:\s*\+\s*(?:\d+(?:[.,]\d+)?\s*)?[A-Z][a-zA-Z0-9₀-₉()\[\]·.^_+\-{}]*(?:\s*\((?:aq|s|l|g|r|k|dd)\))?(?:\s*[↓↑])?)*)/g,
    format: 'bare_chemistry',
    modes: ['auto', 'chemistry'],
    validate: (candidate, fullLine) => classifyFormulaSubject(candidate, fullLine).subject === 'chemistry',
  },
  // Bare calculus/big-operator LaTeX with or without braces (e.g. \int_0^1 x^2\,dx, \sum_{i=1}^n i^2, \lim_{x\to 0} \frac{\sin x}{x})
  {
    regex:
      /\\{1,2}(?:int|iint|iiint|oint|sum|prod|lim)(?:\s*(?:_(?:\{[^{}]*\}|[a-zA-Z0-9\\]+)|\^(?:\{[^{}]*\}|[a-zA-Z0-9\\+\-]+)))*(?:(?:\\[,;:! ]|[\s+\-=<>≤≥≠·⋅×÷^_a-zA-Z0-9(){}\[\]\\/|'*])+(?=\s|$|(?<!\\)[,;:.!?]))?/g,
    format: 'bare_latex',
  },
  // Bare Physics Equations starting with a symbol before LaTeX commands (e.g. W_d=\frac12mv^2, F=qvB\sin\alpha, F=k\frac{|q_1q_2|}{r^2})
  {
    regex:
      /(?<![a-zA-ZÀ-ỹ0-9_\\])(?:[a-zA-Z](?:_\{?[a-zA-Z0-9đĐ]+\}?)?\s*=\s*(?:[^,\n;!?]*\\(?:frac|dfrac|tfrac|sqrt|sin|cos|tan|vec|Delta|omega|Omega|pi|alpha|beta|varphi|lambda|mu|Phi)[^,\n;!?]*))/g,
    format: 'bare_physics',
    modes: ['auto', 'physics'],
  },
  // Bare LaTeX expressions starting with 1 or 2 backslashes or missing-backslash TeX command with braces/args
  // e.g. \frac{x^2+1}{2}, \\frac{x^2+1}{2}, frac{a}{b}, \sqrt{x+1}, sqrt(x+1), \overrightarrow{AB}, \vec{F}=m\vec{a}
  {
    regex:
      /(?:\\{1,2}(?:d|t)?frac|\\{1,2}sqrt|\\{1,2}int|\\{1,2}iint|\\{1,2}oint|\\{1,2}sum|\\{1,2}prod|\\{1,2}lim|\\{1,2}overrightarrow|\\{1,2}overline|\\{1,2}widehat|\\{1,2}vec|\\{1,2}binom|\\{1,2}mathbb|\\{1,2}angle|\\{1,2}triangle|\\{1,2}farc|\\{1,2}frca|\\{1,2}sqtr|\b(?:frac|dfrac|tfrac|sqrt|lim)\s*(?:\{|\[|\(|_))[^{\n,;:.!?]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\[[^\]]*\]|\([^()]*\))+(?:(?:\\[,;:! ]|[\s+\-=<>≤≥≠·⋅×÷^_a-zA-Z0-9(){}\[\]\\/|'*])+(?=\s|$|(?<!\\)[,;:.!?]))?/g,
    format: 'bare_latex',
  },
  // Standalone LaTeX symbol commands (1 or 2 backslashes) like \alpha, \\alpha, \Delta, \perp, \parallel, \in \mathbb{R}
  {
    regex:
      /(?:[a-zA-Z0-9()^_{}\[\]]+\s*)?\\{1,2}(?:alpha|beta|gamma|delta|Delta|theta|lambda|pi|sigma|omega|Omega|Phi|varphi|varepsilon|rho|mu|infty|le|leq|ge|geq|ne|neq|approx|equiv|pm|mp|times|cdot|div|to|rightarrow|Rightarrow|Leftrightarrow|in|notin|subset|subseteq|cup|cap|emptyset|forall|exists|perp|parallel|angle|triangle|cong|sim|sin|cos|tan|cot|log|ln)(?:\s*(?:[a-zA-Z0-9^_{}()+\-=<>\\]+))*/g,
    format: 'bare_latex',
  },
  // Bare single Chemical Molecules, Ions, Hydrates & Linear Condensed Formulas
  // e.g. H2SO4, CO2, Ca(OH)2, Fe3+, OH-, NH4+, SO4^2-, CuSO4.5H2O, CH3-CH2-OH, CH3COOH, AgCl ↓, CO2 ↑, HCl(aq)
  {
    regex:
      /(?<![a-zA-ZÀ-ỹ0-9_\\])(?:(?:\[?(?:(?:[A-Z][a-z]?|\([A-Z][a-zA-Z0-9₀-₉]*\))[0-9₀-₉]*)+\]?(?:[-=≡·.](?:[0-9]*(?:(?:[A-Z][a-z]?|\([A-Z][a-zA-Z0-9₀-₉]*\))[0-9₀-₉]*)+))+)|(?:\[?(?:(?:[A-Z][a-z]?|\([A-Z][a-zA-Z0-9₀-₉]*\))[0-9₀-₉]*)+\]?))(?:\^\{?\d*[+-]\}?|[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+|[+-](?![a-zA-Z0-9=]))?(?:\s*\((?:aq|s|l|g|r|k|dd)\))?(?:\s*[↓↑])?(?![a-zÀ-ỹ])/g,
    format: 'bare_chemistry',
    modes: ['auto', 'chemistry'],
    validate: (candidate) => {
      // Reject single option letters (A., B.), math combinations (C_n^k), or pure uppercase abbreviations without digits/charges
      if (/^[A-D]\.?$/.test(candidate) || /^[CAP]_/.test(candidate)) return false;
      const hasChemMarker =
        /[0-9₀-₉⁺⁻]|(?:\^?\{?\d*[+-]\}?$)|[-=≡·.]|\((?:aq|s|l|g|r|k|dd)\)|[↓↑]/.test(candidate);
      const isKnownBinaryNoDigit =
        /^(?:NaCl|KCl|AgCl|HCl|HBr|HI|HF|NaOH|KOH|CuO|FeO|MgO|CaO|BaO|ZnO|FeS|CuS|PbS|CO|NO|HCN)(?:\s*\((?:aq|s|l|g|r|k|dd)\))?(?:\s*[↓↑])?$/.test(
          candidate
        );
      if (!hasChemMarker && !isKnownBinaryNoDigit) return false;
      return isValidChemicalSpecies(candidate);
    },
  },
  // Bare Classic Physics Equations without $ (e.g. U = IR, F = ma, P = UI, pV = nRT, Q = mcΔt, E = mc^2)
  {
    regex:
      /(?<![a-zA-ZÀ-ỹ0-9_\\])(?:U\s*=\s*I\s*·?\s*R|P\s*=\s*U\s*·?\s*I|F\s*=\s*m\s*a|F\s*=\s*q\s*v\s*B(?:\s*(?:\\?sin\s*(?:\\?alpha|α)))?|p\s*V\s*=\s*n\s*R\s*T|Q\s*=\s*m\s*c\s*(?:\\Delta|Δ)\s*t|E\s*=\s*m\s*c(?:\^2|²)|A\s*=\s*U\s*I\s*t|v\s*=\s*v_0\s*\+\s*a\s*t|F_\{?(?:ms|ht|dh|đh)\}?\s*=\s*[^\n,;!?]+|W_\{?(?:d|đ|t)\}?\s*=\s*[^\n,;!?]+)(?=$|[\s,;.)!?])/g,
    format: 'bare_physics',
    modes: ['auto', 'physics'],
  },
  // UnicodeMath expressions: radicals (√, ∛), integrals/sums (∫, ∑), equations with Unicode superscripts/subscripts/operators
  // Also handles Mathematical Italic Unicode variables (e.g. 𝑥² + 2𝑥 − 3 = 0) copied from ChatGPT/PDF.
  // Carefully requires NO Vietnamese diacritic letters inside the matched span!
  {
    regex:
      /(?:[a-zA-Z\u{1D434}-\u{1D467}0-9()]+(?:\s*[+\-−=≤≥≠<>]\s*)?)?(?:[√∛∜]\s*(?:\([^()]+\)|[a-zA-Z\u{1D434}-\u{1D467}0-9]+)|[∫∑∏][₀-₉⁰-⁹a-zA-Z\u{1D434}-\u{1D467}0-9+\-]*\s*[a-zA-Z\u{1D434}-\u{1D467}0-9()^_+\-−/ ]*|[a-zA-Z\u{1D434}-\u{1D467}][²³⁴⁵⁶⁷⁸⁹⁰¹ⁿ⁻¹⁺]+(?:[\s+\-−=≤≥≠<>a-zA-Z\u{1D434}-\u{1D467}0-9²³⁴⁵⁶⁷⁸⁹⁰¹₀-₉()./]+)?|[a-zA-Z\u{1D434}-\u{1D467}][₀-₉ₙᵢⱼ]+(?:[\s+\-−=≤≥≠<>a-zA-Z\u{1D434}-\u{1D467}0-9²³⁴⁵⁶⁷⁸⁹⁰¹₀-₉()./]+)?|[∠△Δ][A-Z]{2,3}(?:\s*[=∼≅⊥∥]\s*[0-9°∠△ΔA-Z]+)?|[A-Z]{2}\s*[⊥∥]\s*[A-Z]{2})/gu,
    format: 'unicodemath',
  },
  // Plain ASCII algebraic expressions with explicit ^ or _ (e.g. x^2 + 2x - 3 = 0, a_{n+1} = 2a_n, x^(n+1))
  {
    regex:
      /(?<![a-zA-ZÀ-ỹ0-9_\\])(?:[a-zA-Z0-9()]+(?:\^(?:\{[^}]+\}|\([^)]+\)|[a-zA-Z0-9+\-]+)|_(?:\{[^}]+\}|\([^)]+\)|[a-zA-Z0-9đĐ]+))+)(?:\s*[+\-=<>≤≥≠·*/]\s*(?:[a-zA-Z0-9()]+(?:\^(?:\{[^}]+\}|\([^)]+\)|[a-zA-Z0-9+\-]+)|_(?:\{[^}]+\}|\([^)]+\)|[a-zA-Z0-9đĐ]+))*|[0-9]+(?:\.[0-9]+)?))*/g,
    format: 'bare_latex',
  },
];

// Vietnamese diacritic letters range — never swallow prose words into a bare math span
const VIETNAMESE_WORD_REGEX = /[ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵýỷỹ]/;

const TRAILING_MATH_WORD_ALLOWLIST = new Set([
  'dx',
  'dy',
  'dz',
  'dt',
  'du',
  'dv',
  'dr',
  'ds',
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'log',
  'ln',
  'exp',
  'lim',
  'max',
  'min',
  'mod',
  'det',
  'inf',
  'sup',
  'arg',
  'deg',
  'dim',
  'ker',
  'gcd',
  'lcm',
]);

function trimTrailingVietnameseAndPunctuation(candidate: string): string {
  let out = candidate.trim();
  // Trim trailing punctuation like '.', ',', ';', ':' that belong to sentence prose
  while (/[.,;:!?]$/.test(out) && !/\\(cdot|ldots|cdots)\s*$/.test(out)) {
    out = out.slice(0, -1).trimEnd();
  }
  // If candidate accidentally grabbed trailing Vietnamese word with diacritics, cut before it
  const viIdx = out.search(VIETNAMESE_WORD_REGEX);
  if (viIdx > 0) {
    // Cut back to the whitespace before the Vietnamese word
    const beforeVi = out.slice(0, viIdx).replace(/[a-zA-Z]+$/, '').trimEnd();
    if (beforeVi.length > 0) {
      out = beforeVi;
    }
  }
  // Also trim trailing diacritic-free Vietnamese prose words (e.g. "khi", "cho", "ta", "co", "hay")
  // when preceded by whitespace (and NOT immediately preceded by a math operator like +, -, =)
  let changed = true;
  while (changed) {
    changed = false;
    const trailingWordMatch = out.match(/^(.*[^\s+\-=<>≤≥≠·⋅×÷*/(,;:])\s+([a-z]{2,})$/);
    if (trailingWordMatch) {
      const prefix = trailingWordMatch[1];
      const word = trailingWordMatch[2];
      // Do not trim if it's a known math token/differential or a TeX command right after backslash
      if (!TRAILING_MATH_WORD_ALLOWLIST.has(word) && !prefix.endsWith('\\')) {
        out = prefix.trimEnd();
        changed = true;
      }
    }
  }
  while (/[.,;:!?]$/.test(out) && !/\\(cdot|ldots|cdots)\s*$/.test(out)) {
    out = out.slice(0, -1).trimEnd();
  }
  return out;
}

function parsePlainChunkForBareMath(
  text: string,
  subjectMode: SubjectMode = 'auto',
  fullLine = ''
): InlineSegment[] {
  if (!text) return [];

  // Find earliest non-overlapping bare math match across patterns
  const segments: InlineSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    let bestMatch: { start: number; end: number; raw: string; format: FormulaSourceFormat } | null = null;

    for (const pattern of BARE_MATH_TOKEN_PATTERNS) {
      if (pattern.modes && !pattern.modes.includes(subjectMode)) continue;

      pattern.regex.lastIndex = cursor;
      let m: RegExpExecArray | null;
      while ((m = pattern.regex.exec(text)) !== null) {
        if (!m[0]) {
          pattern.regex.lastIndex++;
          continue;
        }
        const start = m.index;
        // Early exit if already strictly past an earlier valid match
        if (bestMatch && start > bestMatch.start) {
          break;
        }

        let raw = m[0];

        // Allow Vietnamese inside \text{...}, \ce{...}, reaction conditions ->[...], and physics subscripts _đ/_đh
        const withoutAllowedVi = raw
          .replace(/\\text\{[^}]*\}/g, '')
          .replace(/\\ce\{[^}]*\}/g, '')
          .replace(/\\xrightarrow(?:\[[^\]]*\])?\{[^}]*\}/g, '')
          .replace(/\\xrightleftharpoons(?:\[[^\]]*\])?\{[^}]*\}/g, '')
          .replace(/(?:->|<=>)\[[^\]]*\]/g, '')
          .replace(/_\{?[đĐ]h?\}?/g, '');

        if (VIETNAMESE_WORD_REGEX.test(withoutAllowedVi)) {
          const trimmed = trimTrailingVietnameseAndPunctuation(raw);
          const trimmedClean = trimmed
            .replace(/\\text\{[^}]*\}/g, '')
            .replace(/\\ce\{[^}]*\}/g, '')
            .replace(/\\xrightarrow(?:\[[^\]]*\])?\{[^}]*\}/g, '')
            .replace(/(?:->|<=>)\[[^\]]*\]/g, '')
            .replace(/_\{?[đĐ]h?\}?/g, '');
          if (!trimmed || VIETNAMESE_WORD_REGEX.test(trimmedClean)) {
            continue;
          }
          raw = trimmed;
        } else {
          raw = trimTrailingVietnameseAndPunctuation(raw);
        }

        if (!raw || raw.length < 2) continue;

        // Avoid matching a lone number or single option letter like "A." or "B."
        if (/^[A-D]\.?$/.test(raw) || /^\d+$/.test(raw)) continue;

        if (pattern.validate && !pattern.validate(raw, fullLine || text)) {
          continue;
        }

        const end = start + raw.length;
        if (
          !bestMatch ||
          start < bestMatch.start ||
          (start === bestMatch.start && raw.length > bestMatch.raw.length)
        ) {
          bestMatch = { start, end, raw, format: pattern.format };
        }
        break;
      }
    }

    if (!bestMatch) {
      segments.push({ id: nextId('t'), type: 'text', text: text.slice(cursor) });
      break;
    }

    if (bestMatch.start > cursor) {
      segments.push({ id: nextId('t'), type: 'text', text: text.slice(cursor, bestMatch.start) });
    }

    let extracted = bestMatch.raw;
    let display = false;
    if (bestMatch.format === 'mathml') {
      extracted = mathmlToLatex(bestMatch.raw);
      display = /display\s*=\s*["']block["']/i.test(bestMatch.raw);
    } else if (/^\\{1,2}begin\{(cases|dcases|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|matrix|aligned|align\*?|equation\*?|array|gather\*?)\}/.test(extracted)) {
      display = true;
    }

    segments.push(
      buildFormulaSegment(bestMatch.raw, extracted, display, bestMatch.format, subjectMode, fullLine || text)
    );
    cursor = bestMatch.end;
  }

  return segments;
}

/**
 * Parse a single paragraph string with explicit math delimiters first:
 * $$...$$, \[...\], \(...\), $...$
 * Then scan remaining plain-text segments for bare LaTeX, MathML, UnicodeMath, Physics, or Chemistry.
 */
export function parseInlineLine(line: string, subjectMode: SubjectMode = 'auto'): InlineSegment[] {
  // Handle complex multi-line 2D structural chemistry block preserved as a single unit
  if ((subjectMode === 'auto' || subjectMode === 'chemistry') && isComplexStructuralChemistry(line)) {
    return [buildFormulaSegment(line, line, true, 'bare_chemistry', 'chemistry', line)];
  }

  const segments: InlineSegment[] = [];
  let i = 0;
  let textStart = 0;

  const flushText = (endIdx: number) => {
    if (endIdx > textStart) {
      const chunk = line.slice(textStart, endIdx);
      segments.push(...parsePlainChunkForBareMath(chunk, subjectMode, line));
    }
  };

  while (i < line.length) {
    // Escaped dollar \$ inside text
    if (line[i] === '\\' && line[i + 1] === '$') {
      i += 2;
      continue;
    }

    // 1. Display $$...$$
    if (line[i] === '$' && line[i + 1] === '$') {
      const closeIdx = line.indexOf('$$', i + 2);
      if (closeIdx !== -1) {
        flushText(i);
        const raw = line.slice(i, closeIdx + 2);
        const inner = line.slice(i + 2, closeIdx);
        segments.push(buildFormulaSegment(raw, inner, true, 'dollar_display', subjectMode, line));
        i = closeIdx + 2;
        textStart = i;
        continue;
      }
    }

    // 2a. Double-escaped Display \\[...\\]
    if (line[i] === '\\' && line[i + 1] === '\\' && line[i + 2] === '[') {
      const closeIdx = line.indexOf('\\\\]', i + 3);
      if (closeIdx !== -1) {
        flushText(i);
        const raw = line.slice(i, closeIdx + 3);
        const inner = line.slice(i + 3, closeIdx);
        segments.push(buildFormulaSegment(raw, inner, true, 'bracket_display', subjectMode, line));
        i = closeIdx + 3;
        textStart = i;
        continue;
      }
    }

    // 2b. Display \[...\]
    if (line[i] === '\\' && line[i + 1] === '[') {
      const closeIdx = line.indexOf('\\]', i + 2);
      if (closeIdx !== -1) {
        flushText(i);
        const raw = line.slice(i, closeIdx + 2);
        const inner = line.slice(i + 2, closeIdx);
        segments.push(buildFormulaSegment(raw, inner, true, 'bracket_display', subjectMode, line));
        i = closeIdx + 2;
        textStart = i;
        continue;
      }
    }

    // 3a. Double-escaped Inline \\(...\\)
    if (line[i] === '\\' && line[i + 1] === '\\' && line[i + 2] === '(') {
      const closeIdx = line.indexOf('\\\\)', i + 3);
      if (closeIdx !== -1) {
        flushText(i);
        const raw = line.slice(i, closeIdx + 3);
        const inner = line.slice(i + 3, closeIdx);
        segments.push(buildFormulaSegment(raw, inner, false, 'paren_inline', subjectMode, line));
        i = closeIdx + 3;
        textStart = i;
        continue;
      }
    }

    // 3b. Inline \(...\)
    if (line[i] === '\\' && line[i + 1] === '(') {
      const closeIdx = line.indexOf('\\)', i + 2);
      if (closeIdx !== -1) {
        flushText(i);
        const raw = line.slice(i, closeIdx + 2);
        const inner = line.slice(i + 2, closeIdx);
        segments.push(buildFormulaSegment(raw, inner, false, 'paren_inline', subjectMode, line));
        i = closeIdx + 2;
        textStart = i;
        continue;
      }
    }

    // 4. Inline $...$
    if (line[i] === '$' && line[i + 1] !== '$') {
      // Find matching unescaped single $
      let j = i + 1;
      let found = -1;
      while (j < line.length) {
        if (line[j] === '\\' && line[j + 1] === '$') {
          j += 2;
          continue;
        }
        if (line[j] === '$' && line[j + 1] !== '$') {
          found = j;
          break;
        }
        j++;
      }

      if (found !== -1) {
        const inner = line.slice(i + 1, found);
        // Guard against currency amounts like "$50 và một cây bút giá $10"
        const strippedTextMacros = inner.replace(/\\text\{[^}]*\}/g, '');
        const looksLikeCurrency =
          /^\d[\d,.]*(?:\s+(?:và|đến|tới|đồng|USD|VND|k)(?:\s|$))/i.test(inner.trim()) ||
          (/^\d[\d,.]*\s+/.test(inner.trim()) && VIETNAMESE_WORD_REGEX.test(strippedTextMacros));
        if (inner.trim().length > 0 && !looksLikeCurrency) {
          flushText(i);
          const raw = line.slice(i, found + 1);
          segments.push(buildFormulaSegment(raw, inner, false, 'dollar_inline', subjectMode, line));
          i = found + 1;
          textStart = i;
          continue;
        }
      }
    }

    i++;
  }

  flushText(line.length);
  return segments;
}

/**
 * Split multi-line raw text into ParagraphBlocks and TableBlocks while keeping
 * multi-line display math blocks ($$...$$, \[...\], \begin{...}...\end{...}) intact!
 */
export function processDocumentText(
  rawText: string,
  sourceType: InputSourceType = 'plain',
  extraWarnings: string[] = [],
  subjectMode: SubjectMode = 'auto'
): ProcessedDocument {
  const normalized = rawText.replace(/\r\n/g, '\n');

  // Step 1: Protect multi-line delimited blocks ($$...$$, \[...\], \begin{...}...\end{...})
  // so they stay together as single paragraphs instead of splitting mid-formula.
  const multiLinePlaceholders: string[] = [];
  let protectedText = normalized.replace(
    /(\$\$[\s\S]*?\$\$|\\{1,2}\[[\s\S]*?\\{1,2}\]|\\{1,2}begin\{(cases|dcases|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|matrix|aligned|align\*?|equation\*?|array|gather\*?)\}[\s\S]*?\\{1,2}end\{\2\})/g,
    (match) => {
      if (!match.includes('\n')) return match;
      const token = `__MATHFIX_BLOCK_${multiLinePlaceholders.length}__`;
      multiLinePlaceholders.push(match);
      return `\n${token}\n`;
    }
  );

  // Step 1b: Group multi-line 2D structural chemistry diagrams (blank-line delimited paragraphs with vertical ASCII bonds | / \)
  if (subjectMode === 'auto' || subjectMode === 'chemistry') {
    const chunks = protectedText.split(/\n{2,}/);
    protectedText = chunks
      .map((chunk) => {
        if (chunk.includes('\n') && isComplexStructuralChemistry(chunk)) {
          const token = `__MATHFIX_BLOCK_${multiLinePlaceholders.length}__`;
          multiLinePlaceholders.push(chunk);
          return token;
        }
        return chunk;
      })
      .join('\n\n');
  }

  const lines = protectedText.split('\n');
  const blocks: DocumentBlock[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx];

    // Check for Markdown-style pipe table (e.g. from pasted tables or DOCX/test data tables)
    if (/^\s*\|.+\|\s*$/.test(line)) {
      const tableRows: TableCellData[][] = [];
      while (idx < lines.length && /^\s*\|.+\|\s*$/.test(lines[idx])) {
        const rowLine = lines[idx].trim();
        // Skip markdown divider row like |---|---|
        if (/^\|[\s:-]+(?:\|[\s:-]+)*\|$/.test(rowLine)) {
          idx++;
          continue;
        }
        const rawCells = rowLine
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        const cells: TableCellData[] = rawCells.map((cellText) => {
          const restored = cellText.replace(/__MATHFIX_BLOCK_(\d+)__/g, (_m, n) => multiLinePlaceholders[Number(n)] || '');
          return {
            id: nextId('tc'),
            paragraphs: [
              {
                id: nextId('p'),
                type: 'paragraph',
                segments: parseInlineLine(restored, subjectMode),
              },
            ],
          };
        });
        tableRows.push(cells);
        idx++;
      }
      if (tableRows.length > 0) {
        const tableBlock: TableBlock = {
          id: nextId('tbl'),
          type: 'table',
          rows: tableRows,
        };
        blocks.push(tableBlock);
      }
      continue;
    }

    // Restore any protected multi-line math or structural chemistry block
    const restoredLine = line.replace(
      /__MATHFIX_BLOCK_(\d+)__/g,
      (_m, n) => multiLinePlaceholders[Number(n)] || ''
    );

    if (restoredLine.trim() === '') {
      // Preserve intentional blank spacing only if not consecutive duplicates
      if (blocks.length > 0) {
        const prev = blocks[blocks.length - 1];
        if (prev.type === 'paragraph' && prev.segments.length === 0) {
          idx++;
          continue;
        }
      }
      blocks.push({
        id: nextId('p'),
        type: 'paragraph',
        segments: [],
      });
      idx++;
      continue;
    }

    const isHeading = /^(?:PHẦN\s+[IVX0-9]+|ĐỀ\s+KIỂM\s+TRA|BÀI\s+TẬP|HƯỚNG\s+DẪN\s+GIẢI|ĐÁP\s+ÁN)/i.test(
      restoredLine.trim()
    );

    const para: ParagraphBlock = {
      id: nextId('p'),
      type: 'paragraph',
      segments: parseInlineLine(restoredLine, subjectMode),
      isHeading,
    };
    blocks.push(para);
    idx++;
  }

  const warnings = [...extraWarnings];
  // Collect document-level warning if any complex 2D structural chemistry diagram is present
  let hasNonOmmlStruct = false;
  for (const b of blocks) {
    if (b.type === 'paragraph') {
      if (b.segments.some((s) => s.type === 'formula' && s.ommlCompatible === false && s.subject === 'chemistry')) {
        hasNonOmmlStruct = true;
      }
    }
  }
  if (hasNonOmmlStruct) {
    warnings.push(
      'Tài liệu có công thức cấu tạo Hóa học phức tạp (2D/vòng) không tương thích Word Equation (OMML) tuyến tính — ứng dụng giữ nguyên định dạng cố định và không xuất giả thành Equation lỗi.'
    );
  }

  return {
    blocks,
    sourceType,
    subjectMode,
    stats: computeDocumentStats(blocks),
    warnings,
  };
}

export function computeDocumentStats(blocks: DocumentBlock[]): DocumentStats {
  const stats: DocumentStats = {
    totalFormulas: 0,
    validCount: 0,
    autoFixedCount: 0,
    needsReviewCount: 0,
    unrecoverableCount: 0,
    mathCount: 0,
    physicsCount: 0,
    chemistryCount: 0,
  };

  const countSegments = (segments: InlineSegment[]) => {
    for (const seg of segments) {
      if (seg.type !== 'formula') continue;
      stats.totalFormulas += 1;
      if (seg.status === 'valid') stats.validCount += 1;
      else if (seg.status === 'auto_fixed') stats.autoFixedCount += 1;
      else if (seg.status === 'needs_review') stats.needsReviewCount += 1;
      else stats.unrecoverableCount += 1;

      if (seg.subject === 'physics') stats.physicsCount = (stats.physicsCount || 0) + 1;
      else if (seg.subject === 'chemistry') stats.chemistryCount = (stats.chemistryCount || 0) + 1;
      else stats.mathCount = (stats.mathCount || 0) + 1;
    }
  };

  for (const block of blocks) {
    if (block.type === 'paragraph') {
      countSegments(block.segments);
    } else {
      for (const row of block.rows) {
        for (const cell of row) {
          for (const p of cell.paragraphs) {
            countSegments(p.segments);
          }
        }
      }
    }
  }

  return stats;
}

export function mapFormulasInDocument(
  doc: ProcessedDocument,
  updater: (formula: FormulaSegment) => FormulaSegment
): ProcessedDocument {
  const mapSegments = (segments: InlineSegment[]): InlineSegment[] =>
    segments.map((seg) => (seg.type === 'formula' ? updater(seg) : seg));

  const blocks: DocumentBlock[] = doc.blocks.map((block) => {
    if (block.type === 'paragraph') {
      return { ...block, segments: mapSegments(block.segments) };
    }
    return {
      ...block,
      rows: block.rows.map((row) =>
        row.map((cell) => ({
          ...cell,
          paragraphs: cell.paragraphs.map((p) => ({
            ...p,
            segments: mapSegments(p.segments),
          })),
        }))
      ),
    };
  });

  return {
    ...doc,
    blocks,
    stats: computeDocumentStats(blocks),
  };
}

export function applyManualLatexEdit(
  formula: FormulaSegment,
  newLatex: string,
  nextSubject?: FormulaSubject
): FormulaSegment {
  const trimmed = newLatex.trim();
  const render = renderLatexToSvg(trimmed, formula.displayMode);
  const subject = nextSubject ?? formula.subject;
  return {
    ...formula,
    activeLatex: trimmed,
    fixedLatex: trimmed,
    subject,
    subjectManualOverride: nextSubject ? true : formula.subjectManualOverride,
    ommlCompatible: render.ok,
    ommlWarning: undefined,
    sourceFormat: 'mathlive',
    userDecision: 'edited',
    status: render.ok ? 'valid' : 'unrecoverable',
    svg: render.svg,
    mathml: render.mathml,
    validated: render.ok,
    errorMessage: render.error,
    notes: render.ok
      ? [{ code: 'manual_edit', message: 'Đã chỉnh sửa trực quan bằng MathLive và xác thực hợp lệ', severity: 'safe' }]
      : [{ code: 'manual_edit_error', message: render.error || 'Biểu thức sau khi sửa chưa hợp lệ', severity: 'error' }],
  };
}

export function applyManualSubjectOverride(
  formula: FormulaSegment,
  subject: FormulaSubject
): FormulaSegment {
  const sourceLatex = formula.originalLatex || formula.raw;
  const fix = fixLatex(sourceLatex, formula.displayMode, { subjectMode: subject });
  return {
    ...formula,
    fixedLatex: fix.fixedLatex,
    activeLatex: fix.fixedLatex,
    subject,
    subjectConfidence: 'high',
    subjectManualOverride: true,
    ommlCompatible: fix.ommlCompatible,
    ommlWarning: fix.ommlWarning,
    status: fix.status,
    svg: fix.svg,
    mathml: fix.mathml,
    validated: fix.validated,
    errorMessage: fix.errorMessage,
    notes: [
      ...fix.notes,
      {
        code: 'manual_subject_override',
        message: `Đã chuyển phân loại thủ công sang môn ${
          subject === 'physics' ? 'Vật lí' : subject === 'chemistry' ? 'Hóa học' : 'Toán học'
        }`,
        severity: 'safe',
      },
    ],
  };
}

export function applyFormulaDecision(
  formula: FormulaSegment,
  decision: 'accept' | 'reject'
): FormulaSegment {
  if (decision === 'accept') {
    const render = renderLatexToSvg(formula.fixedLatex, formula.displayMode);
    if (!render.ok) return formula;
    return {
      ...formula,
      activeLatex: formula.fixedLatex,
      userDecision: 'accepted',
      status: 'valid',
      svg: render.svg,
      mathml: render.mathml,
      validated: true,
    };
  }

  // Reject: revert back to originalLatex
  const origRender = renderLatexToSvg(formula.originalLatex, formula.displayMode);
  return {
    ...formula,
    activeLatex: formula.originalLatex,
    userDecision: 'rejected',
    status: origRender.ok ? 'valid' : 'unrecoverable',
    svg: origRender.svg,
    mathml: origRender.mathml,
    validated: origRender.ok,
    errorMessage: origRender.error,
  };
}
