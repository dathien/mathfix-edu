import { FixNote, FormulaSubject, SubjectConfidence } from './types';

// Full periodic table element symbols (118 elements)
export const CHEMICAL_ELEMENTS = new Set([
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr',
  'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn',
  'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd',
  'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb',
  'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th',
  'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm',
  'Md', 'No', 'Lr', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds',
  'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og',
]);

// Multi-letter elements that are almost exclusively chemical in school documents
const STRONG_TWO_LETTER_ELEMENTS = new Set([
  'He', 'Li', 'Be', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'Cl', 'Ar',
  'Ca', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Br', 'Kr',
  'Ag', 'Sn', 'Ba', 'Pt', 'Au', 'Hg', 'Pb', 'Bi', 'Sr', 'Cd',
  'Rb', 'Cs', 'Ra', 'Ti', 'Ga', 'Ge', 'As', 'Se', 'Sb', 'Te',
]);

// Common chemistry molecule/ion tokens (for high-confidence per-formula classification)
const COMMON_CHEM_FORMULAS_RE =
  /\b(?:H2O|H2O2|H2SO4|H2SO3|H2S|HCl|HBr|HI|HF|HNO3|HNO2|H3PO4|H2CO3|HClO|HClO4|NaOH|KOH|Ca\(OH\)2|Ba\(OH\)2|Mg\(OH\)2|Al\(OH\)3|Fe\(OH\)2|Fe\(OH\)3|Cu\(OH\)2|Zn\(OH\)2|NaCl|KCl|AgCl|BaSO4|CaSO4|CuSO4|FeSO4|Fe2\(SO4\)3|Al2\(SO4\)3|Na2SO4|Na2CO3|NaHCO3|CaCO3|BaCO3|MgCO3|K2CO3|KHCO3|Ca\(HCO3\)2|AgNO3|NaNO3|KNO3|Cu\(NO3\)2|Fe\(NO3\)3|Fe\(NO3\)2|NH3|NH4Cl|NH4NO3|\(NH4\)2SO4|CO2|CO|SO2|SO3|NO2|NO|N2O|N2O5|P2O5|SiO2|FeO|Fe2O3|Fe3O4|CuO|Cu2O|Al2O3|MgO|CaO|BaO|ZnO|Na2O|K2O|MnO2|Cr2O3|KMnO4|K2Cr2O7|KClO3|CaOCl2|FeCl2|FeCl3|CuCl2|AlCl3|MgCl2|CaCl2|BaCl2|ZnCl2|FeS|FeS2|CuS|Ag2S|PbS|CH4|C2H6|C2H4|C2H2|C3H8|C4H10|C6H6|C6H12O6|C12H22O11|C2H5OH|CH3OH|CH3COOH|HCOOH|CH3CHO|HCHO|CH3COOC2H5|C6H5OH|C6H5NH2|CH3NH2|O2|O3|H2|N2|Cl2|Br2|I2|F2)\b/;

// Multi-character physics labels that should ALWAYS be upright \mathrm{...} in subscripts
const ALWAYS_UPRIGHT_PHYSICS_SUBS = new Set([
  'ms', 'ht', 'dh', 'tb', 'max', 'min', 'td', 'cb', 'hd', 'nt', 'ss',
  'ng', 'dm', 'tt', 'tp', 'kh', 'ck', 'lk', 'lkr', 'gh', 'cd', 'ct',
  'dn', 'tn', 'th', 'hl', 'dl', 'qt', 'bk', 'nh', 'cs', 'eff', 'rms',
  'tot', 'net', 'ext', 'int', 'air', 'rad', 'kin', 'pot',
]);

const VIETNAMESE_PHYSICS_SUBS = new Set([
  'đ', 'đh', 'tđ', 'hđ', 'đm', 'cđ', 'đn', 'đl', 'nhiệt', 'cản', 'kéo', 'đẩy', 'hợp', 'toàn', 'ngoài', 'trong',
]);

export interface SubjectClassification {
  subject: FormulaSubject;
  confidence: SubjectConfidence;
  reason: string;
}

/**
 * Detect whether a chemistry input represents a complex 2D/ring structural diagram
 * (e.g. multi-line ASCII art bonds with | / \ or benzene ring) that cannot be faithfully
 * represented as a linear Word Equation OMML.
 */
