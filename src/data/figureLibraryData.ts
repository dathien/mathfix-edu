import {
  DiagramElement,
  DiagramScene,
  FigureLibraryTemplate,
  Geometry3DSolidType,
  GraphPlotState,
} from '../engine/figureTypes';
import {
  createAceticAcidStructure,
  createBenzeneStructure,
  createEthanolStructure,
  renderChemStructureToSvg,
} from '../engine/chemStructureEngine';
import { createDefaultDiagramScene, renderDiagramSceneToSvg } from '../engine/diagramRenderer';
import {
  createDefaultGeometry3DState,
  GEOMETRY_3D_LABELS,
  renderGeometry3DToSvg,
} from '../engine/geometry3dEngine';
import { createDefaultGraphState, renderGraphPlotToSvg } from '../engine/graphEngine';

function makeScene(elements: DiagramElement[], width = 560, height = 360): DiagramScene {
  return {
    ...createDefaultDiagramScene(),
    width,
    height,
    showGrid: false,
    elements,
  };
}

function makeGraphTemplate(
  id: string,
  name: string,
  grade: '10' | '11' | '12',
  topic: string,
  group: string,
  patch: Partial<GraphPlotState>
): FigureLibraryTemplate {
  return {
    id,
    name,
    subject: 'math',
    grade,
    topic,
    group,
    kind: 'graph',
    isBuiltIn: true,
    sourceData: {
      ...createDefaultGraphState(),
      ...patch,
    },
  };
}

