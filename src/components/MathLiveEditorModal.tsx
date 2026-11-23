import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, Redo2, RotateCcw, Undo2, X } from 'lucide-react';
import type { MathfieldElement } from 'mathlive';
import { FormulaSegment, FormulaSubject } from '../engine/types';
import { renderLatexToSvg } from '../engine/mathjaxRenderer';
import { copyFormulaAs } from '../engine/clipboardExport';

interface MathLiveEditorModalProps {
  formula: FormulaSegment | null;
  onClose: () => void;
  onApply: (formulaId: string, newLatex: string, nextSubject?: FormulaSubject) => void;
  onNotify: (message: string, tone?: 'info' | 'success' | 'warning') => void;
}

interface SymbolCategory {
  id: string;
  label: string;
  items: Array<{ label: string; insert: string; title: string }>;
}

const SUBJECT_TABS: Array<{ id: FormulaSubject; label: string }> = [
  { id: 'math', label: 'Toán học' },
  { id: 'physics', label: 'Vật lí' },
  { id: 'chemistry', label: 'Hóa học' },
];

const MATH_CATEGORIES: SymbolCategory[] = [
  {
    id: 'fractions',
    label: 'Phân số',
    items: [
      { label: 'a/b', insert: '\\frac{#0}{#?}', title: 'Phân số chuẩn' },
      { label: 'a/b lớn', insert: '\\dfrac{#0}{#?}', title: 'Phân số cỡ lớn (display)' },
      { label: '1/2', insert: '\\frac{1}{2}', title: 'Một phần hai' },
      { label: 'a/(b/c)', insert: '\\frac{#0}{\\frac{#?}{#?}}', title: 'Phân số lồng nhau' },
    ],
  },
  {
    id: 'radicals',
    label: 'Căn thức',
    items: [
      { label: '√x', insert: '\\sqrt{#0}', title: 'Căn bậc hai' },
      { label: '∛x', insert: '\\sqrt[3]{#0}', title: 'Căn bậc ba' },
      { label: 'ⁿ√x', insert: '\\sqrt[#?]{#0}', title: 'Căn bậc n' },
      { label: '√(a/b)', insert: '\\sqrt{\\frac{#0}{#?}}', title: 'Căn chứa phân số' },
    ],
  },
  {
    id: 'powers',
    label: 'Số mũ',
    items: [
      { label: 'x²', insert: '#0^{2}', title: 'Bình phương' },
      { label: 'x³', insert: '#0^{3}', title: 'Lập phương' },
      { label: 'xⁿ', insert: '#0^{#?}', title: 'Số mũ tùy ý' },
      { label: 'xⁿ⁺¹', insert: 'x^{n+1}', title: 'Số mũ biểu thức' },
      { label: 'eˣ', insert: 'e^{#0}', title: 'Hàm mũ cơ số e' },
    ],
  },
  {
    id: 'subscripts',
    label: 'Chỉ số dưới',
    items: [
      { label: 'aₙ', insert: '#0_{#?}', title: 'Chỉ số dưới' },
      { label: 'aₙ₊₁', insert: 'a_{n+1}', title: 'Chỉ số dãy số' },
      { label: 'x₁,₂', insert: 'x_{1,2}', title: 'Nghiệm x1, x2' },
      { label: 'aᵢʲ', insert: '#0_{#?}^{#?}', title: 'Chỉ số dưới và trên' },
    ],
  },
  {
    id: 'vectors',
    label: 'Vectơ',
    items: [
      { label: 'a⃗', insert: '\\vec{#0}', title: 'Vectơ một chữ' },
      { label: 'AB⃗', insert: '\\overrightarrow{#0}', title: 'Vectơ hai điểm' },
      { label: '|a⃗|', insert: '\\left|\\vec{#0}\\right|', title: 'Độ dài vectơ' },
      { label: 'a⃗·b⃗', insert: '\\vec{a}\\cdot\\vec{b}', title: 'Tích vô hướng' },
      { label: '(x;y;z)', insert: '(#0; #?; #?)', title: 'Tọa độ Oxyz' },
    ],
  },
  {
    id: 'geometry',
    label: 'Hình học',
    items: [
      { label: 'AB̅', insert: '\\overline{#0}', title: 'Đoạn thẳng gạch trên' },
      { label: '∠ABC', insert: '\\widehat{#0}', title: 'Góc có mũ' },
      { label: '∠', insert: '\\angle ', title: 'Ký hiệu góc' },
      { label: '△', insert: '\\triangle ', title: 'Tam giác' },
      { label: '⊥', insert: '\\perp ', title: 'Vuông góc' },
      { label: '∥', insert: '\\parallel ', title: 'Song song' },
      { label: '∼', insert: '\\sim ', title: 'Đồng dạng' },
      { label: '≅', insert: '\\cong ', title: 'Bằng nhau' },
      { label: '⌒AB', insert: '\\overset{\\frown}{#0}', title: 'Cung tròn' },
      { label: '°', insert: '^\\circ', title: 'Độ' },
    ],
  },
  {
    id: 'trig',
    label: 'Lượng giác',
    items: [
      { label: 'sin', insert: '\\sin(#0)', title: 'Hàm sin' },
      { label: 'cos', insert: '\\cos(#0)', title: 'Hàm cos' },
      { label: 'tan', insert: '\\tan(#0)', title: 'Hàm tan' },
      { label: 'cot', insert: '\\cot(#0)', title: 'Hàm cot' },
      { label: 'π', insert: '\\pi', title: 'Số Pi' },
      { label: 'α', insert: '\\alpha', title: 'Alpha' },
      { label: 'β', insert: '\\beta', title: 'Beta' },
      { label: 'φ', insert: '\\varphi', title: 'Phi' },
    ],
  },
  {
    id: 'calculus',
    label: 'Giải tích',
    items: [
      { label: 'lim', insert: '\\lim_{x \\to #0}', title: 'Giới hạn' },
      { label: '∫ f(x)dx', insert: '\\int #0 \\,\\mathrm{d}x', title: 'Nguyên hàm' },
      { label: '∫ₐᵇ', insert: '\\int_{#?}^{#?} #0 \\,\\mathrm{d}x', title: 'Tích phân xác định' },
      { label: '∑', insert: '\\sum_{i=1}^{n} #0', title: 'Tổng xích-ma' },
      { label: '∏', insert: '\\prod_{i=1}^{n} #0', title: 'Tích pi' },
      { label: "f'(x)", insert: "f'(x)", title: 'Đạo hàm bậc nhất' },
      { label: 'dy/dx', insert: '\\frac{\\mathrm{d}y}{\\mathrm{d}x}', title: 'Vi phân' },
      { label: 'logₐ', insert: '\\log_{#?}(#0)', title: 'Logarit cơ số a' },
      { label: 'ln', insert: '\\ln(#0)', title: 'Logarit tự nhiên' },
      { label: '∞', insert: '\\infty', title: 'Vô cực' },
    ],
  },
  {
    id: 'matrix',
    label: 'Ma trận & Hệ',
    items: [
      { label: 'Hệ 2 PT', insert: '\\begin{cases} #0 \\\\ #? \\end{cases}', title: 'Hệ 2 phương trình' },
      { label: 'Hệ 3 PT', insert: '\\begin{cases} #0 \\\\ #? \\\\ #? \\end{cases}', title: 'Hệ 3 phương trình' },
      { label: 'Ma trận 2×2', insert: '\\begin{pmatrix} #0 & #? \\\\ #? & #? \\end{pmatrix}', title: 'Ma trận tròn 2×2' },
      { label: 'Ma trận [2×2]', insert: '\\begin{bmatrix} #0 & #? \\\\ #? & #? \\end{bmatrix}', title: 'Ma trận vuông 2×2' },
      { label: 'Định thức |2×2|', insert: '\\begin{vmatrix} #0 & #? \\\\ #? & #? \\end{vmatrix}', title: 'Định thức 2×2' },
    ],
  },
  {
    id: 'sets',
    label: 'Tập hợp',
    items: [
      { label: '∈', insert: '\\in ', title: 'Thuộc' },
      { label: '∉', insert: '\\notin ', title: 'Không thuộc' },
      { label: '⊂', insert: '\\subset ', title: 'Tập con' },
      { label: '∪', insert: '\\cup ', title: 'Hợp' },
      { label: '∩', insert: '\\cap ', title: 'Giao' },
      { label: '∅', insert: '\\emptyset', title: 'Tập rỗng' },
      { label: 'ℝ', insert: '\\mathbb{R}', title: 'Tập số thực' },
      { label: 'ℕ', insert: '\\mathbb{N}', title: 'Tập số tự nhiên' },
      { label: 'ℤ', insert: '\\mathbb{Z}', title: 'Tập số nguyên' },
      { label: '∀', insert: '\\forall ', title: 'Với mọi' },
      { label: '∃', insert: '\\exists ', title: 'Tồn tại' },
      { label: '⇒', insert: '\\Rightarrow ', title: 'Suy ra' },
      { label: '⇔', insert: '\\Leftrightarrow ', title: 'Tương đương' },
    ],
  },
  {
    id: 'prob',
    label: 'Xác suất & Thống kê',
    items: [
      { label: 'Cₙᵏ', insert: 'C_{#?}^{#?}', title: 'Tổ hợp' },
      { label: 'Aₙᵏ', insert: 'A_{#?}^{#?}', title: 'Chỉnh hợp' },
      { label: '(n k)', insert: '\\binom{#0}{#?}', title: 'Hệ số nhị thức' },
      { label: 'P(A)', insert: 'P(#0)', title: 'Xác suất biến cố' },
      { label: 'P(A|B)', insert: 'P(#0 \\mid #?)', title: 'Xác suất có điều kiện' },
      { label: 'x̄', insert: '\\overline{x}', title: 'Trung bình mẫu' },
      { label: 'σ', insert: '\\sigma', title: 'Độ lệch chuẩn' },
      { label: '≤', insert: '\\le ', title: 'Nhỏ hơn hoặc bằng' },
      { label: '≥', insert: '\\ge ', title: 'Lớn hơn hoặc bằng' },
      { label: '≠', insert: '\\ne ', title: 'Khác' },
    ],
  },
];

