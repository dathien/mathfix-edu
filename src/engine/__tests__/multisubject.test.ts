import { describe, expect, it } from 'vitest';
import { fixLatex } from '../latexFixer';
import {
  applyManualLatexEdit,
  applyManualSubjectOverride,
  processDocumentText,
} from '../parser';
import { buildDocumentXml, generateDocxBuffer } from '../docxExporter';
import { importDocxFromArrayBuffer } from '../docxImporter';
import {
  buildDisplayedFormulaExportPair,
  documentToExportPair,
  paragraphToExportPair,
} from '../clipboardExport';
import { mathmlToOmml } from '../mathmlConverter';
import { FormulaSegment, ParagraphBlock, ProcessedDocument, SubjectMode } from '../types';

function collectFormulas(doc: ProcessedDocument): FormulaSegment[] {
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

function getParagraphs(doc: ProcessedDocument): ParagraphBlock[] {
  return doc.blocks.filter((b): b is ParagraphBlock => b.type === 'paragraph');
}

function parseFormulas(text: string, mode: SubjectMode = 'auto'): FormulaSegment[] {
  return collectFormulas(processDocumentText(text, 'plain', [], mode));
}

// ============================================================================
// NHÓM 1: 30 BÀI KIỂM THỬ TOÁN HỌC (Section III & X)
// ============================================================================
describe('Nhóm 1: Bộ xử lý Toán học (30 test)', () => {
  const mathCases: Array<[string, string, (r: ReturnType<typeof fixLatex>) => void]> = [
    ['M01. Phân số cơ bản \\frac{x^2+1}{2}', '\\frac{x^2+1}{2}', (r) => expect(r.fixedLatex).toBe('\\frac{x^2+1}{2}')],
    ['M02. Phân số viết tắt \\frac12', '\\frac12', (r) => expect(r.fixedLatex).toBe('\\frac{1}{2}')],
    ['M03. Phân số thiếu dấu gạch chéo frac{a+b}{c}', 'frac{a+b}{c}', (r) => expect(r.fixedLatex).toBe('\\frac{a+b}{c}')],
    ['M04. Phân số double-escaped \\\\frac{x^2+1}{2}', '\\\\frac{x^2+1}{2}', (r) => expect(r.fixedLatex).toBe('\\frac{x^2+1}{2}')],
    ['M05. Căn thức bậc hai sqrt(x+1)', 'sqrt(x+1)', (r) => expect(r.fixedLatex).toBe('\\sqrt{x+1}')],
    ['M06. Căn bậc ba Unicode ∛(x^2-1)', '∛(x^2-1)', (r) => expect(r.fixedLatex).toContain('\\sqrt[3]{')],
    ['M07. Căn thức lồng nhau \\sqrt{5+2\\sqrt{6}}', '\\sqrt{5+2\\sqrt{6}}', (r) => expect(r.validated).toBe(true)],
    ['M08. Số mũ ngoặc tròn x^(n+1)', 'x^(n+1)', (r) => expect(r.fixedLatex).toBe('x^{n+1}')],
    ['M09. Chỉ số dưới ngoặc tròn a_(n+1)', 'a_(n+1)', (r) => expect(r.fixedLatex).toBe('a_{n+1}')],
    ['M10. Vectơ hai điểm \\vec{AB}', '\\vec{AB}', (r) => expect(r.fixedLatex).toBe('\\overrightarrow{AB}')],
    ['M11. Góc và tam giác ∠ABC = 60°', '∠ABC = 60°', (r) => expect(r.fixedLatex).toContain('\\angle')],
    ['M12. Đoạn thẳng \\overline{MN} = 5', '\\overline{MN} = 5', (r) => expect(r.fixedLatex).toContain('\\overline{MN}')],
    ['M13. Phương trình bậc hai Unicode x² - 5x + 6 = 0', 'x² - 5x + 6 = 0', (r) => expect(r.fixedLatex).toContain('x^2')],
    ['M14. Bất phương trình x^2 - 4 <= 0', 'x^2 - 4 <= 0', (r) => expect(r.fixedLatex).toContain('\\le')],
    ['M15. Hệ phương trình cases bảo toàn \\\\', '\\begin{cases} 2x + y = 5 \\\\ x - y = 1 \\end{cases}', (r) => expect(r.fixedLatex).toContain('\\\\')],
    ['M16. Hệ phương trình sai chính tả casess', '\\begin{casess} x + y = 3 \\\\ x - y = 1 \\end{casess}', (r) => expect(r.fixedLatex).toContain('\\begin{cases}')],
    ['M17. Đạo hàm f\'(x) = 3x^2 - 2x', "f'(x) = 3x^2 - 2x", (r) => expect(r.subject).toBe('math')],
    ['M18. Giới hạn lim_{x->0} frac{sin x}{x}', 'lim_{x->0} frac{sin x}{x}', (r) => expect(r.fixedLatex).toMatch(/\\lim_\{x\s*\\to\s*0\}/)],
    ['M19. Tích phân xác định \\int_0^1 x^2\\,dx', '\\int_0^1 x^2\\,dx', (r) => expect(r.validated).toBe(true)],
    ['M20. Nguyên hàm \\int (2x+1)\\,dx', '\\int (2x+1)\\,dx', (r) => expect(r.validated).toBe(true)],
    ['M21. Tổng xích-ma sum_{i=1}^n i^2', 'sum_{i=1}^n i^2', (r) => expect(r.fixedLatex).toContain('\\sum_')],
    ['M22. Ma trận pmatrix 2x2 bảo toàn \\\\', '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}', (r) => expect(r.fixedLatex).toContain('\\\\')],
    ['M23. Định thức vmatrix 2x2', '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}', (r) => expect(r.subject).toBe('math')],
    ['M24. Tổ hợp C_n^k = \\binom{n}{k}', 'C_n^k = \\binom{n}{k}', (r) => expect(r.subject).toBe('math')],
    ['M25. Xác suất có điều kiện P(A|B)', 'P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}', (r) => expect(r.subject).toBe('math')],
    ['M26. Tập hợp x \\in \\mathbb{R} \\setminus \\{0\\}', 'x \\in \\mathbb{R} \\setminus \\{0\\}', (r) => expect(r.subject).toBe('math')],
    ['M27. Logic mệnh đề \\forall x \\in \\mathbb{R}, x^2 \\ge 0', '\\forall x \\in \\mathbb{R}, x^2 \\ge 0', (r) => expect(r.subject).toBe('math')],
    ['M28. Logarit \\log_2(x-1) = 3', '\\log_2(x-1) = 3', (r) => expect(r.subject).toBe('math')],
    ['M29. Lượng giác lệnh cũ \\tg x + \\cotg x', '\\tg x + \\cotg x', (r) => expect(r.fixedLatex).toBe('\\tan x + \\cot x')],
    ['M30. Hình học song song vuông góc AB ⊥ CD', 'AB ⊥ CD', (r) => expect(r.fixedLatex).toContain('\\perp')],
  ];

  mathCases.forEach(([title, input, check]) => {
    it(title, () => {
      const res = fixLatex(input, false, { subjectMode: 'auto' });
      expect(res.validated).toBe(true);
      expect(res.ommlCompatible).toBe(true);
      expect(res.svg).toContain('<svg');
      expect(res.mathml).toContain('<math');
      check(res);
    });
  });
});

// ============================================================================
// NHÓM 2: 30 BÀI KIỂM THỬ VẬT LÍ (Section IV & X)
// ============================================================================
describe('Nhóm 2: Bộ xử lý Vật lí (30 test)', () => {
  const physicsCases: Array<[string, string, SubjectMode, (r: ReturnType<typeof fixLatex>) => void]> = [
    ['P01. Định luật II Newton \\vec{F} = m\\vec{a}', '\\vec{F} = m\\vec{a}', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('\\vec{F}');
      expect(r.fixedLatex).toContain('\\vec{a}');
    }],
    ['P02. Động năng viết tắt W_d = \\frac12mv^2', 'W_d = \\frac12mv^2', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('\\frac{1}{2}mv^2');
      expect(r.fixedLatex).toContain('W_d');
    }],
    ['P03. Định luật Ôm U = IR', 'U = IR', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toBe('U = IR');
    }],
    ['P04. Lực Lorentz F = qvB\\sin\\alpha', 'F = qvB\\sin\\alpha', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('\\sin\\alpha');
    }],
    ['P05. Lực ma sát chỉ số nhiều ký tự F_ms = \\mu N', 'F_ms = \\mu N', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('F_{\\mathrm{ms}}');
    }],
    ['P06. Lực hướng tâm F_ht = m\\frac{v^2}{r}', 'F_ht = m\\frac{v^2}{r}', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('F_{\\mathrm{ht}}');
    }],
    ['P07. Vận tốc trung bình v_tb = \\frac{s}{t}', 'v_tb = \\frac{s}{t}', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('v_{\\mathrm{tb}}');
    }],
    ['P08. Chỉ số tiếng Việt động năng W_đ = \\frac{1}{2}mv^2', 'W_đ = \\frac{1}{2}mv^2', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('W_{\\text{đ}}');
    }],
    ['P09. Lực đàn hồi chỉ số tiếng Việt F_đh = k|\\Delta l|', 'F_đh = k|\\Delta l|', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('F_{\\text{đh}}');
    }],
    ['P10. Vectơ dạng hàm vec(F) = m vec(a)', 'vec(F) = m vec(a)', 'physics', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('\\vec{F}');
      expect(r.fixedLatex).toContain('\\vec{a}');
    }],
    ['P11. Động lượng \\vec{p} = m\\vec{v}', '\\vec{p} = m\\vec{v}', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('\\vec{p}');
    }],
    ['P12. Cường độ điện trường \\vec{E} = \\frac{\\vec{F}}{q}', '\\vec{E} = \\frac{\\vec{F}}{q}', 'auto', (r) => {
      expect(r.subject).toBe('physics');
    }],
    ['P13. Cảm ứng từ \\vec{B}', '\\vec{B} = 0.5 T', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('\\mathrm{T}');
    }],
    ['P14. Gia tốc trọng trường có đơn vị SI g = 9.8 m/s^2', 'g = 9.8 m/s^2', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('\\mathrm{m/s}^2');
    }],
    ['P15. Vận tốc có đơn vị SI v = 36 km/h', 'v = 36 km/h', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('\\mathrm{km/h}');
    }],
    ['P16. Điện trở có ký hiệu Ohm R = 100 Ω', 'R = 100 Ω', 'physics', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('\\Omega');
    }],
    ['P17. Điện tích micro-Coulomb q = 5 µC', 'q = 5 µC', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('\\mu\\mathrm{C}');
    }],
    ['P18. Điện dung micro-Farad C = 20 µF', 'C = 20 µF', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('\\mu\\mathrm{F}');
    }],
    ['P19. Nhiệt độ Celsius t = 25 °C', 't = 25 °C', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('^\\circ\\mathrm{C}');
    }],
    ['P20. Nhiệt lượng Q = mc\\Delta t', 'Q = mc\\Delta t', 'auto', (r) => {
      expect(r.subject).toBe('physics');
    }],
    ['P21. Khí lí tưởng pV = nRT', 'pV = nRT', 'auto', (r) => {
      expect(r.subject).toBe('physics');
    }],
    ['P22. Hệ thức Einstein E = mc^2', 'E = mc^2', 'auto', (r) => {
      expect(r.subject).toBe('physics');
    }],
    ['P23. Dao động điều hòa x = A\\cos(\\omega t + \\varphi)', 'x = A\\cos(\\omega t + \\varphi)', 'auto', (r) => {
      expect(r.subject).toBe('physics');
    }],
    ['P24. Chu kì con lắc đơn T = 2\\pi\\sqrt{\\frac{l}{g}}', 'T = 2\\pi\\sqrt{\\frac{l}{g}}', 'auto', (r) => {
      expect(r.subject).toBe('physics');
    }],
    ['P25. Tổng trở mạch RLC Z = \\sqrt{R^2 + (Z_L - Z_C)^2}', 'Z = \\sqrt{R^2 + (Z_L - Z_C)^2}', 'auto', (r) => {
      expect(r.subject).toBe('physics');
    }],
    ['P26. Công thức thấu kính \\frac{1}{f} = \\frac{1}{d} + \\frac{1}{d\'}', "\\frac{1}{f} = \\frac{1}{d} + \\frac{1}{d'}", 'auto', (r) => {
      expect(r.subject).toBe('physics');
    }],
    ['P27. Định luật khúc xạ n_1\\sin i = n_2\\sin r', 'n_1\\sin i = n_2\\sin r', 'auto', (r) => {
      expect(r.subject).toBe('physics');
    }],
    ['P28. Từ thông \\Phi = BS\\cos\\alpha', '\\Phi = BS\\cos\\alpha', 'auto', (r) => {
      expect(r.subject).toBe('physics');
    }],
    ['P29. Đạo hàm gia tốc a = \\frac{dv}{dt}', 'a = \\frac{dv}{dt}', 'physics', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toContain('\\frac{dv}{dt}');
    }],
    ['P30. Không tự thêm đơn vị nếu giáo viên không ghi (F = ma)', 'F = ma', 'auto', (r) => {
      expect(r.subject).toBe('physics');
      expect(r.fixedLatex).toBe('F = ma');
      expect(r.fixedLatex).not.toContain('\\mathrm{N}');
    }],
  ];

  physicsCases.forEach(([title, input, mode, check]) => {
    it(title, () => {
      const res = fixLatex(input, false, { subjectMode: mode });
      expect(res.validated).toBe(true);
      expect(res.ommlCompatible).toBe(true);
      expect(res.svg).toContain('<svg');
      expect(res.mathml).toContain('<math');
      check(res);
    });
  });
});