export function isComplexStructuralChemistry(raw: string): boolean {
  if (/\\chemfig\b/i.test(raw)) {
    return true;
  }
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return false;

  // Reject Markdown tables, LaTeX delimited blocks, LaTeX commands, and Vietnamese prose sentences
  if (lines.some((l) => /^\s*\|.+\|\s*$/.test(l))) return false;
  if (/\$|\\\[|\\\]|\\\(|\\\)|\\(?:frac|dfrac|tfrac|sqrt|vec|overrightarrow|int|sum|prod|lim|begin|end|ce|pu|text|mathrm|sin|cos|tan|pi|alpha|beta|omega|Delta)\b/.test(raw)) {
    return false;
  }
  if (/[À-ỹ]{2,}/.test(raw) || /(?:^|\s)(?:Câu|Bài|PHẦN|ĐỀ|Cho|Tính|Giải|Hòa|Phản|Trong|Áp dụng)\s/.test(raw)) {
    return false;
  }

  // Must have explicit vertical/diagonal ASCII bond lines (e.g. "   |   " or "  / \  ")
  // AND chemical group tokens strictly bounded by non-letters (avoiding JS ASCII \b pitfalls)
  const hasVerticalBondLine = lines.some((l) => /^\s*(?:[|/\\]{1,2}\s*)+$/.test(l));
  const hasChemAtoms = lines.some((l) =>
    /(?:^|[\s\-=|/\\()])(?:CH[23]?|OH|NH2|COOH|CHO|NO2|C|O|N|H)(?=$|[\s\-=|/\\()])/.test(l)
  );
  if (hasVerticalBondLine && hasChemAtoms) {
    return true;
  }
  // Benzene / ring ASCII diagram (diagonal / and \ bonds forming ring across >= 3 lines)
  const hasDiagonalRing =
    lines.length >= 3 &&
    lines.some((l) => /\/\s*\\/.test(l)) &&
    lines.some((l) => /\\\s*\//.test(l)) &&
    hasChemAtoms;
  return hasDiagonalRing;
}

/**
 * Validate whether a single token looks like a real chemical formula (e.g. H2SO4, Ca(OH)2, Fe3+, SO4^2-, NaCl, CH3COOH)
 * strictly checking against the periodic table so math expressions like x^2+1 or f(x) are never misclassified.
 */
export function isValidChemicalSpecies(token: string): boolean {
  const cleaned = token
    .trim()
    .replace(/^(\d+(?:\.\d+)?)\s*/, '') // leading stoichiometric coefficient
    .replace(/\((?:aq|s|l|g|r|k|dd)\)$/i, '') // trailing state
    .replace(/[↓↑]$/, '')
    .replace(/\\(?:downarrow|uparrow)$/, '')
    .trim();

  if (!cleaned) return false;

  // Reject pure math commands or expressions with math operators
  if (/\\(?:frac|dfrac|tfrac|sqrt|int|sum|lim|sin|cos|tan|vec|overrightarrow|begin|end|alpha|beta|omega|Delta)/.test(cleaned)) {
    return false;
  }

  // Strip trailing charge notation: 3+, 2-, +, -, ^3+, ^{2-}, ^+, ^-
  const withoutCharge = cleaned
    .replace(/\^?\{?\s*\d*[+-]\s*\}?$/, '')
    .replace(/[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+$/, '')
    .trim();

  if (!withoutCharge) return false;

  // Reject plain single variable like x, y, a, b, n, m or geometry points AB, ABC unless clearly ionic (e.g. Fe3+, Cl-, H+, Na+)
  const hasExplicitCharge = /(\^?\{?\d*[+-]\}?|[⁺⁻])$/.test(cleaned);
  const hasDigitSubscript = /[0-9₀-₉]/.test(withoutCharge);
  const hasHydrateDot = /[·.]\d*H2O/.test(withoutCharge);
  const hasLinearBond = /[-=≡]/.test(withoutCharge);

  // Split hydrate parts or condensed structural parts on -, =, ≡, ·
  const parts = withoutCharge.split(/(?:·|\.(?=\d*H2O)|(?<=[A-Za-z0-9)])[-=≡](?=[A-Z(]))/);
  let elementCount = 0;
  let strongElementFound = false;

  for (const part of parts) {
    const p = part.replace(/^\d+/, ''); // coefficient after hydrate dot e.g. 5H2O
    if (!p) continue;
    let i = 0;
    let parenDepth = 0;
    while (i < p.length) {
      const ch = p[i];
      if (ch === '(' || ch === '[') {
        parenDepth++;
        i++;
        continue;
      }
      if (ch === ')' || ch === ']') {
        parenDepth--;
        if (parenDepth < 0) return false;
        i++;
        // Optional subscript after closing bracket
        while (i < p.length && /[0-9₀-₉_{}]/.test(p[i])) i++;
        continue;
      }
      if (ch === '_' || ch === '{' || ch === '}') {
        i++;
        continue;
      }
      if (/[0-9₀-₉]/.test(ch)) {
        i++;
        continue;
      }
      if (/[A-Z]/.test(ch)) {
        let sym = ch;
        if (i + 1 < p.length && /[a-z]/.test(p[i + 1])) {
          const two = ch + p[i + 1];
          if (CHEMICAL_ELEMENTS.has(two)) {
            sym = two;
            i += 2;
          } else {
            return false;
          }
        } else {
          i += 1;
        }
        if (!CHEMICAL_ELEMENTS.has(sym)) return false;
        elementCount++;
        if (STRONG_TWO_LETTER_ELEMENTS.has(sym)) strongElementFound = true;
        // Skip optional subscript digits or _{...}
        if (p[i] === '_') {
          i++;
          if (p[i] === '{') {
            const closeIdx = p.indexOf('}', i);
            if (closeIdx === -1) return false;
            const sub = p.slice(i + 1, closeIdx);
            if (!/^[0-9nmxy]+$/.test(sub)) return false;
            i = closeIdx + 1;
          } else if (/[0-9]/.test(p[i] || '')) {
            i++;
          }
        } else {
          while (i < p.length && /[0-9₀-₉]/.test(p[i])) i++;
        }
        continue;
      }
      return false;
    }
    if (parenDepth !== 0) return false;
  }

  if (elementCount === 0) return false;

  // Guard against false positives on single uppercase letters (F, U, I, V, P, W, C, N, S, K, B)
  // or two-letter geometry/physics products (AB, BC, IR, UI, BS, PV) when there is NO digit, NO charge, NO strong element, NO hydrate, NO bond
  if (elementCount === 1 && !hasDigitSubscript && !hasExplicitCharge && !strongElementFound) {
    return false;
  }
  if (elementCount === 2 && !hasDigitSubscript && !hasExplicitCharge && !strongElementFound && !hasHydrateDot && !hasLinearBond) {
    // Allow well-known diatomic / binary oxides without digits ONLY if in known list (CO, NO, HF, HI, KI, KF, CS? no - only CO, NO, HF, HI, KI)
    if (!/^(?:CO|NO|HF|HI|KI|KF|LiF|NaF|KBr|NaI)$/.test(withoutCharge)) {
      return false;
    }
  }
  // Reject lowercase-free 3+ uppercase sequences without digits/strong elements like ABC, MNP, Oxyz
  if (!hasDigitSubscript && !hasExplicitCharge && !strongElementFound && !hasLinearBond && /^[A-Z]{2,}$/.test(withoutCharge)) {
    if (!/^(?:CO|NO|HF|HI|KI|KF|KOH|HCN|HNO|HClO)$/.test(withoutCharge)) {
      return false;
    }
  }

  return true;
}

/**
 * Per-formula automatic subject classifier (Section II).
 * Independently classifies each individual formula so one document can contain Math + Physics + Chemistry together.
 */
export function classifyFormulaSubject(
  rawFormula: string,
  contextText = ''
): SubjectClassification {
  const s = rawFormula.trim();
  const ctx = contextText.toLowerCase();

  // 1. Explicit mhchem commands -> Chemistry (high)
  if (/\\(?:ce|pu)\s*\{/.test(s) || isComplexStructuralChemistry(s)) {
    return { subject: 'chemistry', confidence: 'high', reason: 'Cú pháp hóa học mhchem / cấu tạo' };
  }

  // 2. Strong Math-only structures -> Math (high)
  // Note: \frac, \sqrt, \int can appear in Physics too, so check Math-exclusive constructs first
  if (
    /\\begin\{(?:pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|matrix|cases|dcases)\}/.test(s) ||
    /\\(?:lim|sum|prod|binom|mathbb|forall|exists|subset|subseteq|cup|cap|emptyset|angle|triangle|perp|parallel|cong|sim|widehat|overrightarrow)\b/.test(s) ||
    /\bf\s*'\s*\(x\)|\bf\(x\)|\bg\(x\)|\by\s*'|\blog_|\bln\b/.test(s)
  ) {
    return { subject: 'math', confidence: 'high', reason: 'Cấu trúc đặc trưng Toán học' };
  }

  // 3. Chemistry reaction equation detection (arrows + valid chemical species)
  const hasReactionArrow =
    /(?:->|<=>|<->|⇌|⇄|⟶|→|\\xrightarrow|\\xrightleftharpoons|\\rightleftharpoons|\\longrightarrow)/.test(s);
  if (hasReactionArrow) {
    // Split sides and check if at least 2 tokens are valid chemical species
    const sideTokens = s
      .replace(/\\(?:xrightarrow|xrightleftharpoons)(?:\[[^\]]*\])?\{[^}]*\}/g, ' -> ')
      .replace(/\\(?:rightleftharpoons|longrightarrow|rightarrow|to)/g, ' -> ')
      .replace(/->\[[^\]]*\]/g, ' -> ')
      .split(/(?:->|<=>|<->|⇌|⇄|⟶|→|\+(?!\s*$)(?!\}))/)
      .map((t) => t.replace(/\\mathrm\{([^}]*)\}/g, '$1').trim())
      .filter(Boolean);

    const chemHits = sideTokens.filter((t) => isValidChemicalSpecies(t)).length;
    if (chemHits >= 2 || (chemHits >= 1 && /(?:↓|↑|\\downarrow|\\uparrow|\((?:aq|s|l|g)\)|t\^\\circ|t°|\bxt\b|đpnc|đpdd)/i.test(s))) {
      return { subject: 'chemistry', confidence: 'high', reason: 'Phương trình phản ứng hóa học' };
    }
  }

  // 4. Single chemical molecule / ion / condensed structural formula
  const strippedForChem = s.replace(/\\mathrm\{([^}]*)\}/g, '$1').trim();
  if (COMMON_CHEM_FORMULAS_RE.test(strippedForChem) && !/\\(?:frac|sqrt|int|sin|cos|vec)\b/.test(s)) {
    return { subject: 'chemistry', confidence: 'high', reason: 'Công thức phân tử / hóa chất phổ biến' };
  }
  if (isValidChemicalSpecies(strippedForChem)) {
    // Extra guard: avoid classifying pure math like C_n^k or A_n^k or P(A) as chemistry
    if (!/^[CAP]_\{?[a-z0-9]+\}?\^\{?[a-z0-9]+\}?$/.test(strippedForChem) && !/^[PQ]\([A-Z]\)$/.test(strippedForChem)) {
      return { subject: 'chemistry', confidence: 'high', reason: 'Công thức phân tử hoặc ion hóa học' };
    }
  }

  // 5. Physics detection (vectors, mechanics, electricity, magnetism, optics, thermo, waves, SI units)
  let physicsScore = 0;

  // Physics vectors: \vec{F}, \vec{v}, \vec{p}, \vec{E}, \vec{B}, \vec{P}, \vec{N}, \vec{T}, \vec{g}, or \vec{a} in mechanics
  if (
    /\\vec\s*\{?[FvpEBPNTg]\}?/.test(s) ||
    (/\\vec\s*\{?a\}?/.test(s) && !/\(\s*-?\d+\s*[;,]\s*-?\d+/.test(s) && !/\\vec\s*\{?b\}?/.test(s))
  ) {
    physicsScore += 3;
  }
  // Classic school physics equations & formulas
  if (
    /\b(?:W_\{?(?:d|đ|t|dh|đh)\}?\s*=|E_\{?(?:d|đ|t|lk)\}?\s*=|F_\{?(?:ms|ht|dh|đh|hd|đ|t|L|A)\}?\s*=)/.test(s) ||
    /^\s*(?:U\s*=\s*I\s*·?\s*R|I\s*=\s*\\?(?:d|t)?frac\{?U\}?\{?R\}?|P\s*=\s*U\s*·?\s*I|Q\s*=\s*m\s*c\s*(?:\\Delta|Δ)\s*t|p\s*V\s*=\s*n\s*R\s*T|E\s*=\s*m\s*c\^2|F\s*=\s*m\s*a|F\s*=\s*q\s*v\s*B|F\s*=\s*k\s*\\?(?:d|t)?frac|F\s*=\s*B\s*I\s*l|A\s*=\s*F\s*·?\s*s|A\s*=\s*U\s*I\s*t|T\s*=\s*2\\?pi\\?sqrt|Z\s*=\s*\\?sqrt\{?R\^2|Z_L\s*=|Z_C\s*=|\\?Phi\s*=\s*B\s*S|\\?lambda\s*=|v\s*=\s*v_0\s*\+\s*a\s*t|v\^2\s*-\s*v_0\^2\s*=\s*2\s*a\s*s|s\s*=\s*v_0\s*t|x\s*=\s*A\s*\\?cos\s*\(\s*\\?omega\s*t|n_1\s*\\?sin\s*i|\\?(?:d|t)?frac\{?1\}?\{?f\}?\s*=\s*\\?(?:d|t)?frac\{?1\}?\{?d\}?|\\?(?:d|t)?frac\{?d[xvp]\}?\{?dt\}?)/.test(s)
  ) {
    physicsScore += 4;
  }
  // Physics descriptive subscripts like F_{ms}, F_{ht}, W_d, v_{tb}, Z_L, Z_C, R_{td}
  if (/(?:[FWEPvIUaRZT])_\{?(?:ms|ht|dh|đh|tb|td|tđ|max|min|hd|hđ|nt|ss|lk|gh|đ|d|t|L|C|0)\}?/.test(s)) {
    physicsScore += 2;
  }
  // Explicit SI units attached to numbers/quantities
  if (
    /\d\s*(?:\\,)?(?:\\mathrm\{)?(?:m\/s(?:\^2|²)?|km\/h|rad\/s|kg|Hz|kHz|MHz|Pa|kPa|kWh|eV|MeV|mA|mV|kV|μC|µC|μF|µF|nF|pF|mH|Wb|nm|μm|µm|°C|\^\\circ\s*C|\\Omega|Ω|kΩ)\b/.test(s) ||
    /\\mathrm\{(?:m\/s|kg|Hz|Pa|Wb|eV|MeV|kWh|N\/m|V\/m|N\/C)\}/.test(s)
  ) {
    physicsScore += 3;
  }
  // Greek physics symbols in equations (\omega, \lambda, \Phi, \varepsilon, \rho, \Omega, \mu_0)
  if (/\\(?:omega|Omega|lambda|Phi|varphi|varepsilon|rho|mu_0|Delta\s*[tTxsv\Phi])/.test(s) && /=/.test(s)) {
    physicsScore += 2;
  }
  // Context hints from surrounding Vietnamese sentence only assist when the formula itself
  // already shows at least one Physics signal (prevents bleeding onto a Math formula in the same sentence!)
  const hasPhysicsContext =
    /(?:vật lí|vật lý|lực|vận tốc|gia tốc|động năng|thế năng|cơ năng|điện trở|cường độ dòng điện|hiệu điện thế|từ trường|cảm ứng từ|từ thông|con lắc|dao động|sóng|bước sóng|tần số|thấu kính|khúc xạ|nhiệt lượng|khí lí tưởng|áp suất|công suất|định luật ôm|newton|lorentz|cu-lông)/.test(
      ctx
    );
  if (hasPhysicsContext && physicsScore > 0) {
    physicsScore += 1;
  }

  if (physicsScore >= 3) {
    return { subject: 'physics', confidence: 'high', reason: 'Công thức / đại lượng / đơn vị Vật lí' };
  }
  if (physicsScore === 2) {
    return { subject: 'physics', confidence: 'medium', reason: 'Ký hiệu và ngữ cảnh Vật lí' };
  }

  // Check chemistry context fallback for short species like Fe, Cu, Na, Mg, Ag in chemistry prose
  if (
    /(?:hóa học|phản ứng|dung dịch|axit|bazơ|muối|kết tủa|khí|ion|mol|nồng độ|oxi hóa|khử|nguyên tử|phân tử|nhiệt phân|điện phân)/.test(ctx) &&
    /^[A-Z][a-z]?(?:[0-9₀-₉]|\^?\{?\d*[+-]\}?)?$/.test(strippedForChem) &&
    CHEMICAL_ELEMENTS.has(strippedForChem.replace(/[0-9₀-₉^+\-{}]+$/, ''))
  ) {
    return { subject: 'chemistry', confidence: 'medium', reason: 'Nguyên tố/ion theo ngữ cảnh Hóa học' };
  }

  // Default to Mathematics
  const hasMathCue = /\\(?:frac|sqrt|int|sin|cos|tan|log|ln|le|ge|ne|pm|times|cdot|pi|alpha|beta)|[\^_=<>+\-]/.test(s);
  return {
    subject: 'math',
    confidence: hasMathCue ? 'high' : 'low',
    reason: 'Biểu thức Toán học',
  };
}

// ============================================================================
// PHYSICS NORMALIZER (Section IV)
// - Distinguishes italic physical quantities vs upright SI units & descriptive subscripts
// - Never alters teacher's variable symbols or invents units not in source
// ============================================================================

export function normalizePhysicsLatex(src: string, notes: FixNote[]): string {
  let out = src;

  // 1. Physics vector shorthand: vec(F) -> \vec{F}, vec F -> \vec{F}
  const vecParen = /(?<!\\)\bvec\s*\(([a-zA-Z0-9_{}\\' ]+)\)/g;
  if (vecParen.test(out)) {
    out = out.replace(vecParen, '\\vec{$1}');
    notes.push({
      code: 'physics_vec_paren',
      message: 'Chuẩn hóa ký hiệu vectơ Vật lí vec(...) sang \\vec{...}',
      severity: 'safe',
    });
  }

  // 2. Unicode physics symbols: Ω/Ω -> \Omega, µ/μ -> \mu, °C -> ^\circ\mathrm{C}, ° -> ^\circ
  if (/[Ω]/.test(out)) {
    out = out.replace(/Ω/g, '\\Omega ');
    notes.push({ code: 'physics_ohm', message: 'Chuẩn hóa ký hiệu điện trở Ohm (Ω → \\Omega)', severity: 'safe' });
  }
  if (/µ/.test(out)) {
    out = out.replace(/µ/g, '\\mu ');
    notes.push({ code: 'physics_micro', message: 'Chuẩn hóa tiền tố micro (µ → \\mu)', severity: 'safe' });
  }
  if (/°\s*C\b|\^\s*\\circ\s*C\b/.test(out)) {
    out = out.replace(/°\s*C\b|\^\s*\\circ\s*C\b/g, '^\\circ\\mathrm{C}');
    notes.push({ code: 'physics_celsius', message: 'Chuẩn hóa đơn vị nhiệt độ °C với chữ C đứng', severity: 'safe' });
  }

  // 3. Multi-character descriptive subscripts (upright labels vs italic quantities)
  // e.g. F_ms -> F_{\mathrm{ms}}, F_ht -> F_{\mathrm{ht}}, v_tb -> v_{\mathrm{tb}}, I_max -> I_{\mathrm{max}}
  // Also preserve explicit Vietnamese subscripts like W_đ -> W_{\text{đ}}, F_đh -> F_{\text{đh}}
  const beforeSub = out;
  out = out.replace(
    /([a-zA-Z}\\])_([a-zA-ZđĐ]{2,5})\b/g,
    (full, base, sub) => {
      const lower = sub.toLowerCase();
      if (VIETNAMESE_PHYSICS_SUBS.has(lower)) {
        return `${base}_{\\text{${sub}}}`;
      }
      if (ALWAYS_UPRIGHT_PHYSICS_SUBS.has(lower)) {
        return `${base}_{\\mathrm{${sub}}}`;
      }
      // Wrap any unbraced multi-char subscript safely in braces so LaTeX doesn't subscript only 1st letter!
      return `${base}_{${sub}}`;
    }
  );
  // Also handle single Vietnamese letter subscript like W_đ or E_đ -> W_{\text{đ}}
  out = out.replace(/([a-zA-Z}\\])_([đĐ])(?![a-zA-ZđĐ])/g, '$1_{\\text{$2}}');
  // And braced descriptive subscripts like F_{ms} -> F_{\mathrm{ms}}
  out = out.replace(/([a-zA-Z}\\])_\{([a-zA-Z]{2,5})\}/g, (full, base, sub) => {
    if (ALWAYS_UPRIGHT_PHYSICS_SUBS.has(sub.toLowerCase())) {
      return `${base}_{\\mathrm{${sub}}}`;
    }
    return full;
  });
  if (out !== beforeSub) {
    notes.push({
      code: 'physics_subscript',
      message: 'Chuẩn hóa chỉ số dưới nhiều ký tự Vật lí (chữ đứng cho nhãn mô tả)',
      severity: 'safe',
    });
  }

  // 4. Upright SI units ONLY when explicitly attached to a numeric value in the expression
  // e.g. 9.8 m/s^2 -> 9.8\,\mathrm{m/s}^2, 220 V -> 220\,\mathrm{V}, 50 Hz -> 50\,\mathrm{Hz}
  const beforeUnit = out;
  out = out.replace(
    /(\d(?:[.,]\d+)?)\s*(m\/s\^2|m\/s²|rad\/s\^2|rad\/s²|kg\/m\^3|kg\/m³|g\/cm\^3|g\/cm³|m\/s|km\/h|cm\/s|rad\/s|N\/m|N\/C|V\/m|kWh|MeV|keV|eV|GHz|MHz|kHz|Hz|MPa|kPa|Pa|atm|mmHg|MW|kW|mW|MJ|kJ|mJ|kcal|cal|kV|mV|mA|kΩ|MΩ|mΩ|nC|mC|nF|pF|mF|mH|Wb|mT|km|dm|cm|mm|nm|pm|kg|mg|mol)(?![a-zA-Z0-9_])/g,
    (_m, num, unit) => {
      if (unit === 'm/s^2' || unit === 'm/s²') return `${num}\\,\\mathrm{m/s}^2`;
      if (unit === 'rad/s^2' || unit === 'rad/s²') return `${num}\\,\\mathrm{rad/s}^2`;
      if (unit === 'kg/m^3' || unit === 'kg/m³') return `${num}\\,\\mathrm{kg/m}^3`;
      if (unit === 'g/cm^3' || unit === 'g/cm³') return `${num}\\,\\mathrm{g/cm}^3`;
      if (unit === 'kΩ') return `${num}\\,\\mathrm{k}\\Omega`;
      if (unit === 'MΩ') return `${num}\\,\\mathrm{M}\\Omega`;
      if (unit === 'mΩ') return `${num}\\,\\mathrm{m}\\Omega`;
      return `${num}\\,\\mathrm{${unit}}`;
    }
  );
  // Single-letter SI units strictly when preceded by a space after a number and at end or before punctuation/space
  // (e.g. "220 V", "10 N", "5 A", "20 J", "60 W", "300 K", "5 s", "2 m")
  out = out.replace(
    /(\d(?:[.,]\d+)?)\s+(N|J|W|V|A|C|F|H|T|K)(?=$|[\s,;.)\]}])/g,
    '$1\\,\\mathrm{$2}'
  );
  // Micro units like 5 \mu C -> 5\,\mu\mathrm{C}, 10 \mu F -> 10\,\mu\mathrm{F}, 5 \mu m -> 5\,\mu\mathrm{m}
  out = out.replace(
    /(\d(?:[.,]\d+)?)\s*\\mu\s*(C|F|A|V|H|T|m|s|g)(?![a-zA-Z])/g,
    '$1\\,\\mu\\mathrm{$2}'
  );
  if (out !== beforeUnit) {
    notes.push({
      code: 'physics_si_unit',
      message: 'Chuẩn hóa chữ đứng cho đơn vị đo SI (phân biệt với chữ nghiêng đại lượng)',
      severity: 'safe',
    });
  }

  // 5. Preserve differential notation dx/dt or dv/dt when written with \frac
  // Keep \frac{dv}{dt} or \frac{dx}{dt} valid without altering symbols

  return out;
}

