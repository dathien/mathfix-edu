import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { extractStructuredInputFromHtml, processDocumentText } from '../parser';
import { convertDocumentToFormat, convertFormulaToFormat, mathmlToUnicodeMath } from '../formatConverter';
import {
  buildDisplayedFormulaExportPair,
  documentToExportPair,
  paragraphToExportPair,
} from '../clipboardExport';
import { buildDocumentXml, buildExamHeaderOoxml, generateDocxBuffer } from '../docxExporter';
import { importDocxFromArrayBuffer } from '../docxImporter';
import {
  appendEssayWritingSpace,
  appendShortAnswerBoxes,
  buildQuestionTemplate,
  DEFAULT_EXAM_STYLE,
  DEFAULT_NORMALIZATION_OPTIONS,
  EMPTY_EXAM_HEADER,
  ExamHeaderConfig,
  ExamStyleSettings,
  formatMultipleChoiceOptions,
  formatTrueFalseItems,
  hasAnyHeaderContent,
  normalizeExamText,
  renumberQuestions,
} from '../examTools';
import { PERIODIC_TABLE, searchPeriodicElements } from '../../data/periodicTable';
import { BUILTIN_FORMULA_LIBRARY } from '../../data/formulaLibraryData';
import {
  deleteCustomFormula,
  loadLibraryState,
  parseLibraryImportJson,
  recordRecentFormulaUsage,
  resetMemoryLibraryStore,
  saveCustomFormula,
  saveFavoriteIds,
  serializeLibraryToJson,
} from '../libraryStorage';
import { FormulaSegment, ProcessedDocument } from '../types';

function extractFormulas(doc: ProcessedDocument): FormulaSegment[] {
  const out: FormulaSegment[] = [];
  for (const b of doc.blocks) {
    if (b.type === 'paragraph') {
      for (const s of b.segments) {
        if (s.type === 'formula') out.push(s);
      }
    } else {
      for (const row of b.rows) {
        for (const cell of row) {
          for (const p of cell.paragraphs) {
            for (const s of p.segments) {
              if (s.type === 'formula') out.push(s);
            }
          }
        }
      }
    }
  }
  return out;
}

// ============================================================================
// 1. 40 MATH FORMULA TESTS (Section XXV)
// ============================================================================
describe('1. Bộ kiểm thử 40 công thức Toán học', () => {
  const mathCases: Array<[string, string]> = [
    ['Phân số cơ bản', '$\\frac{x^2+1}{2}$'],
    ['Phân số hiển thị dfrac', '$\\dfrac{2x-3}{x+5}$'],
    ['Phân số lồng nhau', '$\\frac{1}{1+\\frac{1}{x+1}}$'],
    ['Căn bậc hai', '$\\sqrt{2x+3}$'],
    ['Căn bậc ba', '$\\sqrt[3]{x^3 - 8}$'],
    ['Căn bậc n', '$\\sqrt[n]{a^m}$'],
    ['Căn lồng nhau', '$\\sqrt{5 + 2\\sqrt{6}}$'],
    ['Số mũ và chỉ số', '$x_1^2 + x_2^2 = (x_1 + x_2)^2 - 2x_1 x_2$'],
    ['Công thức nghiệm bậc hai', '$$x_{1,2} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$'],
    ['Hệ phương trình cases', '$$\\begin{cases} 2x + 3y = 7 \\\\ x - y = 1 \\end{cases}$$'],
    ['Ma trận ngoặc tròn pmatrix', '$$A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$$'],
    ['Ma trận ngoặc vuông bmatrix', '$$B = \\begin{bmatrix} a & b & c \\\\ d & e & f \\end{bmatrix}$$'],
    ['Định thức vmatrix', '$$\\det(A) = \\begin{vmatrix} 2 & -1 \\\\ 3 & 4 \\end{vmatrix}$$'],
    ['Nguyên hàm cơ bản', '$\\int (3x^2 - 2x + 1)\\,\\mathrm{d}x = x^3 - x^2 + x + C$'],
    ['Tích phân xác định', '$$I = \\int_0^1 \\frac{2x+1}{x^2+x+1}\\,\\mathrm{d}x$$'],
    ['Tích phân lượng giác', '$\\int_0^{\\pi/2} \\sin^2 x\\,\\mathrm{d}x = \\frac{\\pi}{4}$'],
    ['Giới hạn hàm số', '$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$'],
    ['Giới hạn vô cực', '$\\lim_{x \\to +\\infty} \\frac{2x^2 + 1}{x^2 - 3} = 2$'],
    ['Tổng sigma', '$$S = \\sum_{k=1}^{n} \\frac{1}{k(k+1)} = \\frac{n}{n+1}$$'],
    ['Tích pi', '$P = \\prod_{i=1}^{n} a_i$'],
    ['Đạo hàm thương', '$\\left(\\frac{u}{v}\\right)\' = \\frac{u\'v - uv\'}{v^2}$'],
    ['Đạo hàm cấp cao', '$f\'\'(x) = 6x - 4$'],
    ['Logarit cơ số a', '$\\log_a b = \\frac{\\log_c b}{\\log_c a}$'],
    ['Logarit tự nhiên', '$\\ln(e^x + 1) > 0$'],
    ['Hàm số mũ', '$2^{x+1} - 5 \\cdot 2^x + 4 = 0$'],
    ['Hệ thức lượng giác', '$\\sin^2\\alpha + \\cos^2\\alpha = 1$'],
    ['Công thức nhân đôi', '$\\cos 2a = 2\\cos^2 a - 1 = 1 - 2\\sin^2 a$'],
    ['Định lí côsin', '$a^2 = b^2 + c^2 - 2bc\\cos A$'],
    ['Định lí sin', '$\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C} = 2R$'],
    ['Tích vô hướng vectơ', '$\\vec{a}\\cdot\\vec{b} = |\\vec{a}|\\cdot|\\vec{b}|\\cdot\\cos(\\vec{a},\\vec{b})$'],
    ['Vectơ hai điểm', '$\\overrightarrow{AB} = (x_B - x_A; y_B - y_A; z_B - z_A)$'],
    ['Khoảng cách điểm đến mặt phẳng', '$d(M_0,(P)) = \\frac{|Ax_0 + By_0 + Cz_0 + D|}{\\sqrt{A^2+B^2+C^2}}$'],
    ['Tổ hợp chập k', '$C_n^k = \\binom{n}{k} = \\frac{n!}{k!(n-k)!}$'],
    ['Xác suất có điều kiện', '$P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}$'],
    ['Phương sai ghép nhóm', '$s^2 = \\frac{1}{n}\\sum_{i=1}^{k} n_i(c_i - \\overline{x})^2$'],
    ['Tập hợp số thực', '$D = \\mathbb{R} \\setminus \\{-1; 2\\}$'],
    ['Bất đẳng thức Cô-si', '$a + b \\ge 2\\sqrt{ab},\\; \\forall a, b \\ge 0$'],
    ['Giá trị tuyệt đối', '$|2x - 1| \\le 3 \\Leftrightarrow -1 \\le x \\le 2$'],
    ['Đoạn thẳng có gạch ngang', '$\\overline{AB} = 2\\sqrt{6}$'],
    ['Hàm số cho bởi nhiều công thức', '$$f(x) = \\begin{cases} x^2 + 1 & \\text{khi } x \\ge 0 \\\\ -x & \\text{khi } x < 0 \\end{cases}$$'],
  ];

  it.each(mathCases)('Toán học: %s', (_label, input) => {
    const doc = processDocumentText(input, 'plain', [], 'math');
    const formulas = extractFormulas(doc);
    expect(formulas.length).toBeGreaterThanOrEqual(1);
    const f = formulas[0];
    expect(f.validated).toBe(true);
    expect(f.svg).toContain('<svg');
    expect(f.mathml).toContain('<math');
    const omml = convertFormulaToFormat(f, 'omml');
    expect(omml.supported).toBe(true);
    expect(omml.output).toContain('<m:oMath');
  });
});