// ============================================================================
// NHÓM 3: 30 BÀI KIỂM THỬ HÓA HỌC (Section V & X)
// ============================================================================
describe('Nhóm 3: Bộ xử lý Hóa học (30 test)', () => {
  it('C01. Công thức phân tử H2SO4', () => {
    const r = fixLatex('H2SO4', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toBe('\\mathrm{H}_2\\mathrm{S}\\mathrm{O}_4');
  });

  it('C02. Công thức có ngoặc nhóm Ca(OH)2', () => {
    const r = fixLatex('Ca(OH)2', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toBe('\\mathrm{Ca}(\\mathrm{O}\\mathrm{H})_2');
  });

  it('C03. Muối sắt(III) sunfat Fe2(SO4)3', () => {
    const r = fixLatex('Fe2(SO4)3', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toBe('\\mathrm{Fe}_2(\\mathrm{S}\\mathrm{O}_4)_3');
  });

  it('C04. Ion sắt(III) Fe3+', () => {
    const r = fixLatex('Fe3+', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toBe('\\mathrm{Fe}^{3+}');
  });

  it('C05. Ion sunfat SO4^2-', () => {
    const r = fixLatex('SO4^2-', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toBe('\\mathrm{S}\\mathrm{O}_4^{2-}');
  });

  it('C06. Ion amoni NH4+', () => {
    const r = fixLatex('NH4+', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toBe('\\mathrm{N}\\mathrm{H}_4^{+}');
  });

  it('C07. Ion nitrat NO3-', () => {
    const r = fixLatex('NO3-', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toBe('\\mathrm{N}\\mathrm{O}_3^{-}');
  });

  it('C08. Ion cacbonat dạng Unicode CO₃²⁻', () => {
    const r = fixLatex('CO₃²⁻', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('^{2-}');
  });

  it('C09. Công thức phân tử Unicode H₂SO₄', () => {
    const r = fixLatex('H₂SO₄', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toBe('\\mathrm{H}_2\\mathrm{S}\\mathrm{O}_4');
  });

  it('C10. Tinh thể ngậm nước CuSO4.5H2O', () => {
    const r = fixLatex('CuSO4.5H2O', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('\\cdot 5\\mathrm{H}_2\\mathrm{O}');
  });

  it('C11. Phương trình đốt cháy 2H2 + O2 -> 2H2O', () => {
    const r = fixLatex('2H2 + O2 -> 2H2O', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toBe('2\\mathrm{H}_2 + \\mathrm{O}_2 \\longrightarrow 2\\mathrm{H}_2\\mathrm{O}');
  });

  it('C12. Phương trình nhiệt phân CaCO3 -> CaO + CO2', () => {
    const r = fixLatex('CaCO3 -> CaO + CO2', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('\\longrightarrow');
  });

  it('C13. Phương trình có điều kiện nhiệt độ CaCO3 ->[t°] CaO + CO2 ↑', () => {
    const r = fixLatex('CaCO3 ->[t°] CaO + CO2 ↑', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('\\xrightarrow{t^\\circ}');
    expect(r.fixedLatex).toContain('\\uparrow');
  });

  it('C14. Phương trình thuận nghịch N2 + 3H2 <=> 2NH3', () => {
    const r = fixLatex('N2 + 3H2 <=> 2NH3', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('\\rightleftharpoons');
  });

  it('C15. Phương trình thuận nghịch có xúc tác & nhiệt độ 2SO2 + O2 <=>[V2O5, t°] 2SO3', () => {
    const r = fixLatex('2SO2 + O2 <=>[V2O5, t°] 2SO3', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('\\xrightleftharpoons{');
    expect(r.fixedLatex).toContain('t^\\circ');
  });

  it('C16. Phương trình có kết tủa ↓: AgNO3 + NaCl -> AgCl ↓ + NaNO3', () => {
    const r = fixLatex('AgNO3 + NaCl -> AgCl ↓ + NaNO3', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('\\downarrow');
  });

  it('C17. Phương trình ghi trạng thái (aq)/(s)/(l)/(g)', () => {
    const r = fixLatex('BaCl2(aq) + H2SO4(aq) -> BaSO4(s) + 2HCl(aq)', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('(\\mathrm{aq})');
    expect(r.fixedLatex).toContain('(\\mathrm{s})');
  });

  it('C18. Phương trình ion rút gọn Fe3+ + 3OH- -> Fe(OH)3 ↓', () => {
    const r = fixLatex('Fe3+ + 3OH- -> Fe(OH)3 ↓', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('\\mathrm{Fe}^{3+}');
    expect(r.fixedLatex).toContain('3\\mathrm{O}\\mathrm{H}^{-}');
    expect(r.fixedLatex).toContain('\\downarrow');
  });

  it('C19. Phương trình oxi hóa khử ion 2Fe3+ + Cu -> 2Fe2+ + Cu2+', () => {
    const r = fixLatex('2Fe3+ + Cu -> 2Fe2+ + Cu2+', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('2\\mathrm{Fe}^{3+}');
    expect(r.fixedLatex).toContain('\\mathrm{Cu}^{2+}');
  });

  it('C20. Cú pháp mhchem chuẩn \\ce{H2SO4}', () => {
    const r = fixLatex('\\ce{H2SO4}', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.ommlCompatible).toBe(true);
    expect(r.fixedLatex).toBe('\\ce{H2SO4}');
  });

  it('C21. Cú pháp mhchem phản ứng \\ce{2H2 + O2 ->[t^\\circ] 2H2O}', () => {
    const r = fixLatex('\\ce{2H2 + O2 ->[t^\\circ] 2H2O}', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    const omml = mathmlToOmml(r.mathml);
    // Đảm bảo fix <mphantom> không làm lọt chữ 'A' ma vào OMML!
    expect(omml).not.toContain('<m:t xml:space="preserve">A</m:t>');
  });

  it('C22. Cú pháp mhchem ion \\ce{SO4^2-}', () => {
    const r = fixLatex('\\ce{SO4^2-}', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    const omml = mathmlToOmml(r.mathml);
    expect(omml).toContain('<m:oMath');
    expect(omml).not.toContain('>A<');
  });

  it('C23. Công thức cấu tạo thu gọn tuyến tính CH3-CH2-OH', () => {
    const r = fixLatex('CH3-CH2-OH', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('\\text{-}');
  });

  it('C24. Anken liên kết đôi CH2=CH2', () => {
    const r = fixLatex('CH2=CH2', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('=');
  });

  it('C25. Ankin liên kết ba CH≡CH', () => {
    const r = fixLatex('CH≡CH', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('\\equiv');
  });

  it('C26. Axit hữu cơ CH3COOH', () => {
    const r = fixLatex('CH3COOH', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toContain('\\mathrm{C}\\mathrm{H}_3');
  });

  it('C27. Phản ứng viết không dấu cách quanh dấu cộng 2H2+O2->2H2O', () => {
    const r = fixLatex('2H2+O2->2H2O', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toBe('2\\mathrm{H}_2 + \\mathrm{O}_2 \\longrightarrow 2\\mathrm{H}_2\\mathrm{O}');
  });

  it('C28. NGUYÊN TẮC BẮT BUỘC: KHÔNG tự cân bằng phương trình chưa cân bằng (Fe + O2 -> Fe3O4)', () => {
    const r = fixLatex('Fe + O2 -> Fe3O4', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    // Không tự thêm hệ số 3 hay 2!
    expect(r.fixedLatex).toBe('\\mathrm{Fe} + \\mathrm{O}_2 \\longrightarrow \\mathrm{Fe}_3\\mathrm{O}_4');
  });

  it('C29. NGUYÊN TẮC BẮT BUỘC: KHÔNG tự đổi hệ số sai của giáo viên (H2 + O2 -> H2O)', () => {
    const r = fixLatex('H2 + O2 -> H2O', false, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.validated).toBe(true);
    expect(r.fixedLatex).toBe('\\mathrm{H}_2 + \\mathrm{O}_2 \\longrightarrow \\mathrm{H}_2\\mathrm{O}');
  });

  it('C30. Công thức cấu tạo 2D phức tạp được cảnh báo trung thực (ommlCompatible = false)', () => {
    const diagram2D = `   CH3\n    |\nCH3-C-CH3\n    |\n   OH`;
    const r = fixLatex(diagram2D, true, { subjectMode: 'auto' });
    expect(r.subject).toBe('chemistry');
    expect(r.ommlCompatible).toBe(false);
    expect(r.status).toBe('needs_review');
    expect(r.ommlWarning).toBeTruthy();
  });
});

// ============================================================================
// NHÓM 4: 20 ĐOẠN VĂN TIẾNG VIỆT CÓ CÔNG THỨC LIÊN MÔN (Section II & X)
// ============================================================================
describe('Nhóm 4: Đoạn văn tiếng Việt liên môn Toán – Lí – Hóa (20 test)', () => {
  it('L01. Một câu chứa đồng thời công thức Toán + Vật lí + Hóa học', () => {
    const text = 'Giải phương trình $\\frac{x^2+1}{2}=5$, tính động năng W_d=\\frac12mv^2 và hòa tan H2SO4.';
    const fs = parseFormulas(text, 'auto');
    expect(fs.map((f) => f.subject)).toEqual(['math', 'physics', 'chemistry']);
  });

  it('L02. Thống kê số lượng công thức theo từng môn chính xác', () => {
    const doc = processDocumentText(
      'Toán: $\\int_0^1 x^2\\,dx$. Lí: $\\vec{F}=m\\vec{a}$ và U=IR. Hóa: 2H2 + O2 -> 2H2O và Ca(OH)2.',
      'plain',
      [],
      'auto'
    );
    expect(doc.stats.mathCount).toBe(1);
    expect(doc.stats.physicsCount).toBe(2);
    expect(doc.stats.chemistryCount).toBe(2);
    expect(doc.stats.totalFormulas).toBe(5);
  });

  it('L03. Chế độ thủ công Toán học ép phân loại toàn bộ công thức sang Toán', () => {
    const doc = processDocumentText('Cho $x^2 + 1 = 0$ và $U = IR$', 'plain', [], 'math');
    const fs = collectFormulas(doc);
    expect(fs.every((f) => f.subject === 'math')).toBe(true);
  });

  it('L04. Chế độ thủ công Vật lí chuẩn hóa đơn vị và chỉ số Vật lí', () => {
    const doc = processDocumentText('Vật có $F_ms = 10 N$ và gia tốc $a = 2 m/s^2$.', 'plain', [], 'physics');
    const fs = collectFormulas(doc);
    expect(fs.every((f) => f.subject === 'physics')).toBe(true);
    expect(fs[0].activeLatex).toContain('F_{\\mathrm{ms}}');
    expect(fs[1].activeLatex).toContain('\\mathrm{m/s}^2');
  });

  it('L05. Chế độ thủ công Hóa học xử lý ion & phương trình chuẩn xác', () => {
    const doc = processDocumentText('Cho Fe3+ tác dụng với OH- tạo Fe(OH)3 ↓.', 'plain', [], 'chemistry');
    const fs = collectFormulas(doc);
    expect(fs.length).toBeGreaterThanOrEqual(3);
    expect(fs.every((f) => f.subject === 'chemistry')).toBe(true);
  });

  it('L06. Bảo toàn 100% dấu tiếng Việt trong đoạn văn liên môn dài', () => {
    const text =
      'Đề kiểm tra Khoa học Tự nhiên: Học sinh tính $\\frac{x^2+1}{2}$, áp dụng định luật Ôm U = IR và viết phương trình CaCO3 ->[t°] CaO + CO2 ↑.';
    const doc = processDocumentText(text, 'plain', [], 'auto');
    const plain = documentToExportPair(doc).plain;
    expect(plain).toContain('Đề kiểm tra Khoa học Tự nhiên');
    expect(plain).toContain('áp dụng định luật Ôm');
    expect(plain).toContain('viết phương trình');
  });

  it('L07. Không nhận diện nhầm chữ viết tắt tiếng Việt (THPT, THCS, SGK) thành công thức Hóa học', () => {
    const doc = processDocumentText('Giáo viên THPT, THCS soạn đề từ SGK theo chuẩn mới.', 'plain', [], 'auto');
    expect(doc.stats.totalFormulas).toBe(0);
  });

  it('L08. Không nhận diện nhầm điểm hình học AB, ABC, Oxyz thành hóa chất', () => {
    const fs = parseFormulas('Trong không gian Oxyz, cho $\\vec{AB} = (1; 2; 3)$ và △ABC vuông tại A.', 'auto');
    expect(fs.every((f) => f.subject === 'math')).toBe(true);
  });

  it('L09. Không nhận diện nhầm tổ hợp C_n^k và xác suất P(A) thành Hóa học', () => {
    const fs = parseFormulas('Tính $C_n^k$ và xác suất $P(A)$ khi gieo xúc xắc.', 'auto');
    expect(fs.every((f) => f.subject === 'math')).toBe(true);
  });

  it('L10. Chuyển đổi thủ công môn học cho từng công thức bằng applyManualSubjectOverride', () => {
    const fs = parseFormulas('Cho công thức $F = k x$.', 'auto');
    const overridden = applyManualSubjectOverride(fs[0], 'physics');
    expect(overridden.subject).toBe('physics');
    expect(overridden.subjectManualOverride).toBe(true);
    expect(overridden.validated).toBe(true);
  });

  it('L11. Chỉnh sửa công thức Hóa học qua applyManualLatexEdit chỉ cập nhật đúng công thức đó', () => {
    const fs = parseFormulas('Dung dịch H2SO4 và Ca(OH)2.', 'auto');
    expect(fs.length).toBe(2);
    const edited = applyManualLatexEdit(fs[0], '\\mathrm{HCl}', 'chemistry');
    expect(edited.activeLatex).toBe('\\mathrm{HCl}');
    expect(edited.subject).toBe('chemistry');
    expect(fs[1].activeLatex).toContain('\\mathrm{Ca}');
  });

  it('L12. Ngữ cảnh Hóa học giúp phân biệt nguyên tố đơn lẻ $Fe$ trong câu Hóa', () => {
    const fs = parseFormulas('Trong phản ứng oxi hóa khử, kim loại $Fe$ nhường electron.', 'auto');
    expect(fs[0].subject).toBe('chemistry');
  });

  it('L13. Ngữ cảnh Vật lí giúp nhận diện đại lượng trong câu Vật lí', () => {
    const fs = parseFormulas('Tính công suất mạch điện xoay chiều khi $I_{max} = 2 A$.', 'auto');
    expect(fs[0].subject).toBe('physics');
  });

  it('L14. Đoạn trắc nghiệm Hóa học 4 phương án A, B, C, D giữ đúng cấu trúc', () => {
    const text = `Câu 1. Chất nào sau đây là axit mạnh?\nA. H2SO4\nB. Ca(OH)2\nC. NaCl\nD. CO2`;
    const doc = processDocumentText(text, 'plain', [], 'auto');
    expect(doc.blocks.length).toBe(5);
    expect(doc.stats.chemistryCount).toBe(4);
  });

  it('L15. Đoạn trắc nghiệm Vật lí 4 phương án A, B, C, D với biểu thức có căn và phân số', () => {
    const text = `Câu 2. Chu kì con lắc đơn là:\nA. $T = 2\\pi\\sqrt{\\frac{l}{g}}$\nB. $T = 2\\pi\\sqrt{\\frac{g}{l}}$`;
    const doc = processDocumentText(text, 'plain', [], 'auto');
    expect(doc.stats.physicsCount).toBe(2);
    expect(doc.stats.unrecoverableCount).toBe(0);
  });

  it('L16. Đoạn văn hỗn hợp có bảng biểu chứa đồng thời Toán, Lí, Hóa', () => {
    const text = `| Môn | Công thức |\n| --- | --- |\n| Toán | $\\frac{x^2+1}{2}$ |\n| Lí | $\\vec{F}=m\\vec{a}$ |\n| Hóa | H2SO4 |`;
    const doc = processDocumentText(text, 'plain', [], 'auto');
    expect(doc.blocks[0].type).toBe('table');
    expect(doc.stats.mathCount).toBe(1);
    expect(doc.stats.physicsCount).toBe(1);
    expect(doc.stats.chemistryCount).toBe(1);
  });

  it('L17. Đoạn văn chứa công thức lỗi double-backslash xen kẽ công thức Hóa học', () => {
    const text = 'Biểu thức \\\\frac{a+b}{2} kết hợp với phương trình 2H2 + O2 -> 2H2O.';
    const fs = parseFormulas(text, 'auto');
    expect(fs.length).toBe(2);
    expect(fs[0].subject).toBe('math');
    expect(fs[0].activeLatex).toBe('\\frac{a+b}{2}');
    expect(fs[1].subject).toBe('chemistry');
    expect(fs[1].validated).toBe(true);
  });

  it('L18. Đoạn văn chứa mhchem \\ce{...} không có dấu $ xen kẽ văn bản tiếng Việt', () => {
    const text = 'Hòa tan muối \\ce{Fe2(SO4)3} vào nước cất ở nhiệt độ $25 °C$.';
    const fs = parseFormulas(text, 'auto');
    expect(fs.length).toBe(2);
    expect(fs[0].subject).toBe('chemistry');
    expect(fs[0].validated).toBe(true);
    expect(fs[1].subject).toBe('physics');
  });

  it('L19. Đoạn văn có công thức cấu tạo 2D phức tạp phát sinh cảnh báo mức tài liệu', () => {
    const text = `Công thức cấu tạo phân nhánh:\n\n   CH3\n    |\nCH3-C-CH3\n    |\n   OH\n\nVà phương trình H2SO4 + 2NaOH -> Na2SO4 + 2H2O.`;
    const doc = processDocumentText(text, 'plain', [], 'auto');
    expect(doc.warnings.length).toBeGreaterThan(0);
    const fs = collectFormulas(doc);
    expect(fs.some((f) => f.ommlCompatible === false)).toBe(true);
    expect(fs.some((f) => f.ommlCompatible === true)).toBe(true);
  });

  it('L20. Đoạn văn lớn (đề liên môn 3 phần) xử lý nhanh và 0 lỗi unrecoverable', () => {
    const text = [
      'PHẦN I. TOÁN HỌC',
      'Câu 1. Tính $\\int_0^1 \\frac{x^2+1}{2}\\,dx$ và giải hệ $\\begin{cases} x+y=3 \\\\ 2x-y=0 \\end{cases}$.',
      'PHẦN II. VẬT LÍ',
      'Câu 2. Áp dụng $\\vec{F}=m\\vec{a}$, tính $W_d=\\frac12mv^2$ với $v = 10 m/s$ và lực Lorentz $F=qvB\\sin\\alpha$.',
      'PHẦN III. HÓA HỌC',
      'Câu 3. Phản ứng: 2H2 + O2 ->[t°] 2H2O và AgNO3(aq) + NaCl(aq) -> AgCl ↓ + NaNO3(aq).',
    ].join('\n');
    const doc = processDocumentText(text, 'plain', [], 'auto');
    expect(doc.stats.unrecoverableCount).toBe(0);
    expect(doc.stats.mathCount).toBeGreaterThanOrEqual(2);
    expect(doc.stats.physicsCount).toBeGreaterThanOrEqual(3);
    expect(doc.stats.chemistryCount).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// NHÓM 5: 20 TRƯỜNG HỢP COPY – PASTE (Section VII & X)
// ============================================================================
describe('Nhóm 5: Copy – Paste cho Toán, Vật lí, Hóa học và Liên môn (20 test)', () => {
  const assertWordClipboardPayload = (html: string, plain: string) => {
    expect(html).toContain('xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"');
    expect(html).toContain('<!--[if gte msEquation 12]>');
    expect(html).toContain('<m:oMath');
    expect(html).toContain('<![if !msEquation]>');
    expect(html).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML"');
    expect(html).not.toContain('<svg');
    expect(plain.length).toBeGreaterThan(0);
  };

  it('CP01. Copy công thức Toán \\frac{x^2+1}{2} tạo Office OMML + MathML', () => {
    const doc = processDocumentText('\\frac{x^2+1}{2}');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('<m:f>');
    expect(pair.plain).toContain('<math');
  });

  it('CP02. Copy công thức Vật lí \\vec{F}=m\\vec{a} tạo OMML <m:acc> cho vectơ', () => {
    const doc = processDocumentText('\\vec{F}=m\\vec{a}');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('<m:acc>');
  });

  it('CP03. Copy công thức động năng W_d=\\frac12mv^2 có phân số OMML <m:f> và chỉ số <m:sSub>', () => {
    const doc = processDocumentText('W_d=\\frac12mv^2');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('<m:f>');
    expect(pair.html).toContain('<m:sSub>');
  });

  it('CP04. Copy công thức điện U=IR tạo OMML sạch', () => {
    const doc = processDocumentText('U=IR');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
  });

  it('CP05. Copy công thức lực từ F=qvB\\sin\\alpha tạo OMML có sin đứng và alpha', () => {
    const doc = processDocumentText('F=qvB\\sin\\alpha');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('sin');
    expect(pair.html).toContain('α');
  });

  it('CP06. Copy phân tử Hóa học H2SO4 tạo OMML có <m:sSub> và chữ đứng <m:nor/>', () => {
    const doc = processDocumentText('H2SO4');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('<m:sSub>');
    expect(pair.html).toContain('<m:nor/>');
  });

  it('CP07. Copy bazơ Ca(OH)2 tạo OMML giữ ngoặc và chỉ số 2', () => {
    const doc = processDocumentText('Ca(OH)2');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('<m:sSub>');
  });

  it('CP08. Copy ion Fe3+ tạo OMML <m:sSup> với 3+', () => {
    const doc = processDocumentText('Fe3+');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('<m:sSup>');
  });

  it('CP09. Copy ion SO4^2- tạo OMML <m:sSubSup> (hoặc sub+sup) sạch', () => {
    const doc = processDocumentText('SO4^2-');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('<m:sSubSup>');
  });

  it('CP10. Copy phương trình 2H2 + O2 -> 2H2O tạo OMML mũi tên ⟶', () => {
    const doc = processDocumentText('2H2 + O2 -> 2H2O');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('⟶');
  });

  it('CP11. Copy phương trình thuận nghịch N2 + 3H2 <=> 2NH3 chứa ⇌', () => {
    const doc = processDocumentText('N2 + 3H2 <=> 2NH3');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('⇌');
  });

  it('CP12. Copy phương trình có điều kiện nhiệt độ CaCO3 ->[t°] CaO + CO2 ↑ chứa <m:limUpp>', () => {
    const doc = processDocumentText('CaCO3 ->[t°] CaO + CO2 ↑');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('↑');
  });

  it('CP13. Copy mhchem \\ce{AgNO3} không chứa ký tự A ma từ <mphantom>', () => {
    const doc = processDocumentText('\\ce{AgNO3}');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).not.toContain('<m:t>A</m:t>');
  });

  it('CP14. Copy đoạn văn liên môn giữ nguyên tiếng Việt và đúng thứ tự 3 công thức', () => {
    const doc = processDocumentText('Toán $\\frac{1}{2}$, Lí $\\vec{F}=m\\vec{a}$, Hóa H2SO4.');
    const para = getParagraphs(doc)[0];
    const pair = paragraphToExportPair(para);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html.indexOf('Toán')).toBeLessThan(pair.html.indexOf('Lí'));
    expect(pair.html.indexOf('Lí')).toBeLessThan(pair.html.indexOf('Hóa'));
  });

  it('CP15. Copy toàn bộ đề liên môn nhiều đoạn bảo toàn tất cả dấu tiếng Việt', () => {
    const doc = processDocumentText('Câu 1. Tính $\\sqrt{x+1}$.\nCâu 2. Áp dụng U = IR.\nCâu 3. Hòa tan Ca(OH)2.');
    const pair = documentToExportPair(doc);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('Câu 1.');
    expect(pair.html).toContain('Câu 2.');
    expect(pair.html).toContain('Câu 3.');
  });

  it('CP16. Copy đơn vị SI Vật lí 9.8 m/s^2 giữ chữ đứng trong OMML', () => {
    const f = parseFormulas('$g = 9.8 m/s^2$', 'physics')[0];
    const pair = buildDisplayedFormulaExportPair(f);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('<m:nor/>');
  });

  it('CP17. Copy công thức cấu tạo 2D phức tạp xuất <pre> trung thực, không xuất OMML giả', () => {
    const f = parseFormulas('   CH3\n    |\nCH3-C-CH3\n    |\n   OH', 'chemistry')[0];
    const pair = buildDisplayedFormulaExportPair(f);
    expect(pair.html).toContain('<pre');
    expect(pair.html).not.toContain('<m:oMath');
    expect(pair.plain).toContain('CH3-C-CH3');
  });

  it('CP18. Copy bảng chứa công thức 3 môn tạo thẻ <table> kèm OMML trong từng ô', () => {
    const doc = processDocumentText('| Môn | Ví dụ |\n| --- | --- |\n| Toán | $\\frac{1}{2}$ |\n| Hóa | H2SO4 |');
    const pair = documentToExportPair(doc);
    expect(pair.html).toContain('<table');
    expect(pair.html).toContain('<m:oMath');
    expect(pair.html).not.toContain('<svg');
  });

  it('CP19. Copy công thức đơn KHÔNG bao giờ trả về mã LaTeX thô làm bản sao chính khi công thức hợp lệ', () => {
    const f = parseFormulas('\\frac{x^2+1}{2}')[0];
    const pair = buildDisplayedFormulaExportPair(f);
    expect(pair.plain.startsWith('<math')).toBe(true);
    expect(pair.plain).not.toContain('\\frac');
  });

  it('CP20. Copy công thức hiển thị (display mode $$...$$) phát sinh <m:oMathPara>', () => {
    const f = parseFormulas('$$2H2 + O2 -> 2H2O$$')[0];
    const pair = buildDisplayedFormulaExportPair(f);
    assertWordClipboardPayload(pair.html, pair.plain);
    expect(pair.html).toContain('<m:oMathPara>');
  });
});

// ============================================================================
// NHÓM 6: 20 TRƯỜNG HỢP XUẤT WORD DOCX (OMML) & KHỨ HỒI (Section VIII & X)
// ============================================================================
describe('Nhóm 6: Xuất Word (.docx) chứa Word Equation OMML (20 test)', () => {
  it('D01. Xuất DOCX phân số Toán học chứa <m:oMath> và <m:f>', async () => {
    const doc = processDocumentText('Tính $\\frac{x^2+1}{2}$');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<m:f>');
    const bytes = await generateDocxBuffer(doc);
    expect(bytes.byteLength).toBeGreaterThan(500);
  });

  it('D02. Xuất DOCX hệ phương trình Toán chứa <m:d> với begChr="{" và endChr=""', () => {
    const doc = processDocumentText('$$\\begin{cases} x+y=3 \\\\ x-y=1 \\end{cases}$$');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMathPara>');
    expect(xml).toContain('<m:begChr m:val="{"/>');
    expect(xml).toContain('<m:endChr m:val=""/>');
  });

  it('D03. Xuất DOCX tích phân xác định chứa <m:nary>', () => {
    const doc = processDocumentText('$$\\int_0^1 x^2\\,dx$$');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:nary>');
  });

  it('D04. Xuất DOCX định luật II Newton \\vec{F}=m\\vec{a} chứa <m:acc>', () => {
    const doc = processDocumentText('Định luật II Newton: $\\vec{F}=m\\vec{a}$.');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<m:acc>');
  });

  it('D05. Xuất DOCX động năng W_d=\\frac12mv^2 chứa <m:sSub>, <m:f>, <m:sSup>', () => {
    const doc = processDocumentText('Động năng: W_d=\\frac12mv^2');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:sSub>');
    expect(xml).toContain('<m:f>');
    expect(xml).toContain('<m:sSup>');
  });

  it('D06. Xuất DOCX định luật Ôm U=IR chứa <m:oMath>', () => {
    const doc = processDocumentText('Định luật Ôm: U=IR');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
  });

  it('D07. Xuất DOCX lực Lorentz F=qvB\\sin\\alpha chứa sin và α', () => {
    const doc = processDocumentText('Lực từ: F=qvB\\sin\\alpha');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('sin');
    expect(xml).toContain('α');
  });

  it('D08. Xuất DOCX chỉ số nhiều ký tự Vật lí F_ms = \\mu N', () => {
    const doc = processDocumentText('Lực ma sát: $F_ms = \\mu N$');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:sSub>');
    expect(xml).toContain('ms');
  });

  it('D09. Xuất DOCX đơn vị SI Vật lí g = 9.8 m/s^2 có chữ đứng <m:nor/>', () => {
    const doc = processDocumentText('Gia tốc trọng trường $g = 9.8 m/s^2$.');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:nor/>');
    expect(xml).toContain('>m</m:t>');
    expect(xml).toContain('>/</m:t>');
    expect(xml).toContain('>s</m:t>');
    expect(xml).toContain('<m:sSup>');
  });

  it('D10. Xuất DOCX phân tử H2SO4 tạo OMML hợp lệ', () => {
    const doc = processDocumentText('Axit sunfuric H2SO4.');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<m:sSub>');
  });

  it('D11. Xuất DOCX bazơ Ca(OH)2 tạo OMML hợp lệ', () => {
    const doc = processDocumentText('Canxi hiđroxit Ca(OH)2.');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('Ca');
  });

  it('D12. Xuất DOCX ion Fe3+ và SO4^2- tạo <m:sSup> và <m:sSubSup>', () => {
    const doc = processDocumentText('Dung dịch chứa ion Fe3+ và SO4^2-.');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:sSup>');
    expect(xml).toContain('<m:sSubSup>');
  });

  it('D13. Xuất DOCX phương trình 2H2 + O2 -> 2H2O tạo OMML chỉnh sửa được', () => {
    const doc = processDocumentText('Phản ứng: 2H2 + O2 -> 2H2O');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('⟶');
  });

  it('D14. Xuất DOCX phương trình thuận nghịch có điều kiện N2 + 3H2 <=>[xt, t°] 2NH3', () => {
    const doc = processDocumentText('Phản ứng: N2 + 3H2 <=>[xt, t°] 2NH3');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('⇌');
  });

  it('D15. Xuất DOCX mhchem \\ce{H2SO4} không bị lọt chữ A từ <mphantom>', () => {
    const doc = processDocumentText('Dung dịch \\ce{H2SO4}.');
    const xml = buildDocumentXml(doc);
    expect(xml).toContain('<m:oMath>');
    expect(xml).not.toContain('<m:t xml:space="preserve">A</m:t>');
  });

  it('D16. Xuất DOCX cấu tạo 2D phức tạp xuất cảnh báo trung thực, không xuất <m:oMath> giả', () => {
    const doc = processDocumentText('   CH3\n    |\nCH3-C-CH3\n    |\n   OH', 'plain', [], 'chemistry');
    const xml = buildDocumentXml(doc);
    expect(xml).not.toContain('<m:oMath>');
    expect(xml).toContain('Cảnh báo');
    expect(xml).toContain('CH3-C-CH3');
  });

  it('D17. Xuất DOCX tài liệu liên môn Toán – Vật lí – Hóa học giữ nguyên toàn bộ tiếng Việt', async () => {
    const doc = processDocumentText(
      'ĐỀ KIỂM TRA KHTN\nCâu 1. Toán: $\\frac{x^2+1}{2}$.\nCâu 2. Vật lí: $\\vec{F}=m\\vec{a}$.\nCâu 3. Hóa học: CaCO3 -> CaO + CO2.'
    );
    const bytes = await generateDocxBuffer(doc);
    const imported = await importDocxFromArrayBuffer(bytes);
    expect(imported.ommlCount).toBe(3);
    expect(imported.text).toContain('ĐỀ KIỂM TRA KHTN');
    expect(imported.text).toContain('Vật lí');
    expect(imported.text).toContain('Hóa học');
  });

  it('D18. Khứ hồi DOCX (Export -> Import) bảo toàn số lượng công thức Vật lí & Hóa học', async () => {
    const doc = processDocumentText(
      'Động năng W_d=\\frac12mv^2.\nPhản ứng 2H2 + O2 -> 2H2O.\nIon Fe3+.'
    );
    const bytes = await generateDocxBuffer(doc);
    const imported = await importDocxFromArrayBuffer(bytes);
    expect(imported.ommlCount).toBe(3);
  });

  it('D19. Xuất DOCX có bảng biểu chứa công thức 3 môn giữ nguyên cấu trúc bảng <w:tbl>', async () => {
    const doc = processDocumentText(
      '| Môn | Công thức |\n| --- | --- |\n| Toán | $\\sqrt{x+1}$ |\n| Vật lí | U=IR |\n| Hóa học | H2SO4 |'
    );
    const bytes = await generateDocxBuffer(doc);
    const imported = await importDocxFromArrayBuffer(bytes);
    expect(imported.tableCount).toBe(1);
    expect(imported.ommlCount).toBe(3);
  });

  it('D20. Xuất DOCX không chứa thẻ <svg> hay ảnh nhúng thay thế công thức', async () => {
    const doc = processDocumentText(
      'Toán: $\\frac{x^2+1}{2}$. Vật lí: $\\vec{F}=m\\vec{a}$. Hóa: 2H2 + O2 -> 2H2O.'
    );
    const xml = buildDocumentXml(doc);
    expect(xml).not.toContain('<svg');
    expect(xml).not.toContain('<w:drawing');
    expect(xml).toContain('<m:oMath>');
  });
});
