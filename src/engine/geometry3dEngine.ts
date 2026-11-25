import { Geometry3DSolidType, Geometry3DState } from './figureTypes';

/**
 * 3D Spatial Geometry Engine for all 14 THPT/THCS models (Section IV):
 * Provides exact 3D vertex/edge/face definitions, camera projection, hidden-edge
 * visibility classification (solid visible edges vs dashed hidden edges), custom vertex labels,
 * optional Oxyz axes, and high-precision standalone SVG export at the exact current viewing angle.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SolidEdgeDef {
  a: string;
  b: string;
  forceDashed?: boolean;
  accent?: boolean;
  arrow?: boolean;
}

export interface SolidFaceDef {
  vertices: string[];
  accent?: boolean;
  doubleSided?: boolean;
}

export interface SolidMeshDef {
  title: string;
  vertices: Record<string, Vec3>;
  labelKeys: string[];
  edges: SolidEdgeDef[];
  faces: SolidFaceDef[];
  curved?: 'cylinder' | 'cone' | 'sphere';
}

export const GEOMETRY_3D_LABELS: Record<Geometry3DSolidType, string> = {
  cube: 'Hình lập phương',
  cuboid: 'Hình hộp chữ nhật',
  parallelepiped: 'Hình hộp xiên',
  triangular_prism: 'Hình lăng trụ tam giác',
  square_pyramid: 'Hình chóp tứ giác S.ABCD',
  tetrahedron: 'Tứ diện S.ABC',
  cylinder: 'Hình trụ',
  cone: 'Hình nón',
  sphere: 'Hình cầu',
  plane: 'Mặt phẳng (P)',
  space_line: 'Đường thẳng trong không gian',
  intersection_line: 'Giao tuyến hai mặt phẳng',
  cross_section: 'Thiết diện hình chóp',
  oxyz_axes: 'Hệ trục tọa độ Oxyz',
};

export function createDefaultGeometry3DState(
  solidType: Geometry3DSolidType = 'square_pyramid'
): Geometry3DState {
  return {
    solidType,
    azimuthDeg: -34,
    elevationDeg: 22,
    zoom: 1,
    showHiddenEdges: true,
    showLabels: true,
    showAxes: solidType === 'oxyz_axes',
    showFacesFill: true,
    strokeColor: '#0f172a',
    accentColor: '#2563eb',
    customLabels: {},
  };
}

export function getSolidMesh(type: Geometry3DSolidType): SolidMeshDef {
  switch (type) {
    case 'cube': {
      const s = 1;
      return {
        title: GEOMETRY_3D_LABELS.cube,
        vertices: {
          A: { x: -s, y: -s, z: -s },
          B: { x: s, y: -s, z: -s },
          C: { x: s, y: -s, z: s },
          D: { x: -s, y: -s, z: s },
          "A'": { x: -s, y: s, z: -s },
          "B'": { x: s, y: s, z: -s },
          "C'": { x: s, y: s, z: s },
          "D'": { x: -s, y: s, z: s },
        },
        labelKeys: ['A', 'B', 'C', 'D', "A'", "B'", "C'", "D'"],
        faces: [
          { vertices: ['A', 'B', 'C', 'D'] }, // bottom (y=-s, normal -y)
          { vertices: ["A'", "D'", "C'", "B'"] }, // top (y=+s, normal +y)
          { vertices: ['D', 'C', "C'", "D'"] }, // front (z=+s, normal +z)
          { vertices: ['B', 'A', "A'", "B'"] }, // back (z=-s, normal -z)
          { vertices: ['C', 'B', "B'", "C'"] }, // right (x=+s, normal +x)
          { vertices: ['A', 'D', "D'", "A'"] }, // left (x=-s, normal -x)
        ],
        edges: [
          { a: 'A', b: 'B' }, { a: 'B', b: 'C' }, { a: 'C', b: 'D' }, { a: 'D', b: 'A' },
          { a: "A'", b: "B'" }, { a: "B'", b: "C'" }, { a: "C'", b: "D'" }, { a: "D'", b: "A'" },
          { a: 'A', b: "A'" }, { a: 'B', b: "B'" }, { a: 'C', b: "C'" }, { a: 'D', b: "D'" },
        ],
      };
    }

    case 'cuboid': {
      const rx = 1.35, ry = 0.85, rz = 0.95;
      return {
        title: GEOMETRY_3D_LABELS.cuboid,
        vertices: {
          A: { x: -rx, y: -ry, z: -rz },
          B: { x: rx, y: -ry, z: -rz },
          C: { x: rx, y: -ry, z: rz },
          D: { x: -rx, y: -ry, z: rz },
          "A'": { x: -rx, y: ry, z: -rz },
          "B'": { x: rx, y: ry, z: -rz },
          "C'": { x: rx, y: ry, z: rz },
          "D'": { x: -rx, y: ry, z: rz },
        },
        labelKeys: ['A', 'B', 'C', 'D', "A'", "B'", "C'", "D'"],
        faces: [
          { vertices: ['A', 'B', 'C', 'D'] },
          { vertices: ["A'", "D'", "C'", "B'"] },
          { vertices: ['D', 'C', "C'", "D'"] },
          { vertices: ['B', 'A', "A'", "B'"] },
          { vertices: ['C', 'B', "B'", "C'"] },
          { vertices: ['A', 'D', "D'", "A'"] },
        ],
        edges: [
          { a: 'A', b: 'B' }, { a: 'B', b: 'C' }, { a: 'C', b: 'D' }, { a: 'D', b: 'A' },
          { a: "A'", b: "B'" }, { a: "B'", b: "C'" }, { a: "C'", b: "D'" }, { a: "D'", b: "A'" },
          { a: 'A', b: "A'" }, { a: 'B', b: "B'" }, { a: 'C', b: "C'" }, { a: 'D', b: "D'" },
        ],
      };
    }

    case 'parallelepiped': {
      const shX = 0.45, shZ = 0.25;
      return {
        title: GEOMETRY_3D_LABELS.parallelepiped,
        vertices: {
          A: { x: -1.1, y: -0.9, z: -0.8 },
          B: { x: 0.9, y: -0.9, z: -0.8 },
          C: { x: 1.2, y: -0.9, z: 0.8 },
          D: { x: -0.8, y: -0.9, z: 0.8 },
          "A'": { x: -1.1 + shX, y: 0.95, z: -0.8 + shZ },
          "B'": { x: 0.9 + shX, y: 0.95, z: -0.8 + shZ },
          "C'": { x: 1.2 + shX, y: 0.95, z: 0.8 + shZ },
          "D'": { x: -0.8 + shX, y: 0.95, z: 0.8 + shZ },
        },
        labelKeys: ['A', 'B', 'C', 'D', "A'", "B'", "C'", "D'"],
        faces: [
          { vertices: ['A', 'B', 'C', 'D'] },
          { vertices: ["A'", "D'", "C'", "B'"] },
          { vertices: ['D', 'C', "C'", "D'"] },
          { vertices: ['B', 'A', "A'", "B'"] },
          { vertices: ['C', 'B', "B'", "C'"] },
          { vertices: ['A', 'D', "D'", "A'"] },
        ],
        edges: [
          { a: 'A', b: 'B' }, { a: 'B', b: 'C' }, { a: 'C', b: 'D' }, { a: 'D', b: 'A' },
          { a: "A'", b: "B'" }, { a: "B'", b: "C'" }, { a: "C'", b: "D'" }, { a: "D'", b: "A'" },
          { a: 'A', b: "A'" }, { a: 'B', b: "B'" }, { a: 'C', b: "C'" }, { a: 'D', b: "D'" },
        ],
      };
    }

    case 'triangular_prism':
      return {
        title: GEOMETRY_3D_LABELS.triangular_prism,
        vertices: {
          A: { x: -1.1, y: -1.0, z: 0.65 },
          B: { x: 1.1, y: -1.0, z: 0.65 },
          C: { x: 0.0, y: -1.0, z: -1.0 },
          "A'": { x: -1.1, y: 1.0, z: 0.65 },
          "B'": { x: 1.1, y: 1.0, z: 0.65 },
          "C'": { x: 0.0, y: 1.0, z: -1.0 },
        },
        labelKeys: ['A', 'B', 'C', "A'", "B'", "C'"],
        faces: [
          { vertices: ['A', 'C', 'B'] },
          { vertices: ["A'", "B'", "C'"] },
          { vertices: ['A', 'B', "B'", "A'"] },
          { vertices: ['B', 'C', "C'", "B'"] },
          { vertices: ['C', 'A', "A'", "C'"] },
        ],
        edges: [
          { a: 'A', b: 'B' }, { a: 'B', b: 'C' }, { a: 'C', b: 'A' },
          { a: "A'", b: "B'" }, { a: "B'", b: "C'" }, { a: "C'", b: "A'" },
          { a: 'A', b: "A'" }, { a: 'B', b: "B'" }, { a: 'C', b: "C'" },
        ],
      };

    case 'square_pyramid':
      return {
        title: GEOMETRY_3D_LABELS.square_pyramid,
        vertices: {
          S: { x: 0, y: 1.35, z: 0 },
          A: { x: -1.05, y: -0.95, z: -0.95 },
          B: { x: 1.05, y: -0.95, z: -0.95 },
          C: { x: 1.05, y: -0.95, z: 0.95 },
          D: { x: -1.05, y: -0.95, z: 0.95 },
          O: { x: 0, y: -0.95, z: 0 },
        },
        labelKeys: ['S', 'A', 'B', 'C', 'D', 'O'],
        faces: [
          { vertices: ['A', 'B', 'C', 'D'] },
          { vertices: ['S', 'D', 'C'] },
          { vertices: ['S', 'C', 'B'] },
          { vertices: ['S', 'B', 'A'] },
          { vertices: ['S', 'A', 'D'] },
        ],
        edges: [
          { a: 'A', b: 'B' }, { a: 'B', b: 'C' }, { a: 'C', b: 'D' }, { a: 'D', b: 'A' },
          { a: 'S', b: 'A' }, { a: 'S', b: 'B' }, { a: 'S', b: 'C' }, { a: 'S', b: 'D' },
          { a: 'S', b: 'O', forceDashed: true, accent: true },
          { a: 'A', b: 'C', forceDashed: true },
          { a: 'B', b: 'D', forceDashed: true },
        ],
      };

    case 'tetrahedron':
      return {
        title: GEOMETRY_3D_LABELS.tetrahedron,
        vertices: {
          S: { x: 0, y: 1.35, z: 0.1 },
          A: { x: -1.15, y: -0.9, z: 0.7 },
          B: { x: 1.15, y: -0.9, z: 0.7 },
          C: { x: 0.1, y: -0.9, z: -1.1 },
        },
        labelKeys: ['S', 'A', 'B', 'C'],
        faces: [
          { vertices: ['A', 'C', 'B'] },
          { vertices: ['S', 'A', 'B'] },
          { vertices: ['S', 'B', 'C'] },
          { vertices: ['S', 'C', 'A'] },
        ],
        edges: [
          { a: 'A', b: 'B' }, { a: 'B', b: 'C' }, { a: 'C', b: 'A' },
          { a: 'S', b: 'A' }, { a: 'S', b: 'B' }, { a: 'S', b: 'C' },
        ],
      };

    case 'cylinder':
      return {
        title: GEOMETRY_3D_LABELS.cylinder,
        curved: 'cylinder',
        vertices: {
          O: { x: 0, y: -1.05, z: 0 },
          "O'": { x: 0, y: 1.05, z: 0 },
          A: { x: 1.0, y: -1.05, z: 0 },
          "A'": { x: 1.0, y: 1.05, z: 0 },
        },
        labelKeys: ['O', "O'", 'A', "A'"],
        faces: [],
        edges: [
          { a: 'O', b: "O'", forceDashed: true, accent: true },
          { a: 'O', b: 'A', forceDashed: true },
        ],
      };

    case 'cone':
      return {
        title: GEOMETRY_3D_LABELS.cone,
        curved: 'cone',
        vertices: {
          S: { x: 0, y: 1.35, z: 0 },
          O: { x: 0, y: -0.95, z: 0 },
          A: { x: 1.05, y: -0.95, z: 0 },
        },
        labelKeys: ['S', 'O', 'A'],
        faces: [],
        edges: [
          { a: 'S', b: 'O', forceDashed: true, accent: true },
          { a: 'O', b: 'A', forceDashed: true },
        ],
      };

    case 'sphere':
      return {
        title: GEOMETRY_3D_LABELS.sphere,
        curved: 'sphere',
        vertices: {
          O: { x: 0, y: 0, z: 0 },
          R: { x: 1.15, y: 0, z: 0 },
        },
        labelKeys: ['O', 'R'],
        faces: [],
        edges: [{ a: 'O', b: 'R', forceDashed: true, accent: true }],
      };

    case 'plane':
      return {
        title: GEOMETRY_3D_LABELS.plane,
        vertices: {
          P1: { x: -1.45, y: -0.1, z: -0.95 },
          P2: { x: 1.25, y: -0.1, z: -0.95 },
          P3: { x: 1.55, y: -0.1, z: 0.95 },
          P4: { x: -1.15, y: -0.1, z: 0.95 },
          A: { x: -0.45, y: -0.1, z: 0.25 },
          B: { x: 0.55, y: -0.1, z: -0.25 },
          n: { x: 0, y: 1.05, z: 0 },
          O: { x: 0, y: -0.1, z: 0 },
        },
        labelKeys: ['A', 'B', 'O', 'n'],
        faces: [{ vertices: ['P1', 'P2', 'P3', 'P4'], accent: true, doubleSided: true }],
        edges: [
          { a: 'P1', b: 'P2' }, { a: 'P2', b: 'P3' }, { a: 'P3', b: 'P4' }, { a: 'P4', b: 'P1' },
          { a: 'A', b: 'B' },
          { a: 'O', b: 'n', accent: true, arrow: true },
        ],
      };

    case 'space_line':
      return {
        title: GEOMETRY_3D_LABELS.space_line,
        vertices: {
          P1: { x: -1.4, y: -0.5, z: -0.95 },
          P2: { x: 1.3, y: -0.5, z: -0.95 },
          P3: { x: 1.5, y: -0.5, z: 0.95 },
          P4: { x: -1.2, y: -0.5, z: 0.95 },
          M: { x: -0.9, y: 1.1, z: -0.3 },
          I: { x: 0.1, y: -0.5, z: 0.05 },
          N: { x: 0.7, y: -1.35, z: 0.25 },
          H: { x: -0.9, y: -0.5, z: -0.3 },
        },
        labelKeys: ['M', 'I', 'H'],
        faces: [{ vertices: ['P1', 'P2', 'P3', 'P4'], doubleSided: true }],
        edges: [
          { a: 'P1', b: 'P2' }, { a: 'P2', b: 'P3' }, { a: 'P3', b: 'P4' }, { a: 'P4', b: 'P1' },
          { a: 'M', b: 'I', accent: true },
          { a: 'I', b: 'N', forceDashed: true, accent: true },
          { a: 'M', b: 'H', forceDashed: true },
          { a: 'H', b: 'I', forceDashed: true },
        ],
      };

    case 'intersection_line':
      return {
        title: GEOMETRY_3D_LABELS.intersection_line,
        vertices: {
          A: { x: -1.4, y: -0.55, z: 0 },
          B: { x: 1.4, y: -0.55, z: 0 },
          P3: { x: 1.4, y: -0.55, z: 1.15 },
          P4: { x: -1.4, y: -0.55, z: 1.15 },
          Q3: { x: 1.4, y: 1.05, z: -0.75 },
          Q4: { x: -1.4, y: 1.05, z: -0.75 },
        },
        labelKeys: ['A', 'B'],
        faces: [
          { vertices: ['A', 'B', 'P3', 'P4'], doubleSided: true },
          { vertices: ['A', 'B', 'Q3', 'Q4'], accent: true, doubleSided: true },
        ],
        edges: [
          { a: 'A', b: 'B', accent: true },
          { a: 'B', b: 'P3' }, { a: 'P3', b: 'P4' }, { a: 'P4', b: 'A' },
          { a: 'B', b: 'Q3' }, { a: 'Q3', b: 'Q4' }, { a: 'Q4', b: 'A' },
        ],
      };

    case 'cross_section':
      return {
        title: GEOMETRY_3D_LABELS.cross_section,
        vertices: {
          S: { x: 0, y: 1.35, z: 0 },
          A: { x: -1.05, y: -0.95, z: -0.95 },
          B: { x: 1.05, y: -0.95, z: -0.95 },
          C: { x: 1.05, y: -0.95, z: 0.95 },
          D: { x: -1.05, y: -0.95, z: 0.95 },
          M: { x: -0.525, y: 0.2, z: -0.475 },
          N: { x: 0.525, y: 0.2, z: -0.475 },
          P: { x: 0.525, y: 0.2, z: 0.475 },
          Q: { x: -0.525, y: 0.2, z: 0.475 },
        },
        labelKeys: ['S', 'A', 'B', 'C', 'D', 'M', 'N', 'P', 'Q'],
        faces: [
          { vertices: ['A', 'B', 'C', 'D'] },
          { vertices: ['S', 'D', 'C'] },
          { vertices: ['S', 'C', 'B'] },
          { vertices: ['S', 'B', 'A'] },
          { vertices: ['S', 'A', 'D'] },
          { vertices: ['M', 'N', 'P', 'Q'], accent: true, doubleSided: true },
        ],
        edges: [
          { a: 'A', b: 'B' }, { a: 'B', b: 'C' }, { a: 'C', b: 'D' }, { a: 'D', b: 'A' },
          { a: 'S', b: 'A' }, { a: 'S', b: 'B' }, { a: 'S', b: 'C' }, { a: 'S', b: 'D' },
          { a: 'M', b: 'N', accent: true }, { a: 'N', b: 'P', accent: true },
          { a: 'P', b: 'Q', accent: true }, { a: 'Q', b: 'M', accent: true },
        ],
      };

    case 'oxyz_axes':
      return {
        title: GEOMETRY_3D_LABELS.oxyz_axes,
        vertices: {
          O: { x: 0, y: 0, z: 0 },
          x: { x: 1.55, y: 0, z: 0 },
          y: { x: 0, y: 0, z: 1.55 },
          z: { x: 0, y: 1.55, z: 0 },
          M: { x: 0.95, y: 1.0, z: 0.85 },
          Mx: { x: 0.95, y: 0, z: 0 },
          My: { x: 0, y: 0, z: 0.85 },
          Mz: { x: 0, y: 1.0, z: 0 },
          Mxy: { x: 0.95, y: 0, z: 0.85 },
        },
        labelKeys: ['O', 'x', 'y', 'z', 'M'],
        faces: [],
        edges: [
          { a: 'O', b: 'x', arrow: true },
          { a: 'O', b: 'y', arrow: true },
          { a: 'O', b: 'z', arrow: true },
          { a: 'O', b: 'M', accent: true, arrow: true },
          { a: 'Mx', b: 'Mxy', forceDashed: true },
          { a: 'My', b: 'Mxy', forceDashed: true },
          { a: 'Mxy', b: 'M', forceDashed: true },
          { a: 'Mz', b: 'M', forceDashed: true },
        ],
      };
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rotatePoint(p: Vec3, azRad: number, elRad: number): Vec3 {
  // Orbit around Y (azimuth), then X (elevation)
  const cosA = Math.cos(azRad);
  const sinA = Math.sin(azRad);
  const x1 = p.x * cosA + p.z * sinA;
  const z1 = -p.x * sinA + p.z * cosA;
  const cosE = Math.cos(elRad);
  const sinE = Math.sin(elRad);
  const y2 = p.y * cosE - z1 * sinE;
  const z2 = p.y * sinE + z1 * cosE;
  return { x: x1, y: y2, z: z2 };
}

function projectPoint(rot: Vec3, cx: number, cy: number, scale: number): { sx: number; sy: number } {
  // Gentle perspective (camera at z = +6.5)
  const camDist = 6.8;
  const factor = camDist / Math.max(1.5, camDist - rot.z);
  return {
    sx: cx + rot.x * scale * factor,
    sy: cy - rot.y * scale * factor,
  };
}

function faceSignedArea2D(pts: Array<{ sx: number; sy: number }>): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.sx * b.sy - b.sx * a.sy;
  }
  return area / 2;
}

export function renderGeometry3DToSvg(
  state: Geometry3DState,
  width = 520,
  height = 420
): string {
  const mesh = getSolidMesh(state.solidType);
  const azRad = (state.azimuthDeg * Math.PI) / 180;
  const elRad = (state.elevationDeg * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2 + 8;
  const scale = Math.min(width, height) * 0.28 * (state.zoom || 1);

  const rotated: Record<string, Vec3> = {};
  const projected: Record<string, { sx: number; sy: number }> = {};

  for (const [k, v] of Object.entries(mesh.vertices)) {
    rotated[k] = rotatePoint(v, azRad, elRad);
    projected[k] = projectPoint(rotated[k], cx, cy, scale);
  }

  // Classify front-facing faces for accurate polyhedron hidden-edge detection
  const faceVisible: boolean[] = mesh.faces.map((f) => {
    if (f.doubleSided) return true;
    const pts = f.vertices.map((vk) => projected[vk]);
    // In SVG y-down coords, CCW in 3D projects to negative signed area when facing camera
    return faceSignedArea2D(pts) < 0;
  });

  // Painter's sort faces back-to-front
  const facesSvg = state.showFacesFill
    ? mesh.faces
        .map((f, idx) => ({
          f,
          visible: faceVisible[idx],
          avgZ: f.vertices.reduce((s, vk) => s + rotated[vk].z, 0) / f.vertices.length,
        }))
        .sort((a, b) => a.avgZ - b.avgZ)
        .map(({ f }) => {
          const pts = f.vertices
            .map((vk) => `${projected[vk].sx.toFixed(1)},${projected[vk].sy.toFixed(1)}`)
            .join(' ');
          const fill = f.accent ? state.accentColor || '#2563eb' : '#cbd5e1';
          const opacity = f.accent ? 0.24 : 0.16;
          return `<polygon points="${pts}" fill="${escapeXml(fill)}" fill-opacity="${opacity}" stroke="none" />`;
        })
        .join('\n  ')
    : '';

  // Curved surfaces (cylinder, cone, sphere)
  let curvedSvg = '';
  if (mesh.curved === 'cylinder' || mesh.curved === 'cone') {
    const r = mesh.curved === 'cylinder' ? 1.0 : 1.05;
    const yBot = mesh.curved === 'cylinder' ? -1.05 : -0.95;
    const steps = 64;
    const botFront: string[] = [];
    const botBack: string[] = [];
    const topPts: string[] = [];

    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * Math.PI * 2;
      const bp = rotatePoint({ x: r * Math.cos(th), y: yBot, z: r * Math.sin(th) }, azRad, elRad);
      const bProj = projectPoint(bp, cx, cy, scale);
      // Determine front vs back half relative to ellipse center
      const isFront = bp.z >= rotatePoint({ x: 0, y: yBot, z: 0 }, azRad, elRad).z;
      const coord = `${bProj.sx.toFixed(1)},${bProj.sy.toFixed(1)}`;
      if (isFront) botFront.push(coord);
      else botBack.push(coord);

      if (mesh.curved === 'cylinder') {
        const tp = rotatePoint({ x: r * Math.cos(th), y: 1.05, z: r * Math.sin(th) }, azRad, elRad);
        const tProj = projectPoint(tp, cx, cy, scale);
        topPts.push(`${tProj.sx.toFixed(1)},${tProj.sy.toFixed(1)}`);
      }
    }

    // Find extreme left & right screen points on base ellipse for silhouette generators
    let leftPt = { sx: Infinity, sy: 0 };
    let rightPt = { sx: -Infinity, sy: 0 };
    let topLeft = { sx: Infinity, sy: 0 };
    let topRight = { sx: -Infinity, sy: 0 };
    for (let i = 0; i < steps; i++) {
      const th = (i / steps) * Math.PI * 2;
      const bp = projectPoint(rotatePoint({ x: r * Math.cos(th), y: yBot, z: r * Math.sin(th) }, azRad, elRad), cx, cy, scale);
      if (bp.sx < leftPt.sx) leftPt = bp;
      if (bp.sx > rightPt.sx) rightPt = bp;
      if (mesh.curved === 'cylinder') {
        const tp = projectPoint(rotatePoint({ x: r * Math.cos(th), y: 1.05, z: r * Math.sin(th) }, azRad, elRad), cx, cy, scale);
        if (tp.sx < topLeft.sx) topLeft = tp;
        if (tp.sx > topRight.sx) topRight = tp;
      }
    }

    const sColor = escapeXml(state.strokeColor || '#0f172a');
    if (mesh.curved === 'cylinder') {
      if (state.showFacesFill) {
        curvedSvg += `<polygon points="${topLeft.sx.toFixed(1)},${topLeft.sy.toFixed(1)} ${topRight.sx.toFixed(1)},${topRight.sy.toFixed(1)} ${rightPt.sx.toFixed(1)},${rightPt.sy.toFixed(1)} ${leftPt.sx.toFixed(1)},${leftPt.sy.toFixed(1)}" fill="#cbd5e1" fill-opacity="0.18" />`;
      }
      curvedSvg += `<polygon points="${topPts.join(' ')}" fill="${state.showFacesFill ? '#e2e8f0' : 'none'}" fill-opacity="0.32" stroke="${sColor}" stroke-width="2" />`;
      curvedSvg += `<line x1="${topLeft.sx.toFixed(1)}" y1="${topLeft.sy.toFixed(1)}" x2="${leftPt.sx.toFixed(1)}" y2="${leftPt.sy.toFixed(1)}" stroke="${sColor}" stroke-width="2" />`;
      curvedSvg += `<line x1="${topRight.sx.toFixed(1)}" y1="${topRight.sy.toFixed(1)}" x2="${rightPt.sx.toFixed(1)}" y2="${rightPt.sy.toFixed(1)}" stroke="${sColor}" stroke-width="2" />`;
    } else {
      const apex = projected.S;
      if (state.showFacesFill) {
        curvedSvg += `<polygon points="${apex.sx.toFixed(1)},${apex.sy.toFixed(1)} ${leftPt.sx.toFixed(1)},${leftPt.sy.toFixed(1)} ${rightPt.sx.toFixed(1)},${rightPt.sy.toFixed(1)}" fill="#cbd5e1" fill-opacity="0.2" />`;
      }
      curvedSvg += `<line x1="${apex.sx.toFixed(1)}" y1="${apex.sy.toFixed(1)}" x2="${leftPt.sx.toFixed(1)}" y2="${leftPt.sy.toFixed(1)}" stroke="${sColor}" stroke-width="2" />`;
      curvedSvg += `<line x1="${apex.sx.toFixed(1)}" y1="${apex.sy.toFixed(1)}" x2="${rightPt.sx.toFixed(1)}" y2="${rightPt.sy.toFixed(1)}" stroke="${sColor}" stroke-width="2" />`;
    }

    if (botFront.length > 1) {
      curvedSvg += `<polyline points="${botFront.join(' ')}" fill="none" stroke="${sColor}" stroke-width="2" />`;
    }
    if (botBack.length > 1 && state.showHiddenEdges) {
      curvedSvg += `<polyline points="${botBack.join(' ')}" fill="none" stroke="${sColor}" stroke-width="1.6" stroke-dasharray="6 5" opacity="0.78" />`;
    }
  } else if (mesh.curved === 'sphere') {
    const radPx = 1.15 * scale;
    const oProj = projected.O;
    const sColor = escapeXml(state.strokeColor || '#0f172a');
    curvedSvg += `<circle cx="${oProj.sx.toFixed(1)}" cy="${oProj.sy.toFixed(1)}" r="${radPx.toFixed(1)}" fill="${state.showFacesFill ? '#e0f2fe' : 'none'}" fill-opacity="0.35" stroke="${sColor}" stroke-width="2.1" />`;
    // Equator ellipse (front solid, back dashed)
    const ry = Math.max(8, Math.abs(Math.sin(elRad)) * radPx);
    curvedSvg += `<path d="M ${(oProj.sx - radPx).toFixed(1)} ${oProj.sy.toFixed(1)} A ${radPx.toFixed(1)} ${ry.toFixed(1)} 0 0 0 ${(oProj.sx + radPx).toFixed(1)} ${oProj.sy.toFixed(1)}" fill="none" stroke="${sColor}" stroke-width="1.7" />`;
    if (state.showHiddenEdges) {
      curvedSvg += `<path d="M ${(oProj.sx - radPx).toFixed(1)} ${oProj.sy.toFixed(1)} A ${radPx.toFixed(1)} ${ry.toFixed(1)} 0 0 1 ${(oProj.sx + radPx).toFixed(1)} ${oProj.sy.toFixed(1)}" fill="none" stroke="${sColor}" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.75" />`;
    }
  }

  // Optional Oxyz overlay axes on non-oxyz solids
  let extraAxesSvg = '';
  if (state.showAxes && state.solidType !== 'oxyz_axes') {
    const o = projectPoint(rotatePoint({ x: 0, y: 0, z: 0 }, azRad, elRad), cx, cy, scale);
    const axX = projectPoint(rotatePoint({ x: 1.5, y: 0, z: 0 }, azRad, elRad), cx, cy, scale);
    const axY = projectPoint(rotatePoint({ x: 0, y: 0, z: 1.5 }, azRad, elRad), cx, cy, scale);
    const axZ = projectPoint(rotatePoint({ x: 0, y: 1.5, z: 0 }, azRad, elRad), cx, cy, scale);
    extraAxesSvg = `
      <line x1="${o.sx.toFixed(1)}" y1="${o.sy.toFixed(1)}" x2="${axX.sx.toFixed(1)}" y2="${axX.sy.toFixed(1)}" stroke="#dc2626" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#mf-3d-arrow)" />
      <line x1="${o.sx.toFixed(1)}" y1="${o.sy.toFixed(1)}" x2="${axY.sx.toFixed(1)}" y2="${axY.sy.toFixed(1)}" stroke="#16a34a" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#mf-3d-arrow)" />
      <line x1="${o.sx.toFixed(1)}" y1="${o.sy.toFixed(1)}" x2="${axZ.sx.toFixed(1)}" y2="${axZ.sy.toFixed(1)}" stroke="#2563eb" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#mf-3d-arrow)" />
      <text x="${(axX.sx + 8).toFixed(1)}" y="${(axX.sy + 4).toFixed(1)}" font-family="Cambria, serif" font-size="13" font-style="italic" fill="#dc2626">x</text>
      <text x="${(axY.sx + 8).toFixed(1)}" y="${(axY.sy + 4).toFixed(1)}" font-family="Cambria, serif" font-size="13" font-style="italic" fill="#16a34a">y</text>
      <text x="${(axZ.sx + 8).toFixed(1)}" y="${(axZ.sy - 4).toFixed(1)}" font-family="Cambria, serif" font-size="13" font-style="italic" fill="#2563eb">z</text>`;
  }

  // Classify each edge: hidden if it belongs to polyhedron faces AND none of its adjacent faces is front-facing
  const edgesSvg = mesh.edges
    .map((e) => {
      const p1 = projected[e.a];
      const p2 = projected[e.b];
      let isHidden = Boolean(e.forceDashed);
      if (!isHidden && mesh.faces.length > 0 && !mesh.faces.every((f) => f.doubleSided)) {
        const adj = mesh.faces
          .map((f, idx) => ({ f, idx }))
          .filter(({ f }) => !f.doubleSided && f.vertices.includes(e.a) && f.vertices.includes(e.b));
        if (adj.length > 0) {
          isHidden = !adj.some(({ idx }) => faceVisible[idx]);
        }
      }

      if (isHidden && !state.showHiddenEdges) return '';
      const color = e.accent ? state.accentColor || '#2563eb' : state.strokeColor || '#0f172a';
      const dash = isHidden ? ' stroke-dasharray="6 5" opacity="0.78"' : '';
      const sw = isHidden ? 1.6 : e.accent ? 2.4 : 2.1;
      const marker = e.arrow ? ' marker-end="url(#mf-3d-arrow)"' : '';
      return `<line x1="${p1.sx.toFixed(1)}" y1="${p1.sy.toFixed(1)}" x2="${p2.sx.toFixed(1)}" y2="${p2.sy.toFixed(1)}" stroke="${escapeXml(color)}" stroke-width="${sw}"${dash}${marker} stroke-linecap="round" />`;
    })
    .join('\n  ');

  // Vertex points & editable labels pushed slightly outward from centroid
  const centroid = mesh.labelKeys.reduce(
    (acc, k) => ({ sx: acc.sx + projected[k].sx / mesh.labelKeys.length, sy: acc.sy + projected[k].sy / mesh.labelKeys.length }),
    { sx: 0, sy: 0 }
  );

  const labelsSvg = state.showLabels
    ? mesh.labelKeys
        .map((k) => {
          const p = projected[k];
          const dx = p.sx - centroid.sx;
          const dy = p.sy - centroid.sy;
          const len = Math.hypot(dx, dy) || 1;
          const lx = p.sx + (dx / len) * 16;
          const ly = p.sy + (dy / len) * 16;
          const text = state.customLabels?.[k]?.trim() || k;
          return `<circle cx="${p.sx.toFixed(1)}" cy="${p.sy.toFixed(1)}" r="2.7" fill="${escapeXml(state.strokeColor || '#0f172a')}" />
  <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-family="Cambria, 'Times New Roman', serif" font-size="15" font-weight="700" font-style="italic" fill="${escapeXml(state.strokeColor || '#0f172a')}" text-anchor="middle" dominant-baseline="central">${escapeXml(text)}</text>`;
        })
        .join('\n  ')
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <marker id="mf-3d-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
      <path d="M 0 1.2 L 9.5 5 L 0 8.8 z" fill="context-stroke" />
    </marker>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
  ${facesSvg}
  ${curvedSvg}
  ${extraAxesSvg}
  ${edgesSvg}
  ${labelsSvg}
</svg>`;
}
