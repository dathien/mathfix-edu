import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Columns2,
  Copy,
  FileDown,
  FilePlus2,
  FileText,
  Maximize2,
  Minimize2,
  PlusSquare,
  Redo2,
  RotateCcw,
  Rows2,
  Search,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type { MathfieldElement } from 'mathlive';
import { FormulaSegment, FormulaSubject } from '../engine/types';
import { renderLatexToSvg } from '../engine/mathjaxRenderer';
import { copyFormulaAs } from '../engine/clipboardExport';
import { exportSingleFormulaDocx } from '../engine/docxExporter';
import { PERIODIC_TABLE, searchPeriodicElements } from '../data/periodicTable';
import { GradeLevel, LibraryFormulaItem } from '../data/formulaLibraryData';
import { ResponsiveFormula } from './ResponsiveFormula';

interface FormulaStudioPanelProps {
  open: boolean;
  mode: 'create' | 'edit';
  formula: FormulaSegment | null;
  initialSubject: FormulaSubject;
  initialLatex?: string;
  onClose: () => void;
  onApplyEdit: (formulaId: string, newLatex: string, nextSubject: FormulaSubject) => void;
  onInsertIntoDocument: (latex: string, displayMode: boolean, subject: FormulaSubject) => void;
  onSaveToLibrary: (item: Omit<LibraryFormulaItem, 'id' | 'isBuiltIn'>) => void;
  onNotify: (message: string, tone?: 'info' | 'success' | 'warning') => void;
}

interface PaletteItem {
  id: string;
  previewLatex: string;
  insert: string;
  title: string;
  fallbackText?: string;
}

interface SymbolCategory {
  id: string;
  label: string;
  items: PaletteItem[];
}

const SUBJECT_TABS: Array<{ id: FormulaSubject; label: string }> = [
  { id: 'math', label: 'Toán học' },
  { id: 'physics', label: 'Vật lí' },
  { id: 'chemistry', label: 'Hóa học' },
];

// Memoized MathJax SVG cache for crisp visual palette symbols (Section VIII)
const PALETTE_SVG_CACHE = new Map<string, string>();
function getVisualSymbolSvg(latex: string): string {
  const cached = PALETTE_SVG_CACHE.get(latex);
  if (cached !== undefined) return cached;
  const r = renderLatexToSvg(latex, false);
  const svg = r.ok ? r.svg : '';
  PALETTE_SVG_CACHE.set(latex, svg);
  return svg;
}

