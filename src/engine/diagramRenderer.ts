import {
  ChemSymbolVariant,
  DiagramElement,
  DiagramScene,
  PhysicsSymbolVariant,
  StrokeStyle,
} from './figureTypes';
import { renderLatexToSvg } from './mathjaxRenderer';

/**
 * Pure structured 2D vector diagram renderer for Math, Physics, and Chemistry.
 * Produces clean, self-contained standalone SVG markup (no external fonts, no scripts).
 */

export function createDefaultDiagramScene(): DiagramScene {
  return {
    width: 640,
    height: 420,
    showGrid: true,
    gridSize: 20,
    snapToGrid: true,
    snapToPoint: true,
    snapToLine: true,
    background: '#ffffff',
    elements: [],
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function strokeDashArray(style: StrokeStyle): string {
  if (style === 'dashed') return '7 5';
  if (style === 'dotted') return '2.2 4.2';
  return '';
}

function renderLabelText(el: DiagramElement, cx: number, cy: number): string {
  if (!el.label || !el.label.trim()) return '';
  const lx = cx + (el.labelOffsetX ?? 0);
  const ly = cy + (el.labelOffsetY ?? -12);
  const fontSize = el.fontSize ?? 15;
  return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-family="Cambria, 'Times New Roman', serif" font-size="${fontSize}" font-weight="600" fill="${escapeXml(el.stroke || '#0f172a')}" text-anchor="middle" dominant-baseline="central">${escapeXml(el.label)}</text>`;
}

function renderInlineLatexGroup(latex: string, x: number, y: number, fontSize = 16, color = '#0f172a'): string {
  const rendered = renderLatexToSvg(latex, false);
  if (!rendered.ok || !rendered.svg) {
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Cambria, 'Times New Roman', serif" font-size="${fontSize}" fill="${escapeXml(color)}">${escapeXml(latex)}</text>`;
  }
  const vbMatch = rendered.svg.match(/viewBox="([^"]+)"/i);
  const innerMatch = rendered.svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  if (!vbMatch || !innerMatch) {
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Cambria, 'Times New Roman', serif" font-size="${fontSize}" fill="${escapeXml(color)}">${escapeXml(latex)}</text>`;
  }
  const [vx, vy, vw, vh] = vbMatch[1].split(/\s+/).map(Number);
  // MathJax uses ~1000 units per em
  const scale = fontSize / 980;
  const tx = x - (vw * scale) / 2 - vx * scale;
  const ty = y - (vh * scale) / 2 - vy * scale;
  return `<g transform="translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) scale(${scale.toFixed(5)})" fill="${escapeXml(color)}" stroke="${escapeXml(color)}" color="${escapeXml(color)}">${innerMatch[1]}</g>`;
}