const PHYSICS_CATEGORIES: SymbolCategory[] = [
  {
    id: 'phys_vectors',
    label: 'Vectơ & Cơ học',
    items: [
      { label: 'F⃗', insert: '\\vec{F}', title: 'Vectơ lực' },
      { label: 'a⃗', insert: '\\vec{a}', title: 'Vectơ gia tốc' },
      { label: 'v⃗', insert: '\\vec{v}', title: 'Vectơ vận tốc' },
      { label: 'p⃗', insert: '\\vec{p}', title: 'Vectơ động lượng' },
      { label: 'Fₘₛ', insert: 'F_{\\mathrm{ms}}', title: 'Lực ma sát' },
      { label: 'Fₕₜ', insert: 'F_{\\mathrm{ht}}', title: 'Lực hướng tâm' },
      { label: 'Fđₕ', insert: 'F_{\\text{đh}}', title: 'Lực đàn hồi' },
      { label: 'Wđ', insert: 'W_{\\text{đ}}', title: 'Động năng' },
      { label: 'Wₜ', insert: 'W_t', title: 'Thế năng' },
      { label: '½mv²', insert: '\\frac{1}{2}mv^2', title: 'Biểu thức động năng' },
      { label: 'dv/dt', insert: '\\frac{\\mathrm{d}v}{\\mathrm{d}t}', title: 'Đạo hàm vận tốc theo thời gian' },
      { label: 'Δt', insert: '\\Delta t', title: 'Độ biến thiên thời gian' },
    ],
  },
  {
    id: 'phys_greek',
    label: 'Chữ Hy Lạp',
    items: [
      { label: 'α', insert: '\\alpha', title: 'Alpha' },
      { label: 'β', insert: '\\beta', title: 'Beta' },
      { label: 'γ', insert: '\\gamma', title: 'Gamma' },
      { label: 'Δ', insert: '\\Delta', title: 'Delta hoa (độ biến thiên)' },
      { label: 'θ', insert: '\\theta', title: 'Theta' },
      { label: 'λ', insert: '\\lambda', title: 'Bước sóng Lambda' },
      { label: 'μ', insert: '\\mu', title: 'Hệ số ma sát / micro' },
      { label: 'ρ', insert: '\\rho', title: 'Khối lượng riêng / điện trở suất' },
      { label: 'φ', insert: '\\varphi', title: 'Pha ban đầu' },
      { label: 'Φ', insert: '\\Phi', title: 'Từ thông Phi' },
      { label: 'ω', insert: '\\omega', title: 'Tần số góc Omega nhỏ' },
      { label: 'Ω', insert: '\\Omega', title: 'Điện trở Ohm' },
      { label: 'ε', insert: '\\varepsilon', title: 'Suất điện động / hằng số điện môi' },
      { label: 'π', insert: '\\pi', title: 'Số Pi' },
    ],
  },
  {
    id: 'phys_em',
    label: 'Điện – Từ – Quang',
    items: [
      { label: 'E⃗', insert: '\\vec{E}', title: 'Vectơ cường độ điện trường' },
      { label: 'B⃗', insert: '\\vec{B}', title: 'Vectơ cảm ứng từ' },
      { label: 'Z_L', insert: 'Z_L', title: 'Cảm kháng' },
      { label: 'Z_C', insert: 'Z_C', title: 'Dung kháng' },
      { label: 'Rₜđ', insert: 'R_{\\mathrm{td}}', title: 'Điện trở tương đương' },
      { label: 'Iₘₐₓ', insert: 'I_{\\mathrm{max}}', title: 'Cường độ cực đại' },
      { label: 'vₜb', insert: 'v_{\\mathrm{tb}}', title: 'Vận tốc trung bình' },
      { label: 'U = IR', insert: 'U = I \\cdot R', title: 'Định luật Ôm' },
      { label: '1/f', insert: '\\frac{1}{f} = \\frac{1}{d} + \\frac{1}{d\'}', title: 'Công thức thấu kính' },
      { label: 'sin α', insert: '\\sin\\alpha', title: 'Sin góc alpha' },
      { label: 'cos φ', insert: '\\cos\\varphi', title: 'Hệ số công suất' },
    ],
  },
  {
    id: 'phys_units',
    label: 'Đơn vị SI & Ký hiệu',
    items: [
      { label: 'm/s', insert: '\\,\\mathrm{m/s}', title: 'Mét trên giây' },
      { label: 'm/s²', insert: '\\,\\mathrm{m/s}^2', title: 'Mét trên giây bình phương' },
      { label: 'N', insert: '\\,\\mathrm{N}', title: 'Newton' },
      { label: 'J', insert: '\\,\\mathrm{J}', title: 'Joule' },
      { label: 'W', insert: '\\,\\mathrm{W}', title: 'Watt' },
      { label: 'V', insert: '\\,\\mathrm{V}', title: 'Volt' },
      { label: 'A', insert: '\\,\\mathrm{A}', title: 'Ampe' },
      { label: 'Ω', insert: '\\,\\Omega', title: 'Ohm' },
      { label: 'Hz', insert: '\\,\\mathrm{Hz}', title: 'Hertz' },
      { label: 'μC', insert: '\\,\\mu\\mathrm{C}', title: 'Micro-Coulomb' },
      { label: 'μF', insert: '\\,\\mu\\mathrm{F}', title: 'Micro-Farad' },
      { label: '°C', insert: '^\\circ\\mathrm{C}', title: 'Độ C' },
      { label: '×10ⁿ', insert: '\\times 10^{#?}', title: 'Lũy thừa cơ số 10' },
      { label: 'a/b', insert: '\\frac{#0}{#?}', title: 'Phân số' },
      { label: '√', insert: '\\sqrt{#0}', title: 'Căn bậc hai' },
    ],
  },
];

