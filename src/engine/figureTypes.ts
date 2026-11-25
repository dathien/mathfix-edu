import { FormulaSubject } from './types';

export type FigureKind =
  | 'vector_2d'
  | 'geometry_3d'
  | 'graph'
  | 'chemistry_2d'
  | 'raster_upload'
  | 'svg_upload';

export type FigureAlignment = 'left' | 'center' | 'right';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export interface FigureCrop {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_FIGURE_CROP: FigureCrop = { top: 0, right: 0, bottom: 0, left: 0 };

// ============================================================================
// 1. STRUCTURED 2D VECTOR DIAGRAM SCENE (MATH / PHYSICS / CHEMISTRY LAB)
// ============================================================================
export type DiagramElementType =
  | 'point'
  | 'line'
  | 'ray'
  | 'segment'
  | 'vector'
  | 'rect'
  | 'polygon'
  | 'circle'
  | 'arc'
  | 'ellipse'
  | 'curve'
  | 'angle_mark'
  | 'right_angle'
  | 'tick_mark'
  | 'text'
  | 'formula'
  | 'symbol_physics'
  | 'symbol_chem';

export type PhysicsSymbolVariant =
  | 'resistor'
  | 'variable_resistor'
  | 'battery'
  | 'lamp'
  | 'switch_open'
  | 'switch_closed'
  | 'ammeter'
  | 'voltmeter'
  | 'capacitor'
  | 'inductor'
  | 'junction'
  | 'pulley'
  | 'spring'
  | 'pendulum_bob'
  | 'block'
  | 'inclined_plane'
  | 'lever'
  | 'convex_lens'
  | 'concave_lens'
  | 'flat_mirror'
  | 'magnet'
  | 'piston_cylinder';

export type ChemSymbolVariant =
  | 'test_tube'
  | 'test_tube_rack'
  | 'test_tube_clamp'
  | 'beaker'
  | 'erlenmeyer'
  | 'round_flask'
  | 'volumetric_flask'
  | 'graduated_cylinder'
  | 'pipette'
  | 'burette'
  | 'funnel'
  | 'separatory_funnel'
  | 'alcohol_lamp'
  | 'retort_stand'
  | 'delivery_tube'
  | 'water_trough'
  | 'thermometer'
  | 'condenser';

export interface DiagramPoint2D {
  x: number;
  y: number;
}

export interface DiagramElement {
  id: string;
  type: DiagramElementType;
  name?: string;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: DiagramPoint2D[]; // relative to (x, y) for polygons/curves/angles
  startAngleDeg?: number;
  endAngleDeg?: number;
  rotation?: number; // degrees around element anchor/center
  stroke: string;
  fill: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  opacity?: number;
  label?: string;
  labelOffsetX?: number;
  labelOffsetY?: number;
  fontSize?: number;
  formulaLatex?: string;
  tickCount?: 1 | 2 | 3; // equal segment / equal angle marks
  symbolVariant?: PhysicsSymbolVariant | ChemSymbolVariant;
  groupId?: string;
  zIndex: number;
}

export interface DiagramScene {
  width: number;
  height: number;
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  snapToPoint: boolean;
  snapToLine: boolean;
  background: string;
  elements: DiagramElement[];
}

// ============================================================================
// 2. 3D SPATIAL GEOMETRY STATE (14 MODELS — SECTION IV)
// ============================================================================
export type Geometry3DSolidType =
  | 'cube'
  | 'cuboid'
  | 'parallelepiped'
  | 'triangular_prism'
  | 'square_pyramid'
  | 'tetrahedron'
  | 'cylinder'
  | 'cone'
  | 'sphere'
  | 'plane'
  | 'space_line'
  | 'intersection_line'
  | 'cross_section'
  | 'oxyz_axes';

export interface Geometry3DState {
  solidType: Geometry3DSolidType;
  azimuthDeg: number; // horizontal rotation angle
  elevationDeg: number; // vertical tilt angle
  zoom: number; // 0.6..1.8
  showHiddenEdges: boolean;
  showLabels: boolean;
  showAxes: boolean;
  showFacesFill: boolean;
  strokeColor: string;
  accentColor: string;
  customLabels: Record<string, string>; // e.g. { S: "S", A: "A", B: "B", C: "C", D: "D" }
}

// ============================================================================
// 3. FUNCTION GRAPHER + VARIATION / SIGN / VALUE TABLE STATE (SECTION IV)
// ============================================================================
export type GraphViewMode = 'graph' | 'variation_table' | 'sign_table' | 'value_table';

export interface GraphExpressionItem {
  id: string;
  label: string;
  expression: string; // e.g. "x^3 - 3*x + 1", "(2*x + 1)/(x - 1)", "sin(x)"
  latex?: string;
  color: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  visible: boolean;
  domainMin?: number | null;
  domainMax?: number | null;
}

export interface VariationColumn {
  xLabel: string;
  signOrZero: string; // "+", "-", "0", "||"
  yValue: string;
  trend?: 'up' | 'down' | 'none';
}

export interface GraphPlotState {
  viewMode: GraphViewMode;
  width: number;
  height: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  showGrid: boolean;
  showAxes: boolean;
  showAsymptotes: boolean;
  showTicks: boolean;
  expressions: GraphExpressionItem[];
  // Variation / sign table structured config
  tableFuncLabel: string;
  tableDerivLabel: string;
  tableColumns: VariationColumn[];
  // Value table sample points
  valueTableXs: string; // comma-separated numbers e.g. "-2, -1, 0, 1, 2"
}

// ============================================================================
// 4. INTERACTIVE CHEMICAL STRUCTURE STATE (SECTION VI)
// ============================================================================
export type ChemBondOrder = 1 | 2 | 3;
export type ChemDisplayMode = 'skeletal' | 'condensed' | 'lewis';

export interface ChemAtomNode {
  id: string;
  element: string; // e.g. C, H, O, N, Cl, Na, Fe...
  x: number;
  y: number;
  charge?: number; // e.g. +1, -1, +2, -2
  lonePairs?: number; // 0..4 electron pairs for Lewis display
  labelOverride?: string; // e.g. "CH3", "COOH", "OH"
}

export interface ChemBondEdge {
  id: string;
  from: string;
  to: string;
  order: ChemBondOrder;
}

export interface ChemStructureState {
  width: number;
  height: number;
  displayMode: ChemDisplayMode;
  atoms: ChemAtomNode[];
  bonds: ChemBondEdge[];
  showAtomIndices?: boolean;
  captionNote?: string;
}

// ============================================================================
// 5. UNIFIED STORED FIGURE ASSET (EMBEDDED VIA [[HINH:fig_id]])
// ============================================================================
export interface FigureAsset {
  id: string;
  kind: FigureKind;
  subject: FormulaSubject;
  title: string;
  caption?: string;
  showNumber?: boolean;
  align: FigureAlignment;
  widthPx: number;
  aspectRatio: number; // height / width
  rotationDeg: number;
  crop: FigureCrop;
  svgMarkup?: string; // Sanitized standalone vector SVG
  pngDataUrl?: string; // High-DPI PNG data URL (for raster uploads & Word compatibility)
  sourceData?: DiagramScene | Geometry3DState | GraphPlotState | ChemStructureState;
  createdAt: number;
  updatedAt: number;
}

export interface FigureLibraryTemplate {
  id: string;
  name: string;
  subject: FormulaSubject;
  grade: '10' | '11' | '12';
  topic: string;
  group: string;
  kind: 'vector_2d' | 'geometry_3d' | 'graph' | 'chemistry_2d';
  description?: string;
  isBuiltIn: boolean;
  sourceData: DiagramScene | Geometry3DState | GraphPlotState | ChemStructureState;
  createdAt?: number;
}
