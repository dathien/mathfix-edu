import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { fixLatex } from '../latexFixer';
import { mathmlToLatex, mathmlToOmml, ommlToLatex } from '../mathmlConverter';
import {
  applyFormulaDecision,
  applyManualLatexEdit,
  extractStructuredInputFromHtml,
  mapFormulasInDocument,
  processDocumentText,
} from '../parser';
import { buildDocumentXml, generateDocxBuffer } from '../docxExporter';
import { importDocxFromArrayBuffer } from '../docxImporter';
import {
  buildDisplayedFormulaExportPair,
  documentToExportPair,
  paragraphToExportPair,
} from '../clipboardExport';
import { PRACTICE_SAMPLES } from '../../data/samples';
import { FormulaSegment } from '../types';

function getFormulas(text: string): FormulaSegment[] {
  const doc = processDocumentText(text, 'plain');
  const out: FormulaSegment[] = [];
  for (const b of doc.blocks) {
    if (b.type === 'paragraph') {
      for (const s of b.segments) {
        if (s.type === 'formula') out.push(s);
      }
    } else {
      for (const r of b.rows) {
        for (const c of r) {
          for (const p of c.paragraphs) {
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
// NHÓM 1: 20 TRƯỜNG HỢP PHÂN SỐ VÀ CĂN THỨC (Group A & B)
// ============================================================================
describe('Nhóm 1: 20 trường hợp Phân số và Căn thức', () => {
  const cases: Array<[string, string, RegExp]> = [
    ['01. Phân số chuẩn \\frac{a}{b}', '\\frac{a}{b}', /\\frac\{a\}\{b\}/],
    ['02. Phân số lớn \\dfrac{a}{b}', '\\dfrac{2x+1}{x-3}', /\\dfrac\{2x\+1\}\{x-3\}/],
    ['03. Phân số nhỏ \\tfrac{1}{2}', '\\tfrac{1}{2}', /\\tfrac\{1\}\{2\}/],
    ['04. Phân số viết tắt \\frac12', '\\frac12', /\\frac\{1\}\{2\}/],
    ['05. Phân số thiếu dấu gạch chéo frac{a}{b}', 'frac{a+1}{b-1}', /\\frac\{a\+1\}\{b-1\}/],
    ['06. Phân số ngoặc tròn \\frac(x+1)(x-2)', '\\frac(x+1)(x-2)', /\\frac\{x\+1\}\{x-2\}/],
    ['07. Phân số lồng nhau', '\\frac{1}{1 + \\frac{1}{x}}', /\\frac\{1\}\{1 \+ \\frac\{1\}\{x\}\}/],
    ['08. Phân số sai chính tả \\farc{a}{b}', '\\farc{3}{4}', /\\frac\{3\}\{4\}/],
    ['09. Phân số thiếu 1 ngoặc đóng cuối', '\\frac{x^2-1}{x+1', /\\frac\{x\^2-1\}\{x\+1\}/],
    ['10. Phân số với \\dfrac viết tắt \\dfrac35', '\\dfrac35', /\\dfrac\{3\}\{5\}/],
    ['11. Căn bậc hai chuẩn \\sqrt{x}', '\\sqrt{x^2 + 1}', /\\sqrt\{x\^2 \+ 1\}/],
    ['12. Căn bậc ba \\sqrt[3]{x}', '\\sqrt[3]{8x + 1}', /\\sqrt\[3\]\{8x \+ 1\}/],
    ['13. Căn lồng nhau', '\\sqrt{2 + \\sqrt{3 + \\sqrt{5}}}', /\\sqrt\{2 \+ \\sqrt\{3 \+ \\sqrt\{5\}\}\}/],
    ['14. Căn chứa phân số', '\\sqrt{\\frac{x+1}{x-1}}', /\\sqrt\{\\frac\{x\+1\}\{x-1\}\}/],
    ['15. Căn thiếu dấu gạch chéo sqrt{x+2}', 'sqrt{x+2}', /\\sqrt\{x\+2\}/],
    ['16. Căn dùng ngoặc tròn sqrt(2x+1)', 'sqrt(2x+1)', /\\sqrt\{2x\+1\}/],
    ['17. Căn viết tắt \\sqrt2', '\\sqrt2', /\\sqrt\{2\}/],
    ['18. Căn Unicode √(x+3)', '√(x+3)', /\\sqrt\{x\+3\}/],
    ['19. Căn bậc ba Unicode ∛(x-1)', '∛(x-1)', /\\sqrt\[3\]\{x-1\}/],
    ['20. Căn sai chính tả \\sqtr{\\frac{1}{2}}', '\\sqtr{\\frac{1}{2}}', /\\sqrt\{\\frac\{1\}\{2\}\}/],
  ];

  for (const [name, input, expectedPattern] of cases) {
    it(name, () => {
      const res = fixLatex(input);
      expect(res.validated).toBe(true);
      expect(res.svg).toContain('<svg');
      expect(res.mathml).toContain('<math');
      expect(res.fixedLatex).toMatch(expectedPattern);
    });
  }
});

// ============================================================================
// NHÓM 2: 20 TRƯỜNG HỢP SỐ MŨ, CHỈ SỐ DƯỚI VÀ VECTƠ / HÌNH HỌC (Group C & D)
// ============================================================================
describe('Nhóm 2: 20 trường hợp Số mũ, Chỉ số dưới, Vectơ và Hình học', () => {
  const cases: Array<[string, string, RegExp]> = [
    ['21. Số mũ chuẩn x^2', 'x^2 + 3x - 4', /x\^2/],
    ['22. Số mũ nhóm x^{n+1}', 'x^{n+1} - 1', /x\^\{n\+1\}/],
    ['23. Chỉ số dưới chuẩn a_n', 'a_n = 2n + 1', /a_n/],
    ['24. Chỉ số dưới nhóm a_{n+1}', 'a_{n+1} = 3a_n + 2', /a_\{n\+1\}/],
    ['25. Chỉ số trên và dưới đồng thời x_1^2', 'x_1^2 + x_2^2 = 5', /x_1\^2/],
    ['26. Số mũ lồng nhau 2^{3^n}', '2^{3^n}', /2\^\{3\^n\}/],
    ['27. Số mũ ngoặc tròn x^(n+1)', 'x^(n+1)', /x\^\{n\+1\}/],
    ['28. Chỉ số ngoặc tròn a_(n-1)', 'a_(n-1)', /a_\{n-1\}/],
    ['29. Số mũ Unicode x² + y³', 'x² + y³ = zⁿ', /x\^2 \+ y\^3 = z\^n/],
    ['30. Chỉ số dưới Unicode a₁ + a₂ = aₙ', 'a₁ + a₂ = aₙ', /a_1 \+ a_2 = a_n/],
    ['31. Vectơ 1 chữ \\vec{a}', '\\vec{a} + \\vec{b}', /\\vec\{a\}/],
    ['32. Vectơ 2 điểm \\overrightarrow{AB}', '\\overrightarrow{AB} = \\overrightarrow{CD}', /\\overrightarrow\{AB\}/],
    ['33. Vectơ 2 điểm \\vec{AB} chuẩn hóa thành \\overrightarrow{AB}', '\\vec{AB}', /\\overrightarrow\{AB\}/],
    ['34. Vectơ thiếu backslash vec{u}', 'vec{u} = (1; 2; -3)', /\\vec\{u\}/],
    ['35. Đoạn thẳng gạch trên \\overline{AB}', '\\overline{AB} = 5', /\\overline\{AB\}/],
    ['36. Góc có mũ \\widehat{ABC} = 60^\\circ', '\\widehat{ABC} = 60°', /\\widehat\{ABC\} = 60\^\\circ/],
    ['37. Tam giác đồng dạng Unicode △ABC ∼ △DEF', '△ABC ∼ △DEF', /\\triangle\s*ABC\s*\\sim\s*\\triangle\s*DEF/],
    ['38. Vuông góc và song song AB ⊥ CD, MN ∥ PQ', 'AB ⊥ CD, MN ∥ PQ', /\\perp.*\\parallel/],
    ['39. Tam giác bằng nhau \\triangle ABC \\cong \\triangle MNP', '\\triangle ABC \\cong \\triangle MNP', /\\cong/],
    ['40. Cung tròn \\overset{\\frown}{AB}', '\\overset{\\frown}{AB}', /\\overset\{\\frown\}\{AB\}/],
  ];

  for (const [name, input, expectedPattern] of cases) {
    it(name, () => {
      const res = fixLatex(input);
      expect(res.validated).toBe(true);
      expect(res.svg).toContain('<svg');
      expect(res.fixedLatex).toMatch(expectedPattern);
    });
  }
});

// ============================================================================
// NHÓM 3: 20 TRƯỜNG HỢP GIỚI HẠN, ĐẠO HÀM VÀ TÍCH PHÂN (Group E)
// ============================================================================
describe('Nhóm 3: 20 trường hợp Giới hạn, Đạo hàm và Tích phân', () => {
  const cases: Array<[string, string, RegExp]> = [
    ['41. Giới hạn chuẩn \\lim_{x \\to 0}', '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1', /\\lim_\{x \\to 0\}/],
    ['42. Giới hạn thiếu backslash và dùng ->', 'lim_{x->0} frac{sin x}{x}', /\\lim_\{x\\to 0\}/],
    ['43. Giới hạn tiến tới vô cực \\infty', '\\lim_{x -> +infty} \\frac{2x+1}{x-3} = 2', /\\infty/],
    ['44. Giới hạn Unicode ∞ và →', 'lim_{x → ∞} (1 + 1/x)^x = e', /\\lim_\{x \\to\s*\\infty\s*\}/],
    ['45. Đạo hàm bậc nhất f\'(x)', "f'(x) = 3x^2 - 4x + 1", /f'\(x\)/],
    ['46. Đạo hàm bậc hai f\'\'(x)', "f''(x) = 6x - 4", /f''\(x\)/],
    ['47. Vi phân \\frac{\\mathrm{d}y}{\\mathrm{d}x}', '\\frac{\\mathrm{d}y}{\\mathrm{d}x} = 2x', /\\mathrm\{d\}y/],
    ['48. Nguyên hàm không xác định', '\\int (3x^2 + 2x) \\mathrm{d}x = x^3 + x^2 + C', /\\int/],
    ['49. Tích phân xác định có cận', '\\int_0^1 x^2 \\mathrm{d}x = \\frac{1}{3}', /\\int_0\^1/],
    ['50. Tích phân thiếu backslash int_0^1', 'int_0^1 \\frac{1}{x+1} dx', /\\int_0\^1/],
    ['51. Tích phân Unicode ∫₀¹ x² dx', '∫₀¹ x² dx', /\\int\s*_0\^1/],
    ['52. Tích phân chứa phân số và căn', '\\int_1^2 \\frac{\\sqrt{x^2+1}}{x} dx', /\\sqrt\{x\^2\+1\}/],
    ['53. Tổng xích-ma \\sum_{i=1}^n', '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}', /\\sum_\{i=1\}\^\{n\}/],
    ['54. Tổng thiếu backslash sum_{k=1}^n', 'sum_{k=1}^n k^2', /\\sum_\{k=1\}\^n/],
    ['55. Tích \\prod_{k=1}^n', '\\prod_{k=1}^{n} k = n!', /\\prod_\{k=1\}\^\{n\}/],
    ['56. Hàm lượng giác sin, cos, tan, cot', 'sin^2 x + cos^2 x = 1', /\\sin\^2 x \+ \\cos\^2 x = 1/],
    ['57. Lệnh lượng giác cũ \\tg và \\cotg', '\\tg x \\cdot \\cotg x = 1', /\\tan x \\cdot \\cot x = 1/],
    ['58. Hàm lượng giác ngược arcsin, arctan', 'arcsin x + arccos x = \\frac{\\pi}{2}', /\\arcsin.*\\arccos/],
    ['59. Logarit cơ số a và tự nhiên', '\\log_2(x+1) + ln(x) = 3', /\\log_2\(x\+1\) \+ \\ln\(x\) = 3/],
    ['60. Giới hạn một bên x \\to 1^+', '\\lim_{x \\to 1^+} \\frac{1}{x-1} = +\\infty', /\\lim_\{x \\to 1\^\+\}/],
  ];

  for (const [name, input, expectedPattern] of cases) {
    it(name, () => {
      const res = fixLatex(input);
      expect(res.validated).toBe(true);
      expect(res.svg).toContain('<svg');
      expect(res.fixedLatex).toMatch(expectedPattern);
    });
  }
});

// ============================================================================
// NHÓM 4: 20 TRƯỜNG HỢP HỆ PHƯƠNG TRÌNH, MA TRẬN, TẬP HỢP, XÁC SUẤT (Group F)
// ============================================================================
describe('Nhóm 4: 20 trường hợp Hệ phương trình, Ma trận, Tập hợp và Xác suất', () => {
  const cases: Array<[string, string, RegExp]> = [
    ['61. Hệ 2 phương trình cases', '\\begin{cases} x + y = 5 \\\\ 2x - y = 1 \\end{cases}', /\\begin\{cases\}/],
    ['62. Hệ phương trình sai tên môi trường casess', '\\begin{casess} x + 2y = 3 \\\\ x - y = 0 \\end{casess}', /\\begin\{cases\}/],
    ['63. Hệ 3 phương trình', '\\begin{cases} x+y+z=6 \\\\ x-y=1 \\\\ z=3 \\end{cases}', /\\begin\{cases\}/],
    ['64. Bất phương trình với <= và >=', 'x^2 - 4 <= 0 <=> -2 <= x <= 2', /\\le.*\\Leftrightarrow/],
    ['65. Bất phương trình Unicode ≤, ≥, ≠', 'x ≥ 1, y ≤ 5, x ≠ 2', /\\ge.*\\le.*\\ne/],
    ['66. Ma trận pmatrix 2x2', '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}', /\\begin\{pmatrix\}/],
    ['67. Ma trận sai tên môi trường pmatix', '\\begin{pmatix} 1 & 0 \\\\ 0 & 1 \\end{pmatix}', /\\begin\{pmatrix\}/],
    ['68. Ma trận vuông bmatrix', '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', /\\begin\{bmatrix\}/],
    ['69. Định thức vmatrix 2x2', '\\begin{vmatrix} 2 & -1 \\\\ 3 & 4 \\end{vmatrix} = 11', /\\begin\{vmatrix\}/],
    ['70. Định thức 3x3', '\\begin{vmatrix} 1 & 0 & 2 \\\\ 0 & 1 & 3 \\\\ 2 & 1 & 0 \\end{vmatrix}', /\\begin\{vmatrix\}/],
    ['71. Tổ hợp C_n^k và \\binom{n}{k}', 'C_n^k = \\binom{n}{k} = \\frac{n!}{k!(n-k)!}', /\\binom\{n\}\{k\}/],
    ['72. Chỉnh hợp A_n^k', 'A_n^k = \\frac{n!}{(n-k)!}', /A_n\^k/],
    ['73. Xác suất biến cố P(A)', 'P(A) = \\frac{n(A)}{n(\\Omega)}', /\\Omega/],
    ['74. Xác suất có điều kiện P(A|B)', 'P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}', /\\cap/],
    ['75. Tập số thực \\R, \\N, \\Z', 'x \\in \\R, n \\in \\N, k \\in \\Z', /\\mathbb\{R\}.*\\mathbb\{N\}.*\\mathbb\{Z\}/],
    ['76. Tập hợp Unicode ℝ, ∈, ⊂, ∪, ∩, ∅', 'A ⊂ ℝ, x ∈ A ∪ B, A ∩ B = ∅', /\\subset.*\\mathbb\{R\}.*\\emptyset/],
    ['77. Lượng từ ∀, ∃, ⇒, ⇔', '∀x ∈ ℝ, ∃y ∈ ℝ: x + y = 0', /\\forall.*\\exists/],
    ['78. Khoảng và đoạn số thực', 'x \\in (-\\infty; 1] \\cup [3; +\\infty)', /\\cup/],
    ['79. Bảng biến thiên dạng array', '\\begin{array}{c|ccc} x & -\\infty & 0 & +\\infty \\\\ \\hline y\' & - & 0 & + \\end{array}', /\\begin\{array\}/],
    ['80. Hàm phân mảnh với \\text tiếng Việt', 'f(x) = \\begin{cases} x^2 & \\text{khi } x \\ge 0 \\\\ -x & \\text{khi } x < 0 \\end{cases}', /\\text\{khi \}/],
  ];

  for (const [name, input, expectedPattern] of cases) {
    it(name, () => {
      const res = fixLatex(input, true);
      expect(res.validated).toBe(true);
      expect(res.svg).toContain('<svg');
      expect(res.fixedLatex).toMatch(expectedPattern);
    });
  }
});

// ============================================================================
// NHÓM 5: 20 TRƯỜNG HỢP CÔNG THỨC XEN TRONG VĂN BẢN TIẾNG VIỆT
// ============================================================================
describe('Nhóm 5: 20 trường hợp Công thức xen trong văn bản tiếng Việt', () => {
  const proseCases: Array<[string, string, string]> = [
    ['81. Giữ dấu câu hỏi trắc nghiệm', 'Câu 1. Tìm nghiệm của phương trình $x^2 - 4 = 0$.', 'Tìm nghiệm của phương trình'],
    ['82. Nhiều công thức inline trong 1 câu', 'Cho $a > 0$, $b > 0$ thỏa mãn $a + b = 2$. Tính $P = \\frac{1}{a} + \\frac{1}{b}$.', 'thỏa mãn'],
    ['83. Công thức \\(...\\) từ ChatGPT xen tiếng Việt', 'Đạo hàm của \\(y = \\sin(2x)\\) là \\(y\' = 2\\cos(2x)\\).', 'Đạo hàm của'],
    ['84. Công thức \\[...\\] từ ChatGPT', 'Ta có công thức tính diện tích: \\[S = \\pi R^2\\] với bán kính $R > 0$.', 'với bán kính'],
    ['85. Công thức $$...$$ từ Gemini', 'Tích phân cần tính là: $$I = \\int_0^1 e^x dx$$ suy ra kết quả.', 'Tích phân cần tính là'],
    ['86. Bare LaTeX xen trong tiếng Việt', 'Tính giá trị của biểu thức \\frac{2x+1}{x-1} tại $x = 3$.', 'Tính giá trị của biểu thức'],
    ['87. UnicodeMath xen trong tiếng Việt', 'Giải phương trình bậc hai x² - 5x + 6 = 0 trên tập số thực.', 'Giải phương trình bậc hai'],
    ['88. Căn thức Unicode xen tiếng Việt', 'Điều kiện xác định của biểu thức √(2x - 4) là x ≥ 2.', 'Điều kiện xác định'],
    ['89. Ký hiệu hình học xen tiếng Việt', 'Cho △ABC vuông tại A có AB ⊥ AC và ∠ABC = 30°.', 'vuông tại A'],
    ['90. Không làm hỏng tiền tệ $50', 'Một quyển sách giá $50 và một cây bút giá $10, tổng số tiền là bao nhiêu?', 'Một quyển sách giá $50'],
    ['91. Phương án A, B, C, D có phân số', 'A. $\\frac{1}{2}$   B. $\\frac{1}{3}$   C. $\\frac{2}{3}$   D. $\\frac{3}{4}$', 'A.'],
    ['92. Câu Đúng/Sai THPT 2025', 'a) Hàm số đồng biến trên khoảng $(0; +\\infty)$.', 'Hàm số đồng biến trên khoảng'],
    ['93. Tiếng Việt phức tạp có dấu nặng/ngã/hỏi', 'Chứng minh rằng hàm số liên tục tại mọi điểm thuộc tập xác định $D = \\mathbb{R} \\setminus \\{1\\}$.', 'thuộc tập xác định'],
    ['94. Ký tự toán học in nghiêng từ PDF/ChatGPT', 'Cho hàm số $𝑓(𝑥) = 𝑥² + 2𝑥 − 3$ đạt cực tiểu tại $𝑥 = −1$.', 'đạt cực tiểu tại'],
    ['95. Logarit xen văn bản', 'Phương trình $\\log_3(2x - 1) = 2$ có nghiệm duy nhất là $x = 5$.', 'có nghiệm duy nhất là'],
    ['96. Tọa độ Oxyz trong văn bản', 'Trong không gian Oxyz, mặt cầu $(S)$ có tâm $I(1; -2; 3)$ và bán kính $R = 4$.', 'mặt cầu'],
    ['97. Xác suất xen văn bản', 'Gieo ngẫu nhiên một con xúc xắc cân đối. Tính xác suất $P(A) = \\frac{1}{6}$.', 'Gieo ngẫu nhiên một con xúc xắc'],
    ['98. Số phức / Tập hợp xen văn bản', 'Tập hợp các giá trị nguyên của tham số $m \\in [-10; 10]$ thỏa mãn yêu cầu bài toán.', 'giá trị nguyên của tham số'],
    ['99. Hướng dẫn giải nhiều dòng', 'Lời giải:\nBước 1: Đặt $t = \\sqrt{x+1}$ với $t \\ge 0$.\nBước 2: Suy ra $x = t^2 - 1$.', 'Đặt'],
    ['100. Bảng số liệu kèm công thức', '| $x$ | $0$ | $1$ |\n| --- | --- | --- |\n| $y = x^2$ | $0$ | $1$ |', ''],
  ];

  for (const [name, input, expectedVietnamese] of proseCases) {
    it(name, () => {
      const doc = processDocumentText(input, 'plain');
      expect(doc.blocks.length).toBeGreaterThan(0);
      const { plain } = documentToExportPair(doc);
      if (expectedVietnamese) {
        expect(plain).toContain(expectedVietnamese);
      }
      if (!name.includes('tiền tệ')) {
        expect(doc.stats.totalFormulas).toBeGreaterThan(0);
      } else {
        expect(doc.stats.totalFormulas).toBe(0);
      }
    });
  }
});

// ============================================================================
// NHÓM 6: 20 TRƯỜNG HỢP LATEX BỊ LỖI HOẶC MƠ HỒ (Group G — Strict Verification)
// ============================================================================
describe('Nhóm 6: 20 trường hợp LaTeX bị lỗi hoặc mơ hồ', () => {
  // 10 Auto-fixable syntax error cases
  const autoFixableCases: Array<[string, string]> = [
    ['101. Thiếu 1 dấu ngoặc đóng cuối \\frac{a+b}{c+d', '\\frac{a+b}{c+d'],
    ['102. Dư 1 dấu ngoặc đóng cuối \\sqrt{x+1}}', '\\sqrt{x+1}}'],
    ['103. Sai chính tả lệnh \\frca{1}{2}', '\\frca{1}{2}'],
    ['104. Sai chính tả \\infitny', '\\lim_{x \\to \\infitny} \\frac{1}{x}'],
    ['105. Sai chính tả \\rigtharrow', 'x \\rigtharrow 0'],
    ['106. Sai chính tả \\alhpa + \\btea', '\\alhpa + \\btea = \\pi'],
    ['107. Thiếu \\right tương ứng với 1 \\left(', '\\left(\\frac{1}{2} + x'],
    ['108. Công thức bị ngắt dòng khi copy', '\\frac{a + b}\n{c + d}'],
    ['109. Dính ký tự ẩn Zero-Width Space', '\\frac{1\u200B}{2} + \uFEFFx^2'],
    ['110. Sai chính tả \\beign{cases}...\\edn{cases}', '\\beign{cases} x=1 \\\\ y=2 \\edn{cases}'],
  ];

  for (const [name, input] of autoFixableCases) {
    it(name, () => {
      const res = fixLatex(input);
      expect(res.validated).toBe(true);
      expect(['auto_fixed', 'needs_review']).toContain(res.status);
      expect(res.notes.length).toBeGreaterThan(0);
    });
  }

  // 5 Ambiguous cases -> MUST be flagged needs_review or unrecoverable (NEVER silently marked valid!)
  const ambiguousCases: Array<[string, string]> = [
    ['111. Mơ hồ: số mũ kép x^2^3', 'x^2^3'],
    ['112. Mơ hồ: chỉ số kép a_i_j', 'a_i_j'],
    ['113. Mơ hồ: phân số thiếu mẫu số \\frac{x+1}', '\\frac{x+1}'],
    ['114. Mơ hồ: thiếu 2 dấu ngoặc đóng liên tiếp', '\\frac{1}{\\sqrt{x+1'],
    ['115. Mơ hồ: nhiều lệnh \\left không có \\right', '\\left(a + \\left[b + c'],
  ];

  for (const [name, input] of ambiguousCases) {
    it(name, () => {
      const res = fixLatex(input);
      expect(['needs_review', 'unrecoverable']).toContain(res.status);
    });
  }

  // 5 Unrecoverable cases -> MUST NOT be marked valid or validated=true!
  const unrecoverableCases: Array<[string, string]> = [
    ['116. Lệnh không tồn tại \\khongtontai{x}', '\\khongtontai{x}'],
    ['117. Thiếu 4 dấu ngoặc nhọn không thể đoán', '\\frac{\\sqrt{\\frac{1}{2'],
    ['118. Môi trường \\begin{cases} không có \\end', '\\begin{cases} x+1=0 \\\\ y-2=0'],
    ['119. Lệnh lạ \\unknownmacro + 1', '\\unknownmacro + 1'],
    ['120. Biểu thức rỗng', '   '],
  ];

  for (const [name, input] of unrecoverableCases) {
    it(name, () => {
      const res = fixLatex(input);
      expect(res.validated).toBe(false);
      expect(res.status).toBe('unrecoverable');
    });
  }
});

// ============================================================================
// NHÓM 7: 20 TRƯỜNG HỢP SAO CHÉP, DÁN, MATHLIVE VÀ XUẤT/NHẬP DOCX OMML
// ============================================================================
describe('Nhóm 7: 20 trường hợp Sao chép, Dán, Đối chiếu và Xuất/Nhập DOCX OMML', () => {
  it('121. Chuyển MathML phân số sang OMML <m:f>', () => {
    const fix = fixLatex('\\frac{x+1}{x-1}');
    const omml = mathmlToOmml(fix.mathml);
    expect(omml).toContain('<m:oMath');
    expect(omml).toContain('<m:f>');
    expect(omml).toContain('<m:num>');
    expect(omml).toContain('<m:den>');
  });

  it('122. Chuyển MathML căn thức bậc 3 sang OMML <m:rad>', () => {
    const fix = fixLatex('\\sqrt[3]{x+2}');
    const omml = mathmlToOmml(fix.mathml);
    expect(omml).toContain('<m:rad>');
    expect(omml).toContain('<m:deg>');
  });

  it('123. Chuyển MathML tích phân xác định sang OMML <m:nary>', () => {
    const fix = fixLatex('\\int_0^1 x^2 \\mathrm{d}x');
    const omml = mathmlToOmml(fix.mathml);
    expect(omml).toContain('<m:nary>');
    expect(omml).toContain('<m:sub>');
    expect(omml).toContain('<m:sup>');
  });

  it('124. Chuyển MathML hệ phương trình cases sang OMML <m:d> + <m:m>', () => {
    const fix = fixLatex('\\begin{cases} x+y=3 \\\\ x-y=1 \\end{cases}', true);
    const omml = mathmlToOmml(fix.mathml, true);
    expect(omml).toContain('<m:oMathPara');
    expect(omml).toContain('<m:m>');
  });

  it('125. Chuyển MathML ma trận pmatrix sang OMML <m:m>', () => {
    const fix = fixLatex('\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}', true);
    const omml = mathmlToOmml(fix.mathml, true);
    expect(omml).toContain('<m:m>');
    expect(omml).toContain('<m:mr>');
  });

  it('126. Chuyển MathML vectơ \\overrightarrow{AB} sang OMML <m:acc>', () => {
    const fix = fixLatex('\\overrightarrow{AB}');
    const omml = mathmlToOmml(fix.mathml);
    expect(omml).toContain('<m:acc>');
  });

  it('127. Chuyển MathML giới hạn \\lim_{x \\to 0} sang OMML <m:limLow>', () => {
    const fix = fixLatex('\\lim_{x \\to 0} x', true);
    const omml = mathmlToOmml(fix.mathml, true);
    expect(omml).toContain('<m:limLow>');
  });

  it('128. Chuyển MathML -> LaTeX từ nguồn dán web/Word', () => {
    const mml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mrow><mi>a</mi><mo>+</mo><mn>1</mn></mrow><mi>b</mi></mfrac></math>';
    expect(mathmlToLatex(mml)).toBe('\\frac{a+1}{b}');
  });

  it('129. Chuyển OMML -> LaTeX khi đọc ngược Word Equation', () => {
    const fix = fixLatex('\\frac{x^2 + 1}{2}');
    const omml = mathmlToOmml(fix.mathml);
    const back = ommlToLatex(omml);
    expect(back).toContain('\\frac');
    expect(back).toContain('x^{2}');
  });

  it('130. Dán HTML từ ChatGPT (KaTeX annotation) trích xuất đúng LaTeX', () => {
    const html = '<p>Cho hàm số <span class="katex"><annotation encoding="application/x-tex">y = \\frac{1}{x}</annotation></span>.</p>';
    const res = extractStructuredInputFromHtml(html);
    expect(res.sourceType).toBe('chatgpt');
    expect(res.text).toContain('Cho hàm số');
  });

  it('131. Dán nội dung từ Gemini với $$...$$ và tiếng Việt', () => {
    const geminiText = 'Nghiệm của phương trình là:\n$$x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$$';
    const doc = processDocumentText(geminiText, 'gemini');
    expect(doc.stats.totalFormulas).toBe(1);
    expect(doc.stats.validCount).toBe(1);
  });

  it('132. Dán nội dung nhiều câu hỏi trắc nghiệm từ ví dụ đề thi (Sample 9)', () => {
    const examSample = PRACTICE_SAMPLES.find((s) => s.id === 'sample-full-exam')!;
    const doc = processDocumentText(examSample.content, 'plain');
    expect(doc.stats.totalFormulas).toBeGreaterThanOrEqual(12);
    expect(doc.stats.unrecoverableCount).toBe(0);
  });

  it('133. Xuất DOCX tạo file ZIP OOXML đầy đủ các phần bắt buộc', async () => {
    const doc = processDocumentText('Câu 1. Tính $I = \\int_0^1 x^2 dx$.', 'plain');
    const bytes = await generateDocxBuffer(doc);
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file('[Content_Types].xml')).not.toBeNull();
    expect(zip.file('_rels/.rels')).not.toBeNull();
    expect(zip.file('word/document.xml')).not.toBeNull();
    expect(zip.file('word/styles.xml')).not.toBeNull();
    expect(zip.file('word/settings.xml')).not.toBeNull();
  });

  it('134. DOCX xuất ra chứa Word Equation OMML thật và KHÔNG có mã LaTeX thô hay ảnh công thức', async () => {
    const doc = processDocumentText('Câu 1. Giải phương trình $\\frac{x+1}{2} = \\sqrt{x+3}$.', 'plain');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<m:f>');
    expect(xml).toContain('<m:rad>');
    expect(xml).not.toContain('\\frac');
    expect(xml).not.toContain('\\sqrt');
    expect(xml).not.toContain('<w:drawing>');
  });

  it('135. DOCX xuất ra giữ nguyên đầy đủ dấu tiếng Việt Unicode', async () => {
    const text = 'Đề kiểm tra học kì II môn Toán lớp 12 — Trường THPT chuyên Nguyễn Huệ: Tính $\\frac{1}{2} + \\frac{1}{3}$.';
    const doc = processDocumentText(text, 'plain');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('Đề kiểm tra học kì II môn Toán lớp 12');
    expect(xml).toContain('Trường THPT chuyên Nguyễn Huệ');
  });

  it('136. DOCX xuất ra giữ nguyên cấu trúc bảng biểu <w:tbl>', async () => {
    const text = '| Giá trị $x$ | $0$ | $1$ |\n| --- | --- | --- |\n| $f(x) = x^2$ | $0$ | $1$ |';
    const doc = processDocumentText(text, 'plain');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:tr>');
    expect(xml).toContain('<w:tc>');
    expect(xml).toContain('<m:oMath>');
  });

  it('137. Kiểm thử khứ hồi (Round-trip): Xuất DOCX -> Nhập lại DOCX giữ được Word Equation OMML & tiếng Việt', async () => {
    const original = 'Câu 1. Tính giá trị $\\frac{2x+1}{x-1}$ và căn thức $\\sqrt{x^2+1}$.';
    const doc = processDocumentText(original, 'plain');
    const docxBytes = await generateDocxBuffer(doc);
    const reimported = await importDocxFromArrayBuffer(docxBytes);
    expect(reimported.ommlCount).toBe(2);
    expect(reimported.text).toContain('Câu 1. Tính giá trị');
    expect(reimported.text).toContain('\\frac');
    expect(reimported.text).toContain('\\sqrt');
  });

  it('138. Chỉnh sửa trực quan bằng MathLive cập nhật trạng thái và SVG/MathML mới', () => {
    const formulas = getFormulas('Tính $\\farc{1}{2}$');
    expect(formulas.length).toBe(1);
    const edited = applyManualLatexEdit(formulas[0], '\\frac{3}{4}');
    expect(edited.validated).toBe(true);
    expect(edited.activeLatex).toBe('\\frac{3}{4}');
    expect(edited.userDecision).toBe('edited');
    expect(edited.svg).toContain('<svg');
  });

  it('139. Chế độ đối chiếu: Chấp nhận & Từ chối thay đổi hoạt động chính xác', () => {
    const formulas = getFormulas('Tính $\\frac12$');
    const f = formulas[0];
    expect(f.status).toBe('auto_fixed');

    const accepted = applyFormulaDecision(f, 'accept');
    expect(accepted.status).toBe('valid');
    expect(accepted.activeLatex).toBe('\\frac{1}{2}');

    const rejected = applyFormulaDecision(f, 'reject');
    expect(rejected.activeLatex).toBe('\\frac12');
    expect(rejected.userDecision).toBe('rejected');
  });

  it('140. Toàn bộ Ví dụ thực hành (Toán – Vật lí – Hóa học) đều phân tích và dựng công thức thành công 100%', () => {
    expect(PRACTICE_SAMPLES.length).toBeGreaterThanOrEqual(10);
    for (const sample of PRACTICE_SAMPLES) {
      const doc = processDocumentText(sample.content, 'plain');
      expect(doc.stats.totalFormulas).toBeGreaterThan(0);
      expect(doc.stats.unrecoverableCount).toBe(0);
    }
  });
});

describe('Nhóm 8: Kiểm thử nâng cấp nhận diện escape, hiển thị, MathLive và sao chép HTML/MathML', () => {
  it('141. Dán trực tiếp công thức trần \\frac{x^2+1}{2} (không dấu $) được nhận diện, chuẩn hóa và dựng SVG/MathML chính xác', () => {
    const doc = processDocumentText('\\frac{x^2+1}{2}', 'plain');
    expect(doc.blocks.length).toBe(1);
    const para = doc.blocks[0];
    expect(para.type).toBe('paragraph');
    if (para.type === 'paragraph') {
      const formulas = para.segments.filter((s) => s.type === 'formula');
      const nonEmptyTexts = para.segments.filter((s) => s.type === 'text' && s.text.trim().length > 0);
      expect(formulas.length).toBe(1);
      expect(nonEmptyTexts.length).toBe(0);
      const f = formulas[0];
      expect(f.activeLatex).toBe('\\frac{x^2+1}{2}');
      expect(f.validated).toBe(true);
      expect(f.svg).toContain('<svg');
      expect(f.mathml).toContain('<mfrac');
    }
  });

  it('142. Sao chép công thức hiển thị \\frac{x^2+1}{2} ưu tiên Office OMML + MathML (không sao chép SVG hay mã LaTeX thô)', () => {
    const formulas = getFormulas('$\\frac{x^2+1}{2}$');
    expect(formulas.length).toBe(1);
    const pair = buildDisplayedFormulaExportPair(formulas[0]);
    expect(pair.html).toContain('xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"');
    expect(pair.html).toContain('<!--[if gte msEquation 12]><m:oMath>');
    expect(pair.html).toContain('<m:f>');
    expect(pair.html).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML">');
    expect(pair.html).toContain('<mfrac>');
    expect(pair.html).not.toContain('<svg');
    expect(pair.html).not.toContain('\\frac{x^2+1}{2}');
    expect(pair.html).not.toContain('data-mjx-');
    expect(pair.plain).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML">');
    expect(pair.plain).not.toContain('\\frac');
  });

  it('143. Chỉnh sửa công thức \\frac{x^2+1}{2} qua luồng MathLive cập nhật chính xác LaTeX, SVG và MathML mới', () => {
    const formulas = getFormulas('\\frac{x^2+1}{2}');
    expect(formulas.length).toBe(1);
    const edited = applyManualLatexEdit(formulas[0], '\\frac{x^2+1}{3}');
    expect(edited.activeLatex).toBe('\\frac{x^2+1}{3}');
    expect(edited.validated).toBe(true);
    expect(edited.userDecision).toBe('edited');
    expect(edited.mathml).toContain('>3<');
    expect(edited.svg).toContain('<svg');
  });

  it('144. Đoạn văn tiếng Việt nhiều công thức: chỉnh sửa 1 công thức không làm thay đổi công thức khác và giữ nguyên dấu tiếng Việt', () => {
    const input =
      'Cho hàm số $y = \\frac{x^2+1}{2}$, tính đạo hàm $y\' = x$ và tích phân $\\int_0^1 \\sqrt{x+1}\\,dx$ với độ chính xác cao.';
    const doc = processDocumentText(input, 'plain');
    expect(doc.stats.totalFormulas).toBe(3);

    const paraBefore = doc.blocks[0];
    expect(paraBefore.type).toBe('paragraph');
    if (paraBefore.type !== 'paragraph') return;

    const formulasBefore = paraBefore.segments.filter((s) => s.type === 'formula');
    expect(formulasBefore.length).toBe(3);
    const targetId = formulasBefore[1].id;
    const f0Before = formulasBefore[0].activeLatex;
    const f2Before = formulasBefore[2].activeLatex;

    const updatedDoc = mapFormulasInDocument(doc, (f) =>
      f.id === targetId ? applyManualLatexEdit(f, "y' = x + 1") : f
    );

    const paraAfter = updatedDoc.blocks[0];
    expect(paraAfter.type).toBe('paragraph');
    if (paraAfter.type !== 'paragraph') return;

    const formulasAfter = paraAfter.segments.filter((s) => s.type === 'formula');
    expect(formulasAfter[0].activeLatex).toBe(f0Before);
    expect(formulasAfter[0].userDecision).not.toBe('edited');
    expect(formulasAfter[1].activeLatex).toBe("y' = x + 1");
    expect(formulasAfter[1].userDecision).toBe('edited');
    expect(formulasAfter[1].validated).toBe(true);
    expect(formulasAfter[2].activeLatex).toBe(f2Before);
    expect(formulasAfter[2].userDecision).not.toBe('edited');

    const pair = paragraphToExportPair(paraAfter);
    expect(pair.plain).toContain('Cho hàm số');
    expect(pair.plain).toContain('tính đạo hàm');
    expect(pair.plain).toContain('và tích phân');
    expect(pair.plain).toContain('với độ chính xác cao.');
    expect(pair.html).toContain('<math');
    expect(pair.html).toContain('<m:oMath>');
  });

  it('145. Nhận diện và chuẩn hóa công thức trần có hai dấu gạch chéo ngược \\\\frac{x^2+1}{2} không để thừa dấu \\', () => {
    const doc = processDocumentText('Tính giá trị \\\\frac{x^2+1}{2} khi $x = 3$.', 'plain');
    expect(doc.stats.totalFormulas).toBe(2);
    const para = doc.blocks[0];
    if (para.type === 'paragraph') {
      const formulas = para.segments.filter((s) => s.type === 'formula');
      expect(formulas[0].activeLatex).toBe('\\frac{x^2+1}{2}');
      expect(formulas[0].validated).toBe(true);
      expect(formulas[0].status).toBe('auto_fixed');
      const texts = para.segments
        .filter((s) => s.type === 'text')
        .map((s) => s.text)
        .join('');
      expect(texts).not.toContain('\\');
      expect(texts).toContain('Tính giá trị');
    }
  });

  it('146. Nhận diện và chuẩn hóa công thức trong dấu $ có dấu escape thừa $\\\\frac{x^2+1}{2}$', () => {
    const formulas = getFormulas('$\\\\frac{x^2+1}{2}$');
    expect(formulas.length).toBe(1);
    expect(formulas[0].activeLatex).toBe('\\frac{x^2+1}{2}');
    expect(formulas[0].validated).toBe(true);
    expect(formulas[0].status).toBe('auto_fixed');
  });

  it('147. Nhận diện cặp giới hạn bị escape hai lần \\\\(...\\\\) và \\\\[...\\\\]', () => {
    const doc = processDocumentText(
      'Biểu thức nội dòng \\\\(\\\\frac{x^2+1}{2}\\\\) và biểu thức độc lập:\n\\\\[\\\\sqrt{x^2+1} + \\\\frac{1}{x}\\\\]',
      'plain'
    );
    const formulas: FormulaSegment[] = [];
    for (const b of doc.blocks) {
      if (b.type === 'paragraph') {
        for (const s of b.segments) {
          if (s.type === 'formula') formulas.push(s);
        }
      }
    }
    expect(formulas.length).toBe(2);
    expect(formulas[0].displayMode).toBe(false);
    expect(formulas[0].activeLatex).toBe('\\frac{x^2+1}{2}');
    expect(formulas[0].validated).toBe(true);
    expect(formulas[1].displayMode).toBe(true);
    expect(formulas[1].activeLatex).toBe('\\sqrt{x^2+1} + \\frac{1}{x}');
    expect(formulas[1].validated).toBe(true);
  });

  it('148. Hệ phương trình escape hai lần \\\\begin{cases} ... \\\\\\\\ ... \\\\end{cases} giữ nguyên dấu ngắt dòng \\\\ hợp lệ', () => {
    const input = '\\\\begin{cases} 2x + y = 3 \\\\\\\\ x - y = 0 \\\\end{cases}';
    const formulas = getFormulas(input);
    expect(formulas.length).toBe(1);
    expect(formulas[0].validated).toBe(true);
    expect(formulas[0].activeLatex).toContain('\\begin{cases}');
    expect(formulas[0].activeLatex).toContain('\\\\');
    expect(formulas[0].activeLatex).toContain('\\end{cases}');
  });

  it('149. Ma trận escape hai lần \\\\begin{pmatrix} ... \\\\\\\\ ... \\\\end{pmatrix} giữ nguyên dấu ngắt hàng \\\\ hợp lệ', () => {
    const input = '\\\\begin{pmatrix} 1 & 2 \\\\\\\\ 3 & 4 \\\\end{pmatrix}';
    const formulas = getFormulas(input);
    expect(formulas.length).toBe(1);
    expect(formulas[0].validated).toBe(true);
    expect(formulas[0].activeLatex).toContain('\\begin{pmatrix}');
    expect(formulas[0].activeLatex).toContain('\\\\');
    expect(formulas[0].activeLatex).toContain('\\end{pmatrix}');
  });

  it('150. KHÔNG xóa dấu \\\\ hợp lệ trong hệ phương trình \\begin{cases} chuẩn', () => {
    const latex = '\\begin{cases} 2x + y = 3 \\\\ x - y = 0 \\end{cases}';
    const res = fixLatex(latex, true);
    expect(res.validated).toBe(true);
    expect(res.status).toBe('valid');
    expect(res.fixedLatex).toContain('\\\\');
  });

  it('151. KHÔNG xóa dấu \\\\ hợp lệ trong ma trận \\begin{pmatrix} chuẩn', () => {
    const latex = '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}';
    const res = fixLatex(latex, true);
    expect(res.validated).toBe(true);
    expect(res.status).toBe('valid');
    expect(res.fixedLatex).toContain('\\\\');
  });

  it('152. KHÔNG xóa dấu \\\\ hợp lệ trong môi trường nhiều dòng \\begin{aligned} và \\begin{array}', () => {
    const aligned = '\\begin{aligned} x^2 + 1 &= 5 \\\\ x &= \\pm 2 \\end{aligned}';
    const resAligned = fixLatex(aligned, true);
    expect(resAligned.validated).toBe(true);
    expect(resAligned.fixedLatex).toContain('\\\\');

    const arr = '\\begin{array}{cc} a & b \\\\ c & d \\end{array}';
    const resArr = fixLatex(arr, true);
    expect(resArr.validated).toBe(true);
    expect(resArr.fixedLatex).toContain('\\\\');
  });

  it('153. Môi trường nhiều dòng chuẩn có lệnh bị escape thừa ở giữa vẫn giữ \\\\ ngắt dòng và sửa lệnh lỗi', () => {
    const latex = '\\begin{cases} x = 1 \\\\ y = \\\\frac{x^2+1}{2} \\end{cases}';
    const res = fixLatex(latex, true);
    expect(res.validated).toBe(true);
    expect(res.fixedLatex).toContain('\\\\ y = \\frac{x^2+1}{2}');
  });

  it('154. Trường hợp đặc biệt \\\\frac ngay sau dòng đầu trong môi trường nhiều dòng vẫn giữ dấu ngắt dòng \\\\', () => {
    const latex = '\\begin{cases} x = 1 \\\\ \\frac{x^2+1}{2} = y \\end{cases}';
    const res = fixLatex(latex, true);
    expect(res.validated).toBe(true);
    expect(res.fixedLatex).toContain('\\\\ \\frac{x^2+1}{2}');
  });

  it('155. documentToExportPair xuất HTML chứa Office OMML + MathML đầy đủ + plain fallback giữ nguyên tiếng Việt', () => {
    const doc = processDocumentText(
      'Bài 1: Giải phương trình $\\frac{x^2+1}{2} = 5$ và rút gọn \\\\sqrt{x^2+4x+4}.',
      'plain'
    );
    const pair = documentToExportPair(doc);
    expect(pair.html).toContain('xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"');
    expect(pair.html).toContain('<!--[if gte msEquation 12]><m:oMath>');
    expect(pair.html).toContain('<m:f>');
    expect(pair.html).toContain('<m:rad>');
    expect(pair.html).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML">');
    expect(pair.html).toContain('Bài 1: Giải phương trình');
    expect(pair.html).not.toContain('<svg');
    expect(pair.plain).toContain('$\\frac{x^2+1}{2} = 5$');
    expect(pair.plain).toContain('$\\sqrt{x^2+4x+4}$');
  });
});

describe('Nhóm 9: Kiểm thử bắt buộc sao chép sang Word & xuất Word Equation DOCX (OMML chuẩn)', () => {
  it('156. Công thức 1 (\\frac{x^2+1}{2}): Clipboard Word OMML+MathML chuẩn và xuất DOCX OMML khứ hồi thành công', async () => {
    const doc = processDocumentText('\\frac{x^2+1}{2}', 'plain');
    expect(doc.stats.totalFormulas).toBe(1);
    expect(doc.stats.unrecoverableCount).toBe(0);

    // Clipboard payload (Sao chép cho Word / Sao chép công thức)
    const pair = documentToExportPair(doc);
    expect(pair.html).toContain('xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"');
    expect(pair.html).toContain('<!--[if gte msEquation 12]><m:oMath><m:f><m:num>');
    expect(pair.html).toContain('<m:sSup>');
    expect(pair.html).not.toContain('<w:rPr>'); // HTML OMML must NOT embed wordprocessingml w:rPr
    expect(pair.html).not.toContain('<svg');
    expect(pair.html).not.toContain('data-mjx-');
    expect(pair.html).not.toContain('\n  <'); // No indented newlines inside MathML
    expect(pair.plain).toMatch(/^<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML">.*<\/math>$/);

    // DOCX OOXML OMML export + round-trip import
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath><m:f><m:num>');
    expect(xml).toContain('<m:sSup>');
    expect(xml).toContain('Cambria Math');
    expect(xml).not.toContain('\\frac');
    expect(xml).not.toContain('<svg');

    const bytes = await generateDocxBuffer(doc);
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file('word/document.xml')).toBeTruthy();
    expect(zip.file('word/settings.xml')).toBeTruthy();
    const roundTrip = await importDocxFromArrayBuffer(bytes);
    expect(roundTrip.ommlCount).toBe(1);
    expect(roundTrip.text).toContain('\\frac{');
  });

  it('157. Công thức 2 (\\sqrt{x^2+4x+4}): Clipboard Word OMML+MathML chuẩn và xuất DOCX OMML khứ hồi thành công', async () => {
    const doc = processDocumentText('\\sqrt{x^2+4x+4}', 'plain');
    expect(doc.stats.totalFormulas).toBe(1);
    expect(doc.stats.unrecoverableCount).toBe(0);

    const pair = documentToExportPair(doc);
    expect(pair.html).toContain('<!--[if gte msEquation 12]><m:oMath><m:rad>');
    expect(pair.html).toContain('<m:degHide m:val="1"/>');
    expect(pair.html).toContain('<msqrt>');
    expect(pair.html).not.toContain('<svg');
    expect(pair.plain).toContain('<msqrt>');

    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath><m:rad><m:radPr><m:degHide m:val="1"/></m:radPr>');
    expect(xml).not.toContain('\\sqrt');

    const bytes = await generateDocxBuffer(doc);
    const roundTrip = await importDocxFromArrayBuffer(bytes);
    expect(roundTrip.ommlCount).toBe(1);
    expect(roundTrip.text).toContain('\\sqrt{');
  });

  it('158. Công thức 3 (\\int_0^1 x^2\\,dx): Clipboard Word OMML <m:nary> chuẩn và xuất DOCX OMML khứ hồi thành công', async () => {
    const doc = processDocumentText('\\int_0^1 x^2\\,dx', 'plain');
    expect(doc.stats.totalFormulas).toBe(1);
    expect(doc.stats.unrecoverableCount).toBe(0);

    const pair = documentToExportPair(doc);
    expect(pair.html).toContain('<!--[if gte msEquation 12]><m:oMath><m:nary>');
    expect(pair.html).toContain('<m:chr m:val="∫"/>');
    expect(pair.html).toContain('<m:grow m:val="1"/>');
    expect(pair.html).not.toContain('<svg');
    expect(pair.plain).toContain('&#x222B;');

    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:nary>');
    expect(xml).toContain('<m:chr m:val="∫"/>');
    expect(xml).toContain('<m:sub>');
    expect(xml).toContain('<m:sup>');
    expect(xml).not.toContain('\\int');

    const bytes = await generateDocxBuffer(doc);
    const roundTrip = await importDocxFromArrayBuffer(bytes);
    expect(roundTrip.ommlCount).toBe(1);
    expect(roundTrip.text).toContain('\\int');
  });

  it('159. Công thức 4 (\\overrightarrow{AB}): Clipboard Word OMML <m:acc> chuẩn và xuất DOCX OMML khứ hồi thành công', async () => {
    const doc = processDocumentText('\\overrightarrow{AB}', 'plain');
    expect(doc.stats.totalFormulas).toBe(1);
    expect(doc.stats.unrecoverableCount).toBe(0);

    const pair = documentToExportPair(doc);
    expect(pair.html).toContain('<!--[if gte msEquation 12]><m:oMath><m:acc>');
    expect(pair.html).toContain('<m:chr m:val="\u20D7"/>');
    expect(pair.html).toContain('<mover>');
    expect(pair.html).not.toContain('<svg');
    expect(pair.plain).toContain('<mover>');

    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:acc><m:accPr><m:chr m:val="\u20D7"/></m:accPr>');
    expect(xml).not.toContain('\\overrightarrow');

    const bytes = await generateDocxBuffer(doc);
    const roundTrip = await importDocxFromArrayBuffer(bytes);
    expect(roundTrip.ommlCount).toBe(1);
    expect(roundTrip.text).toContain('\\overrightarrow{AB}');
  });

  it('160. Đoạn văn tiếng Việt nhiều công thức (Cho hàm số f(x), đạo hàm f\'(x), phương trình f(x)=0): giữ nguyên thứ tự, tiếng Việt, 3 OMML Equation trong Clipboard và DOCX', async () => {
    const input =
      "Cho hàm số \\(f(x)=x^2-3x+2\\). Tính đạo hàm \\(f'(x)\\) và giải phương trình \\(f(x)=0\\).";
    const doc = processDocumentText(input, 'plain');
    expect(doc.stats.totalFormulas).toBe(3);
    expect(doc.stats.unrecoverableCount).toBe(0);

    // Word Clipboard HTML check
    const pair = documentToExportPair(doc);
    const ommlMatches = pair.html.match(/<!--\[if gte msEquation 12\]><m:oMath>/g) || [];
    const mmlMatches = pair.html.match(/<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML">/g) || [];
    expect(ommlMatches.length).toBe(3);
    expect(mmlMatches.length).toBe(3);
    expect(pair.html).not.toContain('<svg');

    // Verify exact order of Vietnamese prose and equations
    const idx1 = pair.html.indexOf('Cho hàm số');
    const idx2 = pair.html.indexOf('Tính đạo hàm');
    const idx3 = pair.html.indexOf('và giải phương trình');
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(idx1);
    expect(idx3).toBeGreaterThan(idx2);

    // DOCX OOXML verification
    const xml = buildDocumentXml(doc);
    const docxOmathMatches = xml.match(/<m:oMath>/g) || [];
    expect(docxOmathMatches.length).toBe(3);
    expect(xml).toContain('Cho hàm số ');
    expect(xml).toContain('Tính đạo hàm ');
    expect(xml).toContain(' và giải phương trình ');
    expect(xml).not.toContain('\\(');
    expect(xml).not.toContain('<svg');

    // Round-trip DOCX verification
    const bytes = await generateDocxBuffer(doc);
    const roundTrip = await importDocxFromArrayBuffer(bytes);
    expect(roundTrip.ommlCount).toBe(3);
    expect(roundTrip.text).toContain('Cho hàm số');
    expect(roundTrip.text).toContain('Tính đạo hàm');
    expect(roundTrip.text).toContain('và giải phương trình');
  });

  it('161. Hệ phương trình (\\begin{cases}) trong DOCX xuất đúng ngoặc nhọn trái co giãn <m:d> bọc ma trận <m:m> và giới hạn \\lim in đứng <m:nor/>', () => {
    const doc = processDocumentText(
      'Giải hệ $$\\begin{cases} 2x + y = 3 \\\\ x - y = 0 \\end{cases}$$ và tính $\\lim_{x \\to 0} \\frac{\\sin x}{x}$.',
      'plain'
    );
    const xml = buildDocumentXml(doc);
    // \begin{cases} must emit stretchy left brace <m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr><m:e><m:m>
    expect(xml).toContain('<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr><m:e><m:m>');
    expect(xml).toContain('<m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr><m:oMath>');
    // \lim must emit upright <m:nor/> inside <m:limLow>
    expect(xml).toContain('<m:limLow><m:e><m:r><m:rPr><m:nor/></m:rPr>');
  });
});