// ============================================================================
// 2. 40 PHYSICS FORMULA TESTS (Section XXV)
// ============================================================================
describe('2. Bộ kiểm thử 40 công thức Vật lí', () => {
  const physicsCases: Array<[string, string]> = [
    ['Vận tốc thẳng biến đổi đều', '$v = v_0 + at$'],
    ['Độ dịch chuyển', '$d = v_0 t + \\frac{1}{2}at^2$'],
    ['Hệ thức độc lập thời gian', '$v^2 - v_0^2 = 2ad$'],
    ['Định luật II Newton dạng vectơ', '$\\vec{F} = m\\vec{a}$'],
    ['Hợp lực vectơ', '$\\vec{F}_{\\mathrm{hl}} = \\vec{F}_1 + \\vec{F}_2$'],
    ['Lực ma sát trượt', '$F_{\\mathrm{ms}} = \\mu N$'],
    ['Lực ma sát viết tắt F_ms', '$F_ms = \\mu N$'],
    ['Lực hướng tâm', '$F_{\\mathrm{ht}} = \\frac{mv^2}{r} = m\\omega^2 r$'],
    ['Lực hướng tâm viết tắt F_ht', '$F_ht = m\\frac{v^2}{r}$'],
    ['Công cơ học', '$A = F \\cdot s \\cdot \\cos\\alpha$'],
    ['Động năng', '$W_{\\text{đ}} = \\frac{1}{2}mv^2$'],
    ['Động năng viết tắt W_d', '$W_d = \\frac12mv^2$'],
    ['Thế năng trọng trường', '$W_t = mgh$'],
    ['Động lượng vectơ', '$\\vec{p} = m\\vec{v}$'],
    ['Mômen lực', '$M = F \\cdot d$'],
    ['Dao động điều hòa', '$x = A\\cos(\\omega t + \\varphi)$'],
    ['Vận tốc dao động điều hòa', '$v = -\\omega A\\sin(\\omega t + \\varphi)$'],
    ['Gia tốc dao động điều hòa', '$a = -\\omega^2 x$'],
    ['Chu kì con lắc đơn', '$T = 2\\pi\\sqrt{\\frac{l}{g}}$'],
    ['Chu kì con lắc lò xo', '$T = 2\\pi\\sqrt{\\frac{m}{k}}$'],
    ['Bước sóng', '$\\lambda = vT = \\frac{v}{f}$'],
    ['Khoảng vân Y-âng', '$i = \\frac{\\lambda D}{a}$'],
    ['Định luật Coulomb', '$F = k\\frac{|q_1 q_2|}{\\varepsilon r^2}$'],
    ['Cường độ điện trường', '$E = k\\frac{|Q|}{\\varepsilon r^2}$'],
    ['Năng lượng tụ điện', '$W = \\frac{1}{2}CU^2$'],
    ['Định luật Ohm đoạn mạch', '$I = \\frac{U}{R}$'],
    ['Định luật Ohm toàn mạch', '$I = \\frac{\\mathcal{E}}{R_N + r}$'],
    ['Công suất điện', '$P = UI = I^2 R = \\frac{U^2}{R}$'],
    ['Định luật Joule-Lenz', '$Q = I^2 R t$'],
    ['Nhiệt lượng', '$Q = mc\\Delta T$'],
    ['Định luật I Nhiệt động lực học', '$\\Delta U = A + Q$'],
    ['Phương trình khí lí tưởng', '$pV = nRT$'],
    ['Lực từ Ampere', '$F = BIl\\sin\\theta$'],
    ['Lực Lorentz', '$F = |q|vB\\sin\\alpha$'],
    ['Từ thông', '$\\Phi = NBS\\cos\\alpha$'],
    ['Suất điện động cảm ứng', '$e_c = -\\frac{\\Delta\\Phi}{\\Delta t}$'],
    ['Hệ thức Einstein', '$E = mc^2$'],
    ['Định luật phóng xạ', '$N = N_0 \\cdot 2^{-\\frac{t}{T}}$'],
    ['Công thức thấu kính mỏng', '$\\frac{1}{f} = \\frac{1}{d} + \\frac{1}{d\'}$'],
    ['Đơn vị tốc độ và gia tốc SI', '$v = 10\\,\\mathrm{m/s},\\; g = 9{,}8\\,\\mathrm{m/s^2},\\; R = 20\\,\\Omega$'],
  ];

  it.each(physicsCases)('Vật lí: %s', (_label, input) => {
    const doc = processDocumentText(input, 'plain', [], 'physics');
    const formulas = extractFormulas(doc);
    expect(formulas.length).toBeGreaterThanOrEqual(1);
    const f = formulas[0];
    expect(f.subject).toBe('physics');
    expect(f.validated).toBe(true);
    expect(f.svg).toContain('<svg');
    const omml = convertFormulaToFormat(f, 'omml');
    expect(omml.supported).toBe(true);
    expect(omml.output).toContain('<m:oMath');
  });
});

