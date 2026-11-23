/**
 * Self-contained XML AST parser + converters:
 * 1. Presentation MathML -> Word OOXML OMML (<m:oMath> / <m:oMathPara>)
 * 2. Presentation MathML -> LaTeX
 * 3. Word OOXML OMML -> LaTeX (for DOCX import)
 *
 * Works identically offline in all browsers and in Node.js (Vitest) with zero XSLT/DOM quirks.
 */

export interface XmlNode {
  type: 'element' | 'text';
  tag?: string; // local tag name without namespace prefix, e.g., 'mfrac', 'oMath'
  fullTag?: string;
  attrs?: Record<string, string>;
  children?: XmlNode[];
  text?: string;
}

const XML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  minus: '−',
  times: '×',
  div: '÷',
  pm: '±',
  le: '≤',
  ge: '≥',
  ne: '≠',
  infin: '∞',
  rarr: '→',
  larr: '←',
  harr: '↔',
  rArr: '⇒',
  hArr: '⇔',
  int: '∫',
  sum: '∑',
  prod: '∏',
  radic: '√',
  ApplyFunction: '',
  InvisibleTimes: '',
  InvisibleComma: '',
};

export function decodeXmlEntities(str: string): string {
  return str.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z0-9]+);/g, (_m, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    }
    return entity in XML_ENTITY_MAP ? XML_ENTITY_MAP[entity] : `&${entity};`;
  });
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function parseXml(xml: string): XmlNode | null {
  const cleaned = xml
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .trim();

  const root: XmlNode = { type: 'element', tag: '__root__', fullTag: '__root__', attrs: {}, children: [] };
  const stack: XmlNode[] = [root];

  const tokenRegex = /<(\/?)([a-zA-Z0-9_:-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(cleaned)) !== null) {
    const [, isClose, rawTag, rawAttrs, isSelfClose, textContent] = match;
    const parent = stack[stack.length - 1];

    if (textContent !== undefined) {
      const decoded = decodeXmlEntities(textContent);
      if (decoded.length > 0) {
        parent.children!.push({ type: 'text', text: decoded });
      }
      continue;
    }

    const localTag = rawTag.includes(':') ? rawTag.split(':')[1] : rawTag;

    if (isClose) {
      // Pop matching tag
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].tag === localTag || stack[i].fullTag === rawTag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const attrs: Record<string, string> = {};
    const attrRegex = /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let am: RegExpExecArray | null;
    while ((am = attrRegex.exec(rawAttrs || '')) !== null) {
      const attrName = am[1].includes(':') ? am[1].split(':')[1] : am[1];
      attrs[attrName] = decodeXmlEntities(am[2] ?? am[3] ?? '');
    }

    const node: XmlNode = {
      type: 'element',
      tag: localTag,
      fullTag: rawTag,
      attrs,
      children: [],
    };
    parent.children!.push(node);

    if (!isSelfClose) {
      stack.push(node);
    }
  }

  return root.children!.find((c) => c.type === 'element') ?? null;
}

function getElementChildren(node: XmlNode): XmlNode[] {
  return (node.children || []).filter((c) => c.type === 'element');
}

function getTextContent(node: XmlNode): string {
  if (node.type === 'text') return node.text || '';
  return (node.children || []).map(getTextContent).join('');
}

// ============================================================================
// PART 1: PRESENTATION MATHML -> WORD OOXML OMML
// ============================================================================

const NARY_OPERATORS = new Set(['∫', '∬', '∭', '∮', '∯', '∰', '∑', '∏', '∐', '⋃', '⋂', '⋁', '⋀', '⨁', '⨂']);

const ACCENT_CHARS: Record<string, string> = {
  '→': '\u20D7', // combining right arrow above (vector)
  '⃗': '\u20D7',
  '⟶': '\u20D7',
  '←': '\u20D6',
  '^': '\u0302',
  'ˆ': '\u0302',
  '̂': '\u0302',
  '˜': '\u0303',
  '~': '\u0303',
  '̃': '\u0303',
  '˙': '\u0307',
  '¨': '\u0308',
  '˘': '\u0306',
  'ˇ': '\u030C',
  '⌢': '\u2322', // arc above (cung tròn)
  '⌒': '\u2322',
};

const BAR_CHARS = new Set(['¯', '‾', '_', '―', '−', '-', '\u0304', '\u0305', '\u00AF', '\u203E']);

const OPEN_FENCES = new Set(['(', '[', '{', '|', '‖', '⟨', '⌊', '⌈']);
const CLOSE_FENCES = new Set([')', ']', '}', '|', '‖', '⟩', '⌋', '⌉']);

export type OmmlTarget = 'docx' | 'html';

const CAMBRIA_RPR =
  '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" w:cs="Cambria Math"/></w:rPr>';

const UPRIGHT_OPERATOR_WORDS = new Set([
  'lim',
  'lim sup',
  'lim inf',
  'max',
  'min',
  'sup',
  'inf',
  'gcd',
  'det',
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'log',
  'ln',
  'lg',
  'exp',
  'mod',
  'arg',
  'deg',
  'dim',
  'ker',
]);