// ============================================================================
// SECTION VIII: 9 MATH SYMBOL GROUPS (Visual rendered formulas + real placeholders)
// ============================================================================
const MATH_CATEGORIES: SymbolCategory[] = [
  {
    id: 'm_basic',
    label: 'Phép toán cơ bản',
    items: [
      { id: 'plus', previewLatex: '+', insert: '+', title: 'Cộng' },
      { id: 'minus', previewLatex: '-', insert: '-', title: 'Trừ' },
      { id: 'times', previewLatex: '\\times', insert: '\\times ', title: 'Nhân (×)' },
      { id: 'cdot', previewLatex: '\\cdot', insert: '\\cdot ', title: 'Nhân chấm (·)' },
      { id: 'div', previewLatex: '\\div', insert: '\\div ', title: 'Chia (÷)' },
      { id: 'pm', previewLatex: '\\pm', insert: '\\pm ', title: 'Cộng trừ (±)' },
      { id: 'eq', previewLatex: '=', insert: '=', title: 'Bằng (=)' },
      { id: 'ne', previewLatex: '\\ne', insert: '\\ne ', title: 'Khác (≠)' },
      { id: 'lt', previewLatex: '<', insert: '<', title: 'Nhỏ hơn (<)' },
      { id: 'gt', previewLatex: '>', insert: '>', title: 'Lớn hơn (>)' },
      { id: 'le', previewLatex: '\\le', insert: '\\le ', title: 'Nhỏ hơn hoặc bằng (≤)' },
      { id: 'ge', previewLatex: '\\ge', insert: '\\ge ', title: 'Lớn hơn hoặc bằng (≥)' },
      { id: 'approx', previewLatex: '\\approx', insert: '\\approx ', title: 'Xấp xỉ (≈)' },
      { id: 'propto', previewLatex: '\\propto', insert: '\\propto ', title: 'Tỉ lệ (∝)' },
    ],
  },
  {
    id: 'm_frac_rad',
    label: 'Phân số & Căn thức',
    items: [
      { id: 'frac', previewLatex: '\\frac{a}{b}', insert: '\\frac{#0}{#?}', title: 'Phân số thường' },
      { id: 'dfrac', previewLatex: '\\dfrac{a}{b}', insert: '\\dfrac{#0}{#?}', title: 'Phân số cỡ lớn' },
      { id: 'nested_frac', previewLatex: '\\frac{a}{\\frac{b}{c}}', insert: '\\frac{#0}{\\frac{#?}{#?}}', title: 'Phân số lồng nhau' },
      { id: 'sqrt', previewLatex: '\\sqrt{x}', insert: '\\sqrt{#0}', title: 'Căn bậc hai' },
      { id: 'cbrt', previewLatex: '\\sqrt[3]{x}', insert: '\\sqrt[3]{#0}', title: 'Căn bậc ba' },
      { id: 'nrt', previewLatex: '\\sqrt[n]{x}', insert: '\\sqrt[#?]{#0}', title: 'Căn bậc n' },
      { id: 'nested_sqrt', previewLatex: '\\sqrt{a+\\sqrt{b}}', insert: '\\sqrt{#0+\\sqrt{#?}}', title: 'Căn thức lồng nhau' },
    ],
  },
  {
    id: 'm_scripts',
    label: 'Số mũ & Chỉ số',
    items: [
      { id: 'sup2', previewLatex: 'x^2', insert: '#0^{2}', title: 'Bình phương' },
      { id: 'sup', previewLatex: 'x^n', insert: '#0^{#?}', title: 'Số mũ / chỉ số trên' },
      { id: 'sub', previewLatex: 'a_n', insert: '#0_{#?}', title: 'Chỉ số dưới' },
      { id: 'subsup', previewLatex: 'a_i^j', insert: '#0_{#?}^{#?}', title: 'Chỉ số kép (dưới và trên)' },
      { id: 'prescript', previewLatex: '{}_{n}^{k}\\mathrm{X}', insert: '{}_{#?}^{#?}#0', title: 'Chỉ số trước ký tự' },
      { id: 'exp', previewLatex: 'e^x', insert: 'e^{#0}', title: 'Hàm mũ e^x' },
    ],
  },
  {
    id: 'm_accents',
    label: 'Dấu trên & Dấu dưới',
    items: [
      { id: 'overline', previewLatex: '\\overline{AB}', insert: '\\overline{#0}', title: 'Gạch trên' },
      { id: 'underline', previewLatex: '\\underline{x}', insert: '\\underline{#0}', title: 'Gạch dưới' },
      { id: 'hat', previewLatex: '\\hat{x}', insert: '\\hat{#0}', title: 'Dấu mũ' },
      { id: 'widehat', previewLatex: '\\widehat{ABC}', insert: '\\widehat{#0}', title: 'Dấu mũ góc rộng' },
      { id: 'dot', previewLatex: '\\dot{x}', insert: '\\dot{#0}', title: 'Dấu chấm trên' },
      { id: 'ddot', previewLatex: '\\ddot{x}', insert: '\\ddot{#0}', title: 'Dấu hai chấm trên' },
      { id: 'vec', previewLatex: '\\vec{a}', insert: '\\vec{#0}', title: 'Dấu vectơ' },
      { id: 'overleftarrow', previewLatex: '\\overleftarrow{AB}', insert: '\\overleftarrow{#0}', title: 'Mũi tên trái trên' },
      { id: 'overrightarrow', previewLatex: '\\overrightarrow{AB}', insert: '\\overrightarrow{#0}', title: 'Mũi tên phải trên' },
      { id: 'overleftrightarrow', previewLatex: '\\overleftrightarrow{AB}', insert: '\\overleftrightarrow{#0}', title: 'Mũi tên hai chiều trên' },
      { id: 'overbrace', previewLatex: '\\overbrace{a+b}^{n}', insert: '\\overbrace{#0}^{#?}', title: 'Dấu móc trên' },
      { id: 'underbrace', previewLatex: '\\underbrace{a+b}_{n}', insert: '\\underbrace{#0}_{#?}', title: 'Dấu móc dưới' },
    ],
  },
  {
    id: 'm_geometry',
    label: 'Hình học',
    items: [
      { id: 'angle', previewLatex: '\\angle ABC', insert: '\\angle #0', title: 'Góc' },
      { id: 'widehat_g', previewLatex: '\\widehat{ABC}', insert: '\\widehat{#0}', title: 'Góc có mũ' },
      { id: 'tri', previewLatex: '\\triangle ABC', insert: '\\triangle #0', title: 'Tam giác' },
      { id: 'vec_ab', previewLatex: '\\overrightarrow{AB}', insert: '\\overrightarrow{#0}', title: 'Vectơ hai điểm' },
      { id: 'seg', previewLatex: '\\overline{AB}', insert: '\\overline{#0}', title: 'Đoạn thẳng' },
      { id: 'line', previewLatex: '\\overleftrightarrow{AB}', insert: '\\overleftrightarrow{#0}', title: 'Đường thẳng' },
      { id: 'parallel', previewLatex: '\\parallel', insert: '\\parallel ', title: 'Song song' },
      { id: 'perp', previewLatex: '\\perp', insert: '\\perp ', title: 'Vuông góc' },
      { id: 'sim', previewLatex: '\\sim', insert: '\\sim ', title: 'Đồng dạng' },
      { id: 'cong', previewLatex: '\\cong', insert: '\\cong ', title: 'Bằng nhau (hình học)' },
      { id: 'coord', previewLatex: '(x;y;z)', insert: '(#0; #?; #?)', title: 'Tọa độ không gian' },
      { id: 'oxyz', previewLatex: 'Oxyz', insert: 'Oxyz', title: 'Hệ trục tọa độ Oxyz' },
      { id: 'deg', previewLatex: '90^\\circ', insert: '#0^\\circ', title: 'Độ (°)' },
    ],
  },
  {
    id: 'm_calc',
    label: 'Đại số & Giải tích',
    items: [
      { id: 'sys2', previewLatex: '\\begin{cases} x \\\\ y \\end{cases}', insert: '\\begin{cases} #0 \\\\ #? \\end{cases}', title: 'Hệ phương trình / Hàm từng đoạn' },
      { id: 'sys3', previewLatex: '\\begin{cases} a \\\\ b \\\\ c \\end{cases}', insert: '\\begin{cases} #0 \\\\ #? \\\\ #? \\end{cases}', title: 'Hệ 3 phương trình' },
      { id: 'abs', previewLatex: '|x|', insert: '\\left|#0\\right|', title: 'Giá trị tuyệt đối' },
      { id: 'log', previewLatex: '\\log_a b', insert: '\\log_{#?}(#0)', title: 'Logarit cơ số a' },
      { id: 'ln', previewLatex: '\\ln x', insert: '\\ln(#0)', title: 'Logarit tự nhiên' },
      { id: 'sin', previewLatex: '\\sin x', insert: '\\sin(#0)', title: 'Hàm sin' },
      { id: 'cos', previewLatex: '\\cos x', insert: '\\cos(#0)', title: 'Hàm cos' },
      { id: 'tan', previewLatex: '\\tan x', insert: '\\tan(#0)', title: 'Hàm tan' },
      { id: 'cot', previewLatex: '\\cot x', insert: '\\cot(#0)', title: 'Hàm cot' },
      { id: 'lim', previewLatex: '\\lim_{x\\to a}', insert: '\\lim_{x \\to #?} #0', title: 'Giới hạn' },
      { id: 'deriv', previewLatex: "f'(x)", insert: "f'(#0)", title: 'Đạo hàm' },
      { id: 'diff', previewLatex: '\\frac{\\mathrm{d}y}{\\mathrm{d}x}', insert: '\\frac{\\mathrm{d}#0}{\\mathrm{d}#?}', title: 'Vi phân' },
      { id: 'int', previewLatex: '\\int f(x)\\,\\mathrm{d}x', insert: '\\int #0\\,\\mathrm{d}x', title: 'Nguyên hàm' },
      { id: 'defint', previewLatex: '\\int_a^b f(x)\\,\\mathrm{d}x', insert: '\\int_{#?}^{#?} #0\\,\\mathrm{d}x', title: 'Tích phân xác định' },
      { id: 'sum', previewLatex: '\\sum_{i=1}^{n}', insert: '\\sum_{i=#?}^{#?} #0', title: 'Tổng xích-ma' },
      { id: 'prod', previewLatex: '\\prod_{i=1}^{n}', insert: '\\prod_{i=#?}^{#?} #0', title: 'Tích pi' },
    ],
  },
  {
    id: 'm_matrix',
    label: 'Ma trận & Định thức',
    items: [
      { id: 'pmat2', previewLatex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', insert: '\\begin{pmatrix} #0 & #? \\\\ #? & #? \\end{pmatrix}', title: 'Ma trận ngoặc tròn 2×2' },
      { id: 'bmat2', previewLatex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', insert: '\\begin{bmatrix} #0 & #? \\\\ #? & #? \\end{bmatrix}', title: 'Ma trận ngoặc vuông 2×2' },
      { id: 'vmat2', previewLatex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}', insert: '\\begin{vmatrix} #0 & #? \\\\ #? & #? \\end{vmatrix}', title: 'Định thức 2×2' },
      { id: 'pmat3', previewLatex: '\\begin{pmatrix} 1 & 0 & 0 \\\\ 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{pmatrix}', insert: '\\begin{pmatrix} #0 & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #? \\end{pmatrix}', title: 'Ma trận tròn 3×3' },
      { id: 'bmat3', previewLatex: '\\begin{bmatrix} a & b & c \\\\ d & e & f \\end{bmatrix}', insert: '\\begin{bmatrix} #0 & #? & #? \\\\ #? & #? & #? \\end{bmatrix}', title: 'Ma trận vuông 2×3' },
      { id: 'vmat3', previewLatex: '\\begin{vmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{vmatrix}', insert: '\\begin{vmatrix} #0 & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #? \\end{vmatrix}', title: 'Định thức 3×3' },
    ],
  },
  {
    id: 'm_sets',
    label: 'Tập hợp & Xác suất',
    items: [
      { id: 'N', previewLatex: '\\mathbb{N}', insert: '\\mathbb{N}', title: 'Tập số tự nhiên' },
      { id: 'Z', previewLatex: '\\mathbb{Z}', insert: '\\mathbb{Z}', title: 'Tập số nguyên' },
      { id: 'Q', previewLatex: '\\mathbb{Q}', insert: '\\mathbb{Q}', title: 'Tập số hữu tỉ' },
      { id: 'R', previewLatex: '\\mathbb{R}', insert: '\\mathbb{R}', title: 'Tập số thực' },
      { id: 'cup', previewLatex: '\\cup', insert: '\\cup ', title: 'Hợp' },
      { id: 'cap', previewLatex: '\\cap', insert: '\\cap ', title: 'Giao' },
      { id: 'setminus', previewLatex: '\\setminus', insert: '\\setminus ', title: 'Hiệu tập hợp' },
      { id: 'in', previewLatex: '\\in', insert: '\\in ', title: 'Thuộc' },
      { id: 'notin', previewLatex: '\\notin', insert: '\\notin ', title: 'Không thuộc' },
      { id: 'subset', previewLatex: '\\subset', insert: '\\subset ', title: 'Tập con' },
      { id: 'empty', previewLatex: '\\emptyset', insert: '\\emptyset', title: 'Tập rỗng' },
      { id: 'Pn', previewLatex: 'P_n = n!', insert: 'P_{#0} = #0!', title: 'Hoán vị' },
      { id: 'Ank', previewLatex: 'A_n^k', insert: 'A_{#?}^{#?}', title: 'Chỉnh hợp' },
      { id: 'Cnk', previewLatex: 'C_n^k', insert: 'C_{#?}^{#?}', title: 'Tổ hợp' },
      { id: 'PA', previewLatex: 'P(A)', insert: 'P(#0)', title: 'Xác suất biến cố' },
      { id: 'PAB', previewLatex: 'P(A\\mid B)', insert: 'P(#0 \\mid #?)', title: 'Xác suất có điều kiện' },
      { id: 'xbar', previewLatex: '\\overline{x}', insert: '\\overline{x}', title: 'Số trung bình' },
      { id: 'sigma', previewLatex: '\\sigma', insert: '\\sigma', title: 'Độ lệch chuẩn' },
    ],
  },
  {
    id: 'm_greek',
    label: 'Chữ cái Hy Lạp',
    items: [
      { id: 'alpha', previewLatex: '\\alpha', insert: '\\alpha', title: 'Alpha' },
      { id: 'beta', previewLatex: '\\beta', insert: '\\beta', title: 'Beta' },
      { id: 'gamma', previewLatex: '\\gamma', insert: '\\gamma', title: 'Gamma' },
      { id: 'delta', previewLatex: '\\delta', insert: '\\delta', title: 'Delta nhỏ' },
      { id: 'Delta', previewLatex: '\\Delta', insert: '\\Delta', title: 'Delta hoa' },
      { id: 'eps', previewLatex: '\\varepsilon', insert: '\\varepsilon', title: 'Epsilon' },
      { id: 'theta', previewLatex: '\\theta', insert: '\\theta', title: 'Theta' },
      { id: 'lambda', previewLatex: '\\lambda', insert: '\\lambda', title: 'Lambda' },
      { id: 'mu', previewLatex: '\\mu', insert: '\\mu', title: 'Mu' },
      { id: 'pi', previewLatex: '\\pi', insert: '\\pi', title: 'Pi' },
      { id: 'rho', previewLatex: '\\rho', insert: '\\rho', title: 'Rho' },
      { id: 'sig', previewLatex: '\\sigma', insert: '\\sigma', title: 'Sigma nhỏ' },
      { id: 'Sig', previewLatex: '\\Sigma', insert: '\\Sigma', title: 'Sigma hoa' },
      { id: 'phi', previewLatex: '\\varphi', insert: '\\varphi', title: 'Phi nhỏ' },
      { id: 'Phi', previewLatex: '\\Phi', insert: '\\Phi', title: 'Phi hoa' },
      { id: 'omega', previewLatex: '\\omega', insert: '\\omega', title: 'Omega nhỏ' },
      { id: 'Omega', previewLatex: '\\Omega', insert: '\\Omega', title: 'Omega hoa' },
      { id: 'infty', previewLatex: '\\infty', insert: '\\infty', title: 'Vô cực' },
    ],
  },
];

// ============================================================================
// SECTION IX: 7 PHYSICS SYMBOL GROUPS
// ============================================================================
const PHYSICS_CATEGORIES: SymbolCategory[] = [
  {
    id: 'p_mech',
    label: 'Cơ học',
    items: [
      { id: 'v', previewLatex: '\\vec{v}', insert: '\\vec{v}', title: 'Vận tốc' },
      { id: 'a', previewLatex: '\\vec{a}', insert: '\\vec{a}', title: 'Gia tốc' },
      { id: 'F', previewLatex: '\\vec{F}', insert: '\\vec{F}', title: 'Lực' },
      { id: 'Fms', previewLatex: 'F_{\\mathrm{ms}}', insert: 'F_{\\mathrm{ms}}', title: 'Lực ma sát' },
      { id: 'Fht', previewLatex: 'F_{\\mathrm{ht}}', insert: 'F_{\\mathrm{ht}}', title: 'Lực hướng tâm' },
      { id: 'm', previewLatex: 'm', insert: 'm', title: 'Khối lượng' },
      { id: 'p', previewLatex: '\\vec{p} = m\\vec{v}', insert: '\\vec{p} = m\\vec{v}', title: 'Động lượng' },
      { id: 'A', previewLatex: 'A = Fs\\cos\\alpha', insert: 'A = F\\cdot s\\cdot\\cos\\alpha', title: 'Công cơ học' },
      { id: 'P', previewLatex: 'P = \\frac{A}{t}', insert: 'P = \\frac{#0}{#?}', title: 'Công suất' },
      { id: 'Wd', previewLatex: 'W_{\\text{đ}} = \\frac{1}{2}mv^2', insert: 'W_{\\text{đ}} = \\frac{1}{2}mv^2', title: 'Động năng' },
      { id: 'Wt', previewLatex: 'W_t = mgh', insert: 'W_t = mgh', title: 'Thế năng' },
      { id: 'M', previewLatex: 'M = F\\cdot d', insert: 'M = F\\cdot d', title: 'Mômen lực' },
    ],
  },
  {
    id: 'p_thermo',
    label: 'Nhiệt học',
    items: [
      { id: 'Q', previewLatex: 'Q = mc\\Delta t', insert: 'Q = mc\\Delta t', title: 'Nhiệt lượng' },
      { id: 'T', previewLatex: 'T = t + 273', insert: 'T = t + 273', title: 'Nhiệt độ tuyệt đối' },
      { id: 'pV', previewLatex: 'pV = nRT', insert: 'pV = nRT', title: 'Áp suất & Thể tích (Khí lí tưởng)' },
      { id: 'dU', previewLatex: '\\Delta U = A + Q', insert: '\\Delta U = A + Q', title: 'Biến thiên nội năng' },
      { id: 'c', previewLatex: 'c', insert: 'c', title: 'Nhiệt dung riêng' },
      { id: 'degC', previewLatex: 't^\\circ\\mathrm{C}', insert: '#0^\\circ\\mathrm{C}', title: 'Độ Celsius' },
    ],
  },
  {
    id: 'p_em',
    label: 'Điện & Từ trường',
    items: [
      { id: 'q', previewLatex: 'q', insert: 'q', title: 'Điện tích' },
      { id: 'I', previewLatex: 'I = \\frac{U}{R}', insert: 'I = \\frac{#0}{#?}', title: 'Cường độ dòng điện' },
      { id: 'U', previewLatex: 'U = IR', insert: 'U = IR', title: 'Hiệu điện thế' },
      { id: 'R', previewLatex: 'R_{\\mathrm{td}}', insert: 'R_{\\mathrm{td}}', title: 'Điện trở tương đương' },
      { id: 'C', previewLatex: 'C = \\frac{Q}{U}', insert: 'C = \\frac{#0}{#?}', title: 'Điện dung' },
      { id: 'Evec', previewLatex: '\\vec{E}', insert: '\\vec{E}', title: 'Vectơ điện trường' },
      { id: 'Bvec', previewLatex: '\\vec{B}', insert: '\\vec{B}', title: 'Vectơ cảm ứng từ' },
      { id: 'Phi', previewLatex: '\\Phi = BS\\cos\\alpha', insert: '\\Phi = BS\\cos\\alpha', title: 'Từ thông' },
      { id: 'emf', previewLatex: '\\mathcal{E}', insert: '\\mathcal{E}', title: 'Suất điện động' },
      { id: 'Lorentz', previewLatex: 'F = |q|vB\\sin\\alpha', insert: 'F = |q|vB\\sin\\alpha', title: 'Lực Lorentz' },
    ],
  },
  {
    id: 'p_wave',
    label: 'Dao động & Sóng',
    items: [
      { id: 'shm', previewLatex: 'x = A\\cos(\\omega t + \\varphi)', insert: 'x = A\\cos(\\omega t + \\varphi)', title: 'Phương trình dao động điều hòa' },
      { id: 'T_per', previewLatex: 'T = \\frac{2\\pi}{\\omega}', insert: 'T = \\frac{2\\pi}{\\omega}', title: 'Chu kì' },
      { id: 'f_freq', previewLatex: 'f = \\frac{1}{T}', insert: 'f = \\frac{1}{T}', title: 'Tần số' },
      { id: 'omega', previewLatex: '\\omega', insert: '\\omega', title: 'Tần số góc' },
      { id: 'phi', previewLatex: '\\varphi', insert: '\\varphi', title: 'Pha ban đầu' },
      { id: 'lambda', previewLatex: '\\lambda = \\frac{v}{f}', insert: '\\lambda = \\frac{v}{f}', title: 'Bước sóng' },
    ],
  },
  {
    id: 'p_optics',
    label: 'Quang học',
    items: [
      { id: 'snell', previewLatex: 'n_1\\sin i = n_2\\sin r', insert: 'n_1\\sin i = n_2\\sin r', title: 'Định luật khúc xạ ánh sáng' },
      { id: 'lens', previewLatex: '\\frac{1}{f} = \\frac{1}{d} + \\frac{1}{d\'}', insert: '\\frac{1}{f} = \\frac{1}{d} + \\frac{1}{d\'}', title: 'Công thức thấu kính' },
      { id: 'D_opt', previewLatex: 'D = \\frac{1}{f}', insert: 'D = \\frac{1}{f}', title: 'Độ tụ thấu kính' },
      { id: 'young', previewLatex: 'i = \\frac{\\lambda D}{a}', insert: 'i = \\frac{\\lambda D}{a}', title: 'Khoảng vân giao thoa' },
    ],
  },
  {
    id: 'p_nuclear',
    label: 'Vật lí hạt nhân',
    items: [
      { id: 'nuc', previewLatex: '{}_{Z}^{A}\\mathrm{X}', insert: '{}_{#?}^{#?}\\mathrm{#0}', title: 'Ký hiệu hạt nhân' },
      { id: 'alpha_p', previewLatex: '{}_{2}^{4}\\mathrm{He}', insert: '{}_{2}^{4}\\mathrm{He}', title: 'Hạt alpha' },
      { id: 'proton', previewLatex: '{}_{1}^{1}\\mathrm{p}', insert: '{}_{1}^{1}\\mathrm{p}', title: 'Proton' },
      { id: 'neutron', previewLatex: '{}_{0}^{1}\\mathrm{n}', insert: '{}_{0}^{1}\\mathrm{n}', title: 'Neutron' },
      { id: 'beta_m', previewLatex: '{}_{-1}^{0}\\mathrm{e}', insert: '{}_{-1}^{0}\\mathrm{e}', title: 'Hạt beta trừ' },
      { id: 'react', previewLatex: '\\mathrm{X}_1 + \\mathrm{X}_2 \\to \\mathrm{Y}_1 + \\mathrm{Y}_2', insert: '{}_{#?}^{#?}\\mathrm{#0} \\longrightarrow {}_{#?}^{#?}\\mathrm{#?}', title: 'Phản ứng hạt nhân' },
      { id: 'E_mc2', previewLatex: 'E = mc^2', insert: 'E = mc^2', title: 'Năng lượng Einstein' },
      { id: 'Wlk', previewLatex: 'W_{\\mathrm{lk}} = \\Delta m\\cdot c^2', insert: 'W_{\\mathrm{lk}} = \\Delta m\\cdot c^2', title: 'Năng lượng liên kết' },
    ],
  },
  {
    id: 'p_units',
    label: 'Đơn vị đo SI',
    items: [
      { id: 'u_m', previewLatex: '\\mathrm{m}', insert: '\\,\\mathrm{m}', title: 'Mét' },
      { id: 'u_km', previewLatex: '\\mathrm{km}', insert: '\\,\\mathrm{km}', title: 'Kilômét' },
      { id: 'u_cm', previewLatex: '\\mathrm{cm}', insert: '\\,\\mathrm{cm}', title: 'Xentimét' },
      { id: 'u_mm', previewLatex: '\\mathrm{mm}', insert: '\\,\\mathrm{mm}', title: 'Milimét' },
      { id: 'u_s', previewLatex: '\\mathrm{s}', insert: '\\,\\mathrm{s}', title: 'Giây' },
      { id: 'u_ms', previewLatex: '\\mathrm{ms}', insert: '\\,\\mathrm{ms}', title: 'Miligiây' },
      { id: 'u_mps', previewLatex: '\\mathrm{m/s}', insert: '\\,\\mathrm{m/s}', title: 'Mét trên giây' },
      { id: 'u_mps2', previewLatex: '\\mathrm{m/s}^2', insert: '\\,\\mathrm{m/s}^2', title: 'Mét trên giây bình phương' },
      { id: 'u_kg', previewLatex: '\\mathrm{kg}', insert: '\\,\\mathrm{kg}', title: 'Kilôgam' },
      { id: 'u_g', previewLatex: '\\mathrm{g}', insert: '\\,\\mathrm{g}', title: 'Gam' },
      { id: 'u_N', previewLatex: '\\mathrm{N}', insert: '\\,\\mathrm{N}', title: 'Newton' },
      { id: 'u_J', previewLatex: '\\mathrm{J}', insert: '\\,\\mathrm{J}', title: 'Joule' },
      { id: 'u_W', previewLatex: '\\mathrm{W}', insert: '\\,\\mathrm{W}', title: 'Watt' },
      { id: 'u_Pa', previewLatex: '\\mathrm{Pa}', insert: '\\,\\mathrm{Pa}', title: 'Pascal' },
      { id: 'u_V', previewLatex: '\\mathrm{V}', insert: '\\,\\mathrm{V}', title: 'Volt' },
      { id: 'u_A', previewLatex: '\\mathrm{A}', insert: '\\,\\mathrm{A}', title: 'Ampe' },
      { id: 'u_Ohm', previewLatex: '\\Omega', insert: '\\,\\Omega', title: 'Ohm' },
      { id: 'u_Hz', previewLatex: '\\mathrm{Hz}', insert: '\\,\\mathrm{Hz}', title: 'Hertz' },
      { id: 'u_T', previewLatex: '\\mathrm{T}', insert: '\\,\\mathrm{T}', title: 'Tesla' },
      { id: 'u_C', previewLatex: '\\mathrm{C}', insert: '\\,\\mathrm{C}', title: 'Coulomb' },
      { id: 'u_K', previewLatex: '\\mathrm{K}', insert: '\\,\\mathrm{K}', title: 'Kelvin' },
      { id: 'u_degC', previewLatex: '^\\circ\\mathrm{C}', insert: '^\\circ\\mathrm{C}', title: 'Độ C' },
      { id: 'u_uC', previewLatex: '\\mu\\mathrm{C}', insert: '\\,\\mu\\mathrm{C}', title: 'Micro-Coulomb' },
      { id: 'u_k10', previewLatex: '\\times 10^{n}', insert: '\\times 10^{#?}', title: 'Lũy thừa 10' },
    ],
  },
];

// ============================================================================
// SECTION X: 7 CHEMISTRY SYMBOL GROUPS (+ Full 118-element Periodic Table tab!)
// ============================================================================
const CHEMISTRY_CATEGORIES: SymbolCategory[] = [
  {
    id: 'c_periodic',
    label: '118 Nguyên tố',
    items: [], // Rendered with dedicated searchable 118-element Periodic Table picker
  },
  {
    id: 'c_formula',
    label: 'Công thức phân tử',
    items: [
      { id: 'c_sub2', previewLatex: '\\mathrm{X}_2', insert: '#0_{2}', title: 'Chỉ số nguyên tử 2' },
      { id: 'c_sub3', previewLatex: '\\mathrm{X}_3', insert: '#0_{3}', title: 'Chỉ số nguyên tử 3' },
      { id: 'c_sub4', previewLatex: '\\mathrm{X}_4', insert: '#0_{4}', title: 'Chỉ số nguyên tử 4' },
      { id: 'c_subn', previewLatex: '\\mathrm{X}_n', insert: '#0_{#?}', title: 'Chỉ số nguyên tử tùy ý' },
      { id: 'c_grp', previewLatex: '(\\mathrm{OH})_2', insert: '(\\mathrm{#0})_{#?}', title: 'Nhóm nguyên tử trong ngoặc' },
      { id: 'c_hydrate', previewLatex: '\\cdot 5\\mathrm{H}_2\\mathrm{O}', insert: '\\cdot #?\\mathrm{H}_2\\mathrm{O}', title: 'Muối ngậm nước' },
      { id: 'c_ce', previewLatex: '\\ce{H2SO4}', insert: '\\ce{#0}', title: 'Khối mhchem \\ce{...}' },
      { id: 'c_h2so4', previewLatex: '\\mathrm{H}_2\\mathrm{SO}_4', insert: '\\mathrm{H}_2\\mathrm{SO}_4', title: 'Sulfuric acid' },
      { id: 'c_caoh2', previewLatex: '\\mathrm{Ca}(\\mathrm{OH})_2', insert: '\\mathrm{Ca}(\\mathrm{OH})_2', title: 'Calcium hydroxide' },
    ],
  },
  {
    id: 'c_ions',
    label: 'Ion & Số oxi hóa',
    items: [
      { id: 'i_p1', previewLatex: '\\mathrm{X}^{+}', insert: '#0^{+}', title: 'Ion dương 1+' },
      { id: 'i_m1', previewLatex: '\\mathrm{X}^{-}', insert: '#0^{-}', title: 'Ion âm 1-' },
      { id: 'i_p2', previewLatex: '\\mathrm{X}^{2+}', insert: '#0^{2+}', title: 'Ion dương 2+' },
      { id: 'i_p3', previewLatex: '\\mathrm{X}^{3+}', insert: '#0^{3+}', title: 'Ion dương 3+' },
      { id: 'i_m2', previewLatex: '\\mathrm{X}^{2-}', insert: '#0^{2-}', title: 'Ion âm 2-' },
      { id: 'i_m3', previewLatex: '\\mathrm{X}^{3-}', insert: '#0^{3-}', title: 'Ion âm 3-' },
      { id: 'i_so4', previewLatex: '\\mathrm{SO}_4^{2-}', insert: '\\mathrm{SO}_4^{2-}', title: 'Ion sunfat' },
      { id: 'i_no3', previewLatex: '\\mathrm{NO}_3^{-}', insert: '\\mathrm{NO}_3^{-}', title: 'Ion nitrat' },
      { id: 'i_co3', previewLatex: '\\mathrm{CO}_3^{2-}', insert: '\\mathrm{CO}_3^{2-}', title: 'Ion cacbonat' },
      { id: 'i_nh4', previewLatex: '\\mathrm{NH}_4^{+}', insert: '\\mathrm{NH}_4^{+}', title: 'Ion amoni' },
      { id: 'i_oh', previewLatex: '\\mathrm{OH}^{-}', insert: '\\mathrm{OH}^{-}', title: 'Ion hiđroxit' },
      { id: 'i_ox', previewLatex: '\\overset{+3}{\\mathrm{Fe}}', insert: '\\overset{#?}{\\mathrm{#0}}', title: 'Số oxi hóa trên nguyên tố' },
    ],
  },
  {
    id: 'c_equations',
    label: 'Phương trình hóa học',
    items: [
      { id: 'a_r', previewLatex: '\\longrightarrow', insert: ' \\longrightarrow ', title: 'Mũi tên phản ứng 1 chiều' },
      { id: 'a_eq', previewLatex: '\\rightleftharpoons', insert: ' \\rightleftharpoons ', title: 'Mũi tên thuận nghịch / cân bằng' },
      { id: 'a_t', previewLatex: '\\xrightarrow{t^\\circ}', insert: ' \\xrightarrow{t^\\circ} ', title: 'Nhiệt độ t°' },
      { id: 'a_xt', previewLatex: '\\xrightarrow{\\text{xt},\\,t^\\circ}', insert: ' \\xrightarrow{\\text{xt},\\,t^\\circ} ', title: 'Xúc tác và nhiệt độ' },
      { id: 'a_p', previewLatex: '\\xrightarrow[p]{\\text{xt},\\,t^\\circ}', insert: ' \\xrightarrow[#?]{#0} ', title: 'Điều kiện trên và dưới mũi tên' },
      { id: 'a_eq_cond', previewLatex: '\\xrightleftharpoons{\\text{xt},\\,t^\\circ}', insert: ' \\xrightleftharpoons[#?]{#0} ', title: 'Thuận nghịch có điều kiện trên & dưới' },
      { id: 'a_dp', previewLatex: '\\xrightarrow{\\text{đpnc}}', insert: ' \\xrightarrow{\\text{đpnc}} ', title: 'Điện phân nóng chảy' },
      { id: 'a_as', previewLatex: '\\xrightarrow{\\text{as}}', insert: ' \\xrightarrow{\\text{as}} ', title: 'Ánh sáng' },
    ],
  },
  {
    id: 'c_states',
    label: 'Trạng thái & Hiện tượng',
    items: [
      { id: 's_s', previewLatex: '(\\mathrm{s})', insert: '(\\mathrm{s})', title: 'Chất rắn (solid)' },
      { id: 's_l', previewLatex: '(\\mathrm{l})', insert: '(\\mathrm{l})', title: 'Chất lỏng (liquid)' },
      { id: 's_g', previewLatex: '(\\mathrm{g})', insert: '(\\mathrm{g})', title: 'Chất khí (gas)' },
      { id: 's_aq', previewLatex: '(\\mathrm{aq})', insert: '(\\mathrm{aq})', title: 'Dung dịch (aqueous)' },
      { id: 's_down', previewLatex: '\\downarrow', insert: '\\downarrow', title: 'Kết tủa' },
      { id: 's_up', previewLatex: '\\uparrow', insert: '\\uparrow', title: 'Khí thoát ra' },
    ],
  },
  {
    id: 'c_bonds',
    label: 'Liên kết & Cấu tạo',
    items: [
      { id: 'b_1', previewLatex: '\\mathrm{C}\\text{-}\\mathrm{C}', insert: '\\text{-}', title: 'Liên kết đơn' },
      { id: 'b_2', previewLatex: '\\mathrm{C}=\\mathrm{C}', insert: '=', title: 'Liên kết đôi' },
      { id: 'b_3', previewLatex: '\\mathrm{C}\\equiv\\mathrm{C}', insert: '\\equiv ', title: 'Liên kết ba' },
      { id: 'b_e', previewLatex: '\\cdot', insert: '\\cdot ', title: 'Electron độc thân' },
      { id: 'b_pair', previewLatex: '\\colon', insert: '\\colon ', title: 'Cặp electron chưa liên kết' },
      { id: 'b_eth', previewLatex: '\\mathrm{CH}_3\\text{-}\\mathrm{CH}_2\\text{-}\\mathrm{OH}', insert: '\\mathrm{CH}_3\\text{-}\\mathrm{CH}_2\\text{-}\\mathrm{OH}', title: 'Mẫu công thức cấu tạo thu gọn' },
    ],
  },
  {
    id: 'c_isotopes',
    label: 'Đồng vị',
    items: [
      { id: 'iso_tpl', previewLatex: '{}_{Z}^{A}\\mathrm{X}', insert: '{}_{#?}^{#?}\\mathrm{#0}', title: 'Mẫu đồng vị (số khối A, số hiệu Z)' },
      { id: 'iso_c12', previewLatex: '{}_{6}^{12}\\mathrm{C}', insert: '{}_{6}^{12}\\mathrm{C}', title: 'Carbon-12' },
      { id: 'iso_cl35', previewLatex: '{}_{17}^{35}\\mathrm{Cl}', insert: '{}_{17}^{35}\\mathrm{Cl}', title: 'Chlorine-35' },
      { id: 'iso_h2', previewLatex: '{}_{1}^{2}\\mathrm{H}', insert: '{}_{1}^{2}\\mathrm{H}', title: 'Deuterium' },
      { id: 'iso_o16', previewLatex: '{}_{8}^{16}\\mathrm{O}', insert: '{}_{8}^{16}\\mathrm{O}', title: 'Oxygen-16' },
    ],
  },
];

const CATEGORIES_BY_SUBJECT: Record<FormulaSubject, SymbolCategory[]> = {
  math: MATH_CATEGORIES,
  physics: PHYSICS_CATEGORIES,
  chemistry: CHEMISTRY_CATEGORIES,
};

let mathliveConfigured = false;

export const FormulaStudioPanel: React.FC<FormulaStudioPanelProps> = ({
  open,
  mode,
  formula,
  initialSubject,
  initialLatex,
  onClose,
  onApplyEdit,
  onInsertIntoDocument,
  onSaveToLibrary,
  onNotify,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mfRef = useRef<MathfieldElement | null>(null);

  const [latex, setLatex] = useState('');
  const [activeSubject, setActiveSubject] = useState<FormulaSubject>(initialSubject);
  const [activeCat, setActiveCat] = useState<string>('m_frac_rad');
  const [showAdvancedLatex, setShowAdvancedLatex] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [studioFullscreen, setStudioFullscreen] = useState(false);
  const [elementQuery, setElementQuery] = useState('');
  const [insertElementAsIsotope, setInsertElementAsIsotope] = useState(false);

  // Inline save-to-library drawer inside studio
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveGrade, setSaveGrade] = useState<GradeLevel>('10');
  const [saveTopic, setSaveTopic] = useState('');
  const [saveConditions, setSaveConditions] = useState('');

  // Sync studio state whenever opened or target changes
  useEffect(() => {
    if (!open) return;
    const subj: FormulaSubject = mode === 'edit' && formula ? formula.subject : initialSubject;
    const startTex =
      mode === 'edit' && formula
        ? formula.activeLatex
        : initialLatex !== undefined
        ? initialLatex
        : '';
    setActiveSubject(subj);
    setActiveCat(CATEGORIES_BY_SUBJECT[subj][0].id);
    setLatex(startTex);
    setShowAdvancedLatex(false);
    setShowSaveForm(false);
  }, [open, mode, formula?.id, initialSubject, initialLatex]);

  // Mount MathLive <math-field> using local offline fonts
  useEffect(() => {
    if (!open || !hostRef.current) return;
    let cancelled = false;

    const startTex =
      mode === 'edit' && formula
        ? formula.activeLatex
        : initialLatex !== undefined
        ? initialLatex
        : '';

    (async () => {
      const mod = await import('mathlive');
      if (cancelled || !hostRef.current) return;

      if (!mathliveConfigured) {
        mod.MathfieldElement.fontsDirectory = '/mathlive/fonts';
        mod.MathfieldElement.soundsDirectory = null;
        mathliveConfigured = true;
      }

      const mf = new mod.MathfieldElement();
      mf.value = startTex;
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
  }, [open, mode, formula?.id, initialLatex]);

  const livePreview = useMemo(() => {
    if (!latex.trim()) return { ok: false, svg: '', mathml: '', error: '' };
    return renderLatexToSvg(latex, mode === 'edit' ? Boolean(formula?.displayMode) : false);
  }, [latex, mode, formula?.displayMode]);

  const filteredElements = useMemo(
    () => searchPeriodicElements(elementQuery),
    [elementQuery]
  );

  if (!open) return null;

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

  // Strip outermost accent macro around the current expression (Section VIII.4: "Cho phép thêm, sửa và bỏ từng dấu")
  const handleRemoveOuterAccent = () => {
    const stripped = latex.replace(
      /\\(?:overline|underline|hat|widehat|dot|ddot|vec|overleftarrow|overrightarrow|overleftrightarrow|overbrace|underbrace)\{([^{}]+)\}(?:[\^_]\{[^{}]*\})?/g,
      '$1'
    );
    if (stripped !== latex) {
      setLatex(stripped);
      mfRef.current?.setValue(stripped);
      mfRef.current?.focus();
      onNotify('Đã gỡ dấu trên/dưới bọc ngoài ký hiệu.', 'info');
    } else {
      onNotify('Không tìm thấy dấu trên/dưới bọc ngoài để gỡ.', 'info');
    }
  };

  // Matrix row/column manipulation via MathLive native commands (Section VIII.7)
  const runMatrixCommand = (cmd: 'addRowAfter' | 'removeRow' | 'addColumnAfter' | 'removeColumn') => {
    const mf = mfRef.current;
    if (!mf) return;
    mf.executeCommand(cmd);
    setLatex(mf.getValue('latex'));
    mf.focus();
  };

  const handleCreateBlank = () => {
    setLatex('');
    if (mfRef.current) {
      mfRef.current.setValue('');
      mfRef.current.focus();
    }
  };

  const handlePasteIntoStudio = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt.trim()) {
        const clean = txt.trim().replace(/^\$\$|\$\$$|^\$|\$$/g, '');
        insertTemplate(clean);
        onNotify('Đã dán công thức từ clipboard vào trình soạn thảo.', 'success');
      }
    } catch {
      mfRef.current?.focus();
      onNotify('Hãy nhấn Ctrl+V (hoặc Cmd+V) trực tiếp vào ô soạn thảo công thức.', 'info');
    }
  };

  const handleUndo = () => {
    if (!mfRef.current) return;
    mfRef.current.executeCommand('undo');
    setLatex(mfRef.current.getValue('latex'));
    mfRef.current.focus();
  };

  const handleRedo = () => {
    if (!mfRef.current) return;
    mfRef.current.executeCommand('redo');
    setLatex(mfRef.current.getValue('latex'));
    mfRef.current.focus();
  };

  const handleResetOriginal = () => {
    if (mode === 'edit' && formula) {
      setLatex(formula.originalLatex);
      mfRef.current?.setValue(formula.originalLatex);
      mfRef.current?.focus();
    } else {
      handleCreateBlank();
    }
  };

  const handleAdvancedLatexChange = (value: string) => {
    setLatex(value);
    if (mfRef.current && mfRef.current.getValue('latex') !== value) {
      mfRef.current.setValue(value, { silenceNotifications: true });
    }
  };

  const buildTempFormulaSegment = (): FormulaSegment => ({
    id: formula?.id || 'studio_temp',
    type: 'formula',
    raw: latex,
    originalLatex: latex,
    fixedLatex: latex,
    activeLatex: latex,
    displayMode: mode === 'edit' ? Boolean(formula?.displayMode) : false,
    sourceFormat: 'mathlive',
    subject: activeSubject,
    ommlCompatible: livePreview.ok,
    status: livePreview.ok ? 'valid' : 'unrecoverable',
    userDecision: 'edited',
    notes: [],
    svg: livePreview.svg,
    mathml: livePreview.mathml,
    validated: livePreview.ok,
  });

  const handleCopyCurrent = async (format: 'display' | 'latex' | 'mathml' | 'unicodemath' | 'svg' | 'png') => {
    if (!latex.trim()) {
      onNotify('Ô soạn thảo đang trống.', 'warning');
      return;
    }
    const res = await copyFormulaAs(buildTempFormulaSegment(), format);
    onNotify(res.message, res.ok ? 'success' : 'warning');
  };

  const handleExportWordEq = async () => {
    if (!livePreview.ok) {
      onNotify('Công thức chưa hợp lệ để xuất Word Equation.', 'warning');
      return;
    }
    await exportSingleFormulaDocx(buildTempFormulaSegment(), 'MathFix-EDU-Cong-Thuc.docx');
    onNotify('Đã xuất tệp DOCX chứa Word Equation chỉnh sửa được.', 'success');
  };

  const handleConfirmSaveToLibrary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim() || !latex.trim()) return;
    onSaveToLibrary({
      name: saveName.trim(),
      subject: activeSubject,
      grade: saveGrade,
      topic: saveTopic.trim() || 'Công thức cá nhân',
      group: 'Đã lưu từ trình soạn thảo',
      latex: latex.trim(),
      displayMode: false,
      conditions: saveConditions.trim() || undefined,
    });
    setShowSaveForm(false);
    setSaveName('');
    setSaveConditions('');
  };

  return (
    <section
      aria-label="Trình soạn thảo công thức trực quan"
      className={
        studioFullscreen
          ? 'no-print fixed inset-0 z-40 flex flex-col bg-white'
          : 'no-print mb-3 rounded-xl border border-[#0B4F8A]/30 bg-white shadow-sm'
      }
    >
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 rounded-t-xl">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[15px] font-semibold text-slate-900">
            {mode === 'edit' ? 'Chỉnh sửa công thức trực quan' : 'Soạn thảo công thức mới (MathLive)'}
          </h2>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {SUBJECT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSwitchSubject(tab.id)}
                className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeSubject === tab.id
                    ? 'bg-[#0B4F8A] text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleCreateBlank}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Tạo mới
          </button>
          <button
            type="button"
            onClick={handlePasteIntoStudio}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Dán
          </button>
          <button
            type="button"
            onClick={handleUndo}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            title="Hoàn tác"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Hoàn tác
          </button>
          <button
            type="button"
            onClick={handleRedo}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            title="Làm lại"
          >
            <Redo2 className="h-3.5 w-3.5" />
            Làm lại
          </button>
          <button
            type="button"
            onClick={handleResetOriginal}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            title="Xóa / về bản gốc"
          >
            {mode === 'edit' ? <RotateCcw className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
            {mode === 'edit' ? 'Về gốc' : 'Xóa'}
          </button>
          <button
            type="button"
            onClick={() => setStudioFullscreen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            title={studioFullscreen ? 'Thu gọn bảng soạn thảo' : 'Mở toàn màn hình'}
          >
            {studioFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{studioFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStudioFullscreen(false);
              onClose();
            }}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
            aria-label="Đóng trình soạn thảo công thức"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Studio Body */}
      <div className={`mathfix-scroll overflow-y-auto px-4 py-3 space-y-3 ${studioFullscreen ? 'flex-1' : 'max-h-[58vh]'}`}>
        {/* MathLive Visual Input + Live MathJax Preview side by side on wide screens */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          <div className="lg:col-span-7 flex flex-col">
            <div ref={hostRef} className="min-h-[76px] w-full overflow-x-auto" />
            {!isReady && (
              <p className="mt-1 text-xs text-slate-500">Đang khởi tạo trình soạn thảo MathLive ngoại tuyến...</p>
            )}
          </div>
          <div className="lg:col-span-5 flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Xem trước chuẩn MathJax</span>
              {!latex.trim() ? (
                <span>Nhập ký hiệu để xem trước</span>
              ) : livePreview.ok ? (
                <span className="text-emerald-700">Hợp lệ · Sẵn sàng xuất Word</span>
              ) : (
                <span className="text-red-600">Chưa hợp lệ</span>
              )}
            </div>
            <div className="mt-1.5 flex min-h-[54px] items-center py-1">
              {livePreview.ok && livePreview.svg ? (
                <ResponsiveFormula
                  svg={livePreview.svg}
                  baseFontSize="1.28rem"
                  minScale={0.72}
                  align="center"
                />
              ) : (
                <span className="mx-auto text-[15px] text-slate-400">
                  {latex.trim() ? livePreview.error || 'Đang kiểm tra cú pháp...' : 'Chọn mẫu bên dưới hoặc gõ trực tiếp'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Categorized Visual Symbol Palette */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 space-y-2">
          {/* Category sub-tabs */}
          <div className="mathfix-scroll flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-2">
            {subjectCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCat(cat.id)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentCategory.id === cat.id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-700 hover:bg-white hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}

            {/* Special Contextual Controls for Accents & Matrices */}
            {currentCategory.id === 'm_accents' && (
              <button
                type="button"
                onClick={handleRemoveOuterAccent}
                className="ml-auto rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap cursor-pointer"
              >
                Bỏ dấu trên/dưới
              </button>
            )}
            {currentCategory.id === 'm_matrix' && (
              <div className="ml-auto flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => runMatrixCommand('addRowAfter')}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-[#0B4F8A] cursor-pointer"
                >
                  <Rows2 className="h-3 w-3" /> +Hàng
                </button>
                <button
                  type="button"
                  onClick={() => runMatrixCommand('removeRow')}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-red-400 cursor-pointer"
                >
                  −Hàng
                </button>
                <button
                  type="button"
                  onClick={() => runMatrixCommand('addColumnAfter')}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-[#0B4F8A] cursor-pointer"
                >
                  <Columns2 className="h-3 w-3" /> +Cột
                </button>
                <button
                  type="button"
                  onClick={() => runMatrixCommand('removeColumn')}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-red-400 cursor-pointer"
                >
                  −Cột
                </button>
              </div>
            )}
          </div>

          {/* Dedicated Searchable 118-Element Periodic Table (Section X.1) */}
          {currentCategory.id === 'c_periodic' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={elementQuery}
                    onChange={(e) => setElementQuery(e.target.value)}
                    placeholder="Tìm 118 nguyên tố theo ký hiệu (Fe, Na), tên (Iron, Sắt) hoặc Z..."
                    className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 focus:border-[#0B4F8A] focus:outline-none"
                  />
                </div>
                <label className="inline-flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={insertElementAsIsotope}
                    onChange={(e) => setInsertElementAsIsotope(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#0B4F8A]"
                  />
                  <span>Chèn kèm số khối & số hiệu (đồng vị)</span>
                </label>
                <span className="text-xs text-slate-500 tabular-nums">
                  {filteredElements.length} / {PERIODIC_TABLE.length} nguyên tố
                </span>
              </div>

              <div className="mathfix-scroll grid max-h-40 grid-cols-4 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1 overflow-y-auto pr-1">
                {filteredElements.map((el) => (
                  <button
                    key={el.z}
                    type="button"
                    onClick={() =>
                      insertTemplate(
                        insertElementAsIsotope
                          ? `{}_{${el.z}}^{${Math.round(parseFloat(el.mass))}}\\mathrm{${el.symbol}}`
                          : `\\mathrm{${el.symbol}}`
                      )
                    }
                    title={`${el.z}. ${el.name}${el.viCommon ? ` (${el.viCommon})` : ''} — M ≈ ${el.mass}`}
                    className="flex flex-col items-center rounded-md border border-slate-200 bg-white px-1.5 py-1 hover:border-[#0B4F8A] hover:bg-sky-50/70 transition-colors cursor-pointer"
                  >
                    <span className="self-start text-[10px] text-slate-400 tabular-nums leading-none">
                      {el.z}
                    </span>
                    <span className="text-sm font-bold text-slate-900 leading-tight">{el.symbol}</span>
                    <span className="w-full truncate text-center text-[10px] text-slate-500 leading-tight">
                      {el.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Visual Formula Buttons (Rendered with MathJax SVG — Section VIII) */
            <div className="flex flex-wrap gap-1.5">
              {currentCategory.items.map((item) => {
                const svg = getVisualSymbolSvg(item.previewLatex);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => insertTemplate(item.insert)}
                    title={item.title}
                    className="inline-flex min-h-[40px] min-w-[46px] items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900 hover:border-[#0B4F8A] hover:bg-sky-50/70 transition-colors cursor-pointer"
                  >
                    {svg ? (
                      <span
                        className="mathfix-svg-host pointer-events-none"
                        style={{ fontSize: '0.96rem', padding: 0 }}
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />
                    ) : (
                      <span className="text-sm font-medium">{item.fallbackText || item.title}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Inline Save-to-Library Mini Form (Optional, triggered by "Lưu vào thư viện") */}
        {showSaveForm && (
          <form
            onSubmit={handleConfirmSaveToLibrary}
            className="rounded-lg border border-[#0B4F8A]/30 bg-sky-50/40 p-3 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Lưu công thức này vào Thư viện cá nhân (IndexedDB)</span>
              <button
                type="button"
                onClick={() => setShowSaveForm(false)}
                className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                required
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Tên công thức *"
                className="sm:col-span-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#0B4F8A] focus:outline-none"
              />
              <select
                value={saveGrade}
                onChange={(e) => setSaveGrade(e.target.value as GradeLevel)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
              >
                <option value="10">Khối 10</option>
                <option value="11">Khối 11</option>
                <option value="12">Khối 12</option>
              </select>
              <input
                type="text"
                value={saveTopic}
                onChange={(e) => setSaveTopic(e.target.value)}
                placeholder="Chủ đề (vd: Động học)"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#0B4F8A] focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={saveConditions}
                onChange={(e) => setSaveConditions(e.target.value)}
                placeholder="Điều kiện áp dụng (tùy chọn)"
                className="flex-1 min-w-[200px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#0B4F8A] focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-md bg-[#0B4F8A] px-3.5 py-1.5 text-sm font-medium text-white hover:bg-[#093F6F] cursor-pointer"
              >
                Lưu công thức
              </button>
            </div>
          </form>
        )}

        {/* Hidden by Default: Advanced LaTeX Source Toggle (Section VII) */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowAdvancedLatex((v) => !v)}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {showAdvancedLatex ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span>Chế độ nâng cao: Hiển thị mã LaTeX nguồn</span>
          </button>
          {showAdvancedLatex && (
            <textarea
              value={latex}
              onChange={(e) => handleAdvancedLatexChange(e.target.value)}
              rows={2}
              spellCheck={false}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono text-sm text-slate-900 focus:border-[#0B4F8A] focus:bg-white focus:outline-none"
              aria-label="Mã LaTeX nguồn nâng cao"
            />
          )}
        </div>
      </div>

      {/* Studio Action Footer (Section XI: All required actions) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 rounded-b-xl">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleCopyCurrent('display')}
            disabled={!livePreview.ok}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#0B4F8A]/40 bg-sky-50 px-3 py-1.5 text-sm font-medium text-[#0B4F8A] hover:bg-sky-100 disabled:opacity-45 cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            Sao chép cho Word
          </button>
          <button
            type="button"
            onClick={() => handleCopyCurrent('mathml')}
            disabled={!livePreview.ok}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5" />
            Sao chép
          </button>
          <button
            type="button"
            onClick={handleExportWordEq}
            disabled={!livePreview.ok}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
          >
            <FileDown className="h-3.5 w-3.5" />
            Xuất Word Equation
          </button>
          <button
            type="button"
            onClick={() => setShowSaveForm((v) => !v)}
            disabled={!latex.trim()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Lưu vào thư viện
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setStudioFullscreen(false);
              onClose();
            }}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Hủy
          </button>

          <button
            type="button"
            disabled={!livePreview.ok}
            onClick={() => onInsertIntoDocument(latex.trim(), false, activeSubject)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#0B4F8A] bg-white px-3 py-1.5 text-[15px] font-medium text-[#0B4F8A] hover:bg-sky-50 disabled:opacity-45 cursor-pointer"
            title="Chèn công thức nội tuyến ($...$) tại vị trí con trỏ trong Văn bản gốc"
          >
            <PlusSquare className="h-4 w-4" />
            Chèn nội tuyến
          </button>

          <button
            type="button"
            disabled={!livePreview.ok}
            onClick={() => onInsertIntoDocument(latex.trim(), true, activeSubject)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#0B4F8A] bg-white px-3 py-1.5 text-[15px] font-medium text-[#0B4F8A] hover:bg-sky-50 disabled:opacity-45 cursor-pointer"
            title="Chèn công thức độc lập ($$...$$) tại vị trí con trỏ trong Văn bản gốc"
          >
            <PlusSquare className="h-4 w-4" />
            Chèn độc lập
          </button>

          {mode === 'edit' && formula && (
            <button
              type="button"
              disabled={!livePreview.ok}
              onClick={() => onApplyEdit(formula.id, latex.trim(), activeSubject)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B4F8A] px-4 py-1.5 text-[15px] font-semibold text-white hover:bg-[#093F6F] disabled:opacity-45 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              Áp dụng
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