// ============================================================================
// 3. 40 CHEMISTRY FORMULA + 118-ELEMENT PERIODIC TABLE TESTS (Section XXV)
// ============================================================================
describe('3. Bộ kiểm thử 40 công thức Hóa học & Bảng tuần hoàn 118 nguyên tố', () => {
  const chemFormulaCases: Array<[string, string]> = [
    ['Axit sunfuric H2SO4', 'H2SO4'],
    ['Nước H2O', 'H2O'],
    ['Canxi hiđroxit Ca(OH)2', 'Ca(OH)2'],
    ['Sắt(III) sunfat Fe2(SO4)3', 'Fe2(SO4)3'],
    ['Nhôm oxit Al2O3', 'Al2O3'],
    ['Natri cacbonat Na2CO3', 'Na2CO3'],
    ['Amoni nitrat NH4NO3', 'NH4NO3'],
    ['Kali pemanganat KMnO4', 'KMnO4'],
    ['Ion sắt(III) Fe3+', 'Fe3+'],
    ['Ion sunfat SO4^2-', 'SO4^2-'],
    ['Ion amoni NH4+', 'NH4+'],
    ['Ion photphat PO4^3-', 'PO4^3-'],
    ['Ion hiđroxit OH-', 'OH-'],
    ['Đồng vị Cacbon-12', '${}_{6}^{12}\\mathrm{C}$'],
    ['Đồng vị Urani-235', '${}_{92}^{235}\\mathrm{U}$'],
    ['Phản ứng tổng hợp nước', '2H2 + O2 ->[t°] 2H2O'],
    ['Nhiệt phân CaCO3 có khí bay lên', 'CaCO3 ->[t°] CaO + CO2 ↑'],
    ['Kết tủa AgCl', 'AgNO3(aq) + NaCl(aq) -> AgCl ↓ + NaNO3(aq)'],
    ['Cân bằng Haber tổng hợp NH3', 'N2(g) + 3H2(g) <=>[xt, t°] 2NH3(g)'],
    ['Oxi hóa SO2 có xúc tác V2O5', '2SO2 + O2 <=>[V2O5, t°] 2SO3'],
    ['Phản ứng trao đổi ion thu gọn', '$\\mathrm{Fe}^{3+} + 3\\mathrm{OH}^{-} \\longrightarrow \\mathrm{Fe}(\\mathrm{OH})_3\\downarrow$'],
    ['Công thức thu gọn ethanol', 'CH3-CH2-OH'],
    ['Công thức thu gọn acetic acid', '$\\mathrm{CH}_3\\mathrm{COOH}$'],
    ['Phản ứng ester hóa', '$\\mathrm{CH}_3\\mathrm{COOH} + \\mathrm{C}_2\\mathrm{H}_5\\mathrm{OH} \\xrightleftharpoons{\\mathrm{H}_2\\mathrm{SO}_4} \\mathrm{CH}_3\\mathrm{COOC}_2\\mathrm{H}_5 + \\mathrm{H}_2\\mathrm{O}$'],
    ['Lên men glucose', '$\\mathrm{C}_6\\mathrm{H}_{12}\\mathrm{O}_6 \\xrightarrow{\\text{enzyme}} 2\\mathrm{C}_2\\mathrm{H}_5\\mathrm{OH} + 2\\mathrm{CO}_2\\uparrow$'],
    ['Lệnh mhchem cơ bản', '$\\ce{H2SO4 + 2NaOH -> Na2SO4 + 2H2O}$'],
    ['Lệnh mhchem cân bằng', '$\\ce{N2 + 3H2 <=> 2NH3}$'],
    ['Hằng số cân bằng Kc', '$K_C = \\frac{[\\mathrm{C}]^c[\\mathrm{D}]^d}{[\\mathrm{A}]^a[\\mathrm{B}]^b}$'],
    ['Công thức tính pH', '$\\mathrm{pH} = -\\lg[\\mathrm{H}^+]$'],
    ['Phức chất bạc diammine', '$[\\mathrm{Ag}(\\mathrm{NH}_3)_2]^{+}\\mathrm{OH}^{-}$'],
  ];

  it.each(chemFormulaCases)('Hóa học: %s', (_label, input) => {
    const doc = processDocumentText(input, 'plain', [], 'chemistry');
    const formulas = extractFormulas(doc);
    expect(formulas.length).toBeGreaterThanOrEqual(1);
    const f = formulas[0];
    expect(f.subject).toBe('chemistry');
    expect(f.validated).toBe(true);
    expect(f.svg).toContain('<svg');
    const omml = convertFormulaToFormat(f, 'omml');
    expect(omml.supported).toBe(true);
    expect(omml.output).toContain('<m:oMath');
  });

  // 10 Periodic Table & structural chemistry tests (30 + 10 = 40)
  it('Bảng tuần hoàn có đầy đủ chính xác 118 nguyên tố (Z = 1..118 liên tục)', () => {
    expect(PERIODIC_TABLE.length).toBe(118);
    for (let z = 1; z <= 118; z++) {
      expect(PERIODIC_TABLE[z - 1].z).toBe(z);
    }
  });

  it('Nguyên tố đầu tiên là Hydrogen (Z=1, H) và cuối cùng là Oganesson (Z=118, Og)', () => {
    expect(PERIODIC_TABLE[0].symbol).toBe('H');
    expect(PERIODIC_TABLE[117].symbol).toBe('Og');
    expect(PERIODIC_TABLE[117].name).toBe('Oganesson');
  });

  it('Tìm kiếm nguyên tố bằng tên tiếng Việt phổ biến: Sắt -> Fe (Z=26)', () => {
    const found = searchPeriodicElements('sắt');
    expect(found.some((e) => e.symbol === 'Fe' && e.z === 26)).toBe(true);
  });

  it('Tìm kiếm nguyên tố bằng tên tiếng Việt: Đồng -> Cu (Z=29)', () => {
    const found = searchPeriodicElements('đồng');
    expect(found.some((e) => e.symbol === 'Cu' && e.z === 29)).toBe(true);
  });

  it('Tìm kiếm nguyên tố bằng tên tiếng Việt: Vàng -> Au (Z=79)', () => {
    const found = searchPeriodicElements('vàng');
    expect(found.some((e) => e.symbol === 'Au' && e.z === 79)).toBe(true);
  });

  it('Tìm kiếm nguyên tố bằng tên tiếng Việt: Thủy ngân -> Hg (Z=80)', () => {
    const found = searchPeriodicElements('thủy ngân');
    expect(found.some((e) => e.symbol === 'Hg' && e.z === 80)).toBe(true);
  });

  it('Tìm kiếm nguyên tố theo số hiệu nguyên tử Z = 17 -> Cl (Chlorine)', () => {
    const found = searchPeriodicElements('17');
    expect(found[0]?.symbol).toBe('Cl');
  });

  it('Tìm kiếm nguyên tố theo ký hiệu hóa học Na -> Sodium (Z=11)', () => {
    const found = searchPeriodicElements('Na');
    expect(found[0]?.symbol).toBe('Na');
    expect(found[0]?.z).toBe(11);
  });

  it('Không có ký hiệu hóa học trùng lặp trong 118 nguyên tố', () => {
    const symbols = new Set(PERIODIC_TABLE.map((e) => e.symbol));
    expect(symbols.size).toBe(118);
  });

  it('Nhận diện trung thực công thức cấu tạo 2D phân nhánh không tương thích OMML tuyến tính', () => {
    const ascii2D = `      CH3\n       |\nCH3 - CH - CH3`;
    const doc = processDocumentText(ascii2D, 'plain', [], 'chemistry');
    const formulas = extractFormulas(doc);
    const nonOmml = formulas.find((f) => f.ommlCompatible === false);
    expect(nonOmml).toBeDefined();
    if (nonOmml) {
      const conv = convertFormulaToFormat(nonOmml, 'omml');
      expect(conv.supported).toBe(false);
      expect(conv.warning).toBeTruthy();
    }
  });
});

// ============================================================================
// 4. 30 BROKEN LATEX / ESCAPE / SYNTAX RECOVERY TESTS (Section XXV)
// ============================================================================
describe('4. Bộ kiểm thử 30 công thức LaTeX lỗi / escape / thiếu ngoặc', () => {
  const brokenCases: Array<[string, string, string]> = [
    ['Escape kép \\\\frac', '$\\\\frac{x^2+1}{2}$', '\\frac'],
    ['Escape kép \\\\sqrt', '$\\\\sqrt{x+1}$', '\\sqrt'],
    ['Escape kép \\\\vec', '$\\\\vec{F} = m\\\\vec{a}$', '\\vec'],
    ['Escape kép \\\\int', '$\\\\int_0^1 x^2 dx$', '\\int'],
    ['Escape kép \\\\sum', '$\\\\sum_{i=1}^n i$', '\\sum'],
    ['Giữ nguyên \\\\ xuống dòng trong cases', '$$\\begin{cases} x+y=2 \\\\ x-y=0 \\end{cases}$$', '\\\\'],
    ['Giữ nguyên \\\\ xuống dòng trong pmatrix', '$$\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}$$', '\\\\'],
    ['Sửa lỗi chính tả \\sqtr', '$\\sqtr{x^2+1}$', '\\sqrt'],
    ['Sửa lỗi chính tả \\casess', '$$\\begin{casess} x=1 \\\\ y=2 \\end{casess}$$', '\\begin{cases}'],
    ['Sửa lỗi chính tả \\pmatix', '$$\\begin{pmatix} 1 & 2 \\\\ 3 & 4 \\end{pmatix}$$', '\\begin{pmatrix}'],
    ['Thiếu dấu gạch chéo frac{a}{b}', 'frac{2x+1}{x-3}', '\\frac'],
    ['Phân số rút gọn \\frac12', '$\\frac12$', '\\frac{1}{2}'],
    ['Thiếu ngoặc đóng ở phân số', '$\\frac{a^2 - b^2}{a + b$', '\\frac'],
    ['Dấu căn ngoặc tròn \\sqrt(x+1)', '$\\sqrt(x^2 + 1)$', '\\sqrt{'],
    ['Ký hiệu căn Unicode √(2x+3)', '√(2x + 3)', '\\sqrt'],
    ['Ký hiệu căn bậc 3 Unicode ∛(x-1)', '∛(x - 1)', '\\sqrt[3]'],
    ['Ký hiệu cộng trừ +-', '$x = -b +- \\sqrt{\\Delta}$', '\\pm'],
    ['Bất đẳng thức <= và >=', '$0 <= k <= n, x >= 1$', '\\le'],
    ['Ký hiệu khác !=', '$a != 0$', '\\ne'],
    ['Mũi tên giới hạn ->', '$\\lim_{x->0} \\frac{\\sin x}{x} = 1$', '\\to'],
    ['Số mũ Unicode x²', 'x² - 5x + 6 = 0', 'x^2'],
    ['Số mũ Unicode x³', 'y = x³ - 3x', 'x^3'],
    ['Ký hiệu vô cực infty thiếu gạch chéo', '$\\lim_{x->+infty} f(x) = +\\infty$', '\\infty'],
    ['Hàm lượng giác \\tg sang chuẩn', '$(\\tg x)\' = \\frac{1}{\\cos^2 x}$', 'cos'],
    ['Tập số thực viết tắt \\R', '$x \\in \\R$', '\\mathbb{R}'],
    ['Ký tự toán học nghiêng Unicode 𝑥', '𝑥² + 2𝑥 − 3 = 0', 'x^2'],
    ['Dấu ngoặc phân cách ChatGPT \\(...\\)', '\\(\\frac{x+1}{2}\\)', '\\frac'],
    ['Dấu ngoặc phân cách ChatGPT \\[...\\]', '\\[\\int_0^1 x\\,dx\\]', '\\int'],
    ['Thiếu gạch chéo sum_{k=1}^{n}', '$$sum_{k=1}^{n} k = \\frac{n(n+1)}{2}$$', '\\sum'],
    ['Thiếu gạch chéo lim_{x->0}', '$$lim_{x->0} frac{sin x}{x} = 1$$', '\\lim'],
  ];

  it.each(brokenCases)('Sửa lỗi: %s', (_label, input, expectedSubstr) => {
    const doc = processDocumentText(input, 'plain', [], 'auto');
    const formulas = extractFormulas(doc);
    expect(formulas.length).toBeGreaterThanOrEqual(1);
    const combinedLatex = formulas.map((f) => f.activeLatex).join(' ');
    expect(combinedLatex).toContain(expectedSubstr);
    expect(formulas.some((f) => f.validated)).toBe(true);
  });
});