// ============================================================================
// CHEMISTRY NORMALIZER (Section V)
// - Supports mhchem (\ce{...}) natively AND converts plain chemistry into clean,
//   upright, MathLive-editable, MathJax-validated, Word-OMML-native LaTeX.
// - NEVER auto-balances equations.
// - NEVER changes reactants, products, coefficients, or conditions.
// ============================================================================

export interface ChemistryNormalizationResult {
  latex: string;
  ommlCompatible: boolean;
  ommlWarning?: string;
}

function formatSingleChemicalTerm(term: string): string {
  const raw = term.trim();
  if (!raw) return '';

  // Already uses \ce{...} -> keep untouched
  if (/^\\ce\{/.test(raw)) return raw;

  // Extract leading stoichiometric coefficient (e.g., 2H2 -> coeff="2", rest="H2"; 3/2 O2 -> \frac{3}{2})
  let coeff = '';
  let rest = raw;

  const fracCoeff = rest.match(/^(\\?(?:d|t)?frac\{[^}]+\}\{[^}]+\})\s*(.+)$/);
  if (fracCoeff) {
    coeff = `${fracCoeff[1]}\\,`;
    rest = fracCoeff[2].trim();
  } else {
    const numCoeff = rest.match(/^(\d+(?:[.,]\d+)?)\s*([A-Z([].*)$/);
    if (numCoeff) {
      coeff = numCoeff[1];
      rest = numCoeff[2].trim();
    }
  }

  // Extract trailing precipitate/gas arrows (v, ↓, \downarrow, ^, ↑, \uparrow)
  // Carefully distinguish trailing gas "^" (preceded by space or element/digit with no charge after) from "^2-" charge!
  let trailingMarker = '';
  if (/(?:\s+v|↓|\\downarrow)$/.test(rest)) {
    rest = rest.replace(/(?:\s+v|↓|\\downarrow)$/, '').trim();
    trailingMarker = '\\downarrow';
  } else if (/(?:\s+\^|↑|\\uparrow)$/.test(rest)) {
    rest = rest.replace(/(?:\s+\^|↑|\\uparrow)$/, '').trim();
    trailingMarker = '\\uparrow';
  }

  // Extract trailing state tag: (aq), (s), (l), (g), (r), (k), (dd)
  let stateTag = '';
  const stateMatch = rest.match(/\s*\((aq|s|l|g|r|k|dd)\)$/i);
  if (stateMatch) {
    stateTag = `(\\mathrm{${stateMatch[1].toLowerCase()}})`;
    rest = rest.slice(0, stateMatch.index).trim();
  }

  // Extract trailing ionic charge:
  // Supports: Fe3+, Fe^3+, Fe^{3+}, SO4^2-, SO_4^{2-}, SO4^{2-}, OH-, Cl-, NH4+, Fe+++, O--
  let charge = '';
  const bracedCharge = rest.match(/\^\{([0-9]*[+-]|[+-][0-9]*)\}$/);
  if (bracedCharge) {
    charge = bracedCharge[1];
    rest = rest.slice(0, bracedCharge.index).trim();
  } else {
    const caretCharge = rest.match(/\^([0-9]*[+-])$/);
    if (caretCharge) {
      charge = caretCharge[1];
      rest = rest.slice(0, caretCharge.index).trim();
    } else {
      // Bare trailing charge like Fe3+, Ca2+, OH-, Cl-, NH4+, H+, Na+, MnO4-, Fe2+
      // Must be careful with polyatomic ions like NH4+ (4 is subscript, + is charge!) vs Fe3+ (3+ is charge!)
      // Rule:
      // - If ends with digits + sign (e.g. Fe3+, Cu2+, Al3+, SO42-):
      //   * If preceded by single element without another digit (Fe3+, Ca2+, Al3+, Cu2+, O2-, N3-, S2-), digits+sign is charge (3+, 2-)!
      //   * If preceded by polyatomic pattern ending in O/H/N/S/C/Cl + digit + sign:
      //     - NH4+ -> base NH4, charge +
      //     - NO3- -> base NO3, charge -
      //     - MnO4- -> base MnO4, charge -
      //     - HCO3- -> base HCO3, charge -
      //     - HSO4- -> base HSO4, charge -
      //     - SO42- -> base SO4, charge 2-
      //     - CO32- -> base CO3, charge 2-
      //     - PO43- -> base PO4, charge 3-
      const polyTwoDigitCharge = rest.match(/^(.+[A-Za-z)])(\d)(\d)([+-])$/);
      if (polyTwoDigitCharge) {
        rest = polyTwoDigitCharge[1] + polyTwoDigitCharge[2];
        charge = polyTwoDigitCharge[3] + polyTwoDigitCharge[4];
      } else {
        const bareMultiCharge = rest.match(/^([A-Z][a-z]?)([2-7])([+-])$/);
        if (bareMultiCharge && CHEMICAL_ELEMENTS.has(bareMultiCharge[1])) {
          rest = bareMultiCharge[1];
          charge = bareMultiCharge[2] + bareMultiCharge[3];
        } else {
          const repeatedSign = rest.match(/^(.+?)(\+{2,3}|-{2,3})$/);
          if (repeatedSign) {
            rest = repeatedSign[1];
            charge = `${repeatedSign[2].length}${repeatedSign[2][0]}`;
          } else {
            const singleSign = rest.match(/^(.+?)([+-])$/);
            if (singleSign) {
              rest = singleSign[1];
              charge = singleSign[2];
            }
          }
        }
      }
    }
  }

  // Normalize Unicode subscripts/superscripts inside rest
  rest = rest
    .replace(/[₀-₉]/g, (ch) => String(ch.charCodeAt(0) - 0x2080))
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\text\{([^}]*)\}/g, '$1');

  // Parse body into upright chemical symbols, subscripts, brackets, linear bonds (-, =, ≡), and hydrate dots (·)
  const formatBody = (body: string): string => {
    // Handle hydrate dot: CuSO4.5H2O or CuSO4·5H2O
    const hydrateParts = body.split(/·|\.(?=\d*H2O)/);
    if (hydrateParts.length > 1) {
      return hydrateParts
        .map((hp, idx) => {
          if (idx > 0) {
            const m = hp.match(/^(\d+)(.+)$/);
            if (m) return `${m[1]}${formatBody(m[2])}`;
          }
          return formatBody(hp);
        })
        .join('\\cdot ');
    }

    let out = '';
    let i = 0;
    while (i < body.length) {
      const ch = body[i];

      // Linear structural bonds: -, =, ≡
      if (ch === '-' && i > 0 && i < body.length - 1) {
        out += '\\text{-}';
        i++;
        continue;
      }
      if (ch === '=' && i > 0 && i < body.length - 1) {
        out += '=';
        i++;
        continue;
      }
      if (ch === '≡') {
        out += '\\equiv ';
        i++;
        continue;
      }

      // Parentheses / brackets in formulas like Ca(OH)2, [Ag(NH3)2]+
      if (ch === '(' || ch === '[' || ch === ')' || ch === ']') {
        out += ch;
        i++;
        // Optional subscript right after ) or ]
        if (ch === ')' || ch === ']') {
          const subMatch = body.slice(i).match(/^_\{([^}]+)\}|^_([0-9nxy])|^(\d+)/);
          if (subMatch) {
            const subVal = subMatch[1] || subMatch[2] || subMatch[3];
            out += subVal.length > 1 ? `_{${subVal}}` : `_${subVal}`;
            i += subMatch[0].length;
          }
        }
        continue;
      }

      // Chemical element symbol (1 or 2 letters)
      if (/[A-Z]/.test(ch)) {
        let sym = ch;
        if (i + 1 < body.length && /[a-z]/.test(body[i + 1]) && CHEMICAL_ELEMENTS.has(ch + body[i + 1])) {
          sym = ch + body[i + 1];
          i += 2;
        } else {
          i += 1;
        }
        // Check for immediate subscript (digits or _{...} or _n)
        const subMatch = body.slice(i).match(/^_\{([^}]+)\}|^_([0-9nxy])|^(\d+)/);
        if (subMatch) {
          const subVal = subMatch[1] || subMatch[2] || subMatch[3];
          i += subMatch[0].length;
          out += `\\mathrm{${sym}}${subVal.length > 1 ? `_{${subVal}}` : `_${subVal}`}`;
        } else {
          out += `\\mathrm{${sym}}`;
        }
        continue;
      }

      // Fallback character (e.g. n, x, y in C_nH_{2n+2})
      out += ch;
      i++;
    }
    return out;
  };

  let formattedBody = formatBody(rest);

  // Attach ionic charge cleanly onto the end (combining with last subscript into _{sub}^{charge} if present!)
  if (charge) {
    const cleanCharge = charge.replace(/^\+$/, '+').replace(/^-$/, '-');
    formattedBody = `${formattedBody}^{${cleanCharge}}`;
  }

  return `${coeff}${formattedBody}${stateTag}${trailingMarker}`;
}