function ommlRun(
  text: string,
  target: OmmlTarget,
  options?: { normal?: boolean; bold?: boolean; italic?: boolean; script?: string }
): string {
  const cleaned = text.replace(/[\u2061\u2062\u2063\u2064]/g, ''); // Strip invisible MathML operators
  if (!cleaned) return '';
  let mRpr = '';
  if (options?.normal) {
    mRpr = '<m:rPr><m:nor/></m:rPr>';
  } else if (options?.script) {
    mRpr = `<m:rPr><m:scr m:val="${options.script}"/><m:sty m:val="p"/></m:rPr>`;
  } else if (options?.bold && options?.italic) {
    mRpr = '<m:rPr><m:sty m:val="bi"/></m:rPr>';
  } else if (options?.bold) {
    mRpr = '<m:rPr><m:sty m:val="b"/></m:rPr>';
  }

  if (target === 'html') {
    // Word HTML clipboard (xmlns:m="http://schemas.microsoft.com/office/2004/12/omml")
    // does NOT use wordprocessingml <w:rPr>; clean <m:r><m:rPr>?<m:t> is Word's native HTML OMML format.
    return `<m:r>${mRpr}<m:t>${escapeXml(cleaned)}</m:t></m:r>`;
  }

  return `<m:r>${mRpr}${CAMBRIA_RPR}<m:t xml:space="preserve">${escapeXml(cleaned)}</m:t></m:r>`;
}

function isNaryNode(node: XmlNode): string | null {
  if (!node || node.type !== 'element') return null;
  if (node.tag === 'mo') {
    const t = getTextContent(node).trim();
    if (NARY_OPERATORS.has(t)) return t;
  }
  if (node.tag === 'mrow' || node.tag === 'mstyle' || node.tag === 'TeXAtom') {
    const ch = getElementChildren(node);
    if (ch.length === 1) return isNaryNode(ch[0]);
  }
  return null;
}

function isLimitWord(node: XmlNode): boolean {
  const t = getTextContent(node).trim();
  return ['lim', 'lim sup', 'lim inf', 'max', 'min', 'sup', 'inf', 'gcd', 'det'].includes(t);
}

function isPhantomOnlyNode(node: XmlNode): boolean {
  if (!node) return true;
  if (node.type === 'text') return (node.text || '').trim().length === 0;
  if (node.tag === 'mphantom') return true;
  if (node.tag === 'mrow' || node.tag === 'mpadded' || node.tag === 'mstyle' || node.tag === 'TeXAtom') {
    const ch = node.children || [];
    if (ch.length === 0) return true;
    return ch.every(isPhantomOnlyNode);
  }
  return false;
}

function isPhantomScriptNode(node: XmlNode): boolean {
  if (node.type !== 'element') return false;
  if (node.tag !== 'msub' && node.tag !== 'msup' && node.tag !== 'msubsup') return false;
  const parts = getElementChildren(node);
  return parts.length >= 2 && isPhantomOnlyNode(parts[0]);
}