// ============================================================================
// PHYSICS IEC / GDPT SYMBOLS (22 variants, centered at local 0,0, default 80x50)
// ============================================================================
function renderPhysicsSymbol(variant: PhysicsSymbolVariant, el: DiagramElement): string {
  const s = escapeXml(el.stroke || '#0f172a');
  const f = escapeXml(el.fill && el.fill !== 'none' ? el.fill : '#ffffff');
  const sw = el.strokeWidth || 2;
  const w = el.width ?? 80;
  const h = el.height ?? 44;
  const hw = w / 2;
  const hh = h / 2;

  switch (variant) {
    case 'resistor':
      return `
        <line x1="${-hw}" y1="0" x2="${-hw * 0.55}" y2="0" stroke="${s}" stroke-width="${sw}" />
        <rect x="${-hw * 0.55}" y="${-hh * 0.45}" width="${w * 0.55}" height="${h * 0.45}" fill="${f}" stroke="${s}" stroke-width="${sw}" />
        <line x1="${hw * 0.55}" y1="0" x2="${hw}" y2="0" stroke="${s}" stroke-width="${sw}" />`;

    case 'variable_resistor':
      return `
        <line x1="${-hw}" y1="0" x2="${-hw * 0.55}" y2="0" stroke="${s}" stroke-width="${sw}" />
        <rect x="${-hw * 0.55}" y="${-hh * 0.42}" width="${w * 0.55}" height="${h * 0.42}" fill="${f}" stroke="${s}" stroke-width="${sw}" />
        <line x1="${hw * 0.55}" y1="0" x2="${hw}" y2="0" stroke="${s}" stroke-width="${sw}" />
        <line x1="${-hw * 0.4}" y1="${hh * 0.72}" x2="${hw * 0.45}" y2="${-hh * 0.72}" stroke="${s}" stroke-width="${sw}" marker-end="url(#mf-arrow)" />`;

    case 'battery':
      return `
        <line x1="${-hw}" y1="0" x2="-7" y2="0" stroke="${s}" stroke-width="${sw}" />
        <line x1="-7" y1="${-hh * 0.85}" x2="-7" y2="${hh * 0.85}" stroke="${s}" stroke-width="${sw}" />
        <line x1="7" y1="${-hh * 0.45}" x2="7" y2="${hh * 0.45}" stroke="${s}" stroke-width="${sw + 1.5}" />
        <line x1="7" y1="0" x2="${hw}" y2="0" stroke="${s}" stroke-width="${sw}" />
        <text x="-17" y="${-hh * 0.4}" font-size="13" font-weight="700" fill="${s}" text-anchor="middle">+</text>
        <text x="17" y="${-hh * 0.4}" font-size="14" font-weight="700" fill="${s}" text-anchor="middle">−</text>`;

    case 'lamp': {
      const r = Math.min(hw * 0.45, hh * 0.85);
      const d = r * 0.7;
      return `
        <line x1="${-hw}" y1="0" x2="${-r}" y2="0" stroke="${s}" stroke-width="${sw}" />
        <circle cx="0" cy="0" r="${r}" fill="${f}" stroke="${s}" stroke-width="${sw}" />
        <line x1="${-d}" y1="${-d}" x2="${d}" y2="${d}" stroke="${s}" stroke-width="${sw}" />
        <line x1="${-d}" y1="${d}" x2="${d}" y2="${-d}" stroke="${s}" stroke-width="${sw}" />
        <line x1="${r}" y1="0" x2="${hw}" y2="0" stroke="${s}" stroke-width="${sw}" />`;
    }

    case 'switch_open':
      return `
        <line x1="${-hw}" y1="0" x2="-16" y2="0" stroke="${s}" stroke-width="${sw}" />
        <circle cx="-16" cy="0" r="3" fill="${f}" stroke="${s}" stroke-width="${sw}" />
        <line x1="-14" y1="-2" x2="14" y2="-16" stroke="${s}" stroke-width="${sw}" />
        <circle cx="16" cy="0" r="3" fill="${f}" stroke="${s}" stroke-width="${sw}" />
        <line x1="16" y1="0" x2="${hw}" y2="0" stroke="${s}" stroke-width="${sw}" />`;

    case 'switch_closed':
      return `
        <line x1="${-hw}" y1="0" x2="-16" y2="0" stroke="${s}" stroke-width="${sw}" />
        <circle cx="-16" cy="0" r="3" fill="${s}" stroke="${s}" stroke-width="${sw}" />
        <line x1="-16" y1="0" x2="16" y2="0" stroke="${s}" stroke-width="${sw + 0.4}" />
        <circle cx="16" cy="0" r="3" fill="${s}" stroke="${s}" stroke-width="${sw}" />
        <line x1="16" y1="0" x2="${hw}" y2="0" stroke="${s}" stroke-width="${sw}" />`;

    case 'ammeter':
    case 'voltmeter': {
      const r = Math.min(hw * 0.46, hh * 0.85);
      const letter = variant === 'ammeter' ? 'A' : 'V';
      return `
        <line x1="${-hw}" y1="0" x2="${-r}" y2="0" stroke="${s}" stroke-width="${sw}" />
        <circle cx="0" cy="0" r="${r}" fill="${f}" stroke="${s}" stroke-width="${sw}" />
        <text x="0" y="1" font-family="Cambria, serif" font-size="${Math.round(r * 1.1)}" font-weight="700" fill="${s}" text-anchor="middle" dominant-baseline="central">${letter}</text>
        <line x1="${r}" y1="0" x2="${hw}" y2="0" stroke="${s}" stroke-width="${sw}" />`;
    }

    case 'capacitor':
      return `
        <line x1="${-hw}" y1="0" x2="-5" y2="0" stroke="${s}" stroke-width="${sw}" />
        <line x1="-5" y1="${-hh * 0.75}" x2="-5" y2="${hh * 0.75}" stroke="${s}" stroke-width="${sw + 0.5}" />
        <line x1="5" y1="${-hh * 0.75}" x2="5" y2="${hh * 0.75}" stroke="${s}" stroke-width="${sw + 0.5}" />
        <line x1="5" y1="0" x2="${hw}" y2="0" stroke="${s}" stroke-width="${sw}" />`;

    case 'inductor':
      return `
        <line x1="${-hw}" y1="0" x2="-24" y2="0" stroke="${s}" stroke-width="${sw}" />
        <path d="M -24 0 A 6 9 0 0 1 -12 0 A 6 9 0 0 1 0 0 A 6 9 0 0 1 12 0 A 6 9 0 0 1 24 0" fill="none" stroke="${s}" stroke-width="${sw}" />
        <line x1="24" y1="0" x2="${hw}" y2="0" stroke="${s}" stroke-width="${sw}" />`;

    case 'junction':
      return `<circle cx="0" cy="0" r="4.5" fill="${s}" stroke="${s}" stroke-width="1" />`;

    case 'pulley': {
      const r = Math.min(hw * 0.45, hh * 0.7);
      return `
        <line x1="0" y1="${-hh}" x2="0" y2="0" stroke="${s}" stroke-width="${sw}" />
        <line x1="${-r * 0.9}" y1="${-hh}" x2="${r * 0.9}" y2="${-hh}" stroke="${s}" stroke-width="${sw + 1}" />
        <circle cx="0" cy="0" r="${r}" fill="${f}" stroke="${s}" stroke-width="${sw}" />
        <circle cx="0" cy="0" r="3" fill="${s}" />
        <line x1="${-r}" y1="0" x2="${-r}" y2="${hh}" stroke="${s}" stroke-width="${sw * 0.85}" />
        <line x1="${r}" y1="0" x2="${r}" y2="${hh}" stroke="${s}" stroke-width="${sw * 0.85}" />`;
    }

    case 'spring': {
      const coils = 6;
      const startX = -hw + 10;
      const endX = hw - 10;
      const step = (endX - startX) / coils;
      let d = `M ${-hw} 0 L ${startX} 0`;
      for (let i = 0; i < coils; i++) {
        const x1 = startX + i * step + step * 0.25;
        const x2 = startX + i * step + step * 0.75;
        d += ` L ${x1.toFixed(1)} ${(-hh * 0.48).toFixed(1)} L ${x2.toFixed(1)} ${(hh * 0.48).toFixed(1)}`;
      }
      d += ` L ${endX} 0 L ${hw} 0`;
      return `<path d="${d}" fill="none" stroke="${s}" stroke-width="${sw}" stroke-linejoin="round" />`;
    }

    case 'pendulum_bob':
      return `
        <line x1="-22" y1="${-hh}" x2="22" y2="${-hh}" stroke="${s}" stroke-width="${sw + 1}" />
        <line x1="0" y1="${-hh}" x2="0" y2="${hh - 12}" stroke="${s}" stroke-width="${sw * 0.85}" />
        <circle cx="0" cy="${hh - 10}" r="11" fill="${f === '#ffffff' ? '#cbd5e1' : f}" stroke="${s}" stroke-width="${sw}" />`;

    case 'block':
      return `
        <rect x="${-hw * 0.65}" y="${-hh * 0.6}" width="${w * 0.65}" height="${h * 0.6}" fill="${f === '#ffffff' ? '#e2e8f0' : f}" stroke="${s}" stroke-width="${sw}" rx="2" />
        <text x="0" y="1" font-family="Cambria, serif" font-size="14" font-style="italic" font-weight="600" fill="${s}" text-anchor="middle" dominant-baseline="central">m</text>`;

    case 'inclined_plane':
      return `
        <polygon points="${-hw},${hh} ${hw},${hh} ${hw},${-hh}" fill="${f === '#ffffff' ? '#f1f5f9' : f}" stroke="${s}" stroke-width="${sw}" stroke-linejoin="round" />
        <path d="M ${-hw + 22} ${hh} A 22 22 0 0 0 ${-hw + 17} ${hh - 13}" fill="none" stroke="${s}" stroke-width="1.4" />`;

    case 'lever':
      return `
        <line x1="${-hw}" y1="0" x2="${hw}" y2="0" stroke="${s}" stroke-width="${sw + 1}" />
        <polygon points="0,2 -12,${hh} 12,${hh}" fill="${f === '#ffffff' ? '#e2e8f0' : f}" stroke="${s}" stroke-width="${sw}" stroke-linejoin="round" />`;

    case 'convex_lens':
      return `
        <line x1="0" y1="${-hh}" x2="0" y2="${hh}" stroke="${s}" stroke-width="${sw}" />
        <polyline points="-7,${-hh + 9} 0,${-hh} 7,${-hh + 9}" fill="none" stroke="${s}" stroke-width="${sw}" />
        <polyline points="-7,${hh - 9} 0,${hh} 7,${hh - 9}" fill="none" stroke="${s}" stroke-width="${sw}" />`;

    case 'concave_lens':
      return `
        <line x1="0" y1="${-hh}" x2="0" y2="${hh}" stroke="${s}" stroke-width="${sw}" />
        <polyline points="-7,${-hh} 0,${-hh + 9} 7,${-hh}" fill="none" stroke="${s}" stroke-width="${sw}" />
        <polyline points="-7,${hh} 0,${hh - 9} 7,${hh}" fill="none" stroke="${s}" stroke-width="${sw}" />`;

    case 'flat_mirror': {
      let hatches = '';
      for (let y = -hh + 4; y <= hh - 4; y += 8) {
        hatches += `<line x1="0" y1="${y}" x2="8" y2="${y + 6}" stroke="${s}" stroke-width="1.3" />`;
      }
      return `<line x1="0" y1="${-hh}" x2="0" y2="${hh}" stroke="${s}" stroke-width="${sw + 0.6}" />${hatches}`;
    }

    case 'magnet':
      return `
        <rect x="${-hw * 0.75}" y="${-hh * 0.45}" width="${hw * 0.75}" height="${h * 0.45}" fill="#fee2e2" stroke="${s}" stroke-width="${sw}" />
        <rect x="0" y="${-hh * 0.45}" width="${hw * 0.75}" height="${h * 0.45}" fill="#dbeafe" stroke="${s}" stroke-width="${sw}" />
        <text x="${-hw * 0.38}" y="1" font-size="13" font-weight="700" fill="#b91c1c" text-anchor="middle" dominant-baseline="central">N</text>
        <text x="${hw * 0.38}" y="1" font-size="13" font-weight="700" fill="#1d4ed8" text-anchor="middle" dominant-baseline="central">S</text>`;

    case 'piston_cylinder':
      return `
        <path d="M ${-hw * 0.65} ${-hh} L ${-hw * 0.65} ${hh} L ${hw * 0.65} ${hh} L ${hw * 0.65} ${-hh}" fill="none" stroke="${s}" stroke-width="${sw + 0.5}" />
        <rect x="${-hw * 0.62}" y="${-hh * 0.25}" width="${w * 0.62}" height="10" fill="#cbd5e1" stroke="${s}" stroke-width="${sw}" />
        <line x1="0" y1="${-hh * 0.25}" x2="0" y2="${-hh - 12}" stroke="${s}" stroke-width="${sw + 0.5}" />
        <line x1="-14" y1="${-hh - 12}" x2="14" y2="${-hh - 12}" stroke="${s}" stroke-width="${sw + 0.5}" />`;
  }
}

