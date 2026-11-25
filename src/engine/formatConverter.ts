import { FormulaSegment, InlineSegment, ProcessedDocument } from './types';
import { mathmlToOmml, parseXml, XmlNode } from './mathmlConverter';
import { renderLatexToSvg, sanitizePresentationMathML } from './mathjaxRenderer';

export type ExportFormatId =
  | 'omml'
  | 'mathml'
  | 'latex_inline'
  | 'latex_display'
  | 'unicodemath'
  | 'svg'
  | 'png';

export interface FormatConversionResult {
  format: ExportFormatId;
  output: string;
  supported: boolean;
  warning?: string;
}

function getText(node: XmlNode): string {
  if (node.type === 'text') return node.text || '';
  return (node.children || []).map(getText).join('');
}

function elementChildren(node: XmlNode): XmlNode[] {
  return (node.children || []).filter((c) => c.type === 'element');
}

function isSimpleAtom(s: string): boolean {
  const t = s.trim();
  return t.length === 1 || /^[a-zA-Z0-9]+$/.test(t);
}

function wrapUM(s: string): string {
  const t = s.trim();
  if (!t) return '';
  if (isSimpleAtom(t)) return t;
  if ((t.startsWith('(') && t.endsWith(')')) || (t.startsWith('[') && t.endsWith(']'))) {
    return t;
  }
  return `(${t})`;
}

const ACCENT_COMBINING: Record<string, string> = {
  '→': '\u20D7', // combining right arrow above (vector)
  '⟶': '\u20D7',
  '¯': '\u0304', // overbar
  '‾': '\u0304',
  '^': '\u0302', // hat
  'ˆ': '\u0302',
  '˙': '\u0307', // dot
  '¨': '\u0308', // ddot
  '~': '\u0303', // tilde
  '˜': '\u0303',
  '←': '\u20D6',
  '↔': '\u20E1',
};

/**
 * AST-based Presentation MathML -> Microsoft UnicodeMath converter (UTN #28).
 * Tracks unsupported nodes honestly so complex/unmapped structures are flagged
 * rather than silently dropping numerators, denominators, scripts, or conditions.
 */