// ============================================================================
// 5. 30 EMBEDDED FORMULAS IN VIETNAMESE PROSE TESTS (Section XXV)
// ============================================================================
describe('5. Bộ kiểm thử 30 câu văn tiếng Việt chứa công thức xen kẽ', () => {
  const proseCases: Array<[string, string, string]> = [
    ['Hàm số bậc hai', 'Cho hàm số $y = x^2 - 4x + 3$ có đồ thị là parabol.', 'đồ thị là parabol'],
    ['Điều kiện xác định', 'Điều kiện xác định của biểu thức $\\frac{1}{x-2}$ là $x \\ne 2$.', 'Điều kiện xác định'],
    ['Phương trình chứa căn', 'Giải phương trình $\\sqrt{2x+1} = 3$ trên tập số thực.', 'trên tập số thực'],
    ['Đạo hàm cấp một', 'Đạo hàm của hàm số $f(x) = x^3 - 3x$ là $f\'(x) = 3x^2 - 3$.', 'Đạo hàm của hàm số'],
    ['Tích phân xác định', 'Tính tích phân $I = \\int_0^1 x^2\\,\\mathrm{d}x$ bằng công thức Newton.', 'Tính tích phân'],
    ['Hình học Oxyz', 'Trong không gian Oxyz, mặt phẳng $(P): 2x - y + 3z - 5 = 0$ đi qua điểm $M$.', 'Trong không gian Oxyz'],
    ['Định lí Viète', 'Áp dụng định lí Viète, ta có $x_1 + x_2 = 5$ và $x_1 x_2 = 6$.', 'định lí Viète'],
    ['Logarit', 'Với cơ số $a > 0, a \\ne 1$, biểu thức $\\log_a(x-1)$ xác định khi $x > 1$.', 'biểu thức'],
    ['Cấp số cộng', 'Cho cấp số cộng $(u_n)$ có $u_1 = 2$ và công sai $d = 3$.', 'công sai'],
    ['Xác suất lớp 12', 'Xác suất xảy ra biến cố $A$ khi biết biến cố $B$ là $P(A \\mid B) = \\frac{1}{3}$.', 'biến cố'],
    ['Vật lí: Định luật II Newton', 'Theo định luật II Newton, hợp lực $\\vec{F} = m\\vec{a}$ cùng hướng với gia tốc.', 'cùng hướng với gia tốc'],
    ['Vật lí: Động năng', 'Động năng của ô tô khối lượng $m$ chuyển động với tốc độ $v$ là $W_{\\text{đ}} = \\frac{1}{2}mv^2$.', 'khối lượng'],
    ['Vật lí: Con lắc đơn', 'Chu kì dao động nhỏ của con lắc đơn là $T = 2\\pi\\sqrt{\\frac{l}{g}}$.', 'Chu kì dao động'],
    ['Vật lí: Bước sóng', 'Sóng cơ truyền với tốc độ $v$ và tần số $f$ có bước sóng $\\lambda = \\frac{v}{f}$.', 'tần số'],
    ['Vật lí: Định luật Ohm', 'Cường độ dòng điện chạy qua điện trở tuân theo công thức $I = \\frac{U}{R}$.', 'Cường độ dòng điện'],
    ['Vật lí: Nhiệt lượng', 'Nhiệt lượng cần cung cấp để đun nóng nước được tính theo $Q = mc\\Delta T$.', 'đun nóng nước'],
    ['Vật lí: Khí lí tưởng', 'Phương trình trạng thái khí lí tưởng $pV = nRT$ áp dụng cho $n$ mol khí.', 'khí lí tưởng'],
    ['Vật lí: Lực từ', 'Độ lớn lực từ tác dụng lên đoạn dây dẫn là $F = BIl\\sin\\theta$.', 'đoạn dây dẫn'],
    ['Vật lí: Thấu kính', 'Vị trí ảnh qua thấu kính hội tụ thỏa mãn $\\frac{1}{f} = \\frac{1}{d} + \\frac{1}{d\'}$.', 'thấu kính hội tụ'],
    ['Vật lí: Phóng xạ', 'Số hạt nhân còn lại sau thời gian $t$ là $N = N_0 \\cdot 2^{-t/T}$.', 'hạt nhân còn lại'],
    ['Hóa học: Axit sunfuric', 'Dung dịch H2SO4 loãng tác dụng với kẽm giải phóng khí hiđro.', 'giải phóng khí hiđro'],
    ['Hóa học: Nhiệt phân đá vôi', 'Khi nung nóng đá vôi xảy ra phản ứng CaCO3 ->[t°] CaO + CO2 ↑.', 'nung nóng đá vôi'],
    ['Hóa học: Tổng hợp amoniac', 'Quá trình Haber tổng hợp amoniac: N2(g) + 3H2(g) <=>[xt, t°] 2NH3(g).', 'tổng hợp amoniac'],
    ['Hóa học: Kết tủa AgCl', 'Nhỏ dung dịch AgNO3 vào NaCl xuất hiện kết tủa trắng AgCl ↓.', 'kết tủa trắng'],
    ['Hóa học: Ion sắt(III)', 'Trong dung dịch muối sắt(III) có chứa ion Fe3+ và anion SO4^2-.', 'muối sắt(III)'],
    ['Hóa học: Độ pH', 'Giá trị $\\mathrm{pH} = -\\lg[\\mathrm{H}^+]$ cho biết môi trường axit hay bazơ.', 'môi trường axit'],
    ['Hóa học: Điều kiện chuẩn', 'Ở điều kiện chuẩn ($25^\\circ\\mathrm{C}$, 1 bar), thể tích 1 mol khí là $24{,}79\\,\\mathrm{L}$.', 'điều kiện chuẩn'],
    ['Hóa học: Ethanol', 'Công thức cấu tạo thu gọn của ethanol là CH3-CH2-OH rất quen thuộc.', 'quen thuộc'],
    ['Đề thi Trắc nghiệm', 'Câu 1. Tìm tập nghiệm của bất phương trình $x^2 - 4 \\le 0$ trên $\\mathbb{R}$.', 'bất phương trình'],
    ['Đề thi Đúng/Sai', 'a) Đồ thị hàm số $y = \\frac{x+1}{x-1}$ có tiệm cận đứng là đường thẳng $x = 1$.', 'tiệm cận đứng'],
  ];

  it.each(proseCases)('Văn bản tiếng Việt: %s', (_label, input, expectedVietnamese) => {
    const doc = processDocumentText(input, 'plain', [], 'auto');
    const formulas = extractFormulas(doc);
    expect(formulas.length).toBeGreaterThanOrEqual(1);
    const fullText = doc.blocks
      .map((b) =>
        b.type === 'paragraph'
          ? b.segments.map((s) => (s.type === 'text' ? s.text : s.type === 'figure' ? s.raw : s.activeLatex)).join('')
          : ''
      )
      .join('\n');
    expect(fullText).toContain(expectedVietnamese);
  });
});