function convertChildrenWithNary(children: XmlNode[], target: OmmlTarget): string {
  const outParts: string[] = [];
  let i = 0;

  while (i < children.length) {
    const child = children[i];
    if (child.type !== 'element') {
      i++;
      continue;
    }

    // Check if child is a standalone n-ary operator with sub/sup/limits followed by integrand/summand
    if (child.tag === 'msubsup' || child.tag === 'munderover' || child.tag === 'msub' || child.tag === 'munder' || child.tag === 'msup' || child.tag === 'mover') {
      const parts = getElementChildren(child);
      const naryChar = parts.length > 0 ? isNaryNode(parts[0]) : null;
      if (naryChar) {
        let subXml = '<m:sub/>';
        let supXml = '<m:sup/>';
        let subHide = '1';
        let supHide = '1';

        if (child.tag === 'msubsup' || child.tag === 'munderover') {
          if (parts[1]) {
            subXml = `<m:sub>${mmlNodeToOmml(parts[1], target)}</m:sub>`;
            subHide = '0';
          }
          if (parts[2]) {
            supXml = `<m:sup>${mmlNodeToOmml(parts[2], target)}</m:sup>`;
            supHide = '0';
          }
        } else if (child.tag === 'msub' || child.tag === 'munder') {
          if (parts[1]) {
            subXml = `<m:sub>${mmlNodeToOmml(parts[1], target)}</m:sub>`;
            subHide = '0';
          }
        } else if (child.tag === 'msup' || child.tag === 'mover') {
          if (parts[1]) {
            supXml = `<m:sup>${mmlNodeToOmml(parts[1], target)}</m:sup>`;
            supHide = '0';
          }
        }

        const limLoc = naryChar === '∫' || naryChar === '∬' || naryChar === '∭' || naryChar === '∮' ? 'subSup' : 'undOvr';
        // Collect following sibling(s) until a top-level relation (=, <, >, ≤, ≥) or end of row
        const bodyNodes: XmlNode[] = [];
        let j = i + 1;
        while (j < children.length) {
          const sib = children[j];
          if (sib.tag === 'mo') {
            const opText = getTextContent(sib).trim();
            if (['=', '<', '>', '≤', '≥', '≠', '⇒', '⇔', ',', ';'].includes(opText)) {
              break;
            }
          }
          bodyNodes.push(sib);
          j++;
        }

        const bodyXml = bodyNodes.length > 0 ? convertChildrenWithNary(bodyNodes, target) : '';
        outParts.push(
          `<m:nary><m:naryPr><m:chr m:val="${escapeXml(naryChar)}"/><m:limLoc m:val="${limLoc}"/><m:grow m:val="1"/>` +
            `<m:subHide m:val="${subHide}"/><m:supHide m:val="${supHide}"/></m:naryPr>` +
            `${subXml}${supXml}<m:e>${bodyXml}</m:e></m:nary>`
        );
        i = j;
        continue;
      }
    }

    // Standalone bare n-ary operator (e.g. indefinite integral \int x dx)
    const bareNary = isNaryNode(child);
    if (bareNary) {
      const bodyNodes: XmlNode[] = [];
      let j = i + 1;
      while (j < children.length) {
        const sib = children[j];
        if (sib.tag === 'mo') {
          const opText = getTextContent(sib).trim();
          if (['=', '<', '>', '≤', '≥', '≠', '⇒', '⇔', ',', ';'].includes(opText)) {
            break;
          }
        }
        bodyNodes.push(sib);
        j++;
      }
      const bodyXml = bodyNodes.length > 0 ? convertChildrenWithNary(bodyNodes, target) : '';
      outParts.push(
        `<m:nary><m:naryPr><m:chr m:val="${escapeXml(bareNary)}"/><m:limLoc m:val="subSup"/><m:grow m:val="1"/>` +
          `<m:subHide m:val="1"/><m:supHide m:val="1"/></m:naryPr>` +
          `<m:sub/><m:sup/><m:e>${bodyXml}</m:e></m:nary>`
      );
      i = j;
      continue;
    }

    // Handle mhchem pattern: preceding element followed by <msub>/<msup>/<msubsup> with <mphantom> base
    // Attach the sub/sup directly onto the preceding OMML element (so \ce{H2SO4} produces clean O_4 with no ghost A!)
    if (isPhantomScriptNode(child) && outParts.length > 0) {
      const prevOmml = outParts.pop()!;
      const parts = getElementChildren(child);
      if (child.tag === 'msub') {
        const subXml = parts[1] ? mmlNodeToOmml(parts[1], target) : '';
        outParts.push(`<m:sSub><m:e>${prevOmml}</m:e><m:sub>${subXml}</m:sub></m:sSub>`);
      } else if (child.tag === 'msup') {
        const supXml = parts[1] ? mmlNodeToOmml(parts[1], target) : '';
        outParts.push(`<m:sSup><m:e>${prevOmml}</m:e><m:sup>${supXml}</m:sup></m:sSup>`);
      } else if (child.tag === 'msubsup') {
        const subXml = parts[1] ? mmlNodeToOmml(parts[1], target) : '';
        const supXml = parts[2] ? mmlNodeToOmml(parts[2], target) : '';
        outParts.push(`<m:sSubSup><m:e>${prevOmml}</m:e><m:sub>${subXml}</m:sub><m:sup>${supXml}</m:sup></m:sSubSup>`);
      }
      i++;
      continue;
    }

    const piece = mmlNodeToOmml(child, target);
    if (piece) {
      outParts.push(piece);
    }
    i++;
  }

  return outParts.join('');
}

