/**
 * Strict SVG & Uploaded Image Sanitizer (Section VIII Security Safeguard).
 * Strips executable scripts, event handlers, foreignObject, and unsafe URI schemes
 * before rendering or persisting any untrusted SVG or HTML content.
 */

const FORBIDDEN_SVG_TAGS = [
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'applet',
  'link',
  'meta',
  'audio',
  'video',
  'canvas',
  'form',
  'input',
  'button',
  'textarea',
  'select',
];

const SAFE_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export function isSupportedImageFile(file: { type?: string; name?: string; size?: number }): {
  ok: boolean;
  kind: 'raster' | 'svg' | 'unknown';
  error?: string;
} {
  if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      kind: 'unknown',
      error: 'Kích thước ảnh vượt quá giới hạn 10 MB. Vui lòng chọn ảnh nhẹ hơn.',
    };
  }

  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
  const mime = (file.type || '').toLowerCase();

  if (mime === 'image/svg+xml' || ext === 'svg') {
    return { ok: true, kind: 'svg' };
  }
  if (
    SAFE_IMAGE_MIME_TYPES.has(mime) ||
    ['png', 'jpg', 'jpeg', 'webp'].includes(ext)
  ) {
    return { ok: true, kind: 'raster' };
  }
  return {
    ok: false,
    kind: 'unknown',
    error: 'Định dạng hình ảnh chưa hỗ trợ. Chỉ chấp nhận PNG, JPG, WebP và SVG.',
  };
}

function isUnsafeUriValue(val: string): boolean {
  const normalized = val.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  if (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:text/html') ||
    normalized.startsWith('data:image/svg') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('//')
  ) {
    return true;
  }
  return false;
}

/**
 * Sanitize untrusted SVG markup safely in both browser DOM and Node/Vitest environments.
 * Never executes scripts or loads external remote assets inside SVG.
 */
