import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import {
  ChemSymbolVariant,
  DEFAULT_FIGURE_CROP,
  FigureAsset,
  FigureLibraryTemplate,
  Geometry3DSolidType,
  PhysicsSymbolVariant,
} from '../figureTypes';
import { createDefaultDiagramScene, renderDiagramSceneToSvg } from '../diagramRenderer';
import {
  createDefaultGeometry3DState,
  GEOMETRY_3D_LABELS,
  getSolidMesh,
  renderGeometry3DToSvg,
} from '../geometry3dEngine';
import {
  createDefaultGraphState,
  evaluateMathExpression,
  latexToGraphExpression,
  renderGraphPlotToSvg,
  validateMathExpression,
} from '../graphEngine';
import {
  checkValenceWarnings,
  computeImplicitHydrogens,
  createAceticAcidStructure,
  createBenzeneStructure,
  createEthanolStructure,
  renderChemStructureToSvg,
} from '../chemStructureEngine';
import {
  getSvgDimensions,
  isSupportedImageFile,
  sanitizeSvgMarkup,
} from '../svgSanitizer';
import {
  deleteCustomFigureTemplate,
  deleteFigureAsset,
  generateFigureId,
  loadAllFigures,
  loadFigureLibraryState,
  recordRecentFigureTemplate,
  resetMemoryFigureStore,
  saveCustomFigureTemplate,
  saveFigureAsset,
  saveFigureFavoriteIds,
} from '../figureStorage';
import { BUILTIN_FIGURE_LIBRARY, renderFigureTemplateToSvg } from '../../data/figureLibraryData';
import { processDocumentText } from '../parser';
import {
  DEFAULT_EXAM_STYLE,
  DEFAULT_NORMALIZATION_OPTIONS,
  EMPTY_EXAM_HEADER,
  formatMultipleChoiceOptions,
  normalizeExamText,
  renumberQuestions,
} from '../examTools';
import { generateDocxBuffer } from '../docxExporter';