function mmlNodeToOmml(node: XmlNode, target: OmmlTarget): string {
  if (!node) return '';
  if (node.type === 'text') {
    const t = (node.text || '').trim();
    return t ? ommlRun(t, target) : '';
  }

  const tag = node.tag || '';
  const attrs = node.attrs || {};
  const elChildren = getElementChildren(node);

  switch (tag) {
    case 'math':
    case 'semantics': {
      // Ignore <annotation> children in <semantics>
      const filtered = elChildren.filter((c) => c.tag !== 'annotation' && c.tag !== 'annotation-xml');
      return convertChildrenWithNary(filtered, target);
    }

    case 'mphantom': {
      // Phantom nodes occupy invisible spacing only in MathML (e.g. mhchem alignment struts)
      // — NEVER emit visible characters into Word OMML!
      return '';
    }

    case 'mrow':
    case 'mstyle':
    case 'mpadded':
    case 'TeXAtom': {
      // Detect fenced groups: <mrow><mo fence="true">(</mo> ... <mo fence="true">)</mo></mrow>
      // Also detect \begin{cases}:
      //   - 2 children: <mrow><mo>{</mo><mtable>...</mtable></mrow>
      //   - 3 children (MathJax v3): <mrow><mo>{</mo><mtable>...</mtable><mo fence="true"></mo></mrow>
      if (elChildren.length >= 2) {
        const first = elChildren[0];
        const last = elChildren[elChildren.length - 1];
        const firstText = first.tag === 'mo' ? getTextContent(first).trim() : '';
        const lastText = last.tag === 'mo' ? getTextContent(last).trim() : '';

        // Left-only brace around mtable -> system of equations / cases!
        if (first.tag === 'mo' && firstText === '{' && elChildren.length === 2 && last.tag === 'mtable') {
          return (
            `<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr>` +
            `<m:e>${mmlNodeToOmml(last, target)}</m:e></m:d>`
          );
        }

        // MathJax v3 \begin{cases} or \left\{ ... \right. (empty closing <mo></mo>)
        if (
          first.tag === 'mo' &&
          last.tag === 'mo' &&
          OPEN_FENCES.has(firstText) &&
          lastText === '' &&
          elChildren.length >= 3
        ) {
          const inner = elChildren.slice(1, -1);
          return (
            `<m:d><m:dPr><m:begChr m:val="${escapeXml(firstText)}"/><m:endChr m:val=""/></m:dPr>` +
            `<m:e>${convertChildrenWithNary(inner, target)}</m:e></m:d>`
          );
        }

        // Right-only fence (e.g. \left. ... \right| evaluation bar)
        if (
          first.tag === 'mo' &&
          last.tag === 'mo' &&
          firstText === '' &&
          CLOSE_FENCES.has(lastText) &&
          elChildren.length >= 3
        ) {
          const inner = elChildren.slice(1, -1);
          return (
            `<m:d><m:dPr><m:begChr m:val=""/><m:endChr m:val="${escapeXml(lastText)}"/></m:dPr>` +
            `<m:e>${convertChildrenWithNary(inner, target)}</m:e></m:d>`
          );
        }

        // Standard matched stretchy fences (e.g. pmatrix, bmatrix, vmatrix, \left(...\right))
        const isStretchyFence =
          first.tag === 'mo' &&
          last.tag === 'mo' &&
          OPEN_FENCES.has(firstText) &&
          CLOSE_FENCES.has(lastText) &&
          (first.attrs?.fence === 'true' ||
            first.attrs?.stretchy === 'true' ||
            elChildren.some((c) => c.tag === 'mtable' || c.tag === 'mfrac'));

        if (isStretchyFence && elChildren.length >= 3) {
          const inner = elChildren.slice(1, -1);
          return (
            `<m:d><m:dPr><m:begChr m:val="${escapeXml(firstText)}"/><m:endChr m:val="${escapeXml(lastText)}"/></m:dPr>` +
            `<m:e>${convertChildrenWithNary(inner, target)}</m:e></m:d>`
          );
        }
      }
      return convertChildrenWithNary(elChildren, target);
    }

    case 'mi': {
      const text = getTextContent(node);
      const variant = attrs.mathvariant || '';
      if (variant === 'double-struck') {
        return ommlRun(text, target, { script: 'double-struck' });
      }
      if (variant === 'normal' || text.length > 1) {
        return ommlRun(text, target, { normal: true });
      }
      if (variant === 'bold') {
        return ommlRun(text, target, { bold: true });
      }
      return ommlRun(text, target);
    }

    case 'mn': {
      return ommlRun(getTextContent(node), target);
    }

    case 'mo': {
      const text = getTextContent(node);
      if (UPRIGHT_OPERATOR_WORDS.has(text.trim())) {
        return ommlRun(text, target, { normal: true });
      }
      return ommlRun(text, target);
    }

    case 'mtext':
    case 'ms': {
      return ommlRun(getTextContent(node), target, { normal: true });
    }

    case 'mspace': {
      return ommlRun(' ', target, { normal: true });
    }

    case 'mfrac': {
      const [num, den] = elChildren;
      const lineThickness = attrs.linethickness;
      const isNoBar = lineThickness === '0' || lineThickness === '0px' || lineThickness === '0pt';
      const isBevelled = attrs.bevelled === 'true';
      let fPr = '';
      if (isNoBar) {
        fPr = '<m:fPr><m:type m:val="noBar"/></m:fPr>';
      } else if (isBevelled) {
        fPr = '<m:fPr><m:type m:val="skw"/></m:fPr>';
      }
      return (
        `<m:f>${fPr}` +
        `<m:num>${num ? mmlNodeToOmml(num, target) : ''}</m:num>` +
        `<m:den>${den ? mmlNodeToOmml(den, target) : ''}</m:den>` +
        `</m:f>`
      );
    }

    case 'msqrt': {
      return (
        `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr>` +
        `<m:deg/><m:e>${convertChildrenWithNary(elChildren, target)}</m:e></m:rad>`
      );
    }

    case 'mroot': {
      const [base, deg] = elChildren;
      return (
        `<m:rad><m:radPr><m:degHide m:val="0"/></m:radPr>` +
        `<m:deg>${deg ? mmlNodeToOmml(deg, target) : ''}</m:deg>` +
        `<m:e>${base ? mmlNodeToOmml(base, target) : ''}</m:e></m:rad>`
      );
    }

    case 'msup': {
      const [base, sup] = elChildren;
      return (
        `<m:sSup><m:e>${base ? mmlNodeToOmml(base, target) : ''}</m:e>` +
        `<m:sup>${sup ? mmlNodeToOmml(sup, target) : ''}</m:sup></m:sSup>`
      );
    }

    case 'msub': {
      const [base, sub] = elChildren;
      return (
        `<m:sSub><m:e>${base ? mmlNodeToOmml(base, target) : ''}</m:e>` +
        `<m:sub>${sub ? mmlNodeToOmml(sub, target) : ''}</m:sub></m:sSub>`
      );
    }

    case 'msubsup': {
      const [base, sub, sup] = elChildren;
      return (
        `<m:sSubSup><m:e>${base ? mmlNodeToOmml(base, target) : ''}</m:e>` +
        `<m:sub>${sub ? mmlNodeToOmml(sub, target) : ''}</m:sub>` +
        `<m:sup>${sup ? mmlNodeToOmml(sup, target) : ''}</m:sup></m:sSubSup>`
      );
    }

    case 'mover': {
      const [base, over] = elChildren;
      if (!base || !over) return convertChildrenWithNary(elChildren, target);
      const overText = getTextContent(over).trim();

      if (BAR_CHARS.has(overText)) {
        return `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${mmlNodeToOmml(base, target)}</m:e></m:bar>`;
      }
      if (ACCENT_CHARS[overText]) {
        return `<m:acc><m:accPr><m:chr m:val="${escapeXml(ACCENT_CHARS[overText])}"/></m:accPr><m:e>${mmlNodeToOmml(base, target)}</m:e></m:acc>`;
      }
      return `<m:limUpp><m:e>${mmlNodeToOmml(base, target)}</m:e><m:lim>${mmlNodeToOmml(over, target)}</m:lim></m:limUpp>`;
    }

    case 'munder': {
      const [base, under] = elChildren;
      if (!base || !under) return convertChildrenWithNary(elChildren, target);
      const underText = getTextContent(under).trim();

      if (BAR_CHARS.has(underText)) {
        return `<m:bar><m:barPr><m:pos m:val="bot"/></m:barPr><m:e>${mmlNodeToOmml(base, target)}</m:e></m:bar>`;
      }
      if (isLimitWord(base)) {
        return `<m:limLow><m:e>${mmlNodeToOmml(base, target)}</m:e><m:lim>${mmlNodeToOmml(under, target)}</m:lim></m:limLow>`;
      }
      return `<m:limLow><m:e>${mmlNodeToOmml(base, target)}</m:e><m:lim>${mmlNodeToOmml(under, target)}</m:lim></m:limLow>`;
    }

    case 'munderover': {
      const [base, under, over] = elChildren;
      const naryChar = base ? isNaryNode(base) : null;
      if (naryChar) {
        return (
          `<m:nary><m:naryPr><m:chr m:val="${escapeXml(naryChar)}"/><m:limLoc m:val="undOvr"/><m:grow m:val="1"/></m:naryPr>` +
          `<m:sub>${under ? mmlNodeToOmml(under, target) : ''}</m:sub>` +
          `<m:sup>${over ? mmlNodeToOmml(over, target) : ''}</m:sup><m:e/></m:nary>`
        );
      }
      const low = `<m:limLow><m:e>${base ? mmlNodeToOmml(base, target) : ''}</m:e><m:lim>${under ? mmlNodeToOmml(under, target) : ''}</m:lim></m:limLow>`;
      return `<m:limUpp><m:e>${low}</m:e><m:lim>${over ? mmlNodeToOmml(over, target) : ''}</m:lim></m:limUpp>`;
    }

    case 'mfenced': {
      const open = attrs.open ?? '(';
      const close = attrs.close ?? ')';
      const sep = attrs.separators ?? ',';
      const items = elChildren.map((c) => `<m:e>${mmlNodeToOmml(c, target)}</m:e>`).join('');
      return (
        `<m:d><m:dPr><m:begChr m:val="${escapeXml(open)}"/><m:sepChr m:val="${escapeXml(sep[0] || ',')}"/>` +
        `<m:endChr m:val="${escapeXml(close)}"/></m:dPr>${items}</m:d>`
      );
    }

    case 'mtable': {
      const rows = elChildren.filter((c) => c.tag === 'mtr' || c.tag === 'mlabeledtr');
      const maxCols = rows.reduce((max, r) => {
        const cells = getElementChildren(r).filter((c) => c.tag === 'mtd');
        return Math.max(max, cells.length);
      }, 1);

      const rawAlign = (attrs.columnalign || '').trim().split(/\s+/)[0];
      const mcJc = rawAlign === 'left' || rawAlign === 'right' ? rawAlign : 'center';
      const mcs = `<m:mcs><m:mc><m:mcPr><m:count m:val="${maxCols}"/><m:mcJc m:val="${mcJc}"/></m:mcPr></m:mc></m:mcs>`;
      const mrs = rows
        .map((r) => {
          const cells = getElementChildren(r).filter((c) => c.tag === 'mtd');
          const paddedCells: string[] = cells.map(
            (cell) => `<m:e>${convertChildrenWithNary(getElementChildren(cell), target)}</m:e>`
          );
          // OOXML requires every <m:mr> row to have exact maxCols <m:e> elements
          while (paddedCells.length < maxCols) {
            paddedCells.push('<m:e/>');
          }
          return `<m:mr>${paddedCells.join('')}</m:mr>`;
        })
        .join('');

      return `<m:m><m:mPr>${mcs}</m:mPr>${mrs}</m:m>`;
    }

    case 'mtr':
    case 'mtd': {
      return convertChildrenWithNary(elChildren, target);
    }

    case 'menclose': {
      return `<m:box><m:e>${convertChildrenWithNary(elChildren, target)}</m:e></m:box>`;
    }

    default: {
      if (elChildren.length > 0) {
        return convertChildrenWithNary(elChildren, target);
      }
      const txt = getTextContent(node).trim();
      return txt ? ommlRun(txt, target) : '';
    }
  }
}