// ============================================================================
// 6. 30 COPY–PASTE & 7-FORMAT CONVERSION TESTS (Section XXV)
// ============================================================================
describe('6. Bộ kiểm thử 30 tình huống Copy–Paste & Chuyển đổi 7 định dạng', () => {
  const sampleFormula = (latex: string, display = false, mode: 'auto' | 'math' | 'physics' | 'chemistry' = 'auto') => {
    const wrapped = display ? `$$${latex}$$` : `$${latex}$`;
    const doc = processDocumentText(wrapped, 'plain', [], mode);
    return extractFormulas(doc)[0];
  };

  it('1. Chuyển đổi sang Word Equation (OMML) chứa namespace & m:oMath', () => {
    const f = sampleFormula('\\frac{x^2+1}{2}');
    const res = convertFormulaToFormat(f, 'omml');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('<m:oMath');
    expect(res.output).toContain('<m:f>');
  });

  it('2. Chuyển đổi sang MathML chuẩn có xmlns MathML', () => {
    const f = sampleFormula('\\sqrt{x+1}');
    const res = convertFormulaToFormat(f, 'mathml');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('http://www.w3.org/1998/Math/MathML');
    expect(res.output).toContain('<msqrt>');
  });

  it('3. Chuyển đổi sang LaTeX nội tuyến ($...$)', () => {
    const f = sampleFormula('\\frac{a}{b}');
    const res = convertFormulaToFormat(f, 'latex_inline');
    expect(res.supported).toBe(true);
    expect(res.output).toBe('$\\frac{a}{b}$');
  });

  it('4. Chuyển đổi sang LaTeX độc lập ($$...$$)', () => {
    const f = sampleFormula('\\frac{a}{b}');
    const res = convertFormulaToFormat(f, 'latex_display');
    expect(res.supported).toBe(true);
    expect(res.output).toBe('$$\\frac{a}{b}$$');
  });

  it('5. Chuyển đổi sang UnicodeMath phân số', () => {
    const f = sampleFormula('\\frac{x^2+1}{2}');
    const res = convertFormulaToFormat(f, 'unicodemath');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('/');
    expect(res.output).toContain('2');
  });

  it('6. Chuyển đổi sang UnicodeMath căn bậc hai', () => {
    const f = sampleFormula('\\sqrt{2x+1}');
    const res = convertFormulaToFormat(f, 'unicodemath');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('√');
  });

  it('7. Chuyển đổi sang UnicodeMath căn bậc ba', () => {
    const f = sampleFormula('\\sqrt[3]{x-1}');
    const res = convertFormulaToFormat(f, 'unicodemath');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('∛');
  });

  it('8. Chuyển đổi sang UnicodeMath chỉ số dưới và mũ', () => {
    const f = sampleFormula('x_1^2 + x_2^2');
    const res = convertFormulaToFormat(f, 'unicodemath');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('_1');
    expect(res.output).toContain('^2');
  });

  it('9. Chuyển đổi sang UnicodeMath tích phân xác định', () => {
    const f = sampleFormula('\\int_0^1 x^2 dx');
    const res = convertFormulaToFormat(f, 'unicodemath');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('∫');
  });

  it('10. Chuyển đổi sang UnicodeMath tổng sigma', () => {
    const f = sampleFormula('\\sum_{i=1}^{n} i');
    const res = convertFormulaToFormat(f, 'unicodemath');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('∑');
  });

  it('11. Chuyển đổi sang UnicodeMath ma trận', () => {
    const f = sampleFormula('\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}', true);
    const res = convertFormulaToFormat(f, 'unicodemath');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('■(');
  });

  it('12. Chuyển đổi sang UnicodeMath vectơ Vật lí', () => {
    const f = sampleFormula('\\vec{F} = m\\vec{a}', false, 'physics');
    const res = convertFormulaToFormat(f, 'unicodemath');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('F');
    expect(res.output).toContain('a');
  });

  it('13. Chuyển đổi sang UnicodeMath hóa học H2SO4', () => {
    const doc = processDocumentText('H2SO4', 'plain', [], 'chemistry');
    const f = extractFormulas(doc)[0];
    const res = convertFormulaToFormat(f, 'unicodemath');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('H_2');
    expect(res.output).toContain('O_4');
  });

  it('14. Chuyển đổi sang UnicodeMath đồng vị 12_6 C', () => {
    const f = sampleFormula('{}_{6}^{12}\\mathrm{C}', false, 'chemistry');
    const res = convertFormulaToFormat(f, 'unicodemath');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('C');
    expect(res.output).toContain('12');
  });

  it('15. Chuyển đổi sang Vector SVG hợp lệ', () => {
    const f = sampleFormula('\\frac{1}{2}');
    const res = convertFormulaToFormat(f, 'svg');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('<svg');
    expect(res.output).toContain('</svg>');
  });

  it('16. Định dạng PNG báo sẵn sàng nguồn SVG vector', () => {
    const f = sampleFormula('\\frac{1}{2}');
    const res = convertFormulaToFormat(f, 'png');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('<svg');
  });

  it('17. Báo trung thực supported=false cho MathML hỏng trong UnicodeMath', () => {
    const res = mathmlToUnicodeMath('');
    expect(res.supported).toBe(false);
    expect(res.warning).toBeTruthy();
  });

  it('18. Chuyển đổi toàn bộ tài liệu sang LaTeX nội tuyến', () => {
    const doc = processDocumentText('Giải $x^2=4$ và $y=1$.', 'plain', [], 'math');
    const res = convertDocumentToFormat(doc, 'latex_inline');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('Giải $x^2=4$ và $y=1$.');
  });

  it('19. Chuyển đổi toàn bộ tài liệu sang UnicodeMath giữ nguyên tiếng Việt', () => {
    const doc = processDocumentText('Tính $\\frac{1}{2} + \\sqrt{9}$.', 'plain', [], 'math');
    const res = convertDocumentToFormat(doc, 'unicodemath');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('Tính ');
    expect(res.output).toContain('1/2');
    expect(res.output).toContain('√9');
  });

  it('20. Chuyển đổi toàn bộ tài liệu sang OMML', () => {
    const doc = processDocumentText('Câu 1. Tính $\\frac{x+1}{2}$.', 'plain', [], 'math');
    const res = convertDocumentToFormat(doc, 'omml');
    expect(res.supported).toBe(true);
    expect(res.output).toContain('<m:oMath');
    expect(res.output).toContain('Câu 1.');
  });

  it('21. Clipboard Word cho 1 công thức chứa cả OMML conditional comment và MathML fallback', () => {
    const f = sampleFormula('\\frac{x^2+1}{2}');
    const pair = buildDisplayedFormulaExportPair(f);
    expect(pair.html).toContain('xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"');
    expect(pair.html).toContain('<!--[if gte msEquation 12]>');
    expect(pair.html).toContain('<m:oMath>');
    expect(pair.html).toContain('<math');
    expect(pair.html).not.toContain('<svg');
    expect(pair.plain).toContain('<math');
  });

  it('22. Clipboard Word cho công thức độc lập không phát sinh LaTeX thô ở plain', () => {
    const f = sampleFormula('\\int_0^1 x^2 dx', true);
    const pair = buildDisplayedFormulaExportPair(f);
    expect(pair.plain.startsWith('<math')).toBe(true);
    expect(pair.plain).not.toContain('$$');
  });

  it('23. Clipboard Word cho 1 đoạn văn xen kẽ công thức giữ đúng thứ tự chữ – công thức', () => {
    const doc = processDocumentText('Cho phương trình $\\frac{x+1}{2} = 3$ có nghiệm duy nhất.', 'plain', [], 'math');
    const para = doc.blocks[0];
    expect(para.type).toBe('paragraph');
    if (para.type === 'paragraph') {
      const pair = paragraphToExportPair(para);
      expect(pair.html).toContain('Cho phương trình');
      expect(pair.html).toContain('<m:oMath>');
      expect(pair.html).toContain('có nghiệm duy nhất.');
      expect(pair.plain).toContain('Cho phương trình');
    }
  });

  it('24. Clipboard toàn tài liệu với 1 công thức duy nhất ưu tiên MathML plain để Word nhận Equation', () => {
    const doc = processDocumentText('\\frac{x^2+1}{2}', 'plain', [], 'math');
    const pair = documentToExportPair(doc);
    expect(pair.html).toContain('<m:oMath>');
    expect(pair.plain).toContain('<math');
  });

  it('25. Clipboard toàn tài liệu có bảng giữ cấu trúc <table> và OMML trong ô', () => {
    const doc = processDocumentText('| $x$ | $\\sin x$ |\n| --- | --- |\n| $0$ | $0$ |', 'plain', [], 'math');
    const pair = documentToExportPair(doc);
    expect(pair.html).toContain('<table');
    expect(pair.html).toContain('<m:oMath>');
  });

  it('26. Dán HTML từ KaTeX (ChatGPT) trích xuất chính xác annotation TeX', () => {
    const html = `<p>Kết quả là <span class="katex"><annotation encoding="application/x-tex">\\frac{1}{2}</annotation></span>.</p>`;
    const extracted = extractStructuredInputFromHtml(html);
    expect(extracted.text).toContain('\\frac{1}{2}');
    expect(extracted.text).toContain('Kết quả là');
  });

  it('27. Dán HTML chứa MathML thuần trích xuất thành LaTeX hợp lệ', () => {
    const html = `<p>Tính <math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mi>a</mi><mi>b</mi></mfrac></math></p>`;
    const extracted = extractStructuredInputFromHtml(html);
    expect(extracted.text).toContain('\\frac');
    expect(extracted.text).toContain('Tính');
  });

  it('28. Dán HTML có bảng chuyển thành bảng Markdown có công thức', () => {
    const html = `<table><tr><td>Giá trị</td><td>$x^2$</td></tr><tr><td>2</td><td>4</td></tr></table>`;
    const extracted = extractStructuredInputFromHtml(html);
    expect(extracted.text).toContain('|');
    expect(extracted.text).toContain('Giá trị');
  });

  it('29. Dán văn bản tiếng Việt thuần không mất dấu qua extractStructuredInputFromHtml', () => {
    const html = `<p>Phương trình bậc hai có nghiệm kép khi biệt thức bằng không.</p>`;
    const extracted = extractStructuredInputFromHtml(html);
    expect(extracted.text).toContain('Phương trình bậc hai có nghiệm kép');
  });

  it('30. Công thức cấu tạo 2D khi sao chép sang Word giữ <pre> monospace thay vì OMML hỏng', () => {
    const doc = processDocumentText('   CH3\n    |\nCH3-CH-CH3', 'plain', [], 'chemistry');
    const f = extractFormulas(doc).find((x) => x.ommlCompatible === false);
    expect(f).toBeDefined();
    if (f) {
      const pair = buildDisplayedFormulaExportPair(f);
      expect(pair.html).toContain('<pre');
      expect(pair.html).not.toContain('<m:oMath>');
    }
  });
});