function formatReactionCondition(condRaw: string): string {
  let c = condRaw.trim();
  if (!c) return '';
  if (/^t\s*(?:°|\^\\circ|\^o)$/i.test(c)) {
    return 't^\\circ';
  }
  c = c.replace(/t\s*(?:°|\^o)/g, 't^\\circ');

  // Split comma-separated multi-part conditions like "V2O5, t^\circ" or "xt, t^\circ, p"
  if (c.includes(',')) {
    return c
      .split(',')
      .map((part) => formatReactionCondition(part))
      .filter(Boolean)
      .join(',\\,');
  }

  // Handle combined condition containing t^\circ without comma
  if (c.includes('t^\\circ')) {
    const parts = c.split('t^\\circ');
    return parts
      .map((p) => {
        const pt = p.trim();
        if (!pt) return '';
        if (isValidChemicalSpecies(pt)) return formatSingleChemicalTerm(pt);
        return `\\text{${pt}}`;
      })
      .join('\\,t^\\circ\\,')
      .replace(/^\\,/, '')
      .replace(/\\,$/, '');
  }

  // Chemical catalyst species (e.g. MnO2, V2O5, H2SO4, Fe, Pt, Ni)
  if (isValidChemicalSpecies(c) || /^(?:Fe|Pt|Ni|Pd|Cu|Ag|Al)$/.test(c)) {
    return formatSingleChemicalTerm(c);
  }
  return `\\text{${c}}`;
}