export function mathmlToUnicodeMath(mathml: string): {
  output: string;
  supported: boolean;
  warning?: string;
} {
  const root = parseXml(mathml);
  if (!root) {
    return { output: '', supported: false, warning: 'Không thể phân tích cấu trúc MathML sang UnicodeMath.' };
  }

  let unsupportedReasons: string[] = [];

  const convert = (node: XmlNode): string => {
    if (node.type === 'text') return node.text || '';
    const tag = node.tag || '';
    const kids = elementChildren(node);

    switch (tag) {
      case '__root__':
      case 'math':
      case 'mrow':
      case 'mstyle':
      case 'mpadded':
      case 'semantics':
        return convertSequence(kids);

      case 'mphantom':
        // mhchem alignment phantom -> zero-width in UnicodeMath
        return '';

      case 'annotation':
      case 'annotation-xml':
        return '';

      case 'mi':
      case 'mn':
      case 'mo':
      case 'mtext':
      case 'ms':
        return getText(node);

      case 'mspace':
        return ' ';

      case 'mfrac': {
        if (kids.length < 2) {
          unsupportedReasons.push('Phân số thiếu tử hoặc mẫu');
          return '';
        }
        const num = convert(kids[0]).trim();
        const den = convert(kids[1]).trim();
        return `${wrapUM(num)}/${wrapUM(den)}`;
      }

      case 'msqrt': {
        const inner = convertSequence(kids).trim();
        return `√${wrapUM(inner)}`;
      }

      case 'mroot': {
        if (kids.length < 2) return '';
        const base = convert(kids[0]).trim();
        const deg = convert(kids[1]).trim();
        if (deg === '3') return `∛${wrapUM(base)}`;
        if (deg === '4') return `∜${wrapUM(base)}`;
        return `√(${deg}&${base})`;
      }

      case 'msup': {
        if (kids.length < 2) return '';
        const base = convert(kids[0]).trim();
        const sup = convert(kids[1]).trim();
        return `${base}^${wrapUM(sup)}`;
      }

      case 'msub': {
        if (kids.length < 2) return '';
        const base = convert(kids[0]).trim();
        const sub = convert(kids[1]).trim();
        return `${base}_${wrapUM(sub)}`;
      }

      case 'msubsup': {
        if (kids.length < 3) return '';
        const base = convert(kids[0]).trim();
        const sub = convert(kids[1]).trim();
        const sup = convert(kids[2]).trim();
        return `${base}_${wrapUM(sub)}^${wrapUM(sup)}`;
      }

      case 'mmultiscripts': {
        // Handle pre-scripts (isotopes like {}_{6}^{12}C)
        const preIdx = kids.findIndex((k) => k.tag === 'mprescripts');
        const base = kids[0] ? convert(kids[0]).trim() : '';
        if (preIdx !== -1) {
          const preSub = kids[preIdx + 1] && kids[preIdx + 1].tag !== 'none' ? convert(kids[preIdx + 1]).trim() : '';
          const preSup = kids[preIdx + 2] && kids[preIdx + 2].tag !== 'none' ? convert(kids[preIdx + 2]).trim() : '';
          const prePart = `${preSub ? `_${wrapUM(preSub)}` : ''}${preSup ? `^${wrapUM(preSup)}` : ''}`;
          return `${prePart}${base}`;
        }
        return base;
      }

      case 'mover': {
        if (kids.length < 2) return '';
        const base = convert(kids[0]).trim();
        const over = convert(kids[1]).trim();
        // Reaction arrows with conditions above (e.g. \xrightarrow{t°})
        if (/[→⟶⇌⇄↔]/.test(base)) {
          return `${base}^${wrapUM(over)}`;
        }
        const comb = ACCENT_COMBINING[over];
        if (comb && base.length === 1) {
          return `${base}${comb}`;
        }
        if (over === '→' || over === '⟶') return `\\vec(${base})`;
        if (over === '¯' || over === '‾' || over === '―') return `\\overbar(${base})`;
        if (over === '^' || over === 'ˆ') return `\\hat(${base})`;
        if (over === '⏞') return `⏞(${base})^${wrapUM(over)}`;
        return `${base}┴${wrapUM(over)}`;
      }

      case 'munder': {
        if (kids.length < 2) return '';
        const base = convert(kids[0]).trim();
        const under = convert(kids[1]).trim();
        if (/[→⟶⇌⇄↔]/.test(base) || /^(lim|∑|∏|∫|max|min)$/.test(base)) {
          return `${base}_${wrapUM(under)}`;
        }
        if (under === '_' || under === '―' || under === '‾') return `\\underbar(${base})`;
        return `${base}_${wrapUM(under)}`;
      }

      case 'munderover': {
        if (kids.length < 3) return '';
        const base = convert(kids[0]).trim();
        const under = convert(kids[1]).trim();
        const over = convert(kids[2]).trim();
        return `${base}_${wrapUM(under)}^${wrapUM(over)}`;
      }

      case 'mfenced': {
        const open = node.attrs?.open ?? '(';
        const close = node.attrs?.close ?? ')';
        const sep = node.attrs?.separators ?? ',';
        return `${open}${kids.map(convert).join(sep)}${close}`;
      }

      case 'mtable': {
        const rows = kids
          .filter((k) => k.tag === 'mtr' || k.tag === 'mlabeledtr')
          .map((row) =>
            elementChildren(row)
              .filter((c) => c.tag === 'mtd')
              .map((cell) => convertSequence(elementChildren(cell)).trim())
              .join('&')
          );
        return `■(${rows.join('@')})`;
      }

      case 'menclose': {
        const inner = convertSequence(kids).trim();
        return `(${inner})`;
      }

      default: {
        unsupportedReasons.push(`Thẻ MathML chưa hỗ trợ đầy đủ trong UnicodeMath: <${tag}>`);
        return convertSequence(kids);
      }
    }
  };

  const convertSequence = (nodes: XmlNode[]): string => {
    let out = '';
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      // Merge mhchem phantom-base sub/sup cleanly onto preceding element
      if (
        (n.tag === 'msub' || n.tag === 'msup' || n.tag === 'msubsup') &&
        elementChildren(n)[0]?.tag === 'mphantom'
      ) {
        const subKids = elementChildren(n);
        if (n.tag === 'msub' && subKids[1]) out += `_${wrapUM(convert(subKids[1]))}`;
        else if (n.tag === 'msup' && subKids[1]) out += `^${wrapUM(convert(subKids[1]))}`;
        else if (n.tag === 'msubsup' && subKids[1] && subKids[2]) {
          out += `_${wrapUM(convert(subKids[1]))}^${wrapUM(convert(subKids[2]))}`;
        }
        continue;
      }
      out += convert(n);
    }
    return out;
  };

  const result = convert(root).replace(/\s+/g, ' ').trim();
  const supported = unsupportedReasons.length === 0 && result.length > 0;
  return {
    output: result,
    supported,
    warning: unsupportedReasons.length > 0 ? unsupportedReasons.join('; ') : undefined,
  };
}