// ============================================================================
// 1. MATH — PLANE GEOMETRY TEMPLATES
// ============================================================================
const MATH_PLANE_TEMPLATES: FigureLibraryTemplate[] = [
  {
    id: 'tpl_math_right_triangle',
    name: 'Tam giác vuông ABC có đường cao AH',
    subject: 'math',
    grade: '10',
    topic: 'Hình học phẳng',
    group: 'Tam giác & Hệ thức lượng',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      {
        id: 'tri',
        type: 'polygon',
        x: 280,
        y: 200,
        points: [
          { x: -120, y: -95 },
          { x: -120, y: 85 },
          { x: 145, y: 85 },
        ],
        stroke: '#0f172a',
        fill: '#f8fafc',
        strokeWidth: 2.2,
        strokeStyle: 'solid',
        zIndex: 1,
      },
      {
        id: 'ra_a',
        type: 'right_angle',
        x: 160,
        y: 285,
        radius: 15,
        stroke: '#0f172a',
        fill: 'none',
        strokeWidth: 1.6,
        strokeStyle: 'solid',
        zIndex: 2,
      },
      {
        id: 'alt_ah',
        type: 'segment',
        x: 160,
        y: 285,
        x2: 244,
        y2: 162,
        stroke: '#2563eb',
        fill: 'none',
        strokeWidth: 1.8,
        strokeStyle: 'dashed',
        zIndex: 2,
      },
      { id: 'ptA', type: 'point', x: 160, y: 285, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'A', labelOffsetX: -14, labelOffsetY: 14, zIndex: 3 },
      { id: 'ptB', type: 'point', x: 160, y: 105, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'B', labelOffsetX: -14, labelOffsetY: -12, zIndex: 3 },
      { id: 'ptC', type: 'point', x: 425, y: 285, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'C', labelOffsetX: 16, labelOffsetY: 10, zIndex: 3 },
      { id: 'ptH', type: 'point', x: 244, y: 162, stroke: '#2563eb', fill: '#2563eb', strokeWidth: 1, strokeStyle: 'solid', label: 'H', labelOffsetX: 14, labelOffsetY: -12, zIndex: 3 },
    ]),
  },
  {
    id: 'tpl_math_isosceles_triangle',
    name: 'Tam giác cân ABC & trung tuyến AM',
    subject: 'math',
    grade: '10',
    topic: 'Hình học phẳng',
    group: 'Tam giác & Hệ thức lượng',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'ab', type: 'segment', x: 280, y: 75, x2: 155, y2: 285, stroke: '#0f172a', fill: 'none', strokeWidth: 2.2, strokeStyle: 'solid', tickCount: 1, zIndex: 1 },
      { id: 'ac', type: 'segment', x: 280, y: 75, x2: 405, y2: 285, stroke: '#0f172a', fill: 'none', strokeWidth: 2.2, strokeStyle: 'solid', tickCount: 1, zIndex: 1 },
      { id: 'bc', type: 'segment', x: 155, y: 285, x2: 405, y2: 285, stroke: '#0f172a', fill: 'none', strokeWidth: 2.2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'am', type: 'segment', x: 280, y: 75, x2: 280, y2: 285, stroke: '#2563eb', fill: 'none', strokeWidth: 1.8, strokeStyle: 'dashed', zIndex: 2 },
      { id: 'ram', type: 'right_angle', x: 280, y: 285, radius: 13, stroke: '#2563eb', fill: 'none', strokeWidth: 1.5, strokeStyle: 'solid', zIndex: 2 },
      { id: 'pA', type: 'point', x: 280, y: 75, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'A', labelOffsetY: -16, zIndex: 3 },
      { id: 'pB', type: 'point', x: 155, y: 285, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'B', labelOffsetX: -14, labelOffsetY: 14, zIndex: 3 },
      { id: 'pC', type: 'point', x: 405, y: 285, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'C', labelOffsetX: 14, labelOffsetY: 14, zIndex: 3 },
      { id: 'pM', type: 'point', x: 280, y: 285, stroke: '#2563eb', fill: '#2563eb', strokeWidth: 1, strokeStyle: 'solid', label: 'M', labelOffsetY: 16, zIndex: 3 },
    ]),
  },
  {
    id: 'tpl_math_circle_tangent',
    name: 'Đường tròn tâm O, bán kính R & tiếp tuyến',
    subject: 'math',
    grade: '10',
    topic: 'Hình học phẳng',
    group: 'Đường tròn',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'c1', type: 'circle', x: 250, y: 185, radius: 95, stroke: '#0f172a', fill: '#f8fafc', strokeWidth: 2.2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'rad', type: 'segment', x: 250, y: 185, x2: 345, y2: 185, stroke: '#2563eb', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', label: 'R', labelOffsetY: -12, zIndex: 2 },
      { id: 'tan', type: 'segment', x: 345, y: 65, x2: 345, y2: 305, stroke: '#dc2626', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', label: 'd', labelOffsetX: 14, labelOffsetY: -95, zIndex: 2 },
      { id: 'ra', type: 'right_angle', x: 345, y: 185, radius: 13, rotation: -90, stroke: '#0f172a', fill: 'none', strokeWidth: 1.5, strokeStyle: 'solid', zIndex: 3 },
      { id: 'chord', type: 'segment', x: 182, y: 118, x2: 318, y2: 118, stroke: '#0f172a', fill: 'none', strokeWidth: 1.8, strokeStyle: 'solid', zIndex: 2 },
      { id: 'pO', type: 'point', x: 250, y: 185, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'O', labelOffsetX: -14, labelOffsetY: 12, zIndex: 4 },
      { id: 'pT', type: 'point', x: 345, y: 185, stroke: '#dc2626', fill: '#dc2626', strokeWidth: 1, strokeStyle: 'solid', label: 'T', labelOffsetX: 14, labelOffsetY: 12, zIndex: 4 },
      { id: 'pA', type: 'point', x: 182, y: 118, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'A', labelOffsetX: -14, labelOffsetY: -10, zIndex: 4 },
      { id: 'pB', type: 'point', x: 318, y: 118, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'B', labelOffsetX: 14, labelOffsetY: -10, zIndex: 4 },
    ]),
  },
  {
    id: 'tpl_math_parallelogram_vectors',
    name: 'Quy tắc hình bình hành (Tổng hai vectơ)',
    subject: 'math',
    grade: '10',
    topic: 'Vectơ',
    group: 'Vectơ & Tứ giác',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'va', type: 'vector', x: 145, y: 265, x2: 345, y2: 265, stroke: '#0f172a', fill: 'none', strokeWidth: 2.4, strokeStyle: 'solid', zIndex: 2 },
      { id: 'vb', type: 'vector', x: 145, y: 265, x2: 235, y2: 115, stroke: '#0f172a', fill: 'none', strokeWidth: 2.4, strokeStyle: 'solid', zIndex: 2 },
      { id: 'vs', type: 'vector', x: 145, y: 265, x2: 435, y2: 115, stroke: '#2563eb', fill: 'none', strokeWidth: 2.6, strokeStyle: 'solid', zIndex: 3 },
      { id: 'd1', type: 'segment', x: 345, y: 265, x2: 435, y2: 115, stroke: '#64748b', fill: 'none', strokeWidth: 1.6, strokeStyle: 'dashed', zIndex: 1 },
      { id: 'd2', type: 'segment', x: 235, y: 115, x2: 435, y2: 115, stroke: '#64748b', fill: 'none', strokeWidth: 1.6, strokeStyle: 'dashed', zIndex: 1 },
      { id: 'f1', type: 'formula', x: 245, y: 290, stroke: '#0f172a', fill: 'none', strokeWidth: 1, strokeStyle: 'solid', formulaLatex: '\\vec{a}', zIndex: 4 },
      { id: 'f2', type: 'formula', x: 170, y: 175, stroke: '#0f172a', fill: 'none', strokeWidth: 1, strokeStyle: 'solid', formulaLatex: '\\vec{b}', zIndex: 4 },
      { id: 'f3', type: 'formula', x: 315, y: 165, stroke: '#2563eb', fill: 'none', strokeWidth: 1, strokeStyle: 'solid', formulaLatex: '\\vec{a}+\\vec{b}', zIndex: 4 },
    ]),
  },
  {
    id: 'tpl_math_parallel_transversal',
    name: 'Hai đường thẳng song song và cát tuyến',
    subject: 'math',
    grade: '10',
    topic: 'Hình học phẳng',
    group: 'Đường thẳng & Góc',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'l1', type: 'segment', x: 90, y: 120, x2: 470, y2: 120, stroke: '#0f172a', fill: 'none', strokeWidth: 2.2, strokeStyle: 'solid', label: 'a', labelOffsetX: -195, labelOffsetY: -12, zIndex: 1 },
      { id: 'l2', type: 'segment', x: 90, y: 240, x2: 470, y2: 240, stroke: '#0f172a', fill: 'none', strokeWidth: 2.2, strokeStyle: 'solid', label: 'b', labelOffsetX: -195, labelOffsetY: -12, zIndex: 1 },
      { id: 'tr', type: 'segment', x: 200, y: 310, x2: 360, y2: 50, stroke: '#2563eb', fill: 'none', strokeWidth: 2.2, strokeStyle: 'solid', label: 'c', labelOffsetX: 85, labelOffsetY: -115, zIndex: 2 },
      { id: 'a1', type: 'angle_mark', x: 317, y: 120, radius: 24, startAngleDeg: 0, endAngleDeg: 58, stroke: '#dc2626', fill: 'none', strokeWidth: 1.8, strokeStyle: 'solid', zIndex: 3 },
      { id: 'a2', type: 'angle_mark', x: 243, y: 240, radius: 24, startAngleDeg: 0, endAngleDeg: 58, stroke: '#dc2626', fill: 'none', strokeWidth: 1.8, strokeStyle: 'solid', zIndex: 3 },
    ]),
  },
  {
    id: 'tpl_math_trapezoid',
    name: 'Hình thang ABCD và đường trung bình MN',
    subject: 'math',
    grade: '10',
    topic: 'Hình học phẳng',
    group: 'Vectơ & Tứ giác',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      {
        id: 'trap',
        type: 'polygon',
        x: 280,
        y: 190,
        points: [
          { x: -85, y: -80 },
          { x: 85, y: -80 },
          { x: 155, y: 80 },
          { x: -155, y: 80 },
        ],
        stroke: '#0f172a',
        fill: '#f8fafc',
        strokeWidth: 2.2,
        strokeStyle: 'solid',
        zIndex: 1,
      },
      { id: 'mn', type: 'segment', x: 160, y: 190, x2: 400, y2: 190, stroke: '#2563eb', fill: 'none', strokeWidth: 2, strokeStyle: 'dashed', zIndex: 2 },
      { id: 'pA', type: 'point', x: 195, y: 110, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'A', labelOffsetX: -12, labelOffsetY: -12, zIndex: 3 },
      { id: 'pB', type: 'point', x: 365, y: 110, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'B', labelOffsetX: 12, labelOffsetY: -12, zIndex: 3 },
      { id: 'pC', type: 'point', x: 435, y: 270, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'C', labelOffsetX: 14, labelOffsetY: 12, zIndex: 3 },
      { id: 'pD', type: 'point', x: 125, y: 270, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'D', labelOffsetX: -14, labelOffsetY: 12, zIndex: 3 },
      { id: 'pM', type: 'point', x: 160, y: 190, stroke: '#2563eb', fill: '#2563eb', strokeWidth: 1, strokeStyle: 'solid', label: 'M', labelOffsetX: -16, labelOffsetY: 0, zIndex: 3 },
      { id: 'pN', type: 'point', x: 400, y: 190, stroke: '#2563eb', fill: '#2563eb', strokeWidth: 1, strokeStyle: 'solid', label: 'N', labelOffsetX: 16, labelOffsetY: 0, zIndex: 3 },
    ]),
  },
];