// ============================================================================
// 7. 20 WORD EQUATION OMML DOCX TESTS (Section XXV)
// ============================================================================
describe('7. Bộ kiểm thử 20 tình huống xuất/nhập Word Equation (OMML .docx)', () => {
  it('1. Xuất DOCX tạo đủ cấu trúc tệp OOXML chuẩn trong ZIP', async () => {
    const doc = processDocumentText('Tính $\\frac{x^2+1}{2}$.', 'plain', [], 'math');
    const buf = await generateDocxBuffer(doc);
    const zip = await JSZip.loadAsync(buf);
    expect(zip.file('[Content_Types].xml')).not.toBeNull();
    expect(zip.file('_rels/.rels')).not.toBeNull();
    expect(zip.file('word/document.xml')).not.toBeNull();
    expect(zip.file('word/styles.xml')).not.toBeNull();
    expect(zip.file('word/settings.xml')).not.toBeNull();
  });

  it('2. settings.xml khai báo phông Cambria Math cho Word Equation', async () => {
    const doc = processDocumentText('$x^2$', 'plain', [], 'math');
    const buf = await generateDocxBuffer(doc);
    const zip = await JSZip.loadAsync(buf);
    const settings = await zip.file('word/settings.xml')!.async('string');
    expect(settings).toContain('Cambria Math');
  });

  it('3. Công thức phân số xuất ra <m:f> với <m:num> và <m:den>', () => {
    const doc = processDocumentText('$\\frac{a+b}{c}$', 'plain', [], 'math');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<m:f>');
    expect(xml).toContain('<m:num>');
    expect(xml).toContain('<m:den>');
  });

  it('4. Công thức căn thức xuất ra <m:rad>', () => {
    const doc = processDocumentText('$\\sqrt[3]{x+1}$', 'plain', [], 'math');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:rad>');
  });

  it('5. Công thức độc lập ($$...$$) xuất ra <m:oMathPara> căn giữa', () => {
    const doc = processDocumentText('$$\\int_0^1 x^2\\,\\mathrm{d}x$$', 'plain', [], 'math');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMathPara>');
    expect(xml).toContain('w:val="center"');
  });

  it('6. Hệ phương trình cases xuất ra ma trận OMML <m:m>', () => {
    const doc = processDocumentText('$$\\begin{cases} x+y=3 \\\\ x-y=1 \\end{cases}$$', 'plain', [], 'math');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:m>');
  });

  it('7. Vectơ Vật lí xuất ra dấu mũi tên trên <m:acc>', () => {
    const doc = processDocumentText('$\\vec{F} = m\\vec{a}$', 'plain', [], 'physics');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<m:acc>');
  });

  it('8. Công thức Hóa học H2SO4 xuất ra chỉ số dưới <m:sSub>', () => {
    const doc = processDocumentText('H2SO4', 'plain', [], 'chemistry');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<m:sSub>');
  });

  it('9. Phương trình phản ứng có điều kiện nhiệt độ xuất ra OMML hợp lệ', () => {
    const doc = processDocumentText('CaCO3 ->[t°] CaO + CO2 ↑', 'plain', [], 'chemistry');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
  });

  it('10. Giữ nguyên đầy đủ tiếng Việt Unicode trong document.xml', () => {
    const doc = processDocumentText('Câu 1. Tìm giá trị lớn nhất của hàm số $y = x^2$.', 'plain', [], 'math');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('Câu 1.');
    expect(xml).toContain('Tìm giá trị lớn nhất của hàm số');
  });

  it('11. Tự động in đậm nhãn "Câu 1." và "A." không đổi ký tự văn bản', () => {
    const doc = processDocumentText('Câu 1. Chọn đáp án đúng:\nA. $x = 1$', 'plain', [], 'math');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('Câu 1.');
    expect(xml).toContain('A.');
  });

  it('12. Xuất bảng biểu (<w:tbl>) chứa công thức OMML trong ô bảng', () => {
    const doc = processDocumentText('| $x$ | $f(x)$ |\n| --- | --- |\n| $1$ | $\\frac{1}{2}$ |', 'plain', [], 'math');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<m:f>');
  });

  it('13. Áp dụng tùy chỉnh phông chữ & cỡ chữ từ ExamStyleSettings vào styles.xml', async () => {
    const doc = processDocumentText('Đề kiểm tra $x^2$.', 'plain', [], 'math');
    const customStyle: ExamStyleSettings = {
      ...DEFAULT_EXAM_STYLE,
      fontFamily: 'Arial',
      fontSizePt: 14,
      lineHeight: 1.5,
      paragraphSpacingPt: 4,
    };
    const buf = await generateDocxBuffer(doc, { style: customStyle });
    const zip = await JSZip.loadAsync(buf);
    const styles = await zip.file('word/styles.xml')!.async('string');
    expect(styles).toContain('w:ascii="Arial"');
    expect(styles).toContain('w:val="28"'); // 14pt * 2
    expect(styles).toContain('w:line="360"'); // 1.5 * 240
  });

  it('14. Áp dụng lề trang A4 (mm -> twips) vào <w:pgMar>', () => {
    const doc = processDocumentText('Nội dung', 'plain', [], 'math');
    const xml = buildDocumentXml(doc, {
      style: { ...DEFAULT_EXAM_STYLE, marginTopMm: 20, marginLeftMm: 30 },
    });
    expect(xml).toContain('w:pgSz w:w="11906" w:h="16838"');
    expect(xml).toContain('w:top="1134"');
    expect(xml).toContain('w:left="1701"');
  });

  it('15. EMPTY_EXAM_HEADER không tạo tên trường giả và trả về chuỗi rỗng', () => {
    expect(hasAnyHeaderContent(EMPTY_EXAM_HEADER)).toBe(false);
    expect(buildExamHeaderOoxml(EMPTY_EXAM_HEADER)).toBe('');
  });

  it('16. Tiêu đề đề kiểm tra do giáo viên nhập xuất thành bảng 2 cột chuẩn trong DOCX', () => {
    const header: ExamHeaderConfig = {
      enabled: true,
      schoolName: 'Trường THPT Mẫu Kiểm Thử',
      department: 'Tổ Toán - Tin',
      subject: 'Toán học',
      grade: '12',
      examTitle: 'KIỂM TRA GIỮA HỌC KÌ II',
      duration: '90 phút',
      examCode: '101',
      schoolYear: '2025 - 2026',
    };
    const xml = buildDocumentXml(processDocumentText('Câu 1. $x=1$', 'plain', [], 'math'), { header });
    expect(xml).toContain('TRƯỜNG THPT MẪU KIỂM THỬ');
    expect(xml).toContain('Tổ Toán - Tin');
    expect(xml).toContain('Mã đề: 101');
    expect(xml).toContain('Thời gian làm bài: 90 phút');
  });

  it('17. Công thức cấu tạo 2D không sinh OMML lỗi mà xuất monospace kèm cảnh báo trung thực', () => {
    const doc = processDocumentText('   CH3\n    |\nCH3-CH-CH3', 'plain', [], 'chemistry');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('Consolas');
    expect(xml).toContain('không tương thích Word Equation OMML tuyến tính');
  });

  it('18. Không nhúng hình ảnh PNG/SVG thay thế cho công thức OMML trong document.xml', () => {
    const doc = processDocumentText('Tính $\\frac{x^2+1}{2} + \\sqrt{x}$.', 'plain', [], 'math');
    const xml = buildDocumentXml(doc);
    expect(xml).not.toContain('<w:drawing');
    expect(xml).not.toContain('<svg');
    expect(xml).toContain('<m:oMath>');
  });

  it('19. Vòng lặp khép kín DOCX Export -> DOCX Import bảo toàn văn bản và công thức OMML', async () => {
    const src = 'Câu 1. Giải phương trình $\\frac{x^2+1}{2} = 5$.';
    const doc = processDocumentText(src, 'plain', [], 'math');
    const buf = await generateDocxBuffer(doc);
    const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    const imported = await importDocxFromArrayBuffer(arrayBuf);
    expect(imported.ommlCount).toBe(1);
    expect(imported.text).toContain('Câu 1.');
    expect(imported.text).toContain('\\frac');
  });

  it('20. Vòng lặp khép kín DOCX Export -> Import tài liệu liên môn Toán – Lí – Hóa', async () => {
    const src = 'Toán: $\\sqrt{x+1}$.\nVật lí: $\\vec{F} = m\\vec{a}$.\nHóa học: H2SO4.';
    const doc = processDocumentText(src, 'plain', [], 'auto');
    const buf = await generateDocxBuffer(doc);
    const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    const imported = await importDocxFromArrayBuffer(arrayBuf);
    expect(imported.ommlCount).toBe(3);
    expect(imported.text).toContain('Toán:');
    expect(imported.text).toContain('Vật lí:');
    expect(imported.text).toContain('Hóa học:');
  });
});