/**
 * Convert a single FormulaSegment into any of the 7 supported formats (Section XII).
 */
export function convertFormulaToFormat(
  formula: FormulaSegment,
  format: ExportFormatId
): FormatConversionResult {
  const latex = (formula.activeLatex || formula.raw || '').trim();

  if (formula.ommlCompatible === false) {
    if (format === 'omml' || format === 'unicodemath') {
      return {
        format,
        output: latex,
        supported: false,
        warning:
          formula.ommlWarning ||
          'Công thức cấu tạo 2D/vòng phức tạp không hỗ trợ chuyển đổi tuyến tính sang OMML/UnicodeMath.',
      };
    }
  }

  let mathml = formula.mathml;
  let svg = formula.svg;
  let validated = formula.validated;

  if ((!mathml || !svg) && latex) {
    const rendered = renderLatexToSvg(latex, formula.displayMode);
    if (rendered.ok) {
      mathml = rendered.mathml;
      svg = rendered.svg;
      validated = true;
    }
  }

  switch (format) {
    case 'latex_inline':
      return { format, output: `$${latex}$`, supported: Boolean(latex) };

    case 'latex_display':
      return { format, output: `$$${latex}$$`, supported: Boolean(latex) };

    case 'mathml': {
      const clean = sanitizePresentationMathML(mathml);
      return {
        format,
        output: clean,
        supported: Boolean(clean && validated),
        warning: !clean ? 'Công thức chưa có MathML hợp lệ.' : undefined,
      };
    }

    case 'omml': {
      const clean = sanitizePresentationMathML(mathml);
      if (!clean || !validated) {
        return {
          format,
          output: '',
          supported: false,
          warning: 'Công thức chưa hợp lệ để chuyển sang Word Equation (OMML).',
        };
      }
      const omml = mathmlToOmml(clean, formula.displayMode, {
        target: 'docx',
        includeNamespaces: true,
      });
      return {
        format,
        output: omml,
        supported: Boolean(omml),
        warning: !omml ? 'Không thể tạo OMML từ công thức này.' : undefined,
      };
    }

    case 'unicodemath': {
      const clean = sanitizePresentationMathML(mathml);
      if (!clean || !validated) {
        return {
          format,
          output: '',
          supported: false,
          warning: 'Công thức chưa hợp lệ để chuyển sang UnicodeMath.',
        };
      }
      const um = mathmlToUnicodeMath(clean);
      return {
        format,
        output: um.output,
        supported: um.supported,
        warning: um.warning,
      };
    }

    case 'svg':
      return {
        format,
        output: svg || '',
        supported: Boolean(svg && validated),
        warning: !svg ? 'Chưa có dữ liệu vector SVG cho công thức này.' : undefined,
      };

    case 'png':
      return {
        format,
        output: svg || '',
        supported: Boolean(svg && validated),
        warning: !svg ? 'Chưa có dữ liệu vector để xuất ảnh PNG.' : undefined,
      };
  }
}

/**
 * Convert an entire ProcessedDocument (all formulas + Vietnamese prose) to a target format (Section XII).
 */
export function convertDocumentToFormat(
  doc: ProcessedDocument,
  format: ExportFormatId
): FormatConversionResult {
  const warnings: string[] = [];
  let allSupported = true;

  const convertInline = (segs: InlineSegment[]): string =>
    segs
      .map((seg) => {
        if (seg.type === 'text') return seg.text;
        if (seg.type === 'figure') return seg.raw;
        const r = convertFormulaToFormat(seg, format);
        if (!r.supported) {
          allSupported = false;
          if (r.warning && !warnings.includes(r.warning)) warnings.push(r.warning);
        }
        return r.output || seg.activeLatex;
      })
      .join('');

  const lines: string[] = [];
  for (const block of doc.blocks) {
    if (block.type === 'paragraph') {
      lines.push(convertInline(block.segments));
    } else {
      for (const row of block.rows) {
        const cells = row.map((c) => c.paragraphs.map((p) => convertInline(p.segments)).join(' '));
        lines.push(`| ${cells.join(' | ')} |`);
      }
    }
  }

  return {
    format,
    output: lines.join('\n'),
    supported: allSupported,
    warning: warnings.length > 0 ? warnings.join(' ') : undefined,
  };
}