// ============================================================================
// 2. MATH — ALL 14 3D SPATIAL GEOMETRY MODELS
// ============================================================================
const ALL_3D_SOLIDS: Array<{ type: Geometry3DSolidType; grade: '11' | '12'; group: string }> = [
  { type: 'cube', grade: '11', group: 'Khối đa diện' },
  { type: 'cuboid', grade: '11', group: 'Khối đa diện' },
  { type: 'parallelepiped', grade: '11', group: 'Khối đa diện' },
  { type: 'triangular_prism', grade: '11', group: 'Khối đa diện' },
  { type: 'square_pyramid', grade: '11', group: 'Hình chóp & Tứ diện' },
  { type: 'tetrahedron', grade: '11', group: 'Hình chóp & Tứ diện' },
  { type: 'cylinder', grade: '12', group: 'Khối tròn xoay' },
  { type: 'cone', grade: '12', group: 'Khối tròn xoay' },
  { type: 'sphere', grade: '12', group: 'Khối tròn xoay' },
  { type: 'plane', grade: '11', group: 'Quan hệ không gian' },
  { type: 'space_line', grade: '11', group: 'Quan hệ không gian' },
  { type: 'intersection_line', grade: '11', group: 'Quan hệ không gian' },
  { type: 'cross_section', grade: '11', group: 'Quan hệ không gian' },
  { type: 'oxyz_axes', grade: '12', group: 'Tọa độ Oxyz' },
];

const MATH_3D_TEMPLATES: FigureLibraryTemplate[] = ALL_3D_SOLIDS.map((item) => ({
  id: `tpl_3d_${item.type}`,
  name: GEOMETRY_3D_LABELS[item.type],
  subject: 'math',
  grade: item.grade,
  topic: 'Hình học không gian 3D',
  group: item.group,
  kind: 'geometry_3d',
  isBuiltIn: true,
  sourceData: createDefaultGeometry3DState(item.type),
}));

