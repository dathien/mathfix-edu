import { ChemAtomNode, ChemStructureState } from './figureTypes';

/**
 * Interactive 2D Chemical Structure Engine (Section VI):
 * - Supports straight chains, branched chains, cycloalkanes, benzene ring, functional groups,
 *   ions (+/-), lone electron pairs (Lewis), and 3 display modes: skeletal, condensed, lewis.
 * - Checks basic chemical valence and returns non-blocking warnings WITHOUT auto-modifying user input.
 */

export const ELEMENT_VALENCES: Record<string, number[]> = {
  H: [1],
  Li: [1],
  Na: [1],
  K: [1],
  Be: [2],
  Mg: [2],
  Ca: [2],
  Ba: [2],
  B: [3],
  Al: [3],
  C: [4],
  Si: [4],
  N: [3, 5],
  P: [3, 5],
  O: [2],
  S: [2, 4, 6],
  F: [1],
  Cl: [1, 3, 5, 7],
  Br: [1, 3, 5],
  I: [1, 3, 5, 7],
  Fe: [2, 3],
  Cu: [1, 2],
  Zn: [2],
  Ag: [1],
};

export interface ValenceWarning {
  atomId: string;
  element: string;
  bondSum: number;
  expected: number[];
  message: string;
}

export function getAtomBondOrderSum(state: ChemStructureState, atomId: string): number {
  let sum = 0;
  for (const b of state.bonds) {
    if (b.from === atomId || b.to === atomId) {
      sum += b.order;
    }
  }
  return sum;
}

/**
 * Returns valence warnings for abnormal bond counts without altering the molecule.
 */
export function checkValenceWarnings(state: ChemStructureState): ValenceWarning[] {
  const warnings: ValenceWarning[] = [];
  for (const atom of state.atoms) {
    if (atom.labelOverride && atom.labelOverride.trim()) continue;
    const allowed = ELEMENT_VALENCES[atom.element];
    if (!allowed) continue;

    const bondSum = getAtomBondOrderSum(state, atom.id);
    const charge = atom.charge ?? 0;
    // Allow typical formal charge shifts (e.g. NH4+ has N with 4 bonds, OH- has O with 1 bond, H3O+ has O with 3)
    const maxAllowed = Math.max(...allowed) + Math.abs(charge);

    if (bondSum > maxAllowed) {
      warnings.push({
        atomId: atom.id,
        element: atom.element,
        bondSum,
        expected: allowed,
        message: `Nguyên tử ${atom.element} đang có tổng bậc liên kết = ${bondSum} (vượt hóa trị thường gặp ${allowed.join('/')}).`,
      });
    }
  }
  return warnings;
}

export function computeImplicitHydrogens(state: ChemStructureState, atom: ChemAtomNode): number {
  if (atom.labelOverride) return 0;
  const standard: Record<string, number> = { C: 4, N: 3, O: 2, S: 2, P: 3, F: 1, Cl: 1, Br: 1, I: 1 };
  const base = standard[atom.element];
  if (!base) return 0;
  const chargeAdj = atom.element === 'N' && (atom.charge ?? 0) > 0 ? 1 : atom.element === 'O' && (atom.charge ?? 0) < 0 ? -1 : 0;
  const target = Math.max(0, base + chargeAdj);
  const bondSum = getAtomBondOrderSum(state, atom.id);
  return Math.max(0, target - bondSum);
}

export function createBenzeneStructure(): ChemStructureState {
  const cx = 240;
  const cy = 165;
  const r = 64;
  const atoms: ChemAtomNode[] = [];
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 - 90) * Math.PI) / 180;
    atoms.push({
      id: `c${i + 1}`,
      element: 'C',
      x: Math.round(cx + r * Math.cos(a)),
      y: Math.round(cy + r * Math.sin(a)),
    });
  }
  return {
    width: 480,
    height: 330,
    displayMode: 'skeletal',
    atoms,
    bonds: [
      { id: 'b1', from: 'c1', to: 'c2', order: 2 },
      { id: 'b2', from: 'c2', to: 'c3', order: 1 },
      { id: 'b3', from: 'c3', to: 'c4', order: 2 },
      { id: 'b4', from: 'c4', to: 'c5', order: 1 },
      { id: 'b5', from: 'c5', to: 'c6', order: 2 },
      { id: 'b6', from: 'c6', to: 'c1', order: 1 },
    ],
  };
}