export function mathmlToOmml(
  mathml: string,
  displayMode = false,
  options?: { target?: OmmlTarget; includeNamespaces?: boolean }
): string {
  const target: OmmlTarget = options?.target ?? 'docx';
  const includeNamespaces = options?.includeNamespaces ?? target === 'docx';
  const ast = parseXml(mathml);
  if (!ast) return '';
  const inner = mmlNodeToOmml(ast, target);
  if (!inner) return '';

  const nsAttrs = includeNamespaces
    ? ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
    : '';
  const oMath = `<m:oMath${nsAttrs}>${inner}</m:oMath>`;
  if (displayMode) {
    return `<m:oMathPara${nsAttrs}><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr>${oMath}</m:oMathPara>`;
  }
  return oMath;
}

// ============================================================================
// PART 2: PRESENTATION MATHML -> LATEX (for HTML/Word/Web Clipboard Paste)
// ============================================================================

const SYMBOL_TO_LATEX: Record<string, string> = {
  '−': '-',
  '×': '\\times ',
  '÷': '\\div ',
  '·': '\\cdot ',
  '⋅': '\\cdot ',
  '±': '\\pm ',
  '∓': '\\mp ',
  '≤': '\\le ',
  '≥': '\\ge ',
  '≠': '\\ne ',
  '≈': '\\approx ',
  '≡': '\\equiv ',
  '∞': '\\infty ',
  '→': '\\to ',
  '←': '\\leftarrow ',
  '⇒': '\\Rightarrow ',
  '⇔': '\\Leftrightarrow ',
  '∈': '\\in ',
  '∉': '\\notin ',
  '⊂': '\\subset ',
  '⊆': '\\subseteq ',
  '∪': '\\cup ',
  '∩': '\\cap ',
  '∅': '\\emptyset ',
  '∀': '\\forall ',
  '∃': '\\exists ',
  '⊥': '\\perp ',
  '∥': '\\parallel ',
  '∠': '\\angle ',
  '△': '\\triangle ',
  '∫': '\\int ',
  '∑': '\\sum ',
  '∏': '\\prod ',
  'α': '\\alpha ',
  'β': '\\beta ',
  'γ': '\\gamma ',
  'δ': '\\delta ',
  'Δ': '\\Delta ',
  'θ': '\\theta ',
  'λ': '\\lambda ',
  'μ': '\\mu ',
  'π': '\\pi ',
  'σ': '\\sigma ',
  'φ': '\\varphi ',
  'ω': '\\omega ',
  'Ω': '\\Omega ',
};