const CHEMISTRY_CATEGORIES: SymbolCategory[] = [
  {
    id: 'chem_elements',
    label: 'Nguyên tố phổ biến',
    items: [
      { label: 'H', insert: '\\mathrm{H}', title: 'Hiđro' },
      { label: 'O', insert: '\\mathrm{O}', title: 'Oxi' },
      { label: 'C', insert: '\\mathrm{C}', title: 'Cacbon' },
      { label: 'N', insert: '\\mathrm{N}', title: 'Nitơ' },
      { label: 'S', insert: '\\mathrm{S}', title: 'Lưu huỳnh' },
      { label: 'P', insert: '\\mathrm{P}', title: 'Photpho' },
      { label: 'Cl', insert: '\\mathrm{Cl}', title: 'Clo' },
      { label: 'Na', insert: '\\mathrm{Na}', title: 'Natri' },
      { label: 'K', insert: '\\mathrm{K}', title: 'Kali' },
      { label: 'Ca', insert: '\\mathrm{Ca}', title: 'Canxi' },
      { label: 'Mg', insert: '\\mathrm{Mg}', title: 'Magie' },
      { label: 'Al', insert: '\\mathrm{Al}', title: 'Nhôm' },
      { label: 'Fe', insert: '\\mathrm{Fe}', title: 'Sắt' },
      { label: 'Cu', insert: '\\mathrm{Cu}', title: 'Đồng' },
      { label: 'Zn', insert: '\\mathrm{Zn}', title: 'Kẽm' },
      { label: 'Ag', insert: '\\mathrm{Ag}', title: 'Bạc' },
      { label: 'Ba', insert: '\\mathrm{Ba}', title: 'Bari' },
      { label: 'Mn', insert: '\\mathrm{Mn}', title: 'Mangan' },
    ],
  },
  {
    id: 'chem_ions',
    label: 'Chỉ số & Ion',
    items: [
      { label: 'X₂', insert: '#0_{2}', title: 'Chỉ số 2' },
      { label: 'X₃', insert: '#0_{3}', title: 'Chỉ số 3' },
      { label: 'X₄', insert: '#0_{4}', title: 'Chỉ số 4' },
      { label: 'Xₙ', insert: '#0_{#?}', title: 'Chỉ số tùy ý' },
      { label: '⁺', insert: '^{+}', title: 'Điện tích 1+' },
      { label: '⁻', insert: '^{-}', title: 'Điện tích 1-' },
      { label: '²⁺', insert: '^{2+}', title: 'Điện tích 2+' },
      { label: '³⁺', insert: '^{3+}', title: 'Điện tích 3+' },
      { label: '²⁻', insert: '^{2-}', title: 'Điện tích 2-' },
      { label: '³⁻', insert: '^{3-}', title: 'Điện tích 3-' },
      { label: 'SO₄²⁻', insert: '\\mathrm{SO}_4^{2-}', title: 'Ion sunfat' },
      { label: 'NO₃⁻', insert: '\\mathrm{NO}_3^{-}', title: 'Ion nitrat' },
      { label: 'CO₃²⁻', insert: '\\mathrm{CO}_3^{2-}', title: 'Ion cacbonat' },
      { label: 'OH⁻', insert: '\\mathrm{OH}^{-}', title: 'Ion hiđroxit' },
      { label: 'NH₄⁺', insert: '\\mathrm{NH}_4^{+}', title: 'Ion amoni' },
    ],
  },
  {
    id: 'chem_arrows',
    label: 'Mũi tên & Điều kiện',
    items: [
      { label: '⟶', insert: ' \\longrightarrow ', title: 'Mũi tên phản ứng 1 chiều' },
      { label: '⇌', insert: ' \\rightleftharpoons ', title: 'Mũi tên thuận nghịch' },
      { label: '⟶ (t°)', insert: ' \\xrightarrow{t^\\circ} ', title: 'Phản ứng cần đun nóng t°' },
      { label: '⟶ (xt, t°)', insert: ' \\xrightarrow{\\text{xt},\\,t^\\circ} ', title: 'Xúc tác và nhiệt độ' },
      { label: '⇌ (xt, t°)', insert: ' \\xrightleftharpoons{\\text{xt},\\,t^\\circ} ', title: 'Thuận nghịch có xúc tác, nhiệt độ' },
      { label: '⟶ (đpnc)', insert: ' \\xrightarrow{\\text{đpnc}} ', title: 'Điện phân nóng chảy' },
      { label: '⟶ (as)', insert: ' \\xrightarrow{\\text{as}} ', title: 'Ánh sáng' },
      { label: '↓', insert: '\\downarrow', title: 'Chất kết tủa' },
      { label: '↑', insert: '\\uparrow', title: 'Chất khí thoát ra' },
      { label: '· (ngậm nước)', insert: '\\cdot ', title: 'Dấu chấm tinh thể ngậm nước' },
    ],
  },
  {
    id: 'chem_states',
    label: 'Trạng thái & Cấu tạo',
    items: [
      { label: '(aq)', insert: '(\\mathrm{aq})', title: 'Dung dịch nước' },
      { label: '(s)', insert: '(\\mathrm{s})', title: 'Trạng thái rắn' },
      { label: '(l)', insert: '(\\mathrm{l})', title: 'Trạng thái lỏng' },
      { label: '(g)', insert: '(\\mathrm{g})', title: 'Trạng thái khí' },
      { label: '– (liên kết đơn)', insert: '\\text{-}', title: 'Liên kết đơn tuyến tính' },
      { label: '= (liên kết đôi)', insert: '=', title: 'Liên kết đôi' },
      { label: '≡ (liên kết ba)', insert: '\\equiv ', title: 'Liên kết ba' },
      { label: '\\ce{...}', insert: '\\ce{#0}', title: 'Cú pháp mhchem' },
      { label: 'H₂O', insert: '\\mathrm{H}_2\\mathrm{O}', title: 'Nước' },
      { label: 'H₂SO₄', insert: '\\mathrm{H}_2\\mathrm{SO}_4', title: 'Axit sunfuric' },
      { label: 'Ca(OH)₂', insert: '\\mathrm{Ca}(\\mathrm{OH})_2', title: 'Canxi hiđroxit' },
      { label: 'CO₂↑', insert: '\\mathrm{CO}_2\\uparrow', title: 'Khí CO2' },
    ],
  },
];