export function createEthanolStructure(): ChemStructureState {
  return {
    width: 480,
    height: 280,
    displayMode: 'condensed',
    atoms: [
      { id: 'a1', element: 'C', x: 130, y: 155 },
      { id: 'a2', element: 'C', x: 235, y: 115 },
      { id: 'a3', element: 'O', x: 340, y: 155, lonePairs: 2 },
    ],
    bonds: [
      { id: 'b1', from: 'a1', to: 'a2', order: 1 },
      { id: 'b2', from: 'a2', to: 'a3', order: 1 },
    ],
  };
}

export function createAceticAcidStructure(): ChemStructureState {
  return {
    width: 480,
    height: 300,
    displayMode: 'condensed',
    atoms: [
      { id: 'a1', element: 'C', x: 130, y: 165 },
      { id: 'a2', element: 'C', x: 235, y: 165 },
      { id: 'a3', element: 'O', x: 235, y: 78, lonePairs: 2 },
      { id: 'a4', element: 'O', x: 335, y: 195, lonePairs: 2 },
    ],
    bonds: [
      { id: 'b1', from: 'a1', to: 'a2', order: 1 },
      { id: 'b2', from: 'a2', to: 'a3', order: 2 },
      { id: 'b3', from: 'a2', to: 'a4', order: 1 },
    ],
  };
}