function mapSymbolToLatex(text: string): string {
  const cleaned = text.replace(/[\u2061\u2062\u2063\u2064]/g, '');
  if (!cleaned) return '';
  if (SYMBOL_TO_LATEX[cleaned]) return SYMBOL_TO_LATEX[cleaned];
  if (['sin', 'cos', 'tan', 'cot', 'lim', 'log', 'ln', 'exp', 'max', 'min', 'det'].includes(cleaned.trim())) {
    return `\\${cleaned.trim()} `;
  }
  return cleaned;
}

function mmlNodeToLatex(node: XmlNode): string {
  if (!node) return '';
  if (node.type === 'text') return mapSymbolToLatex(node.text || '');

  const tag = node.tag || '';
  const attrs = node.attrs || {};
  const ch = getElementChildren(node);

  switch (tag) {
    case 'mphantom':
      return '';

    case 'math':
    case 'mrow':
    case 'mstyle':
    case 'mpadded':
    case 'TeXAtom':
      return ch.map(mmlNodeToLatex).join('');

    case 'semantics': {
      // Prefer explicit TeX annotation if embedded (e.g. from KaTeX / Wikipedia / ChatGPT)
      const texAnn = ch.find(
        (c) => c.tag === 'annotation' && /tex/i.test(c.attrs?.encoding || '')
      );
      if (texAnn) {
        return getTextContent(texAnn).trim();
      }
      const main = ch.filter((c) => c.tag !== 'annotation' && c.tag !== 'annotation-xml');
      return main.map(mmlNodeToLatex).join('');
    }

    case 'mi':
    case 'mn':
    case 'mo': {
      const t = getTextContent(node).trim();
      if (attrs.mathvariant === 'double-struck' && /^[RNZQC]$/.test(t)) {
        return `\\mathbb{${t}}`;
      }
      return mapSymbolToLatex(t);
    }

    case 'mtext':
      return `\\text{${getTextContent(node)}}`;

    case 'mspace':
      return ' ';

    case 'mfrac': {
      const [num, den] = ch;
      if (attrs.linethickness === '0' || attrs.linethickness === '0px') {
        return `\\binom{${num ? mmlNodeToLatex(num) : ''}}{${den ? mmlNodeToLatex(den) : ''}}`;
      }
      return `\\frac{${num ? mmlNodeToLatex(num) : ''}}{${den ? mmlNodeToLatex(den) : ''}}`;
    }

    case 'msqrt':
      return `\\sqrt{${ch.map(mmlNodeToLatex).join('')}}`;

    case 'mroot': {
      const [base, deg] = ch;
      return `\\sqrt[${deg ? mmlNodeToLatex(deg) : ''}]{${base ? mmlNodeToLatex(base) : ''}}`;
    }

    case 'msup': {
      const [base, sup] = ch;
      return `${base ? mmlNodeToLatex(base) : ''}^{${sup ? mmlNodeToLatex(sup) : ''}}`;
    }

    case 'msub': {
      const [base, sub] = ch;
      return `${base ? mmlNodeToLatex(base) : ''}_{${sub ? mmlNodeToLatex(sub) : ''}}`;
    }

    case 'msubsup': {
      const [base, sub, sup] = ch;
      return `${base ? mmlNodeToLatex(base) : ''}_{${sub ? mmlNodeToLatex(sub) : ''}}^{${sup ? mmlNodeToLatex(sup) : ''}}`;
    }

    case 'mover': {
      const [base, over] = ch;
      const b = base ? mmlNodeToLatex(base) : '';
      const o = over ? getTextContent(over).trim() : '';
      if (o === '→' || o === '⃗' || o === '⟶') return b.length > 1 ? `\\overrightarrow{${b}}` : `\\vec{${b}}`;
      if (BAR_CHARS.has(o)) return `\\overline{${b}}`;
      if (o === '^' || o === 'ˆ' || o === '̂') return b.length > 1 ? `\\widehat{${b}}` : `\\hat{${b}}`;
      return `\\overset{${over ? mmlNodeToLatex(over) : ''}}{${b}}`;
    }

    case 'munder': {
      const [base, under] = ch;
      const b = base ? mmlNodeToLatex(base) : '';
      const u = under ? mmlNodeToLatex(under) : '';
      if (b.trim() === '\\lim' || b.trim() === 'lim') return `\\lim_{${u}}`;
      return `\\underset{${u}}{${b}}`;
    }

    case 'munderover': {
      const [base, under, over] = ch;
      return `${base ? mmlNodeToLatex(base) : ''}_{${under ? mmlNodeToLatex(under) : ''}}^{${over ? mmlNodeToLatex(over) : ''}}`;
    }

    case 'mfenced': {
      const open = attrs.open ?? '(';
      const close = attrs.close ?? ')';
      const sep = (attrs.separators ?? ',')[0] || ',';
      return `\\left${open === '{' ? '\\{' : open}${ch.map(mmlNodeToLatex).join(sep)}\\right${close === '}' ? '\\}' : close}`;
    }

    case 'mtable': {
      const rows = ch
        .filter((r) => r.tag === 'mtr' || r.tag === 'mlabeledtr')
        .map((r) =>
          getElementChildren(r)
            .filter((c) => c.tag === 'mtd')
            .map((c) => getElementChildren(c).map(mmlNodeToLatex).join(''))
            .join(' & ')
        )
        .join(' \\\\ ');
      return `\\begin{matrix}${rows}\\end{matrix}`;
    }

    default:
      return ch.length > 0 ? ch.map(mmlNodeToLatex).join('') : mapSymbolToLatex(getTextContent(node));
  }
}