const CATEGORIES_BY_SUBJECT: Record<FormulaSubject, SymbolCategory[]> = {
  math: MATH_CATEGORIES,
  physics: PHYSICS_CATEGORIES,
  chemistry: CHEMISTRY_CATEGORIES,
};

let mathliveConfigured = false;

export const MathLiveEditorModal: React.FC<MathLiveEditorModalProps> = ({
  formula,
  onClose,
  onApply,
  onNotify,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mfRef = useRef<MathfieldElement | null>(null);
  const [latex, setLatex] = useState('');
  const [activeSubject, setActiveSubject] = useState<FormulaSubject>('math');
  const [activeCat, setActiveCat] = useState<string>('fractions');
  const [showAdvancedLatex, setShowAdvancedLatex] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Sync local latex & subject palette whenever formula changes
  useEffect(() => {
    if (formula) {
      const subj: FormulaSubject = formula.subject || 'math';
      setLatex(formula.activeLatex);
      setActiveSubject(subj);
      setActiveCat(CATEGORIES_BY_SUBJECT[subj][0].id);
      setShowAdvancedLatex(false);
    }
  }, [formula?.id, formula?.activeLatex, formula?.subject]);

  // Allow Escape key to cancel cleanly without changing any formula
  useEffect(() => {
    if (!formula) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formula, onClose]);

  // Mount MathLive <math-field> element cleanly using local offline fonts
  useEffect(() => {
    if (!formula || !hostRef.current) return;
    let cancelled = false;

    (async () => {
      const mod = await import('mathlive');
      if (cancelled || !hostRef.current) return;

      if (!mathliveConfigured) {
        mod.MathfieldElement.fontsDirectory = '/mathlive/fonts';
        mod.MathfieldElement.soundsDirectory = null;
        mathliveConfigured = true;
      }

      const mf = new mod.MathfieldElement();
      mf.value = formula.activeLatex;
      mf.mathVirtualKeyboardPolicy = 'manual';
      mf.smartFence = true;
      mf.smartSuperscript = true;

      const handleInput = () => {
        setLatex(mf.getValue('latex'));
      };
      mf.addEventListener('input', handleInput);

      hostRef.current.innerHTML = '';
      hostRef.current.appendChild(mf);
      mfRef.current = mf;
      setIsReady(true);
      setTimeout(() => mf.focus(), 50);

      return () => {
        mf.removeEventListener('input', handleInput);
      };
    })();

    return () => {
      cancelled = true;
      mfRef.current = null;
      setIsReady(false);
    };
  }, [formula?.id, formula?.activeLatex]);

  // Live MathJax SVG validation preview
  const livePreview = useMemo(() => {
    if (!formula) return null;
    return renderLatexToSvg(latex, formula.displayMode);
  }, [latex, formula]);

  if (!formula) return null;

  const subjectCategories = CATEGORIES_BY_SUBJECT[activeSubject];
  const currentCategory = subjectCategories.find((c) => c.id === activeCat) || subjectCategories[0];

  const handleSwitchSubject = (subj: FormulaSubject) => {
    setActiveSubject(subj);
    setActiveCat(CATEGORIES_BY_SUBJECT[subj][0].id);
  };

  const insertTemplate = (template: string) => {
    const mf = mfRef.current;
    if (mf) {
      mf.executeCommand(['insert', template, { insertionMode: 'replaceSelection', selectionMode: 'placeholder' }]);
      mf.focus();
      setLatex(mf.getValue('latex'));
    } else {
      const cleaned = template.replace(/#[0?]/g, '');
      setLatex((prev) => `${prev}${cleaned}`);
    }
  };

  const handleUndo = () => {
    const mf = mfRef.current;
    if (mf) {
      mf.executeCommand('undo');
      setLatex(mf.getValue('latex'));
      mf.focus();
    }
  };

  const handleRedo = () => {
    const mf = mfRef.current;
    if (mf) {
      mf.executeCommand('redo');
      setLatex(mf.getValue('latex'));
      mf.focus();
    }
  };

  const handleResetToOriginal = () => {
    setLatex(formula.originalLatex);
    if (mfRef.current) {
      mfRef.current.setValue(formula.originalLatex);
      mfRef.current.focus();
    }
  };

  const handleAdvancedLatexChange = (value: string) => {
    setLatex(value);
    if (mfRef.current && mfRef.current.getValue('latex') !== value) {
      mfRef.current.setValue(value, { silenceNotifications: true });
    }
  };

  const handleCopyCurrent = async (format: 'display' | 'latex' | 'mathml' | 'svg' | 'png') => {
    const preview = renderLatexToSvg(latex, formula.displayMode);
    const tempFormula: FormulaSegment = {
      ...formula,
      subject: activeSubject,
      activeLatex: latex,
      svg: preview.svg,
      mathml: preview.mathml,
      validated: preview.ok,
      ommlCompatible: preview.ok,
    };
    const res = await copyFormulaAs(tempFormula, format);
    onNotify(res.message, res.ok ? 'success' : 'warning');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mathlive-modal-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 id="mathlive-modal-title" className="text-base sm:text-lg font-semibold text-slate-900">
              Chỉnh sửa công thức trực quan (MathLive)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Chọn bộ ký hiệu Toán học, Vật lí hoặc Hóa học bên dưới — không cần thuộc mã LaTeX.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            aria-label="Đóng trình chỉnh sửa công thức"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="mathfix-scroll flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Interactive MathLive Field (auto-expands cleanly; toolbar never overlaps input) */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">Vùng soạn thảo công thức</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Hoàn tác
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                  Làm lại
                </button>
                <button
                  type="button"
                  onClick={handleResetToOriginal}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Về bản gốc
                </button>
              </div>
            </div>
            <div ref={hostRef} className="min-h-[76px] w-full overflow-x-auto" />
            {!isReady && (
              <p className="mt-1 text-xs text-slate-500">Đang khởi tạo trình soạn thảo MathLive...</p>
            )}
          </div>

          {/* Subject-Aware Categorized Symbol Keyboard (Toán học / Vật lí / Hóa học) */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
            {/* Subject Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                {SUBJECT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSwitchSubject(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      activeSubject === tab.id
                        ? 'bg-[#0B4F8A] text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">
                Môn của công thức: <strong className="text-slate-800">{SUBJECT_TABS.find((t) => t.id === activeSubject)?.label}</strong>
              </span>
            </div>

            {/* Category Sub-tabs */}
            <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
              {subjectCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCat(cat.id)}
                  className={`rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    currentCategory.id === cat.id
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-700 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Symbol buttons */}
            <div className="flex flex-wrap gap-1.5">
              {currentCategory.items.map((item) => (
                <button
                  key={`${currentCategory.id}-${item.label}`}
                  type="button"
                  onClick={() => insertTemplate(item.insert)}
                  title={item.title}
                  className="min-w-[48px] rounded-md border border-slate-200 bg-white px-3 py-2 text-[15px] font-medium text-slate-800 hover:border-[#0B4F8A] hover:bg-sky-50/60 hover:text-[#0B4F8A] transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live MathJax SVG Preview + Validation Status */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
              <span>Xem trước chuẩn MathJax SVG</span>
              {livePreview?.ok ? (
                <span className="text-emerald-700">Hợp lệ — sẵn sàng xuất Word</span>
              ) : (
                <span className="text-red-600">Chưa hợp lệ: {livePreview?.error || 'Lỗi cú pháp'}</span>
              )}
            </div>
            <div className="mt-3 flex min-h-[54px] items-center justify-center overflow-x-auto py-1">
              {livePreview?.ok && livePreview.svg ? (
                <div
                  className="mathfix-svg-host"
                  style={{ fontSize: '1.35rem' }}
                  dangerouslySetInnerHTML={{ __html: livePreview.svg }}
                />
              ) : (
                <span className="text-sm text-red-600 font-mono">{latex || '(Trống)'}</span>
              )}
            </div>
          </div>

          {/* Fix notes if any */}
          {formula.notes.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Ghi chú phân tích ban đầu:</p>
              <ul className="mt-1 list-disc pl-5 space-y-0.5 text-xs sm:text-sm">
                {formula.notes.map((n, idx) => (
                  <li key={`${n.code}-${idx}`}>{n.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Optional Advanced LaTeX Source — Hidden by Default */}
          <div className="border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => setShowAdvancedLatex((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {showAdvancedLatex ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span>Xem mã LaTeX nâng cao (tùy chọn)</span>
            </button>
            {showAdvancedLatex && (
              <div className="mt-2">
                <textarea
                  value={latex}
                  onChange={(e) => handleAdvancedLatexChange(e.target.value)}
                  rows={3}
                  spellCheck={false}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 font-mono text-sm text-slate-900 focus:border-[#0B4F8A] focus:bg-white focus:outline-none"
                  aria-label="Mã LaTeX nâng cao"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-3.5 rounded-b-xl">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 mr-1">Sao chép nhanh:</span>
            <button
              type="button"
              onClick={() => handleCopyCurrent('display')}
              className="inline-flex items-center gap-1 rounded-md border border-[#0B4F8A]/40 bg-sky-50/70 px-2.5 py-1.5 text-xs font-medium text-[#0B4F8A] hover:bg-sky-100 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" />
              Công thức
            </button>
            <button
              type="button"
              onClick={() => handleCopyCurrent('latex')}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              LaTeX
            </button>
            <button
              type="button"
              onClick={() => handleCopyCurrent('mathml')}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              MathML
            </button>
            <button
              type="button"
              onClick={() => handleCopyCurrent('svg')}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              SVG
            </button>
            <button
              type="button"
              onClick={() => handleCopyCurrent('png')}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              PNG
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[15px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => onApply(formula.id, latex, activeSubject)}
              disabled={!livePreview?.ok}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B4F8A] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#093F6F] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check className="h-4 w-4" />
              Áp dụng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