// ============================================================================
// CHEMISTRY LABWARE SYMBOLS (18 variants, centered at local 0,0)
// ============================================================================
function renderChemSymbol(variant: ChemSymbolVariant, el: DiagramElement): string {
  const s = escapeXml(el.stroke || '#0f172a');
  const f = escapeXml(el.fill && el.fill !== 'none' ? el.fill : '#e0f2fe');
  const sw = el.strokeWidth || 2;
  const w = el.width ?? 64;
  const h = el.height ?? 90;
  const hw = w / 2;
  const hh = h / 2;

  switch (variant) {
    case 'test_tube':
      return `
        <path d="M -9 ${-hh + 6} L -9 ${hh - 10} A 9 9 0 0 0 9 ${hh - 10} L 9 ${-hh + 6}" fill="none" stroke="${s}" stroke-width="${sw}" />
        <path d="M -8 4 L -8 ${hh - 10} A 8 8 0 0 0 8 ${hh - 10} L 8 4 Z" fill="${f}" opacity="0.7" />
        <line x1="-12" y1="${-hh + 6}" x2="12" y2="${-hh + 6}" stroke="${s}" stroke-width="${sw}" />`;

    case 'test_tube_rack':
      return `
        <rect x="${-hw}" y="${hh - 8}" width="${w}" height="8" fill="#e2e8f0" stroke="${s}" stroke-width="${sw}" />
        <rect x="${-hw}" y="${-hh * 0.35}" width="${w}" height="6" fill="#e2e8f0" stroke="${s}" stroke-width="${sw}" />
        <line x1="${-hw + 6}" y1="${-hh * 0.35}" x2="${-hw + 6}" y2="${hh - 8}" stroke="${s}" stroke-width="${sw}" />
        <line x1="${hw - 6}" y1="${-hh * 0.35}" x2="${hw - 6}" y2="${hh - 8}" stroke="${s}" stroke-width="${sw}" />`;

    case 'test_tube_clamp':
      return `
        <line x1="${-hw}" y1="0" x2="6" y2="0" stroke="${s}" stroke-width="${sw + 0.5}" />
        <path d="M 6 -9 C 18 -14, 22 -4, 16 0 C 22 4, 18 14, 6 9" fill="none" stroke="${s}" stroke-width="${sw}" />
        <circle cx="-10" cy="0" r="3.5" fill="${s}" />`;

    case 'beaker':
      return `
        <path d="M ${-hw * 0.72} ${-hh * 0.7} L ${-hw * 0.72} ${hh * 0.78} Q ${-hw * 0.72} ${hh * 0.88} ${-hw * 0.58} ${hh * 0.88} L ${hw * 0.58} ${hh * 0.88} Q ${hw * 0.72} ${hh * 0.88} ${hw * 0.72} ${hh * 0.78} L ${hw * 0.72} ${-hh * 0.7}" fill="none" stroke="${s}" stroke-width="${sw}" />
        <rect x="${-hw * 0.68}" y="${hh * 0.15}" width="${w * 0.68}" height="${hh * 0.7}" fill="${f}" opacity="0.65" />
        <path d="M ${-hw * 0.84} ${-hh * 0.76} L ${-hw * 0.72} ${-hh * 0.7}" stroke="${s}" stroke-width="${sw}" />
        <line x1="${-hw * 0.35}" y1="-8" x2="${-hw * 0.68}" y2="-8" stroke="${s}" stroke-width="1.2" />
        <line x1="${-hw * 0.35}" y1="8" x2="${-hw * 0.68}" y2="8" stroke="${s}" stroke-width="1.2" />`;

    case 'erlenmeyer':
      return `
        <path d="M -8 ${-hh * 0.85} L -8 ${-hh * 0.3} L ${-hw * 0.78} ${hh * 0.78} Q ${-hw * 0.8} ${hh * 0.88} ${-hw * 0.66} ${hh * 0.88} L ${hw * 0.66} ${hh * 0.88} Q ${hw * 0.8} ${hh * 0.88} ${hw * 0.78} ${hh * 0.78} L 8 ${-hh * 0.3} L 8 ${-hh * 0.85}" fill="none" stroke="${s}" stroke-width="${sw}" />
        <polygon points="${-hw * 0.45},${hh * 0.25} ${hw * 0.45},${hh * 0.25} ${hw * 0.74},${hh * 0.84} ${-hw * 0.74},${hh * 0.84}" fill="${f}" opacity="0.65" />
        <line x1="-11" y1="${-hh * 0.85}" x2="11" y2="${-hh * 0.85}" stroke="${s}" stroke-width="${sw}" />`;

    case 'round_flask': {
      const r = Math.min(hw * 0.72, hh * 0.48);
      return `
        <circle cx="0" cy="${hh * 0.3}" r="${r}" fill="none" stroke="${s}" stroke-width="${sw}" />
        <path d="M ${-r * 0.88} ${hh * 0.38} A ${r} ${r} 0 0 0 ${r * 0.88} ${hh * 0.38} Z" fill="${f}" opacity="0.65" />
        <line x1="-7" y1="${-hh * 0.88}" x2="-7" y2="${hh * 0.3 - r + 2}" stroke="${s}" stroke-width="${sw}" />
        <line x1="7" y1="${-hh * 0.88}" x2="7" y2="${hh * 0.3 - r + 2}" stroke="${s}" stroke-width="${sw}" />
        <line x1="-10" y1="${-hh * 0.88}" x2="10" y2="${-hh * 0.88}" stroke="${s}" stroke-width="${sw}" />`;
    }

    case 'volumetric_flask':
      return `
        <path d="M -5 ${-hh * 0.9} L -5 ${-hh * 0.05} L ${-hw * 0.62} ${hh * 0.78} Q ${-hw * 0.62} ${hh * 0.9} ${-hw * 0.45} ${hh * 0.9} L ${hw * 0.45} ${hh * 0.9} Q ${hw * 0.62} ${hh * 0.9} ${hw * 0.62} ${hh * 0.78} L 5 ${-hh * 0.05} L 5 ${-hh * 0.9}" fill="none" stroke="${s}" stroke-width="${sw}" />
        <line x1="-9" y1="${-hh * 0.45}" x2="9" y2="${-hh * 0.45}" stroke="${s}" stroke-width="1.5" />
        <line x1="-8" y1="${-hh * 0.9}" x2="8" y2="${-hh * 0.9}" stroke="${s}" stroke-width="${sw}" />`;

    case 'graduated_cylinder':
      return `
        <rect x="-10" y="${-hh * 0.88}" width="20" height="${h * 0.8}" fill="none" stroke="${s}" stroke-width="${sw}" />
        <rect x="-9" y="4" width="18" height="${hh * 0.68}" fill="${f}" opacity="0.65" />
        <line x1="-20" y1="${hh * 0.76}" x2="20" y2="${hh * 0.76}" stroke="${s}" stroke-width="${sw + 1}" />
        <line x1="-10" y1="-22" x2="-2" y2="-22" stroke="${s}" stroke-width="1.2" />
        <line x1="-10" y1="-8" x2="-2" y2="-8" stroke="${s}" stroke-width="1.2" />
        <line x1="-10" y1="6" x2="-2" y2="6" stroke="${s}" stroke-width="1.2" />
        <line x1="-10" y1="20" x2="-2" y2="20" stroke="${s}" stroke-width="1.2" />`;

    case 'pipette':
      return `
        <line x1="0" y1="${-hh * 0.92}" x2="0" y2="${-12}" stroke="${s}" stroke-width="${sw}" />
        <ellipse cx="0" cy="0" rx="6" ry="13" fill="${f}" stroke="${s}" stroke-width="${sw}" />
        <line x1="0" y1="13" x2="0" y2="${hh * 0.85}" stroke="${s}" stroke-width="${sw}" />
        <line x1="-2" y1="${hh * 0.85}" x2="0" y2="${hh * 0.95}" stroke="${s}" stroke-width="${sw}" />`;

    case 'burette':
      return `
        <rect x="-6" y="${-hh * 0.9}" width="12" height="${h * 0.72}" fill="none" stroke="${s}" stroke-width="${sw}" />
        <rect x="-5" y="-10" width="10" height="${hh * 0.74}" fill="${f}" opacity="0.65" />
        <line x1="-13" y1="${hh * 0.62}" x2="13" y2="${hh * 0.62}" stroke="${s}" stroke-width="${sw + 0.6}" />
        <path d="M -3 ${hh * 0.54} L 0 ${hh * 0.92} L 3 ${hh * 0.54}" fill="none" stroke="${s}" stroke-width="${sw}" />`;

    case 'funnel':
      return `
        <polygon points="${-hw * 0.75},${-hh * 0.55} ${hw * 0.75},${-hh * 0.55} 4,4 -4,4" fill="none" stroke="${s}" stroke-width="${sw}" stroke-linejoin="round" />
        <line x1="-4" y1="4" x2="-4" y2="${hh * 0.82}" stroke="${s}" stroke-width="${sw}" />
        <line x1="4" y1="4" x2="4" y2="${hh * 0.72}" stroke="${s}" stroke-width="${sw}" />
        <line x1="-4" y1="${hh * 0.82}" x2="4" y2="${hh * 0.72}" stroke="${s}" stroke-width="${sw}" />`;

    case 'separatory_funnel':
      return `
        <path d="M -7 ${-hh * 0.85} L -7 ${-hh * 0.62} C -22 ${-hh * 0.45}, -20 6, -4 20 L -4 ${hh * 0.82} L 4 ${hh * 0.74} L 4 20 C 20 6, 22 ${-hh * 0.45}, 7 ${-hh * 0.62} L 7 ${-hh * 0.85} Z" fill="none" stroke="${s}" stroke-width="${sw}" />
        <line x1="-12" y1="${hh * 0.48}" x2="12" y2="${hh * 0.48}" stroke="${s}" stroke-width="${sw + 0.6}" />
        <line x1="-10" y1="${-hh * 0.85}" x2="10" y2="${-hh * 0.85}" stroke="${s}" stroke-width="${sw}" />`;

    case 'alcohol_lamp':
      return `
        <path d="M -18 ${hh * 0.85} L -14 ${hh * 0.1} L 14 ${hh * 0.1} L 18 ${hh * 0.85} Z" fill="#fef3c7" stroke="${s}" stroke-width="${sw}" />
        <rect x="-7" y="${-hh * 0.05}" width="14" height="8" fill="#cbd5e1" stroke="${s}" stroke-width="${sw}" />
        <line x1="0" y1="${-hh * 0.05}" x2="0" y2="${-hh * 0.28}" stroke="${s}" stroke-width="${sw}" />
        <path d="M 0 ${-hh * 0.78} C 9 ${-hh * 0.52}, 8 ${-hh * 0.25}, 0 ${-hh * 0.25} C -8 ${-hh * 0.25}, -9 ${-hh * 0.52}, 0 ${-hh * 0.78} Z" fill="#fb923c" stroke="#ea580c" stroke-width="1.5" />`;

    case 'retort_stand':
      return `
        <line x1="${-hw * 0.65}" y1="${hh * 0.9}" x2="${hw * 0.65}" y2="${hh * 0.9}" stroke="${s}" stroke-width="${sw + 2}" />
        <line x1="${-hw * 0.35}" y1="${hh * 0.9}" x2="${-hw * 0.35}" y2="${-hh * 0.9}" stroke="${s}" stroke-width="${sw + 0.6}" />
        <line x1="${-hw * 0.35}" y1="${-hh * 0.25}" x2="${hw * 0.3}" y2="${-hh * 0.25}" stroke="${s}" stroke-width="${sw}" />
        <circle cx="${-hw * 0.35}" cy="${-hh * 0.25}" r="3.5" fill="${s}" />`;

    case 'delivery_tube':
      return `<path d="M ${-hw * 0.8} ${hh * 0.4} L ${-hw * 0.8} ${-hh * 0.55} Q ${-hw * 0.8} ${-hh * 0.75} ${-hw * 0.55} ${-hh * 0.75} L ${hw * 0.55} ${-hh * 0.75} Q ${hw * 0.8} ${-hh * 0.75} ${hw * 0.8} ${-hh * 0.55} L ${hw * 0.8} ${hh * 0.45}" fill="none" stroke="${s}" stroke-width="${sw + 0.4}" />`;

    case 'water_trough':
      return `
        <path d="M ${-hw * 0.9} ${-hh * 0.45} L ${-hw * 0.9} ${hh * 0.6} L ${hw * 0.9} ${hh * 0.6} L ${hw * 0.9} ${-hh * 0.45}" fill="none" stroke="${s}" stroke-width="${sw + 0.5}" />
        <rect x="${-hw * 0.86}" y="${-hh * 0.1}" width="${w * 0.86}" height="${hh * 0.66}" fill="${f}" opacity="0.65" />`;

    case 'thermometer':
      return `
        <rect x="-3.5" y="${-hh * 0.9}" width="7" height="${h * 0.78}" rx="3.5" fill="#ffffff" stroke="${s}" stroke-width="${sw * 0.85}" />
        <circle cx="0" cy="${hh * 0.78}" r="7" fill="#ef4444" stroke="${s}" stroke-width="${sw * 0.85}" />
        <line x1="0" y1="${hh * 0.72}" x2="0" y2="${-hh * 0.35}" stroke="#ef4444" stroke-width="2.5" />`;

    case 'condenser':
      return `
        <line x1="${-hw * 0.95}" y1="0" x2="${hw * 0.95}" y2="0" stroke="${s}" stroke-width="${sw}" />
        <rect x="${-hw * 0.65}" y="-11" width="${w * 0.65}" height="22" rx="4" fill="${f}" fill-opacity="0.35" stroke="${s}" stroke-width="${sw}" />
        <line x1="${-hw * 0.45}" y1="11" x2="${-hw * 0.45}" y2="23" stroke="${s}" stroke-width="${sw}" />
        <line x1="${hw * 0.45}" y1="-11" x2="${hw * 0.45}" y2="-23" stroke="${s}" stroke-width="${sw}" />`;
  }
}