export function normalizeChemistryLatex(src: string, notes: FixNote[]): ChemistryNormalizationResult {
  const trimmed = src.trim();

  // Check complex 2D structural diagrams — NEVER fake as broken text or claim OMML compatibility!
  if (isComplexStructuralChemistry(trimmed)) {
    notes.push({
      code: 'chem_complex_structural',
      message:
        'Phát hiện công thức cấu tạo 2D/vòng phức tạp không thể biểu diễn trung thực bằng Word Equation (OMML) tuyến tính — giữ nguyên cấu trúc và cảnh báo khi xuất Word',
      severity: 'ambiguous',
    });
    return {
      latex: trimmed,
      ommlCompatible: false,
      ommlWarning:
        'Công thức cấu tạo phức tạp không tương thích OMML tuyến tính; xuất dạng văn bản định dạng cố định thay vì Word Equation.',
    };
  }

  // If already explicit \ce{...}, keep mhchem syntax intact (MathJax renders mhchem natively & fixed OMML handles it!)
  if (/^\\ce\{[\s\S]+\}$/.test(trimmed)) {
    return { latex: trimmed, ommlCompatible: true };
  }

  // Normalize Unicode superscripts/subscripts in chemistry first (e.g. H₂SO₄, Fe³⁺, SO₄²⁻)
  let work = trimmed
    .replace(/⁰/g, '^0').replace(/¹/g, '^1').replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/⁴/g, '^4').replace(/⁵/g, '^5').replace(/⁶/g, '^6').replace(/⁷/g, '^7')
    .replace(/⁸/g, '^8').replace(/⁹/g, '^9').replace(/⁺/g, '+').replace(/⁻/g, '-')
    .replace(/\^([0-9])\^([0-9])/g, '^$1$2')
    .replace(/([0-9])([+-])(?=\s|$|\+)/g, '$1$2');

  // Check if it's a chemical equation (contains reaction arrow)
  const arrowRegex =
    /\\xrightarrow(?:\[([^\]]*)\])?\{([^}]*)\}|\\xrightleftharpoons(?:\[([^\]]*)\])?\{([^}]*)\}|\\rightleftharpoons|\\longrightarrow|\\rightarrow|\\to|<=>\[([^\]]*)\]|->\[([^\]]*)\]|<=>|<->|⇌|⇄|⟶|→|->/;

  const arrowMatch = arrowRegex.exec(work);
  if (arrowMatch) {
    const leftSide = work.slice(0, arrowMatch.index).trim();
    const rightSide = work.slice(arrowMatch.index + arrowMatch[0].length).trim();
    const matchedArrow = arrowMatch[0];

    let arrowLatex = '\\longrightarrow';
    if (matchedArrow.startsWith('\\xrightarrow')) {
      const below = arrowMatch[1] ? `[${formatReactionCondition(arrowMatch[1])}]` : '';
      const above = formatReactionCondition(arrowMatch[2] || '');
      arrowLatex = `\\xrightarrow${below}{${above}}`;
    } else if (matchedArrow.startsWith('\\xrightleftharpoons')) {
      const below = arrowMatch[3] ? `[${formatReactionCondition(arrowMatch[3])}]` : '';
      const above = formatReactionCondition(arrowMatch[4] || '');
      arrowLatex = `\\xrightleftharpoons${below}{${above}}`;
    } else if (matchedArrow.startsWith('<=>[')) {
      arrowLatex = `\\xrightleftharpoons{${formatReactionCondition(arrowMatch[5] || '')}}`;
    } else if (matchedArrow.startsWith('->[')) {
      arrowLatex = `\\xrightarrow{${formatReactionCondition(arrowMatch[6] || '')}}`;
    } else if (/^(?:<=>|<->|⇌|⇄|\\rightleftharpoons)$/.test(matchedArrow)) {
      arrowLatex = '\\rightleftharpoons';
    } else {
      arrowLatex = '\\longrightarrow';
    }

    // Split reactants & products on " + " (carefully NOT splitting ionic charges like Fe3+ + OH- or Fe^{3+} + ...)
    const splitSide = (side: string): string[] => {
      // Protect ionic charges "+" inside ^{...} or directly attached to ion end before whitespace+next-species
      const tokens: string[] = [];
      let current = '';
      let braceDepth = 0;
      for (let i = 0; i < side.length; i++) {
        const ch = side[i];
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);

        if (ch === '+' && braceDepth === 0) {
          const prev = side[i - 1] || '';
          const next = side[i + 1] || '';
          // A "+" is an ionic charge if preceded by '^', OR attached directly to an element/digit
          // and followed by whitespace, end-of-side, or another '+' (e.g. "Fe3+ + OH-", "H+ + Cl-").
          const isChargePlus =
            prev === '^' ||
            (/[A-Za-z0-9)]/.test(prev) && (next === ' ' || next === '' || next === '+' || next === '\t'));
          // Otherwise it is a reaction term separator (supports both "2H2 + O2" and "2H2+O2")
          if (!isChargePlus && (/\s/.test(prev) || /\s/.test(next) || /[A-Z0-9(\\]/.test(next))) {
            if (current.trim()) tokens.push(current.trim());
            current = '';
            continue;
          }
        }
        current += ch;
      }
      if (current.trim()) tokens.push(current.trim());
      return tokens;
    };

    const formattedLeft = splitSide(leftSide).map(formatSingleChemicalTerm).join(' + ');
    const formattedRight = splitSide(rightSide).map(formatSingleChemicalTerm).join(' + ');
    const finalEq = `${formattedLeft} ${arrowLatex} ${formattedRight}`.trim();

    if (finalEq !== trimmed) {
      notes.push({
        code: 'chem_equation_normalized',
        message: 'Chuẩn hóa phương trình hóa học (chỉ số nguyên tử, điện tích ion, mũi tên phản ứng — giữ nguyên chất và hệ số gốc)',
        severity: 'safe',
      });
    }
    return { latex: finalEq, ommlCompatible: true };
  }

  // Single chemical formula, ion, hydrate, or condensed linear structural formula
  const formattedSingle = formatSingleChemicalTerm(work);
  if (formattedSingle !== trimmed) {
    notes.push({
      code: 'chem_formula_normalized',
      message: 'Chuẩn hóa công thức hóa học (chữ đứng nguyên tố, chỉ số dưới, điện tích ion)',
      severity: 'safe',
    });
  }
  return { latex: formattedSingle, ommlCompatible: true };
}