export function mathmlToLatex(mathml: string): string {
  const ast = parseXml(mathml);
  if (!ast) return '';
  return mmlNodeToLatex(ast).replace(/\s{2,}/g, ' ').trim();
}

// ============================================================================
// PART 3: WORD OOXML OMML -> LATEX (for DOCX Import!)
// ============================================================================

function findChild(node: XmlNode, tag: string): XmlNode | undefined {
  return getElementChildren(node).find((c) => c.tag === tag);
}

function ommlNodeToLatex(node: XmlNode): string {
  if (!node) return '';
  if (node.type === 'text') return mapSymbolToLatex(node.text || '');

  const tag = node.tag || '';
  const ch = getElementChildren(node);

  switch (tag) {
    case 'oMathPara':
    case 'oMath':
    case 'e':
    case 'num':
    case 'den':
    case 'sub':
    case 'sup':
    case 'deg':
    case 'lim':
    case 'box':
      return ch.map(ommlNodeToLatex).join('');

    case 'r': {
      const tNode = findChild(node, 't');
      const rPr = findChild(node, 'rPr');
      const isNor = rPr && Boolean(findChild(rPr, 'nor'));
      const scr = rPr ? findChild(rPr, 'scr')?.attrs?.val : undefined;
      const text = tNode ? getTextContent(tNode) : '';
      if (!text) return '';
      if (scr === 'double-struck') return `\\mathbb{${text}}`;
      if (isNor && text.trim().length > 1 && !['sin', 'cos', 'tan', 'cot', 'lim', 'log', 'ln'].includes(text.trim())) {
        return `\\text{${text}}`;
      }
      return Array.from(text).map(mapSymbolToLatex).join('');
    }

    case 'f': {
      const fPr = findChild(node, 'fPr');
      const fType = fPr ? findChild(fPr, 'type')?.attrs?.val : undefined;
      const num = findChild(node, 'num');
      const den = findChild(node, 'den');
      if (fType === 'noBar') {
        return `\\binom{${num ? ommlNodeToLatex(num) : ''}}{${den ? ommlNodeToLatex(den) : ''}}`;
      }
      return `\\frac{${num ? ommlNodeToLatex(num) : ''}}{${den ? ommlNodeToLatex(den) : ''}}`;
    }

    case 'rad': {
      const deg = findChild(node, 'deg');
      const e = findChild(node, 'e');
      const degStr = deg ? ommlNodeToLatex(deg).trim() : '';
      const eStr = e ? ommlNodeToLatex(e) : '';
      return degStr ? `\\sqrt[${degStr}]{${eStr}}` : `\\sqrt{${eStr}}`;
    }

    case 'sSup': {
      const e = findChild(node, 'e');
      const sup = findChild(node, 'sup');
      return `${e ? ommlNodeToLatex(e) : ''}^{${sup ? ommlNodeToLatex(sup) : ''}}`;
    }

    case 'sSub': {
      const e = findChild(node, 'e');
      const sub = findChild(node, 'sub');
      return `${e ? ommlNodeToLatex(e) : ''}_{${sub ? ommlNodeToLatex(sub) : ''}}`;
    }

    case 'sSubSup': {
      const e = findChild(node, 'e');
      const sub = findChild(node, 'sub');
      const sup = findChild(node, 'sup');
      return `${e ? ommlNodeToLatex(e) : ''}_{${sub ? ommlNodeToLatex(sub) : ''}}^{${sup ? ommlNodeToLatex(sup) : ''}}`;
    }

    case 'nary': {
      const pr = findChild(node, 'naryPr');
      const chr = pr ? findChild(pr, 'chr')?.attrs?.val || '∫' : '∫';
      const opLatex = mapSymbolToLatex(chr).trim() || '\\int';
      const sub = findChild(node, 'sub');
      const sup = findChild(node, 'sup');
      const e = findChild(node, 'e');
      const subStr = sub ? ommlNodeToLatex(sub).trim() : '';
      const supStr = sup ? ommlNodeToLatex(sup).trim() : '';
      const eStr = e ? ommlNodeToLatex(e).trim() : '';
      return `${opLatex}${subStr ? `_{${subStr}}` : ''}${supStr ? `^{${supStr}}` : ''} ${eStr}`.trim();
    }

    case 'd': {
      const pr = findChild(node, 'dPr');
      const beg = pr ? findChild(pr, 'begChr')?.attrs?.val ?? '(' : '(';
      const end = pr ? findChild(pr, 'endChr')?.attrs?.val ?? ')' : ')';
      const sep = pr ? findChild(pr, 'sepChr')?.attrs?.val ?? ',' : ',';
      const es = ch.filter((c) => c.tag === 'e');

      // Detect system of equations: beg='{', end='', contains <m:m> or <m:eqArr>
      if (beg === '{' && end === '' && es.length === 1) {
        const innerM = findChild(es[0], 'm') || findChild(es[0], 'eqArr');
        if (innerM) {
          const rows =
            innerM.tag === 'm'
              ? getElementChildren(innerM)
                  .filter((r) => r.tag === 'mr')
                  .map((r) => getElementChildren(r).filter((c) => c.tag === 'e').map(ommlNodeToLatex).join(' & '))
              : getElementChildren(innerM)
                  .filter((c) => c.tag === 'e')
                  .map(ommlNodeToLatex);
          return `\\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}`;
        }
      }

      const openL = beg === '{' ? '\\{' : beg === '' ? '.' : beg;
      const closeL = end === '}' ? '\\}' : end === '' ? '.' : end;
      return `\\left${openL}${es.map(ommlNodeToLatex).join(sep)}\\right${closeL}`;
    }

    case 'm': {
      const rows = ch
        .filter((r) => r.tag === 'mr')
        .map((r) =>
          getElementChildren(r)
            .filter((c) => c.tag === 'e')
            .map(ommlNodeToLatex)
            .join(' & ')
        )
        .join(' \\\\ ');
      return `\\begin{matrix}${rows}\\end{matrix}`;
    }

    case 'eqArr': {
      const rows = ch.filter((c) => c.tag === 'e').map(ommlNodeToLatex).join(' \\\\ ');
      return `\\begin{aligned}${rows}\\end{aligned}`;
    }

    case 'acc': {
      const pr = findChild(node, 'accPr');
      const chr = pr ? findChild(pr, 'chr')?.attrs?.val || '\u0302' : '\u0302';
      const e = findChild(node, 'e');
      const body = e ? ommlNodeToLatex(e).trim() : '';
      if (chr === '\u20D7' || chr === '→') return body.length > 1 ? `\\overrightarrow{${body}}` : `\\vec{${body}}`;
      if (chr === '\u0302' || chr === '^') return body.length > 1 ? `\\widehat{${body}}` : `\\hat{${body}}`;
      if (chr === '\u0303' || chr === '~') return `\\widetilde{${body}}`;
      return `\\hat{${body}}`;
    }

    case 'bar': {
      const pr = findChild(node, 'barPr');
      const pos = pr ? findChild(pr, 'pos')?.attrs?.val || 'top' : 'top';
      const e = findChild(node, 'e');
      const body = e ? ommlNodeToLatex(e).trim() : '';
      return pos === 'bot' ? `\\underline{${body}}` : `\\overline{${body}}`;
    }

    case 'limLow': {
      const e = findChild(node, 'e');
      const lim = findChild(node, 'lim');
      const eStr = e ? ommlNodeToLatex(e).trim() : '';
      const lStr = lim ? ommlNodeToLatex(lim).trim() : '';
      if (eStr === 'lim' || eStr === '\\lim') return `\\lim_{${lStr}}`;
      return `\\underset{${lStr}}{${eStr}}`;
    }

    case 'limUpp': {
      const e = findChild(node, 'e');
      const lim = findChild(node, 'lim');
      return `\\overset{${lim ? ommlNodeToLatex(lim).trim() : ''}}{${e ? ommlNodeToLatex(e).trim() : ''}}`;
    }

    case 'func': {
      const fName = findChild(node, 'fName');
      const e = findChild(node, 'e');
      return `${fName ? ommlNodeToLatex(fName) : ''}${e ? ommlNodeToLatex(e) : ''}`;
    }

    default:
      return ch.map(ommlNodeToLatex).join('');
  }
}

export function ommlToLatex(ommlXml: string): string {
  const ast = parseXml(ommlXml);
  if (!ast) return '';
  return ommlNodeToLatex(ast).replace(/\s{2,}/g, ' ').trim();
}