// ============================================================================
// MAIN ELEMENT & SCENE RENDERER
// ============================================================================
function renderElement(el: DiagramElement, scene: DiagramScene): string {
  const s = escapeXml(el.stroke || '#0f172a');
  const f = escapeXml(el.fill || 'none');
  const sw = el.strokeWidth ?? 2;
  const dash = strokeDashArray(el.strokeStyle || 'solid');
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
  const opacityAttr = el.opacity !== undefined && el.opacity < 1 ? ` opacity="${el.opacity}"` : '';
  const rot = el.rotation ?? 0;

  let body = '';
  let labelCx = el.x;
  let labelCy = el.y;

  switch (el.type) {
    case 'point': {
      const r = el.radius ?? 4;
      body = `<circle cx="${el.x}" cy="${el.y}" r="${r}" fill="${s}" stroke="${s}" stroke-width="1" />`;
      break;
    }

    case 'segment': {
      const x2 = el.x2 ?? el.x + 120;
      const y2 = el.y2 ?? el.y;
      labelCx = (el.x + x2) / 2;
      labelCy = (el.y + y2) / 2;
      body = `<line x1="${el.x}" y1="${el.y}" x2="${x2}" y2="${y2}" stroke="${s}" stroke-width="${sw}"${dashAttr} stroke-linecap="round" />`;
      if (el.tickCount) {
        const dx = x2 - el.x;
        const dy = y2 - el.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * 6;
        const ny = (dx / len) * 6;
        const ux = (dx / len) * 5;
        const uy = (dy / len) * 5;
        const startOffset = -((el.tickCount - 1) / 2);
        for (let i = 0; i < el.tickCount; i++) {
          const mx = labelCx + (startOffset + i) * ux;
          const my = labelCy + (startOffset + i) * uy;
          body += `<line x1="${(mx - nx).toFixed(1)}" y1="${(my - ny).toFixed(1)}" x2="${(mx + nx).toFixed(1)}" y2="${(my + ny).toFixed(1)}" stroke="${s}" stroke-width="1.6" />`;
        }
      }
      break;
    }

    case 'line': {
      const x2 = el.x2 ?? el.x + 120;
      const y2 = el.y2 ?? el.y;
      const dx = x2 - el.x;
      const dy = y2 - el.y;
      const len = Math.hypot(dx, dy) || 1;
      const ext = Math.max(scene.width, scene.height);
      const ax = el.x - (dx / len) * ext;
      const ay = el.y - (dy / len) * ext;
      const bx = x2 + (dx / len) * ext;
      const by = y2 + (dy / len) * ext;
      labelCx = (el.x + x2) / 2;
      labelCy = (el.y + y2) / 2;
      body = `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${s}" stroke-width="${sw}"${dashAttr} />`;
      break;
    }

    case 'ray': {
      const x2 = el.x2 ?? el.x + 120;
      const y2 = el.y2 ?? el.y;
      const dx = x2 - el.x;
      const dy = y2 - el.y;
      const len = Math.hypot(dx, dy) || 1;
      const bx = el.x + (dx / len) * Math.max(len, 180);
      const by = el.y + (dy / len) * Math.max(len, 180);
      labelCx = (el.x + bx) / 2;
      labelCy = (el.y + by) / 2;
      body = `<circle cx="${el.x}" cy="${el.y}" r="3.2" fill="${s}" /><line x1="${el.x}" y1="${el.y}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${s}" stroke-width="${sw}"${dashAttr} marker-end="url(#mf-arrow)" />`;
      break;
    }

    case 'vector': {
      const x2 = el.x2 ?? el.x + 100;
      const y2 = el.y2 ?? el.y;
      labelCx = (el.x + x2) / 2;
      labelCy = (el.y + y2) / 2;
      body = `<line x1="${el.x}" y1="${el.y}" x2="${x2}" y2="${y2}" stroke="${s}" stroke-width="${sw}"${dashAttr} marker-end="url(#mf-arrow)" stroke-linecap="round" />`;
      break;
    }

    case 'rect': {
      const w = el.width ?? 120;
      const h = el.height ?? 76;
      labelCx = el.x + w / 2;
      labelCy = el.y + h / 2;
      const transform = rot ? ` transform="rotate(${rot} ${labelCx} ${labelCy})"` : '';
      body = `<rect x="${el.x}" y="${el.y}" width="${w}" height="${h}" fill="${f}" stroke="${s}" stroke-width="${sw}"${dashAttr}${transform} />`;
      break;
    }

    case 'polygon': {
      const pts = el.points && el.points.length >= 3
        ? el.points
        : [
            { x: 0, y: -55 },
            { x: -65, y: 45 },
            { x: 65, y: 45 },
          ];
      const absPts = pts.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
      labelCx = absPts.reduce((acc, p) => acc + p.x, 0) / absPts.length;
      labelCy = absPts.reduce((acc, p) => acc + p.y, 0) / absPts.length;
      const str = absPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      const transform = rot ? ` transform="rotate(${rot} ${labelCx} ${labelCy})"` : '';
      body = `<polygon points="${str}" fill="${f}" stroke="${s}" stroke-width="${sw}"${dashAttr} stroke-linejoin="round"${transform} />`;
      break;
    }

    case 'circle': {
      const r = el.radius ?? 55;
      body = `<circle cx="${el.x}" cy="${el.y}" r="${r}" fill="${f}" stroke="${s}" stroke-width="${sw}"${dashAttr} />`;
      break;
    }

    case 'ellipse': {
      const rx = (el.width ?? 120) / 2;
      const ry = (el.height ?? 70) / 2;
      const transform = rot ? ` transform="rotate(${rot} ${el.x} ${el.y})"` : '';
      body = `<ellipse cx="${el.x}" cy="${el.y}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${s}" stroke-width="${sw}"${dashAttr}${transform} />`;
      break;
    }

    case 'arc':
    case 'angle_mark': {
      const r = el.radius ?? (el.type === 'angle_mark' ? 24 : 50);
      const a1 = ((el.startAngleDeg ?? 0) * Math.PI) / 180;
      const a2 = ((el.endAngleDeg ?? 60) * Math.PI) / 180;
      const sx = el.x + r * Math.cos(a1);
      const sy = el.y - r * Math.sin(a1);
      const ex = el.x + r * Math.cos(a2);
      const ey = el.y - r * Math.sin(a2);
      const largeArc = Math.abs((el.endAngleDeg ?? 60) - (el.startAngleDeg ?? 0)) > 180 ? 1 : 0;
      body = `<path d="M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${r} ${r} 0 ${largeArc} 0 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${s}" stroke-width="${sw}"${dashAttr} />`;
      if (el.type === 'angle_mark' && el.tickCount && el.tickCount >= 2) {
        const r2 = r + 4;
        const sx2 = el.x + r2 * Math.cos(a1);
        const sy2 = el.y - r2 * Math.sin(a1);
        const ex2 = el.x + r2 * Math.cos(a2);
        const ey2 = el.y - r2 * Math.sin(a2);
        body += `<path d="M ${sx2.toFixed(1)} ${sy2.toFixed(1)} A ${r2} ${r2} 0 ${largeArc} 0 ${ex2.toFixed(1)} ${ey2.toFixed(1)}" fill="none" stroke="${s}" stroke-width="${sw}" />`;
      }
      break;
    }

    case 'right_angle': {
      const sz = el.radius ?? 14;
      const transform = rot ? ` transform="rotate(${rot} ${el.x} ${el.y})"` : '';
      body = `<polyline points="${el.x + sz},${el.y} ${el.x + sz},${el.y - sz} ${el.x},${el.y - sz}" fill="none" stroke="${s}" stroke-width="${Math.max(1.5, sw * 0.85)}"${transform} />`;
      break;
    }

    case 'tick_mark': {
      const count = el.tickCount ?? 1;
      const transform = rot ? ` transform="rotate(${rot} ${el.x} ${el.y})"` : '';
      let lines = '';
      const start = -((count - 1) * 5) / 2;
      for (let i = 0; i < count; i++) {
        const dx = start + i * 5;
        lines += `<line x1="${el.x + dx}" y1="${el.y - 6}" x2="${el.x + dx}" y2="${el.y + 6}" stroke="${s}" stroke-width="${sw}" />`;
      }
      body = `<g${transform}>${lines}</g>`;
      break;
    }

    case 'curve': {
      const pts = el.points && el.points.length >= 3
        ? el.points
        : [
            { x: -60, y: 20 },
            { x: 0, y: -45 },
            { x: 60, y: 20 },
          ];
      if (pts.length === 3) {
        body = `<path d="M ${(el.x + pts[0].x).toFixed(1)} ${(el.y + pts[0].y).toFixed(1)} Q ${(el.x + pts[1].x).toFixed(1)} ${(el.y + pts[1].y).toFixed(1)} ${(el.x + pts[2].x).toFixed(1)} ${(el.y + pts[2].y).toFixed(1)}" fill="none" stroke="${s}" stroke-width="${sw}"${dashAttr} />`;
      } else {
        const d = pts
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${(el.x + p.x).toFixed(1)} ${(el.y + p.y).toFixed(1)}`)
          .join(' ');
        body = `<path d="${d}" fill="none" stroke="${s}" stroke-width="${sw}"${dashAttr} />`;
      }
      break;
    }

    case 'text': {
      const fontSize = el.fontSize ?? 16;
      const transform = rot ? ` transform="rotate(${rot} ${el.x} ${el.y})"` : '';
      body = `<text x="${el.x}" y="${el.y}" font-family="Cambria, 'Times New Roman', serif" font-size="${fontSize}" font-weight="600" fill="${s}" text-anchor="middle" dominant-baseline="central"${transform}>${escapeXml(el.label || 'Nhãn')}</text>`;
      return `<g data-element-id="${escapeXml(el.id)}"${opacityAttr}>${body}</g>`;
    }

    case 'formula': {
      const latex = el.formulaLatex || el.label || 'x';
      const fontSize = el.fontSize ?? 17;
      body = renderInlineLatexGroup(latex, el.x, el.y, fontSize, el.stroke || '#0f172a');
      return `<g data-element-id="${escapeXml(el.id)}"${opacityAttr}>${body}</g>`;
    }

    case 'symbol_physics': {
      const variant = (el.symbolVariant as PhysicsSymbolVariant) || 'resistor';
      const inner = renderPhysicsSymbol(variant, el);
      body = `<g transform="translate(${el.x.toFixed(1)}, ${el.y.toFixed(1)}) rotate(${rot})">${inner}</g>`;
      break;
    }

    case 'symbol_chem': {
      const variant = (el.symbolVariant as ChemSymbolVariant) || 'beaker';
      const inner = renderChemSymbol(variant, el);
      body = `<g transform="translate(${el.x.toFixed(1)}, ${el.y.toFixed(1)}) rotate(${rot})">${inner}</g>`;
      break;
    }
  }

  const labelMarkup = renderLabelText(el, labelCx, labelCy);
  return `<g data-element-id="${escapeXml(el.id)}"${opacityAttr}>${body}${labelMarkup}</g>`;
}

export function renderDiagramSceneToSvg(
  scene: DiagramScene,
  options?: { includeGrid?: boolean }
): string {
  const width = Math.max(160, Math.round(scene.width || 640));
  const height = Math.max(120, Math.round(scene.height || 420));
  const gridSize = Math.max(8, scene.gridSize || 20);
  const showGrid = options?.includeGrid ?? false;

  const sorted = [...scene.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const renderedElements = sorted.map((el) => renderElement(el, scene)).join('\n  ');

  const gridDef = showGrid
    ? `<pattern id="mf-grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
        <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="#e2e8f0" stroke-width="0.9" />
      </pattern>`
    : '';

  const gridRect = showGrid
    ? `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#mf-grid)" />`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <marker id="mf-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1.2 L 9.5 5 L 0 8.8 z" fill="context-stroke" />
    </marker>
    ${gridDef}
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="${escapeXml(scene.background || '#ffffff')}" />
  ${gridRect}
  ${renderedElements}
</svg>`;
}