// ============================================================================
// 8. 20 EXAM NORMALIZATION, EXAM TOOLS & FORMULA LIBRARY TESTS (Section XXV)
// ============================================================================
describe('8. Bộ kiểm thử 20 tình huống Chuẩn hóa đề thi, Công cụ đề thi & Thư viện công thức', () => {
  beforeEach(() => {
    resetMemoryLibraryStore();
  });

  it('1. Chuẩn hóa nhãn câu hỏi "câu  1 :" và "bài 2)" thành "Câu 1." và "Bài 2."', () => {
    const res = normalizeExamText('câu  1 : Tính $x$\nbài 2) Chứng minh', DEFAULT_NORMALIZATION_OPTIONS);
    expect(res.text).toContain('Câu 1. Tính $x$');
    expect(res.text).toContain('Bài 2. Chứng minh');
    expect(res.changesCount).toBeGreaterThanOrEqual(2);
  });

  it('2. Chuẩn hóa câu hỏi vẫn bảo toàn câu chùm "Câu 1-3:" -> "Câu 1–3."', () => {
    const res = normalizeExamText('câu 1-3: Đọc đoạn thông tin sau', DEFAULT_NORMALIZATION_OPTIONS);
    expect(res.text).toContain('Câu 1–3. Đọc đoạn thông tin sau');
  });

  it('3. Chuẩn hóa phương án A) B: C. D) và Đúng/Sai a. b) c: d.', () => {
    const res = normalizeExamText('A ) 1\nB: 2\na. Đúng\nb : Sai', DEFAULT_NORMALIZATION_OPTIONS);
    expect(res.text).toContain('A. 1');
    expect(res.text).toContain('B. 2');
    expect(res.text).toContain('a) Đúng');
    expect(res.text).toContain('b) Sai');
  });

  it('4. Xóa khoảng trắng thừa ngoài công thức nhưng KHÔNG đụng khoảng trắng trong $...$', () => {
    const res = normalizeExamText('Cho   biểu   thức  $a +  b$  bằng   0 .', DEFAULT_NORMALIZATION_OPTIONS);
    expect(res.text).toBe('Cho biểu thức $a +  b$ bằng 0.');
  });

  it('5. Xóa dòng trống thừa liên tiếp giữ tối đa 1 dòng trống', () => {
    const res = normalizeExamText('Dòng 1\n\n\n\nDòng 2', DEFAULT_NORMALIZATION_OPTIONS);
    expect(res.text).toBe('Dòng 1\n\nDòng 2');
  });

  it('6. Chuẩn hóa bảng Markdown căn đều dấu |', () => {
    const res = normalizeExamText('|x|  y  |z|', DEFAULT_NORMALIZATION_OPTIONS);
    expect(res.text).toBe('| x | y | z |');
  });

  it('7. Tắt từng checkbox trong ExamNormalizationOptions không sửa mục tương ứng', () => {
    const res = normalizeExamText('câu  5 :   Nội   dung', {
      ...DEFAULT_NORMALIZATION_OPTIONS,
      normalizeQuestionLabels: false,
      normalizeSpaces: false,
    });
    expect(res.text).toBe('câu  5 :   Nội   dung');
    expect(res.changesCount).toBe(0);
  });

  it('8. Đánh số lại toàn bộ câu hỏi từ Câu 1', () => {
    const src = 'Câu 5. Hỏi một\nCâu 9. Hỏi hai\nCâu 12. Hỏi ba';
    const res = renumberQuestions(src, { startNumber: 1, fromLineIndex: 0, prefix: 'Câu' });
    expect(res.renumberedCount).toBe(3);
    expect(res.text).toBe('Câu 1. Hỏi một\nCâu 2. Hỏi hai\nCâu 3. Hỏi ba');
  });

  it('9. Đánh số lại câu giữ nguyên câu chùm "Câu 1–3." và mục con a) b)', () => {
    const src = 'Câu 1–3. Dữ liệu chung\nCâu 10. Hỏi A\na) Ý 1\nCâu 20. Hỏi B';
    const res = renumberQuestions(src, { startNumber: 1, fromLineIndex: 0, prefix: 'Câu' });
    expect(res.text).toContain('Câu 1–3. Dữ liệu chung');
    expect(res.text).toContain('Câu 1. Hỏi A');
    expect(res.text).toContain('a) Ý 1');
    expect(res.text).toContain('Câu 2. Hỏi B');
  });

  it('10. Đánh số lại từ dòng con trỏ (fromLineIndex) không ảnh hưởng các câu phía trên', () => {
    const src = 'Câu 1. Giữ nguyên\nCâu 9. Đổi từ đây\nCâu 15. Tiếp theo';
    const res = renumberQuestions(src, { startNumber: 2, fromLineIndex: 1, prefix: 'Câu' });
    expect(res.text).toBe('Câu 1. Giữ nguyên\nCâu 2. Đổi từ đây\nCâu 3. Tiếp theo');
  });

  it('11. Căn chỉnh phương án A–D thành 2 cột', () => {
    const src = 'A. 1\nB. 2\nC. 3\nD. 4';
    const res = formatMultipleChoiceOptions(src, 2);
    expect(res.blocksFormatted).toBe(1);
    expect(res.text.split('\n').length).toBe(2);
    expect(res.text).toContain('A. 1    B. 2');
    expect(res.text).toContain('C. 3    D. 4');
  });

  it('12. Căn chỉnh phương án A–D thành 4 trên 1 dòng và tự động xuống dòng khi phương án quá dài', () => {
    const shortRes = formatMultipleChoiceOptions('A. 1\nB. 2\nC. 3\nD. 4', 4);
    expect(shortRes.text.split('\n').length).toBe(1);

    const longOpt = 'A. Phương án này có nội dung diễn giải rất dài vượt quá ngưỡng cho phép trên một dòng\nB. Ngắn\nC. Ngắn\nD. Ngắn';
    const longRes = formatMultipleChoiceOptions(longOpt, 4);
    expect(longRes.text.split('\n').length).toBe(4); // auto-wrapped cleanly to 1 col
  });

  it('13. Chuẩn hóa mục Đúng/Sai a) b) c) d)', () => {
    const res = formatTrueFalseItems('a. Ý thứ nhất\nb: Ý thứ hai');
    expect(res.formattedCount).toBe(2);
    expect(res.text).toBe('a) Ý thứ nhất\nb) Ý thứ hai');
  });

  it('14. Chèn dòng trả lời ngắn cho câu chưa có phương án', () => {
    const res = appendShortAnswerBoxes('Câu 1. Tính $2+3$.');
    expect(res.insertedCount).toBe(1);
    expect(res.text).toContain('Trả lời:');
  });

  it('15. Chèn vùng dòng kẻ làm bài tự luận', () => {
    const res = appendEssayWritingSpace('Bài 1. Giải phương trình $x^2 - 1 = 0$.', 2);
    expect(res.insertedCount).toBe(1);
    expect(res.text).toContain('Bài làm:');
  });

  it('16. Tạo khung mẫu câu hỏi nhanh đủ 4 dạng (MCQ, Đúng/Sai, Trả lời ngắn, Tự luận)', () => {
    expect(buildQuestionTemplate('mcq', 1)).toContain('A.');
    expect(buildQuestionTemplate('true_false', 2)).toContain('a)');
    expect(buildQuestionTemplate('short_answer', 3)).toContain('Trả lời:');
    expect(buildQuestionTemplate('essay', 4)).toContain('Bài làm:');
  });

  it('17. Thư viện công thức GDPT 2018 có đầy đủ 3 môn Toán – Lí – Hóa, 3 khối 10–11–12 và render hợp lệ', () => {
    expect(BUILTIN_FORMULA_LIBRARY.length).toBeGreaterThanOrEqual(60);
    for (const subj of ['math', 'physics', 'chemistry'] as const) {
      for (const grade of ['10', '11', '12'] as const) {
        expect(
          BUILTIN_FORMULA_LIBRARY.some((item) => item.subject === subj && item.grade === grade)
        ).toBe(true);
      }
    }
    // Verify every single built-in formula parses & validates via MathJax
    for (const item of BUILTIN_FORMULA_LIBRARY) {
      const doc = processDocumentText(`$${item.latex}$`, 'plain', [], item.subject);
      const formulas = extractFormulas(doc);
      expect(formulas[0]?.validated, `Formula ${item.id} failed validation`).toBe(true);
    }
  });

  it('18. Lưu, đọc và xóa công thức cá nhân trong libraryStorage', async () => {
    const saved = await saveCustomFormula({
      id: 'custom_test_1',
      name: 'Công thức kiểm thử',
      subject: 'math',
      grade: '12',
      topic: 'Giải tích',
      group: 'Tích phân',
      latex: '\\int_0^1 x\\,dx = \\frac{1}{2}',
      isBuiltIn: false,
    });
    expect(saved.id).toBe('custom_test_1');

    let state = await loadLibraryState();
    expect(state.customFormulas.some((c) => c.id === 'custom_test_1')).toBe(true);

    await deleteCustomFormula('custom_test_1');
    state = await loadLibraryState();
    expect(state.customFormulas.some((c) => c.id === 'custom_test_1')).toBe(false);
  });

  it('19. Lưu yêu thích và lịch sử công thức dùng gần đây (tối đa 30 mục, mới nhất lên đầu)', async () => {
    await saveFavoriteIds(['m10-quad', 'p10-newton2']);
    await recordRecentFormulaUsage('m10-quad');
    await recordRecentFormulaUsage('c10-h2o');
    const state = await loadLibraryState();
    expect(state.favoriteIds).toEqual(['m10-quad', 'p10-newton2']);
    expect(state.recentEntries[0]?.id).toBe('c10-h2o');
    expect(state.recentEntries[1]?.id).toBe('m10-quad');
  });

  it('20. Xuất & Nhập JSON thư viện cá nhân khép kín và từ chối JSON lỗi an toàn', () => {
    const json = serializeLibraryToJson(
      [
        {
          id: 'custom_exp_1',
          name: 'Công thức xuất thử',
          subject: 'physics',
          grade: '11',
          topic: 'Điện trường',
          group: 'Tụ điện',
          latex: 'Q = CU',
          isBuiltIn: false,
        },
      ],
      ['m10-quad']
    );
    const parsed = parseLibraryImportJson(json);
    expect(parsed.ok).toBe(true);
    expect(parsed.formulas.length).toBe(1);
    expect(parsed.formulas[0].name).toBe('Công thức xuất thử');
    expect(parsed.favoriteIds).toEqual(['m10-quad']);

    const bad = parseLibraryImportJson('{not valid json');
    expect(bad.ok).toBe(false);
    expect(bad.error).toBeTruthy();
  });
});