// ============================================================================
// 3. MATH — FUNCTION GRAPHS + VARIATION / SIGN / VALUE TABLES
// ============================================================================
const MATH_GRAPH_TEMPLATES: FigureLibraryTemplate[] = [
  makeGraphTemplate('tpl_graph_linear', 'Hàm số bậc nhất y = 2x - 1', '10', 'Đồ thị hàm số', 'Hàm đa thức', {
    expressions: [{ id: 'e1', label: 'y = 2x - 1', expression: '2*x - 1', color: '#2563eb', strokeWidth: 2.5, strokeStyle: 'solid', visible: true }],
  }),
  makeGraphTemplate('tpl_graph_quadratic', 'Parabol bậc hai y = x² - 2x - 1', '10', 'Đồ thị hàm số', 'Hàm đa thức', {
    expressions: [{ id: 'e1', label: 'y = x² - 2x - 1', expression: 'x^2 - 2*x - 1', color: '#2563eb', strokeWidth: 2.5, strokeStyle: 'solid', visible: true }],
  }),
  makeGraphTemplate('tpl_graph_cubic', 'Hàm số bậc ba y = x³ - 3x', '12', 'Đồ thị hàm số', 'Hàm đa thức', {
    expressions: [{ id: 'e1', label: 'y = x³ - 3x', expression: 'x^3 - 3*x', color: '#2563eb', strokeWidth: 2.5, strokeStyle: 'solid', visible: true }],
  }),
  makeGraphTemplate('tpl_graph_quartic', 'Hàm trùng phương y = x⁴ - 2x²', '12', 'Đồ thị hàm số', 'Hàm đa thức', {
    xMin: -3.5, xMax: 3.5, yMin: -2.5, yMax: 4.5,
    expressions: [{ id: 'e1', label: 'y = x⁴ - 2x²', expression: 'x^4 - 2*x^2', color: '#7c3aed', strokeWidth: 2.5, strokeStyle: 'solid', visible: true }],
  }),
  makeGraphTemplate('tpl_graph_rational', 'Hàm phân thức y = (2x - 1)/(x - 1)', '12', 'Đồ thị hàm số', 'Hàm phân thức', {
    xMin: -5, xMax: 7, yMin: -5, yMax: 8,
    showAsymptotes: true,
    expressions: [
      { id: 'e1', label: 'y = (2x-1)/(x-1)', expression: '(2*x - 1)/(x - 1)', color: '#2563eb', strokeWidth: 2.5, strokeStyle: 'solid', visible: true },
      { id: 'e2', label: 'TCN y = 2', expression: '2', color: '#dc2626', strokeWidth: 1.5, strokeStyle: 'dashed', visible: true },
    ],
  }),
  makeGraphTemplate('tpl_graph_exp_log', 'Hàm số mũ y = 2^x và logarit y = log₂(x)', '11', 'Đồ thị hàm số', 'Mũ & Logarit', {
    xMin: -4, xMax: 6, yMin: -4, yMax: 6,
    expressions: [
      { id: 'e1', label: 'y = 2^x', expression: '2^x', color: '#2563eb', strokeWidth: 2.5, strokeStyle: 'solid', visible: true },
      { id: 'e2', label: 'y = log₂(x)', expression: 'log2(x)', color: '#16a34a', strokeWidth: 2.5, strokeStyle: 'solid', visible: true, domainMin: 0.02 },
    ],
  }),
  makeGraphTemplate('tpl_graph_trig', 'Hàm lượng giác y = sin(x) và y = cos(x)', '11', 'Đồ thị hàm số', 'Lượng giác', {
    xMin: -6.5, xMax: 6.5, yMin: -2.2, yMax: 2.2,
    expressions: [
      { id: 'e1', label: 'y = sin(x)', expression: 'sin(x)', color: '#2563eb', strokeWidth: 2.5, strokeStyle: 'solid', visible: true },
      { id: 'e2', label: 'y = cos(x)', expression: 'cos(x)', color: '#ea580c', strokeWidth: 2.2, strokeStyle: 'dashed', visible: true },
    ],
  }),
  makeGraphTemplate('tpl_graph_abs', 'Hàm trị tuyệt đối y = |x² - 2|', '12', 'Đồ thị hàm số', 'Hàm đặc biệt', {
    xMin: -4, xMax: 4, yMin: -1.5, yMax: 5,
    expressions: [{ id: 'e1', label: 'y = |x² - 2|', expression: 'abs(x^2 - 2)', color: '#0f766e', strokeWidth: 2.5, strokeStyle: 'solid', visible: true }],
  }),
  makeGraphTemplate('tpl_variation_cubic', 'Bảng biến thiên hàm bậc ba', '12', 'Bảng biến thiên', 'Bảng khảo sát', {
    viewMode: 'variation_table',
    tableFuncLabel: 'y',
    tableDerivLabel: "y'",
    tableColumns: [
      { xLabel: '-∞', signOrZero: '+', yValue: '-∞', trend: 'up' },
      { xLabel: '-1', signOrZero: '0', yValue: '2', trend: 'down' },
      { xLabel: '1', signOrZero: '0', yValue: '-2', trend: 'up' },
      { xLabel: '+∞', signOrZero: '+', yValue: '+∞', trend: 'none' },
    ],
  }),
  makeGraphTemplate('tpl_sign_quadratic', 'Bảng xét dấu tam thức bậc hai', '10', 'Bảng biến thiên', 'Bảng khảo sát', {
    viewMode: 'sign_table',
    tableDerivLabel: 'f(x)',
    tableColumns: [
      { xLabel: '-∞', signOrZero: '+', yValue: '', trend: 'up' },
      { xLabel: '1', signOrZero: '0', yValue: '', trend: 'down' },
      { xLabel: '3', signOrZero: '0', yValue: '', trend: 'up' },
      { xLabel: '+∞', signOrZero: '+', yValue: '', trend: 'none' },
    ],
  }),
];