export function sanitizeSvgMarkup(rawSvg: string): string {
  if (!rawSvg || typeof rawSvg !== 'string') return '';

  // Remove XML processing instructions, DOCTYPE/ENTITY declarations (XXE prevention), and CDATA scripts
  let cleaned = rawSvg
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!ENTITY[\s\S]*?>/gi, '')
    .replace(/<\?xml-stylesheet[\s\S]*?\?>/gi, '');

  // Extract from first <svg to last </svg>
  const svgStart = cleaned.search(/<svg\b/i);
  const svgEnd = cleaned.search(/<\/svg\s*>/i);
  if (svgStart === -1 || svgEnd === -1) return '';
  cleaned = cleaned.slice(svgStart, svgEnd + cleaned.slice(svgEnd).indexOf('>') + 1);

  // Strip all forbidden elements (both paired and self-closing)
  for (const tag of FORBIDDEN_SVG_TAGS) {
    const paired = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
    const selfClosing = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    cleaned = cleaned.replace(paired, '').replace(selfClosing, '');
  }

  // Strip animate / set targeting href or on* attributes
  cleaned = cleaned.replace(/<(?:set|animate\w*)\b[^>]*attributeName\s*=\s*["']?(?:href|xlink:href|on\w+)["']?[^>]*\/?>/gi, '');

  // Strip all inline event handlers (onmouseover, onload, onerror, onclick, etc.)
  cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Strip unsafe href / xlink:href / src attributes
  cleaned = cleaned.replace(
    /\s+((?:xlink:)?href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (full, _attr, dVal, sVal, uVal) => {
      const val = dVal ?? sVal ?? uVal ?? '';
      if (isUnsafeUriValue(val)) return '';
      return full;
    }
  );

  // Strip CSS expressions / external url() inside style attributes and <style> tags
  cleaned = cleaned.replace(/expression\s*\([^)]*\)/gi, '');
  cleaned = cleaned.replace(/url\s*\(\s*["']?\s*(?:https?:|javascript:|data:text\/html)[^)]*\)/gi, 'none');
  cleaned = cleaned.replace(/@import\b[^;]*;?/gi, '');

  // Ensure xmlns="http://www.w3.org/2000/svg" is present for standalone rendering and Word embedding
  if (!/xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(cleaned)) {
    cleaned = cleaned.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return cleaned.trim();
}

/**
 * Parse intrinsic width/height ratio from an SVG string's viewBox or width/height attributes.
 */
export function getSvgDimensions(svgMarkup: string): { width: number; height: number } {
  const vbMatch = svgMarkup.match(/viewBox\s*=\s*["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*["']/i);
  if (vbMatch) {
    const w = Number(vbMatch[3]);
    const h = Number(vbMatch[4]);
    if (w > 0 && h > 0) return { width: w, height: h };
  }
  const wMatch = svgMarkup.match(/\bwidth\s*=\s*["']([\d.]+)/i);
  const hMatch = svgMarkup.match(/\bheight\s*=\s*["']([\d.]+)/i);
  const w = wMatch ? Number(wMatch[1]) : 560;
  const h = hMatch ? Number(hMatch[1]) : 360;
  return { width: w > 0 ? w : 560, height: h > 0 ? h : 360 };
}

/**
 * Convert a sanitized SVG markup string into a crisp high-DPI PNG data URL in the browser.
 * Returns null gracefully in non-browser (Node/Vitest) environments.
 */
export async function svgMarkupToPngDataUrl(
  svgMarkup: string,
  targetWidthOrScale = 1120
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;

  const clean = sanitizeSvgMarkup(svgMarkup);
  if (!clean) return null;

  const dims = getSvgDimensions(clean);
  const ratio = dims.height / Math.max(1, dims.width);
  const resolvedWidth =
    targetWidthOrScale > 0 && targetWidthOrScale <= 6
      ? dims.width * targetWidthOrScale
      : targetWidthOrScale;
  const outW = Math.max(120, Math.min(2200, Math.round(resolvedWidth)));
  const outH = Math.max(80, Math.min(2200, Math.round(outW * ratio)));

  // Guarantee explicit pixel width/height attributes on root <svg> so browsers rasterize crisply
  let prepared = clean;
  if (!/\bwidth\s*=/.test(prepared.slice(0, 260))) {
    prepared = prepared.replace(/<svg\b/i, `<svg width="${outW}" height="${outH}"`);
  }

  const blob = new Blob([prepared], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = outW;
          canvas.height = outH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, outW, outH);
          ctx.drawImage(img, 0, 0, outW, outH);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Read a raster File/Blob into a PNG/JPEG data URL and return its natural dimensions.
 */
export async function readRasterImageFile(file: Blob): Promise<{
  dataUrl: string;
  width: number;
  height: number;
}> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc dữ liệu ảnh'));
    reader.readAsDataURL(file);
  });

  if (typeof Image === 'undefined') {
    return { dataUrl, width: 480, height: 320 };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        dataUrl,
        width: img.naturalWidth || 480,
        height: img.naturalHeight || 320,
      });
    img.onerror = () => resolve({ dataUrl, width: 480, height: 320 });
    img.src = dataUrl;
  });
}

/**
 * Apply optional crop & rotation to a raster data URL and return a clean PNG data URL
 * suitable for Word DOCX embedding or download.
 */
export async function renderCroppedRasterPng(
  dataUrl: string,
  crop: { top: number; right: number; bottom: number; left: number },
  rotationDeg: number
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return { dataUrl, width: 480, height: 320 };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const natW = img.naturalWidth || 480;
      const natH = img.naturalHeight || 320;
      const sx = Math.round((Math.max(0, Math.min(45, crop.left)) / 100) * natW);
      const sy = Math.round((Math.max(0, Math.min(45, crop.top)) / 100) * natH);
      const sw = Math.max(
        16,
        natW - sx - Math.round((Math.max(0, Math.min(45, crop.right)) / 100) * natW)
      );
      const sh = Math.max(
        16,
        natH - sy - Math.round((Math.max(0, Math.min(45, crop.bottom)) / 100) * natH)
      );

      const rad = ((((rotationDeg % 360) + 360) % 360) * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const outW = Math.max(16, Math.round(sw * cos + sh * sin));
      const outH = Math.max(16, Math.round(sw * sin + sh * cos));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl, width: sw, height: sh });
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outW, outH);
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
      resolve({ dataUrl: canvas.toDataURL('image/png'), width: outW, height: outH });
    };
    img.onerror = () => resolve({ dataUrl, width: 480, height: 320 });
    img.src = dataUrl;
  });
}