export function createDefaultChemStructure(): ChemStructureState {
  return createEthanolStructure();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatCharge(charge?: number): string {
  if (!charge) return '';
  if (charge === 1) return '+';
  if (charge === -1) return '−';
  return charge > 0 ? `${charge}+` : `${Math.abs(charge)}−`;
}

function elementColor(el: string): string {
  switch (el) {
    case 'O':
      return '#dc2626';
    case 'N':
      return '#2563eb';
    case 'Cl':
    case 'F':
      return '#15803d';
    case 'Br':
      return '#9a3412';
    case 'S':
      return '#b45309';
    case 'P':
      return '#c2410c';
    default:
      return '#0f172a';
  }
}

export function renderChemStructureToSvg(state: ChemStructureState): string {
  const width = Math.max(260, state.width || 480);
  const height = Math.max(180, state.height || 300);
  const atomMap = new Map(state.atoms.map((a) => [a.id, a]));

  let bondsSvg = '';
  for (const bond of state.bonds) {
    const a1 = atomMap.get(bond.from);
    const a2 = atomMap.get(bond.to);
    if (!a1 || !a2) continue;

    const dx = a2.x - a1.x;
    const dy = a2.y - a1.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    const hide1 = state.displayMode === 'skeletal' && a1.element === 'C' && !a1.labelOverride && !a1.charge;
    const hide2 = state.displayMode === 'skeletal' && a2.element === 'C' && !a2.labelOverride && !a2.charge;
    const pad1 = hide1 ? 0 : 16;
    const pad2 = hide2 ? 0 : 16;

    const x1 = a1.x + ux * pad1;
    const y1 = a1.y + uy * pad1;
    const x2 = a2.x - ux * pad2;
    const y2 = a2.y - uy * pad2;

    if (bond.order === 1) {
      bondsSvg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" />`;
    } else if (bond.order === 2) {
      const off = 3.6;
      bondsSvg += `<line x1="${(x1 + nx * off).toFixed(1)}" y1="${(y1 + ny * off).toFixed(1)}" x2="${(x2 + nx * off).toFixed(1)}" y2="${(y2 + ny * off).toFixed(1)}" stroke="#0f172a" stroke-width="2" stroke-linecap="round" />`;
      bondsSvg += `<line x1="${(x1 - nx * off).toFixed(1)}" y1="${(y1 - ny * off).toFixed(1)}" x2="${(x2 - nx * off).toFixed(1)}" y2="${(y2 - ny * off).toFixed(1)}" stroke="#0f172a" stroke-width="2" stroke-linecap="round" />`;
    } else {
      const off = 5.4;
      bondsSvg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#0f172a" stroke-width="1.9" stroke-linecap="round" />`;
      bondsSvg += `<line x1="${(x1 + nx * off).toFixed(1)}" y1="${(y1 + ny * off).toFixed(1)}" x2="${(x2 + nx * off).toFixed(1)}" y2="${(y2 + ny * off).toFixed(1)}" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round" />`;
      bondsSvg += `<line x1="${(x1 - nx * off).toFixed(1)}" y1="${(y1 - ny * off).toFixed(1)}" x2="${(x2 - nx * off).toFixed(1)}" y2="${(y2 - ny * off).toFixed(1)}" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round" />`;
    }
  }

  let atomsSvg = '';
  for (const atom of state.atoms) {
    const isHiddenCarbon =
      state.displayMode === 'skeletal' &&
      atom.element === 'C' &&
      !atom.labelOverride &&
      !atom.charge &&
      !atom.lonePairs;

    if (isHiddenCarbon) continue;

    const impH = computeImplicitHydrogens(state, atom);
    const color = elementColor(atom.element);
    const chargeText = formatCharge(atom.charge);

    let mainLabel = atom.labelOverride?.trim() || atom.element;
    let hSub = '';
    if (!atom.labelOverride && impH > 0) {
      if (state.displayMode === 'condensed' || atom.element !== 'C') {
        hSub = impH === 1 ? 'H' : `H<tspan dy="4" font-size="12">${impH}</tspan><tspan dy="-4"></tspan>`;
      }
    }

    const bgW = Math.max(22, (mainLabel.length + (hSub ? 2 : 0)) * 11 + 6);
    atomsSvg += `<rect x="${(atom.x - bgW / 2).toFixed(1)}" y="${(atom.y - 12).toFixed(1)}" width="${bgW}" height="24" rx="5" fill="#ffffff" />`;
    atomsSvg += `<text x="${atom.x.toFixed(1)}" y="${(atom.y + 5).toFixed(1)}" font-family="Cambria, 'Times New Roman', serif" font-size="17" font-weight="700" fill="${color}" text-anchor="middle">${escapeXml(mainLabel)}${hSub}${
      chargeText ? `<tspan dy="-6" font-size="12" fill="#dc2626">${escapeXml(chargeText)}</tspan>` : ''
    }</text>`;

    // Lewis lone pairs (dots around atom)
    const pairs =
      state.displayMode === 'lewis'
        ? atom.lonePairs ?? (atom.element === 'O' ? 2 : atom.element === 'N' ? 1 : ['F', 'Cl', 'Br', 'I'].includes(atom.element) ? 3 : 0)
        : atom.lonePairs ?? 0;

    if (pairs > 0) {
      const positions = [
        [0, -17],
        [0, 17],
        [-19, 0],
        [19, 0],
      ];
      for (let p = 0; p < Math.min(pairs, 4); p++) {
        const [ox, oy] = positions[p];
        const horiz = oy !== 0;
        const d1x = atom.x + ox + (horiz ? -3.2 : 0);
        const d1y = atom.y + oy + (horiz ? 0 : -3.2);
        const d2x = atom.x + ox + (horiz ? 3.2 : 0);
        const d2y = atom.y + oy + (horiz ? 0 : 3.2);
        atomsSvg += `<circle cx="${d1x.toFixed(1)}" cy="${d1y.toFixed(1)}" r="2" fill="${color}" />`;
        atomsSvg += `<circle cx="${d2x.toFixed(1)}" cy="${d2y.toFixed(1)}" r="2" fill="${color}" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
  ${bondsSvg}
  ${atomsSvg}
</svg>`;
}