// ============================================================================
// 4. PHYSICS TEMPLATES (MECHANICS, ELECTRICITY, OPTICS, OSCILLATIONS, THERMO)
// ============================================================================
const PHYSICS_TEMPLATES: FigureLibraryTemplate[] = [
  {
    id: 'tpl_phys_inclined_plane',
    name: 'Vật trượt trên mặt phẳng nghiêng (Phân tích lực)',
    subject: 'physics',
    grade: '10',
    topic: 'Cơ học',
    group: 'Động lực học',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'plane', type: 'symbol_physics', symbolVariant: 'inclined_plane', x: 280, y: 225, width: 320, height: 150, stroke: '#0f172a', fill: '#f1f5f9', strokeWidth: 2.2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'blk', type: 'symbol_physics', symbolVariant: 'block', x: 285, y: 196, width: 66, height: 42, rotation: -25, stroke: '#0f172a', fill: '#e2e8f0', strokeWidth: 2, strokeStyle: 'solid', zIndex: 2 },
      { id: 'vecP', type: 'vector', x: 285, y: 196, x2: 285, y2: 300, stroke: '#dc2626', fill: 'none', strokeWidth: 2.3, strokeStyle: 'solid', zIndex: 3 },
      { id: 'vecN', type: 'vector', x: 285, y: 196, x2: 245, y2: 112, stroke: '#2563eb', fill: 'none', strokeWidth: 2.3, strokeStyle: 'solid', zIndex: 3 },
      { id: 'vecFms', type: 'vector', x: 285, y: 196, x2: 358, y2: 162, stroke: '#16a34a', fill: 'none', strokeWidth: 2.2, strokeStyle: 'solid', zIndex: 3 },
      { id: 'fP', type: 'formula', x: 305, y: 295, stroke: '#dc2626', fill: 'none', strokeWidth: 1, strokeStyle: 'solid', formulaLatex: '\\vec{P}', zIndex: 4 },
      { id: 'fN', type: 'formula', x: 230, y: 112, stroke: '#2563eb', fill: 'none', strokeWidth: 1, strokeStyle: 'solid', formulaLatex: '\\vec{N}', zIndex: 4 },
      { id: 'fms', type: 'formula', x: 382, y: 152, stroke: '#16a34a', fill: 'none', strokeWidth: 1, strokeStyle: 'solid', formulaLatex: '\\vec{F}_{ms}', zIndex: 4 },
      { id: 'alp', type: 'formula', x: 166, y: 286, stroke: '#0f172a', fill: 'none', strokeWidth: 1, strokeStyle: 'solid', formulaLatex: '\\alpha', zIndex: 4 },
    ]),
  },
  {
    id: 'tpl_phys_spring_oscillator',
    name: 'Con lắc lò xo nằm ngang',
    subject: 'physics',
    grade: '11',
    topic: 'Dao động & Sóng',
    group: 'Con lắc lò xo',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'wall', type: 'segment', x: 105, y: 110, x2: 105, y2: 235, stroke: '#0f172a', fill: 'none', strokeWidth: 3.5, strokeStyle: 'solid', zIndex: 1 },
      { id: 'floor', type: 'segment', x: 105, y: 235, x2: 470, y2: 235, stroke: '#475569', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'spr', type: 'symbol_physics', symbolVariant: 'spring', x: 205, y: 195, width: 195, height: 42, stroke: '#0f172a', fill: 'none', strokeWidth: 2.1, strokeStyle: 'solid', label: 'k', labelOffsetY: -28, zIndex: 2 },
      { id: 'mass', type: 'symbol_physics', symbolVariant: 'block', x: 332, y: 202, width: 88, height: 64, stroke: '#0f172a', fill: '#dbeafe', strokeWidth: 2.2, strokeStyle: 'solid', zIndex: 3 },
      { id: 'axis', type: 'vector', x: 140, y: 275, x2: 455, y2: 275, stroke: '#2563eb', fill: 'none', strokeWidth: 1.8, strokeStyle: 'solid', label: 'x', labelOffsetX: 168, labelOffsetY: 4, zIndex: 2 },
      { id: 'ptO', type: 'point', x: 332, y: 275, stroke: '#2563eb', fill: '#2563eb', strokeWidth: 1, strokeStyle: 'solid', label: 'O', labelOffsetY: 16, zIndex: 3 },
    ]),
  },
  {
    id: 'tpl_phys_pendulum',
    name: 'Con lắc đơn dao động điều hòa',
    subject: 'physics',
    grade: '11',
    topic: 'Dao động & Sóng',
    group: 'Con lắc đơn',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'ceil', type: 'segment', x: 210, y: 65, x2: 350, y2: 65, stroke: '#0f172a', fill: 'none', strokeWidth: 3.5, strokeStyle: 'solid', zIndex: 1 },
      { id: 'vert', type: 'segment', x: 280, y: 65, x2: 280, y2: 295, stroke: '#64748b', fill: 'none', strokeWidth: 1.5, strokeStyle: 'dashed', zIndex: 1 },
      { id: 'cord', type: 'segment', x: 280, y: 65, x2: 365, y2: 255, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', label: 'l', labelOffsetX: 16, labelOffsetY: -6, zIndex: 2 },
      { id: 'bob', type: 'circle', x: 365, y: 255, radius: 16, stroke: '#0f172a', fill: '#cbd5e1', strokeWidth: 2, strokeStyle: 'solid', label: 'm', labelOffsetY: 0, zIndex: 3 },
      { id: 'arc', type: 'arc', x: 280, y: 65, radius: 70, startAngleDeg: -90, endAngleDeg: -66, stroke: '#2563eb', fill: 'none', strokeWidth: 1.8, strokeStyle: 'solid', zIndex: 2 },
      { id: 'fAlp', type: 'formula', x: 300, y: 150, stroke: '#2563eb', fill: 'none', strokeWidth: 1, strokeStyle: 'solid', formulaLatex: '\\alpha', zIndex: 4 },
      { id: 'vP', type: 'vector', x: 365, y: 271, x2: 365, y2: 332, stroke: '#dc2626', fill: 'none', strokeWidth: 2.2, strokeStyle: 'solid', zIndex: 3 },
      { id: 'fP', type: 'formula', x: 384, y: 318, stroke: '#dc2626', fill: 'none', strokeWidth: 1, strokeStyle: 'solid', formulaLatex: '\\vec{P}', zIndex: 4 },
    ]),
  },
  {
    id: 'tpl_phys_series_circuit',
    name: 'Mạch điện mắc nối tiếp (Nguồn, Khóa K, R1, R2, Ampe kế)',
    subject: 'physics',
    grade: '11',
    topic: 'Điện học',
    group: 'Mạch điện một chiều',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'bat', type: 'symbol_physics', symbolVariant: 'battery', x: 215, y: 95, width: 90, height: 48, stroke: '#0f172a', fill: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', label: 'E, r', labelOffsetY: -34, zIndex: 2 },
      { id: 'sw', type: 'symbol_physics', symbolVariant: 'switch_closed', x: 355, y: 95, width: 80, height: 40, stroke: '#0f172a', fill: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', label: 'K', labelOffsetY: -24, zIndex: 2 },
      { id: 'r1', type: 'symbol_physics', symbolVariant: 'resistor', x: 205, y: 265, width: 96, height: 44, stroke: '#0f172a', fill: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', label: 'R₁', labelOffsetY: -24, zIndex: 2 },
      { id: 'r2', type: 'symbol_physics', symbolVariant: 'resistor', x: 355, y: 265, width: 96, height: 44, stroke: '#0f172a', fill: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', label: 'R₂', labelOffsetY: -24, zIndex: 2 },
      { id: 'amp', type: 'symbol_physics', symbolVariant: 'ammeter', x: 115, y: 180, width: 76, height: 44, rotation: 90, stroke: '#2563eb', fill: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', zIndex: 2 },
      { id: 'w1', type: 'segment', x: 115, y: 95, x2: 170, y2: 95, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'w2', type: 'segment', x: 260, y: 95, x2: 315, y2: 95, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'w3', type: 'segment', x: 395, y: 95, x2: 450, y2: 95, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'w4', type: 'segment', x: 450, y: 95, x2: 450, y2: 265, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'w5', type: 'segment', x: 403, y: 265, x2: 450, y2: 265, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'w6', type: 'segment', x: 253, y: 265, x2: 307, y2: 265, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'w7', type: 'segment', x: 115, y: 265, x2: 157, y2: 265, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'w8', type: 'segment', x: 115, y: 95, x2: 115, y2: 142, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'w9', type: 'segment', x: 115, y: 218, x2: 115, y2: 265, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
    ]),
  },
  {
    id: 'tpl_phys_parallel_circuit',
    name: 'Mạch điện mắc song song (R1 // R2 + Vôn kế)',
    subject: 'physics',
    grade: '11',
    topic: 'Điện học',
    group: 'Mạch điện một chiều',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'bat', type: 'symbol_physics', symbolVariant: 'battery', x: 280, y: 75, width: 100, height: 48, stroke: '#0f172a', fill: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', label: 'E, r', labelOffsetY: -34, zIndex: 2 },
      { id: 'r1', type: 'symbol_physics', symbolVariant: 'resistor', x: 280, y: 175, width: 110, height: 42, stroke: '#0f172a', fill: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', label: 'R₁', labelOffsetY: -22, zIndex: 2 },
      { id: 'r2', type: 'symbol_physics', symbolVariant: 'resistor', x: 280, y: 255, width: 110, height: 42, stroke: '#0f172a', fill: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', label: 'R₂', labelOffsetY: -22, zIndex: 2 },
      { id: 'volt', type: 'symbol_physics', symbolVariant: 'voltmeter', x: 280, y: 325, width: 110, height: 40, stroke: '#dc2626', fill: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', zIndex: 2 },
      { id: 'wl', type: 'segment', x: 145, y: 75, x2: 145, y2: 325, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'wr', type: 'segment', x: 415, y: 75, x2: 415, y2: 325, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'wt1', type: 'segment', x: 145, y: 75, x2: 230, y2: 75, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'wt2', type: 'segment', x: 330, y: 75, x2: 415, y2: 75, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'wm1', type: 'segment', x: 145, y: 175, x2: 225, y2: 175, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'wm2', type: 'segment', x: 335, y: 175, x2: 415, y2: 175, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'wb1', type: 'segment', x: 145, y: 255, x2: 225, y2: 255, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'wb2', type: 'segment', x: 335, y: 255, x2: 415, y2: 255, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'wv1', type: 'segment', x: 145, y: 325, x2: 225, y2: 325, stroke: '#dc2626', fill: 'none', strokeWidth: 1.8, strokeStyle: 'solid', zIndex: 1 },
      { id: 'wv2', type: 'segment', x: 335, y: 325, x2: 415, y2: 325, stroke: '#dc2626', fill: 'none', strokeWidth: 1.8, strokeStyle: 'solid', zIndex: 1 },
      { id: 'j1', type: 'symbol_physics', symbolVariant: 'junction', x: 145, y: 175, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', zIndex: 3 },
      { id: 'j2', type: 'symbol_physics', symbolVariant: 'junction', x: 415, y: 175, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', zIndex: 3 },
      { id: 'j3', type: 'symbol_physics', symbolVariant: 'junction', x: 145, y: 255, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', zIndex: 3 },
      { id: 'j4', type: 'symbol_physics', symbolVariant: 'junction', x: 415, y: 255, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', zIndex: 3 },
    ]),
  },
  {
    id: 'tpl_phys_lc_circuit',
    name: 'Mạch dao động điện từ LC',
    subject: 'physics',
    grade: '12',
    topic: 'Điện học',
    group: 'Điện xoay chiều & LC',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'ind', type: 'symbol_physics', symbolVariant: 'inductor', x: 280, y: 120, width: 110, height: 40, stroke: '#0f172a', fill: 'none', strokeWidth: 2.2, strokeStyle: 'solid', label: 'L', labelOffsetY: -24, zIndex: 2 },
      { id: 'cap', type: 'symbol_physics', symbolVariant: 'capacitor', x: 280, y: 240, width: 110, height: 48, stroke: '#0f172a', fill: 'none', strokeWidth: 2.2, strokeStyle: 'solid', label: 'C', labelOffsetY: 32, zIndex: 2 },
      { id: 'w1', type: 'segment', x: 170, y: 120, x2: 225, y2: 120, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'w2', type: 'segment', x: 335, y: 120, x2: 390, y2: 120, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'w3', type: 'segment', x: 170, y: 240, x2: 225, y2: 240, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'w4', type: 'segment', x: 335, y: 240, x2: 390, y2: 240, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'wl', type: 'segment', x: 170, y: 120, x2: 170, y2: 240, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'wr', type: 'segment', x: 390, y: 120, x2: 390, y2: 240, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
    ]),
  },
  {
    id: 'tpl_phys_convex_lens',
    name: 'Thấu kính hội tụ tạo ảnh thật qua hai tia đặc biệt',
    subject: 'physics',
    grade: '11',
    topic: 'Quang học',
    group: 'Thấu kính',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'axis', type: 'segment', x: 45, y: 190, x2: 520, y2: 190, stroke: '#475569', fill: 'none', strokeWidth: 1.5, strokeStyle: 'solid', zIndex: 1 },
      { id: 'lens', type: 'symbol_physics', symbolVariant: 'convex_lens', x: 280, y: 190, width: 30, height: 190, stroke: '#0f172a', fill: 'none', strokeWidth: 2.4, strokeStyle: 'solid', zIndex: 2 },
      { id: 'obj', type: 'vector', x: 125, y: 190, x2: 125, y2: 115, stroke: '#0f172a', fill: 'none', strokeWidth: 2.5, strokeStyle: 'solid', label: 'AB', labelOffsetX: -18, labelOffsetY: -10, zIndex: 3 },
      { id: 'img', type: 'vector', x: 465, y: 190, x2: 465, y2: 280, stroke: '#dc2626', fill: 'none', strokeWidth: 2.5, strokeStyle: 'solid', label: "A'B'", labelOffsetX: 22, labelOffsetY: 16, zIndex: 3 },
      { id: 'r1a', type: 'segment', x: 125, y: 115, x2: 280, y2: 115, stroke: '#2563eb', fill: 'none', strokeWidth: 1.8, strokeStyle: 'solid', zIndex: 2 },
      { id: 'r1b', type: 'segment', x: 280, y: 115, x2: 465, y2: 280, stroke: '#2563eb', fill: 'none', strokeWidth: 1.8, strokeStyle: 'solid', zIndex: 2 },
      { id: 'r2', type: 'segment', x: 125, y: 115, x2: 465, y2: 280, stroke: '#16a34a', fill: 'none', strokeWidth: 1.8, strokeStyle: 'solid', zIndex: 2 },
      { id: 'ptF', type: 'point', x: 195, y: 190, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'F', labelOffsetY: 18, zIndex: 3 },
      { id: 'ptFp', type: 'point', x: 365, y: 190, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: "F'", labelOffsetY: -16, zIndex: 3 },
      { id: 'ptO', type: 'point', x: 280, y: 190, stroke: '#0f172a', fill: '#0f172a', strokeWidth: 1, strokeStyle: 'solid', label: 'O', labelOffsetX: -12, labelOffsetY: 16, zIndex: 3 },
    ]),
  },
  {
    id: 'tpl_phys_magnet',
    name: 'Nam châm thẳng & Xilanh pít-tông',
    subject: 'physics',
    grade: '12',
    topic: 'Nhiệt học & Từ trường',
    group: 'Từ trường',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'mag', type: 'symbol_physics', symbolVariant: 'magnet', x: 280, y: 180, width: 170, height: 68, stroke: '#0f172a', fill: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', zIndex: 2 },
      { id: 'fl1', type: 'curve', x: 280, y: 145, points: [{ x: -64, y: 15 }, { x: 0, y: -85 }, { x: 64, y: 15 }], stroke: '#2563eb', fill: 'none', strokeWidth: 1.7, strokeStyle: 'solid', zIndex: 1 },
      { id: 'fl2', type: 'curve', x: 280, y: 215, points: [{ x: -64, y: -15 }, { x: 0, y: 85 }, { x: 64, y: -15 }], stroke: '#2563eb', fill: 'none', strokeWidth: 1.7, strokeStyle: 'solid', zIndex: 1 },
      { id: 'arr1', type: 'vector', x: 270, y: 110, x2: 294, y2: 110, stroke: '#2563eb', fill: 'none', strokeWidth: 1.8, strokeStyle: 'solid', zIndex: 3 },
      { id: 'arr2', type: 'vector', x: 270, y: 250, x2: 294, y2: 250, stroke: '#2563eb', fill: 'none', strokeWidth: 1.8, strokeStyle: 'solid', zIndex: 3 },
    ]),
  },
];