// Minimal valid 1x1 PNG data URL for Node/Vitest DOCX embedding tests
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('MathFix EDU – Trình vẽ hình & Soạn câu hỏi có hình minh họa (Toán – Lí – Hóa)', () => {
  beforeEach(() => {
    resetMemoryFigureStore();
  });

  // =========================================================================
  // 1. 2D VECTOR DIAGRAM ENGINE (Math + Physics + Chemistry)
  // =========================================================================
  describe('1. Động cơ vẽ hình vector 2D (diagramRenderer)', () => {
    it('vẽ đầy đủ hình học phẳng, nét đứt, góc vuông, ký hiệu bằng nhau và nhãn công thức MathJax', () => {
      const scene = createDefaultDiagramScene();
      scene.elements = [
        {
          id: 'tri1',
          type: 'polygon',
          x: 100,
          y: 80,
          points: [
            { x: 0, y: 200 },
            { x: 280, y: 200 },
            { x: 0, y: 0 },
          ],
          stroke: '#0f172a',
          strokeWidth: 2,
          strokeStyle: 'solid',
          fill: 'none',
          zIndex: 1,
        },
        {
          id: 'alt1',
          type: 'line',
          x: 100,
          y: 280,
          x2: 200,
          y2: 150,
          stroke: '#0f172a',
          strokeWidth: 1.8,
          strokeStyle: 'dashed',
          fill: 'none',
          zIndex: 2,
        },
        {
          id: 'ra1',
          type: 'right_angle',
          x: 100,
          y: 280,
          radius: 16,
          startAngleDeg: 0,
          stroke: '#0f172a',
          strokeWidth: 1.5,
          strokeStyle: 'solid',
          fill: 'none',
          zIndex: 3,
        },
        {
          id: 'tick1',
          type: 'tick_mark',
          x: 100,
          y: 280,
          x2: 380,
          y2: 280,
          tickCount: 2,
          stroke: '#0f172a',
          strokeWidth: 1.5,
          strokeStyle: 'solid',
          fill: 'none',
          zIndex: 4,
        },
        {
          id: 'f1',
          type: 'formula',
          x: 240,
          y: 120,
          formulaLatex: '\\frac{a^2 + b^2}{c^2} = 1',
          stroke: '#0f172a',
          strokeWidth: 1,
          strokeStyle: 'solid',
          fill: 'none',
          zIndex: 5,
        },
      ];

      const svg = renderDiagramSceneToSvg(scene);
      expect(svg).toContain('<svg');
      expect(svg).toContain('<polygon');
      expect(svg).toContain('stroke-dasharray');
      expect(svg).toContain('<path'); // MathJax SVG paths embedded
      expect(svg).not.toContain('<script');
    });

    it('render đầy đủ 22 ký hiệu Vật lí (IEC mạch điện, quang học, cơ học, từ trường)', () => {
      const physicsVariants: PhysicsSymbolVariant[] = [
        'resistor',
        'variable_resistor',
        'battery',
        'lamp',
        'switch_open',
        'switch_closed',
        'ammeter',
        'voltmeter',
        'capacitor',
        'inductor',
        'junction',
        'pulley',
        'spring',
        'pendulum_bob',
        'block',
        'inclined_plane',
        'lever',
        'convex_lens',
        'concave_lens',
        'flat_mirror',
        'magnet',
        'piston_cylinder',
      ];

      expect(physicsVariants.length).toBe(22);

      for (const variant of physicsVariants) {
        const scene = createDefaultDiagramScene();
        scene.elements = [
          {
            id: `p_${variant}`,
            type: 'symbol_physics',
            symbolVariant: variant,
            x: 280,
            y: 180,
            label: variant,
            stroke: '#0f172a',
            fill: 'none',
            strokeWidth: 2,
            strokeStyle: 'solid',
            zIndex: 1,
          },
        ];
        const svg = renderDiagramSceneToSvg(scene);
        expect(svg, `Physics symbol ${variant}`).toContain('<svg');
        expect(svg.length, `Physics symbol ${variant} non-empty`).toBeGreaterThan(200);
      }
    });

    it('render đầy đủ 18 dụng cụ thí nghiệm Hóa học', () => {
      const chemVariants: ChemSymbolVariant[] = [
        'test_tube',
        'test_tube_rack',
        'test_tube_clamp',
        'beaker',
        'erlenmeyer',
        'round_flask',
        'volumetric_flask',
        'graduated_cylinder',
        'pipette',
        'burette',
        'funnel',
        'separatory_funnel',
        'alcohol_lamp',
        'retort_stand',
        'delivery_tube',
        'water_trough',
        'thermometer',
        'condenser',
      ];

      expect(chemVariants.length).toBe(18);

      for (const variant of chemVariants) {
        const scene = createDefaultDiagramScene();
        scene.elements = [
          {
            id: `c_${variant}`,
            type: 'symbol_chem',
            symbolVariant: variant,
            x: 280,
            y: 180,
            label: variant,
            stroke: '#0f172a',
            fill: 'none',
            strokeWidth: 2,
            strokeStyle: 'solid',
            zIndex: 1,
          },
        ];
        const svg = renderDiagramSceneToSvg(scene);
        expect(svg, `Chem symbol ${variant}`).toContain('<svg');
        expect(svg.length, `Chem symbol ${variant} non-empty`).toBeGreaterThan(200);
      }
    });
  });

  // =========================================================================
  // 2. 3D SPATIAL GEOMETRY ENGINE (All 14 Required Models)
  // =========================================================================
  describe('2. Hình học không gian 3D (14 mô hình & nét đứt khuất)', () => {
    const all14Solids: Geometry3DSolidType[] = [
      'cube',
      'cuboid',
      'parallelepiped',
      'triangular_prism',
      'square_pyramid',
      'tetrahedron',
      'cylinder',
      'cone',
      'sphere',
      'plane',
      'space_line',
      'intersection_line',
      'cross_section',
      'oxyz_axes',
    ];

    it('hỗ trợ đủ tất cả 14 mô hình hình học không gian 3D chuẩn chương trình THPT', () => {
      expect(Object.keys(GEOMETRY_3D_LABELS).length).toBe(14);
      for (const solid of all14Solids) {
        expect(GEOMETRY_3D_LABELS[solid]).toBeTruthy();
        const mesh = getSolidMesh(solid);
        expect(Object.keys(mesh.vertices).length).toBeGreaterThan(0);
        expect(mesh.edges.length).toBeGreaterThan(0);

        const state = createDefaultGeometry3DState(solid);
        const svg = renderGeometry3DToSvg(state);
        expect(svg, `3D solid ${solid}`).toContain('<svg');
        expect(svg, `3D solid ${solid} has geometry`).toMatch(/<(line|path|ellipse|circle)\b/);
      }
    });

    it('tự động vẽ nét đứt cho cạnh khuất, đổi nhãn đỉnh tùy chỉnh và thay đổi góc xoay', () => {
      const stateA = createDefaultGeometry3DState('square_pyramid');
      stateA.showHiddenEdges = true;
      stateA.customLabels = { S: 'P', A: 'M' };
      const svgA = renderGeometry3DToSvg(stateA);
      expect(svgA).toContain('stroke-dasharray');
      expect(svgA).toContain('>P<');
      expect(svgA).toContain('>M<');

      const stateB = { ...stateA, azimuthDeg: stateA.azimuthDeg + 65, elevationDeg: 35 };
      const svgB = renderGeometry3DToSvg(stateB);
      expect(svgB).not.toBe(svgA);
    });
  });

  // =========================================================================
  // 3. FUNCTION GRAPHER & VARIATION / SIGN / VALUE TABLES
  // =========================================================================
  describe('3. Vẽ đồ thị hàm số & Bảng biến thiên / Bảng xét dấu (không dùng eval)', () => {
    it('tính toán chính xác đa thức, phân thức, lượng giác, căn thức, logarit và hàm từng khúc', () => {
      expect(evaluateMathExpression('x^3 - 3x + 2', 2)).toBeCloseTo(4, 6);
      expect(evaluateMathExpression('(2x - 1)/(x - 1)', 3)).toBeCloseTo(2.5, 6);
      expect(evaluateMathExpression('sin(pi/2) + cos(0)', 0)).toBeCloseTo(2, 6);
      expect(evaluateMathExpression('sqrt(x^2 + 9)', 4)).toBeCloseTo(5, 6);
      expect(evaluateMathExpression('ln(e^2)', 0)).toBeCloseTo(2, 6);
      expect(evaluateMathExpression('abs(-3x)', 2)).toBeCloseTo(6, 6);
      // Piecewise function
      expect(evaluateMathExpression('x < 0 ? -x : x^2', -3)).toBeCloseTo(3, 6);
      expect(evaluateMathExpression('x < 0 ? -x : x^2', 3)).toBeCloseTo(9, 6);
    });

    it('chuyển đổi cú pháp LaTeX sang biểu thức đồ thị chuẩn xác', () => {
      expect(latexToGraphExpression('\\frac{2x-1}{x-1}')).toContain('(2x-1)/(x-1)');
      expect(latexToGraphExpression('\\sqrt{x^2+1}')).toContain('sqrt(x^2+1)');
      expect(latexToGraphExpression('\\sin(x) + \\ln(x)')).toContain('sin(x)');
    });

    it('từ chối biểu thức độc hại (chống injection, không dùng eval/new Function)', () => {
      expect(validateMathExpression('window.alert(1)').ok).toBe(false);
      expect(validateMathExpression('process.exit(1)').ok).toBe(false);
      expect(validateMathExpression('constructor.constructor("return 1")()').ok).toBe(false);
      expect(Number.isNaN(evaluateMathExpression('alert(1)', 1))).toBe(true);
    });

    it('tách nhánh đồ thị sạch qua tiệm cận đứng x = 1 với y = (2x-1)/(x-1)', () => {
      const state = createDefaultGraphState();
      state.viewMode = 'graph';
      state.expressions = [
        {
          id: 'fn_rat',
          expression: '(2x - 1)/(x - 1)',
          label: 'y = (2x-1)/(x-1)',
          color: '#0B4F8A',
          strokeWidth: 2.2,
          strokeStyle: 'solid',
          visible: true,
        },
      ];
      state.xMin = -4;
      state.xMax = 6;
      state.yMin = -5;
      state.yMax = 8;
      const svg = renderGraphPlotToSvg(state);
      expect(svg).toContain('<svg');
      const pathMatches = svg.match(/<path\b[^>]*stroke="#0B4F8A"[^>]*>/g) || [];
      const combinedD = pathMatches.join(' ');
      const moveCount = (combinedD.match(/\bM\s*[-\d.]/g) || []).length;
      expect(moveCount).toBeGreaterThanOrEqual(2);
    });

    it('vẽ đầy đủ Bảng biến thiên, Bảng xét dấu và Bảng giá trị bằng tiếng Việt chuẩn', () => {
      for (const viewMode of ['variation_table', 'sign_table', 'value_table'] as const) {
        const state = createDefaultGraphState();
        state.viewMode = viewMode;
        const svg = renderGraphPlotToSvg(state);
        expect(svg, `Graph viewMode ${viewMode}`).toContain('<svg');
        expect(svg).toContain('<line');
        expect(svg).toContain('<text');
      }
    });
  });

  // =========================================================================
  // 4. CHEMISTRY 2D STRUCTURAL FORMULA ENGINE
  // =========================================================================
  describe('4. Vẽ công thức cấu tạo Hóa học 2D & Cảnh báo hóa trị an toàn', () => {
    it('vẽ vòng benzen, etanol, axit axetic ở cả 3 chế độ skeletal / condensed / lewis', () => {
      const presets = [
        createBenzeneStructure(),
        createEthanolStructure(),
        createAceticAcidStructure(),
      ];
      for (const preset of presets) {
        for (const mode of ['skeletal', 'condensed', 'lewis'] as const) {
          const svg = renderChemStructureToSvg({ ...preset, displayMode: mode });
          expect(svg).toContain('<svg');
          expect(svg).toMatch(/<(line|path|circle)\b/);
        }
      }
    });

    it('cảnh báo hóa trị khi Carbon có 5 liên kết nhưng TUYỆT ĐỐI KHÔNG tự ý sửa hoặc xóa liên kết', () => {
      const state = createEthanolStructure();
      const c1 = state.atoms[0];
      state.atoms.push(
        { id: 'x1', element: 'H', x: c1.x - 40, y: c1.y - 30 },
        { id: 'x2', element: 'H', x: c1.x - 40, y: c1.y + 30 },
        { id: 'x3', element: 'H', x: c1.x, y: c1.y - 50 },
        { id: 'x4', element: 'H', x: c1.x, y: c1.y + 50 }
      );
      state.bonds.push(
        { id: 'bx1', from: c1.id, to: 'x1', order: 1 },
        { id: 'bx2', from: c1.id, to: 'x2', order: 1 },
        { id: 'bx3', from: c1.id, to: 'x3', order: 1 },
        { id: 'bx4', from: c1.id, to: 'x4', order: 1 }
      );
      const bondCountBefore = state.bonds.length;
      const warnings = checkValenceWarnings(state);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].element).toBe('C');
      expect(state.bonds.length).toBe(bondCountBefore); // Never auto-mutated!
    });

    it('tính chính xác số nguyên tử Hydro ẩn cho nguyên tử Cacbon', () => {
      const ethanol = createEthanolStructure();
      const firstC = ethanol.atoms.find((a) => a.element === 'C')!;
      expect(computeImplicitHydrogens(ethanol, firstC)).toBe(3);
    });
  });

  // =========================================================================
  // 5. BUILT-IN FIGURE LIBRARY COMPLETENESS (Math, Physics, Chemistry ONLY)
  // =========================================================================
  describe('5. Thư viện hình mẫu chuẩn khoa học (Toán – Vật lí – Hóa học)', () => {
    it('chứa đầy đủ hình mẫu cho cả 3 môn Toán, Vật lí, Hóa học và render SVG sạch', () => {
      const mathTemplates = BUILTIN_FIGURE_LIBRARY.filter((t) => t.subject === 'math');
      const physicsTemplates = BUILTIN_FIGURE_LIBRARY.filter((t) => t.subject === 'physics');
      const chemTemplates = BUILTIN_FIGURE_LIBRARY.filter((t) => t.subject === 'chemistry');

      expect(mathTemplates.length).toBeGreaterThanOrEqual(15);
      expect(physicsTemplates.length).toBeGreaterThanOrEqual(8);
      expect(chemTemplates.length).toBeGreaterThanOrEqual(6);

      for (const tpl of BUILTIN_FIGURE_LIBRARY) {
        const svg = renderFigureTemplateToSvg(tpl);
        expect(svg, `Template ${tpl.id}`).toContain('<svg');
        expect(svg, `Template ${tpl.id} safe`).not.toMatch(/<script\b/i);
      }
    });
  });

  // =========================================================================
  // 6. SECURITY: SVG SANITIZATION & UPLOAD VALIDATION
  // =========================================================================
  describe('6. Bảo mật tải ảnh & làm sạch SVG (chống XSS / XXE)', () => {
    it('loại bỏ triệt để script, on* handlers, foreignObject, javascript:, external href và DOCTYPE ENTITY', () => {
      const maliciousSvg = `
        <!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" onload="alert('xss')">
          <script>alert('pwned')</script>
          <foreignObject width="100" height="100"><body xmlns="http://www.w3.org/1999/xhtml"><iframe src="https://evil.test"></iframe></body></foreignObject>
          <a href="javascript:alert(1)"><circle cx="50" cy="50" r="30" onclick="steal()" fill="#0B4F8A" /></a>
          <image href="https://evil.test/tracker.png" width="10" height="10" />
          <line x1="0" y1="0" x2="100" y2="100" stroke="#000" style="width: expression(alert(1)); background: url(https://evil.test/x)" />
        </svg>
      `;

      const clean = sanitizeSvgMarkup(maliciousSvg);
      expect(clean).toContain('<svg');
      expect(clean).toContain('<circle');
      expect(clean).toContain('<line');
      expect(clean).not.toMatch(/<script/i);
      expect(clean).not.toMatch(/onload\s*=/i);
      expect(clean).not.toMatch(/onclick\s*=/i);
      expect(clean).not.toMatch(/foreignObject/i);
      expect(clean).not.toMatch(/<iframe/i);
      expect(clean).not.toMatch(/javascript:/i);
      expect(clean).not.toMatch(/https:\/\/evil\.test/i);
      expect(clean).not.toMatch(/<!DOCTYPE|<!ENTITY/i);
      expect(clean).not.toMatch(/expression\s*\(/i);

      const dims = getSvgDimensions(clean);
      expect(dims.width).toBe(200);
      expect(dims.height).toBe(100);
    });

    it('chấp nhận PNG/JPG/WebP/SVG dưới 10MB và từ chối định dạng nguy hiểm hoặc quá lớn', () => {
      expect(isSupportedImageFile({ name: 'do-thi.png', type: 'image/png', size: 1024 }).ok).toBe(true);
      expect(isSupportedImageFile({ name: 'mach-dien.jpg', type: 'image/jpeg', size: 1024 }).ok).toBe(true);
      expect(isSupportedImageFile({ name: 'hinh.webp', type: 'image/webp', size: 1024 }).ok).toBe(true);
      expect(isSupportedImageFile({ name: 'vector.svg', type: 'image/svg+xml', size: 2048 }).ok).toBe(true);

      expect(isSupportedImageFile({ name: 'payload.html', type: 'text/html', size: 500 }).ok).toBe(false);
      expect(isSupportedImageFile({ name: 'virus.exe', type: 'application/octet-stream', size: 500 }).ok).toBe(false);
      expect(isSupportedImageFile({ name: 'huge.png', type: 'image/png', size: 15 * 1024 * 1024 }).ok).toBe(false);
    });
  });

  // =========================================================================
  // 7. PARSER & EXAM TOOLS INTEGRATION WITH FIGURES
  // =========================================================================
  describe('7. Tích hợp hình minh họa vào câu hỏi, đề thi & phương án A/B/C/D', () => {
    it('nhận diện chính xác token [[HINH:...]] trong thân câu hỏi, nhiều hình trong 1 câu và trong phương án A/B/C/D', () => {
      const examText = [
        'Câu 1. Cho hình chóp $S.ABCD$ và đồ thị hàm số $y = \\frac{x^2+1}{2}$ như hai hình bên dưới:',
        '[[HINH:fig_3d_01]]',
        '[[HINH:fig_graph_02]]',
        'A. [[HINH:fig_opt_a]]',
        'B. [[HINH:fig_opt_b]]',
        'C. $x = 2$',
        'D. $x = 4$',
      ].join('\n');

      const doc = processDocumentText(examText, 'plain', [], 'auto');
      const figureIds: string[] = [];
      let formulaCount = 0;

      for (const b of doc.blocks) {
        if (b.type === 'paragraph') {
          for (const s of b.segments) {
            if (s.type === 'figure') figureIds.push(s.figureId);
            if (s.type === 'formula') formulaCount++;
          }
        }
      }

      expect(figureIds).toEqual(['fig_3d_01', 'fig_graph_02', 'fig_opt_a', 'fig_opt_b']);
      expect(formulaCount).toBe(4);
    });

    it('giữ nguyên token [[HINH:...]] khi chuẩn hóa đề thi, đánh số lại câu và căn chỉnh phương án', () => {
      const raw = [
        'Câu 5. Tính điện trở tương đương của mạch điện:',
        '[[HINH:fig_circuit_1]]',
        'A. [[HINH:fig_ans_a]]',
        'B. [[HINH:fig_ans_b]]',
        'C. $R = 10\\,\\Omega$',
        'D. $R = 20\\,\\Omega$',
      ].join('\n');

      const norm = normalizeExamText(raw, DEFAULT_NORMALIZATION_OPTIONS);
      expect(norm.text).toContain('[[HINH:fig_circuit_1]]');
      expect(norm.text).toContain('[[HINH:fig_ans_a]]');

      const renum = renumberQuestions(norm.text, { startNumber: 1, fromLineIndex: 0, prefix: 'Câu' });
      expect(renum.text).toContain('Câu 1.');
      expect(renum.text).toContain('[[HINH:fig_circuit_1]]');

      // Guard: 4-col MCQ containing figures downgrades to <=2 cols so all 4 options never squish onto 1 line
      const aligned = formatMultipleChoiceOptions(renum.text, 4);
      expect(aligned.text).toContain('[[HINH:fig_ans_a]]');
      expect(aligned.text).toContain('[[HINH:fig_ans_b]]');
      const optionLine = aligned.text.split('\n').find((l) => l.includes('[[HINH:fig_ans_a]]')) || '';
      expect(optionLine).not.toContain('C.');
      expect(optionLine).not.toContain('D.');
    });
  });

  // =========================================================================
  // 8. WORD DOCX EXPORT WITH TEXT + EDITABLE OMML EQUATIONS + EMBEDDED FIGURES
  // =========================================================================
  describe('8. Xuất tệp Word (.docx) chứa văn bản + OMML Word Equation + Hình nhúng thực', () => {
    it('nhúng đồng thời văn bản tiếng Việt, phương trình OMML chỉnh sửa được, hình vector (PNG + SVG blip) và ảnh raster', async () => {
      const geoState = createDefaultGeometry3DState('cube');
      const geoSvg = renderGeometry3DToSvg(geoState);

      const figVector: FigureAsset = {
        id: 'fig_vec_cube',
        kind: 'geometry_3d',
        subject: 'math',
        title: "Hình lập phương ABCD.A'B'C'D'",
        caption: 'Khối lập phương cạnh a',
        showNumber: true,
        align: 'center',
        widthPx: 360,
        aspectRatio: 0.72,
        rotationDeg: 0,
        crop: DEFAULT_FIGURE_CROP,
        svgMarkup: geoSvg,
        pngDataUrl: TINY_PNG_DATA_URL,
        sourceData: geoState,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const figRaster: FigureAsset = {
        id: 'fig_ras_photo',
        kind: 'raster_upload',
        subject: 'physics',
        title: 'Ảnh mạch điện thí nghiệm',
        caption: 'Sơ đồ thí nghiệm định luật Ôm',
        showNumber: true,
        align: 'left',
        widthPx: 320,
        aspectRatio: 0.65,
        rotationDeg: 0,
        crop: DEFAULT_FIGURE_CROP,
        pngDataUrl: TINY_PNG_DATA_URL,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const figuresMap = new Map<string, FigureAsset>([
        [figVector.id, figVector],
        [figRaster.id, figRaster],
      ]);

      const source = [
        'Câu 1. Tính thể tích khối lập phương biết biểu thức $V = \\frac{x^2+1}{2}$:',
        '[[HINH:fig_vec_cube]]',
        'Câu 2. Quan sát thí nghiệm dòng điện $I = \\frac{U}{R}$:',
        '[[HINH:fig_ras_photo]]',
      ].join('\n');

      const doc = processDocumentText(source, 'plain', [], 'auto');
      const buf = await generateDocxBuffer(doc, {
        style: DEFAULT_EXAM_STYLE,
        header: EMPTY_EXAM_HEADER,
        figures: figuresMap,
      });

      const zip = await JSZip.loadAsync(buf);
      const docXml = await zip.file('word/document.xml')?.async('string');
      const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string');
      const contentTypesXml = await zip.file('[Content_Types].xml')?.async('string');

      expect(docXml).toBeTruthy();
      expect(relsXml).toBeTruthy();
      expect(contentTypesXml).toBeTruthy();

      // Editable OMML equations preserved
      expect(docXml!).toContain('<m:oMath');
      expect(docXml!).toContain('<m:f>');

      // Vietnamese text & figure captions preserved
      expect(docXml!).toContain('khối lập phương');
      expect(docXml!).toContain('Hình 1. Khối lập phương cạnh a');
      expect(docXml!).toContain('Hình 2. Sơ đồ thí nghiệm định luật Ôm');

      // Real Word drawing XML + PNG & Office 365 SVG blip extensions
      expect(docXml!).toContain('<w:drawing>');
      expect(docXml!).toContain('<wp:inline');
      expect(docXml!).toContain('<a:blip');
      expect(docXml!).toContain('svgBlip');

      // Media files physically packed into ZIP
      const mediaNames = Object.keys(zip.files).filter((k) => k.startsWith('word/media/'));
      expect(mediaNames.some((n) => n.endsWith('.png'))).toBe(true);
      expect(mediaNames.some((n) => n.endsWith('.svg'))).toBe(true);

      // Content types & relationships valid
      expect(contentTypesXml!).toContain('Extension="png"');
      expect(contentTypesXml!).toContain('Extension="svg"');
      expect(relsXml!).toContain('media/image');
    });
  });

  // =========================================================================
  // 9. OFFLINE STORAGE & PERSONAL FIGURE LIBRARY PERSISTENCE
  // =========================================================================
  describe('9. Lưu trữ ngoại tuyến hình vẽ & thư viện hình cá nhân (figureStorage)', () => {
    it('lưu, đọc, cập nhật và xóa FigureAsset cùng mẫu hình cá nhân, yêu thích và gần đây', async () => {
      const id = generateFigureId();
      const asset: FigureAsset = {
        id,
        kind: 'vector_2d',
        subject: 'math',
        title: 'Tam giác vuông ABC',
        caption: 'Tam giác ABC vuông tại A',
        showNumber: true,
        align: 'center',
        widthPx: 400,
        aspectRatio: 0.65,
        rotationDeg: 0,
        crop: DEFAULT_FIGURE_CROP,
        svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 130"><line x1="0" y1="0" x2="100" y2="100" stroke="#000"/></svg>',
        pngDataUrl: TINY_PNG_DATA_URL,
        sourceData: createDefaultDiagramScene(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveFigureAsset(asset);
      const loaded = await loadAllFigures();
      expect(loaded.has(id)).toBe(true);

      await deleteFigureAsset(id);
      const afterDelete = await loadAllFigures();
      expect(afterDelete.has(id)).toBe(false);

      const tpl: FigureLibraryTemplate = {
        id: 'custom_tpl_1',
        name: 'Mạch RLC nối tiếp cá nhân',
        subject: 'physics',
        grade: '12',
        topic: 'Dòng điện xoay chiều',
        group: 'Hình cá nhân',
        kind: 'vector_2d',
        isBuiltIn: false,
        sourceData: createDefaultDiagramScene(),
        createdAt: Date.now(),
      };

      await saveCustomFigureTemplate(tpl);
      await saveFigureFavoriteIds(['custom_tpl_1']);
      await recordRecentFigureTemplate('custom_tpl_1');

      const snap = await loadFigureLibraryState();
      expect(snap.customTemplates.some((t) => t.id === 'custom_tpl_1')).toBe(true);
      expect(snap.favoriteIds).toContain('custom_tpl_1');
      expect(snap.recentEntries.some((r) => r.id === 'custom_tpl_1')).toBe(true);

      await deleteCustomFigureTemplate('custom_tpl_1');
      const snapAfter = await loadFigureLibraryState();
      expect(snapAfter.customTemplates.some((t) => t.id === 'custom_tpl_1')).toBe(false);
    });
  });
});