// ============================================================================
// 5. CHEMISTRY TEMPLATES (LAB ASSEMBLIES + 2D MOLECULAR STRUCTURES)
// ============================================================================
const CHEMISTRY_TEMPLATES: FigureLibraryTemplate[] = [
  {
    id: 'tpl_chem_gas_water',
    name: 'Bộ điều chế và thu khí bằng phương pháp đẩy nước',
    subject: 'chemistry',
    grade: '10',
    topic: 'Thí nghiệm Hóa học',
    group: 'Bộ lắp ráp thí nghiệm',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'stand', type: 'symbol_chem', symbolVariant: 'retort_stand', x: 115, y: 205, width: 90, height: 195, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'tube', type: 'symbol_chem', symbolVariant: 'test_tube', x: 175, y: 155, width: 42, height: 115, rotation: 62, stroke: '#0f172a', fill: '#fde68a', strokeWidth: 2, strokeStyle: 'solid', zIndex: 2 },
      { id: 'lamp', type: 'symbol_chem', symbolVariant: 'alcohol_lamp', x: 155, y: 255, width: 52, height: 76, stroke: '#0f172a', fill: '#fef3c7', strokeWidth: 2, strokeStyle: 'solid', zIndex: 2 },
      { id: 'pipe', type: 'symbol_chem', symbolVariant: 'delivery_tube', x: 298, y: 210, width: 155, height: 130, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 3 },
      { id: 'trough', type: 'symbol_chem', symbolVariant: 'water_trough', x: 415, y: 268, width: 150, height: 75, stroke: '#0f172a', fill: '#bae6fd', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'collect', type: 'symbol_chem', symbolVariant: 'test_tube', x: 405, y: 205, width: 44, height: 115, rotation: 180, stroke: '#0f172a', fill: '#e0f2fe', strokeWidth: 2, strokeStyle: 'solid', zIndex: 2 },
      { id: 'lbl', type: 'text', x: 415, y: 328, stroke: '#0f172a', fill: 'none', strokeWidth: 1, strokeStyle: 'solid', label: 'Chậu nước thu khí', fontSize: 14, zIndex: 4 },
    ]),
  },
  {
    id: 'tpl_chem_titration',
    name: 'Bộ chuẩn độ axit – bazơ (Buret & Bình tam giác)',
    subject: 'chemistry',
    grade: '11',
    topic: 'Thí nghiệm Hóa học',
    group: 'Bộ lắp ráp thí nghiệm',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'stand', type: 'symbol_chem', symbolVariant: 'retort_stand', x: 210, y: 185, width: 120, height: 260, stroke: '#0f172a', fill: 'none', strokeWidth: 2.1, strokeStyle: 'solid', zIndex: 1 },
      { id: 'buret', type: 'symbol_chem', symbolVariant: 'burette', x: 280, y: 120, width: 40, height: 140, stroke: '#0f172a', fill: '#bae6fd', strokeWidth: 2, strokeStyle: 'solid', label: 'Dung dịch chuẩn', labelOffsetX: 88, labelOffsetY: -12, zIndex: 2 },
      { id: 'flask', type: 'symbol_chem', symbolVariant: 'erlenmeyer', x: 280, y: 262, width: 92, height: 100, stroke: '#0f172a', fill: '#fbcfe8', strokeWidth: 2, strokeStyle: 'solid', label: 'Dung dịch cần chuẩn độ', labelOffsetX: 118, labelOffsetY: 16, zIndex: 2 },
    ]),
  },
  {
    id: 'tpl_chem_distillation',
    name: 'Bộ chưng cất chất lỏng (Bình cầu & Ống sinh hàn)',
    subject: 'chemistry',
    grade: '11',
    topic: 'Thí nghiệm Hóa học',
    group: 'Bộ lắp ráp thí nghiệm',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'flask', type: 'symbol_chem', symbolVariant: 'round_flask', x: 145, y: 175, width: 88, height: 112, stroke: '#0f172a', fill: '#bae6fd', strokeWidth: 2, strokeStyle: 'solid', zIndex: 2 },
      { id: 'therm', type: 'symbol_chem', symbolVariant: 'thermometer', x: 145, y: 98, width: 22, height: 100, stroke: '#0f172a', fill: 'none', strokeWidth: 1.8, strokeStyle: 'solid', zIndex: 3 },
      { id: 'lamp', type: 'symbol_chem', symbolVariant: 'alcohol_lamp', x: 145, y: 278, width: 54, height: 78, stroke: '#0f172a', fill: '#fef3c7', strokeWidth: 2, strokeStyle: 'solid', zIndex: 2 },
      { id: 'cond', type: 'symbol_chem', symbolVariant: 'condenser', x: 300, y: 165, width: 175, height: 48, rotation: 20, stroke: '#0f172a', fill: '#bfdbfe', strokeWidth: 2, strokeStyle: 'solid', label: 'Ống sinh hàn', labelOffsetY: -36, zIndex: 2 },
      { id: 'recv', type: 'symbol_chem', symbolVariant: 'erlenmeyer', x: 430, y: 255, width: 80, height: 92, stroke: '#0f172a', fill: '#e0f2fe', strokeWidth: 2, strokeStyle: 'solid', label: 'Sản phẩm chưng cất', labelOffsetY: 60, zIndex: 2 },
    ]),
  },
  {
    id: 'tpl_chem_filtration',
    name: 'Bộ lọc tách chất rắn không tan (Phễu & Cốc)',
    subject: 'chemistry',
    grade: '10',
    topic: 'Thí nghiệm Hóa học',
    group: 'Bộ lắp ráp thí nghiệm',
    kind: 'vector_2d',
    isBuiltIn: true,
    sourceData: makeScene([
      { id: 'stand', type: 'symbol_chem', symbolVariant: 'retort_stand', x: 205, y: 185, width: 110, height: 245, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', zIndex: 1 },
      { id: 'fun', type: 'symbol_chem', symbolVariant: 'funnel', x: 280, y: 145, width: 72, height: 85, stroke: '#0f172a', fill: 'none', strokeWidth: 2, strokeStyle: 'solid', label: 'Phễu lọc', labelOffsetX: 68, labelOffsetY: -12, zIndex: 2 },
      { id: 'beak', type: 'symbol_chem', symbolVariant: 'beaker', x: 280, y: 255, width: 88, height: 92, stroke: '#0f172a', fill: '#e0f2fe', strokeWidth: 2, strokeStyle: 'solid', label: 'Nước lọc', labelOffsetX: 74, labelOffsetY: 14, zIndex: 2 },
    ]),
  },
  {
    id: 'tpl_chem_benzene',
    name: 'Vòng Benzen (C₆H₆)',
    subject: 'chemistry',
    grade: '11',
    topic: 'Hóa học Hữu cơ',
    group: 'Công thức cấu tạo',
    kind: 'chemistry_2d',
    isBuiltIn: true,
    sourceData: createBenzeneStructure(),
  },
  {
    id: 'tpl_chem_ethanol',
    name: 'Etanol (CH₃–CH₂–OH)',
    subject: 'chemistry',
    grade: '11',
    topic: 'Hóa học Hữu cơ',
    group: 'Công thức cấu tạo',
    kind: 'chemistry_2d',
    isBuiltIn: true,
    sourceData: createEthanolStructure(),
  },
  {
    id: 'tpl_chem_acetic_acid',
    name: 'Axit axetic (CH₃–COOH)',
    subject: 'chemistry',
    grade: '11',
    topic: 'Hóa học Hữu cơ',
    group: 'Công thức cấu tạo',
    kind: 'chemistry_2d',
    isBuiltIn: true,
    sourceData: createAceticAcidStructure(),
  },
  {
    id: 'tpl_chem_ethylene',
    name: 'Etilen (CH₂=CH₂) – Liên kết đôi',
    subject: 'chemistry',
    grade: '11',
    topic: 'Hóa học Hữu cơ',
    group: 'Công thức cấu tạo',
    kind: 'chemistry_2d',
    isBuiltIn: true,
    sourceData: {
      width: 440,
      height: 240,
      displayMode: 'condensed',
      atoms: [
        { id: 'c1', element: 'C', x: 160, y: 120 },
        { id: 'c2', element: 'C', x: 280, y: 120 },
      ],
      bonds: [{ id: 'b1', from: 'c1', to: 'c2', order: 2 }],
    },
  },
];

export const BUILTIN_FIGURE_LIBRARY: FigureLibraryTemplate[] = [
  ...MATH_PLANE_TEMPLATES,
  ...MATH_3D_TEMPLATES,
  ...MATH_GRAPH_TEMPLATES,
  ...PHYSICS_TEMPLATES,
  ...CHEMISTRY_TEMPLATES,
];

export function renderFigureTemplateToSvg(tpl: FigureLibraryTemplate): string {
  switch (tpl.kind) {
    case 'vector_2d':
      return renderDiagramSceneToSvg(tpl.sourceData as DiagramScene);
    case 'geometry_3d':
      return renderGeometry3DToSvg(tpl.sourceData as Parameters<typeof renderGeometry3DToSvg>[0]);
    case 'graph':
      return renderGraphPlotToSvg(tpl.sourceData as GraphPlotState);
    case 'chemistry_2d':
      return renderChemStructureToSvg(tpl.sourceData as Parameters<typeof renderChemStructureToSvg>[0]);
  }
}
