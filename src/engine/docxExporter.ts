import JSZip from 'jszip';
import {
  DocumentBlock,
  FigureSegment,
  FormulaSegment,
  InlineSegment,
  ParagraphBlock,
  ProcessedDocument,
  TableBlock,
} from './types';
import { FigureAsset } from './figureTypes';
import { escapeXml, mathmlToOmml } from './mathmlConverter';
import { renderLatexToSvg } from './mathjaxRenderer';
import { sanitizeSvgMarkup } from './svgSanitizer';
import {
  DEFAULT_EXAM_STYLE,
  ExamHeaderConfig,
  ExamStyleSettings,
  hasAnyHeaderContent,
} from './examTools';

export interface DocxExportOptions {
  style?: ExamStyleSettings;
  header?: ExamHeaderConfig;
  figures?: Map<string, FigureAsset>;
}

interface EmbeddedMediaEntry {
  relId: string;
  target: string; // relative to word/ e.g. "media/image1.png"
  data: Uint8Array;
  ext: 'png' | 'svg';
}

interface DocxBuildContext {
  style: ExamStyleSettings;
  figures?: Map<string, FigureAsset>;
  media: EmbeddedMediaEntry[];
  nextRelNum: number; // rId1 = styles, rId2 = settings, media starts at rId3
  nextDocPrId: number;
  figureCounter: number;
}

// Valid 1x1 transparent PNG fallback when headless SVG-only export has no browser Canvas PNG raster
const FALLBACK_1PX_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function dataUrlToBytes(dataUrl?: string): Uint8Array | null {
  if (!dataUrl) return null;
  const idx = dataUrl.indexOf('base64,');
  if (idx === -1) return null;
  try {
    return base64ToUint8Array(dataUrl.slice(idx + 7));
  } catch {
    return null;
  }
}

function utf8ToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function buildContentTypesXml(hasPng: boolean, hasSvg: boolean): string {
  const mediaDefaults = [
    hasPng ? '  <Default Extension="png" ContentType="image/png"/>' : '',
    hasSvg ? '  <Default Extension="svg" ContentType="image/svg+xml"/>' : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
${mediaDefaults ? `${mediaDefaults}\n` : ''}  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;
}

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function buildDocumentRelsXml(media: EmbeddedMediaEntry[]): string {
  const mediaRels = media
    .map(
      (m) =>
        `  <Relationship Id="${m.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${m.target}"/>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
${mediaRels ? `${mediaRels}\n` : ''}</Relationships>`;
}

function mmToTwips(mm: number): number {
  return Math.round(mm * 56.6929);
}

function buildStylesXml(style: ExamStyleSettings): string {
  const font = escapeXml(style.fontFamily === 'Plus Jakarta Sans' ? 'Calibri' : style.fontFamily);
  const szHalfPt = style.fontSizePt * 2;
  const lineTwips = Math.round(style.lineHeight * 240);
  const afterTwips = style.paragraphSpacingPt * 20;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/>
        <w:sz w:val="${szHalfPt}"/>
        <w:szCs w:val="${szHalfPt}"/>
        <w:lang w:val="vi-VN"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="${afterTwips}" w:line="${lineTwips}" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;
}

const SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
  <m:mathPr>
    <m:mathFont m:val="Cambria Math"/>
    <m:brkBin m:val="before"/>
    <m:brkBinSub m:val="--"/>
    <m:smallFrac m:val="0"/>
    <m:dispDef/>
    <m:lMargin m:val="0"/>
    <m:rMargin m:val="0"/>
    <m:defJc m:val="centerGroup"/>
    <m:wrapIndent m:val="1440"/>
    <m:intLim m:val="subSup"/>
    <m:naryLim m:val="undOvr"/>
  </m:mathPr>
</w:settings>`;

function textRunXml(
  text: string,
  bold = false,
  style: ExamStyleSettings = DEFAULT_EXAM_STYLE,
  italic = false
): string {
  if (!text) return '';
  const font = escapeXml(style.fontFamily === 'Plus Jakarta Sans' ? 'Calibri' : style.fontFamily);
  const szHalfPt = style.fontSizePt * 2;
  const bTag = bold ? '<w:b/>' : '';
  const iTag = italic ? '<w:i/>' : '';
  return `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>${bTag}${iTag}<w:sz w:val="${szHalfPt}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function formatVietnameseTextRuns(
  text: string,
  isHeading = false,
  style: ExamStyleSettings = DEFAULT_EXAM_STYLE
): string {
  if (isHeading) {
    return textRunXml(text, true, style);
  }
  const leadMatch = text.match(/^(\s*(?:Câu\s+\d+[.:]|Bài\s+\d+[.:]|Phần\s+[IVX0-9]+[.:]?|[A-D]\.|[a-d]\)))([\s\S]*)$/);
  if (leadMatch) {
    return textRunXml(leadMatch[1], true, style) + textRunXml(leadMatch[2], false, style);
  }
  return textRunXml(text, false, style);
}

function registerFigureMedia(
  fig: FigureAsset,
  ctx: DocxBuildContext
): { pngRelId: string; svgRelId?: string } {
  const pngBytes = dataUrlToBytes(fig.pngDataUrl) ?? base64ToUint8Array(FALLBACK_1PX_PNG_BASE64);
  const pngRelId = `rId${ctx.nextRelNum++}`;
  const pngIdx = ctx.media.length + 1;
  ctx.media.push({
    relId: pngRelId,
    target: `media/image${pngIdx}.png`,
    data: pngBytes,
    ext: 'png',
  });

  let svgRelId: string | undefined;
  if (fig.svgMarkup) {
    const cleanSvg = sanitizeSvgMarkup(fig.svgMarkup);
    if (cleanSvg) {
      svgRelId = `rId${ctx.nextRelNum++}`;
      const svgIdx = ctx.media.length + 1;
      ctx.media.push({
        relId: svgRelId,
        target: `media/image${svgIdx}.svg`,
        data: utf8ToUint8Array(cleanSvg),
        ext: 'svg',
      });
    }
  }

  return { pngRelId, svgRelId };
}

function buildDrawingRunXml(
  fig: FigureAsset,
  ctx: DocxBuildContext,
  inlineCompact = false
): string {
  const { pngRelId, svgRelId } = registerFigureMedia(fig, ctx);
  const docPrId = ctx.nextDocPrId++;
  const maxWidthPx = inlineCompact ? 260 : 560;
  const widthPx = Math.max(80, Math.min(maxWidthPx, Math.round(fig.widthPx || 380)));
  const ratio = fig.aspectRatio > 0.1 && fig.aspectRatio < 5 ? fig.aspectRatio : 0.68;
  const heightPx = Math.max(50, Math.round(widthPx * ratio));

  // 1 CSS px at 96 DPI = 9525 EMUs
  const cx = widthPx * 9525;
  const cy = heightPx * 9525;
  const safeName = escapeXml(fig.title || `Hinh_${docPrId}`);

  const svgExtXml = svgRelId
    ? `<a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${svgRelId}"/></a:ext></a:extLst>`
    : '';

  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="${safeName}" descr="${safeName}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${safeName}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${pngRelId}">${svgExtXml}</a:blip><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function buildStandaloneFigureParagraphs(seg: FigureSegment, ctx: DocxBuildContext): string {
  const fig = ctx.figures?.get(seg.figureId);
  if (!fig) {
    return `<w:p>${textRunXml(`[Hình không tìm thấy: ${seg.figureId}]`, false, ctx.style, true)}</w:p>`;
  }

  ctx.figureCounter += 1;
  const jc = fig.align === 'left' ? 'left' : fig.align === 'right' ? 'right' : 'center';
  const drawingRun = buildDrawingRunXml(fig, ctx, false);
  let xml = `<w:p><w:pPr><w:jc w:val="${jc}"/><w:spacing w:before="80" w:after="60"/>${
    fig.caption || fig.showNumber ? '<w:keepNext/>' : ''
  }</w:pPr>${drawingRun}</w:p>`;

  const captionParts: string[] = [];
  if (fig.showNumber !== false && (fig.caption?.trim() || fig.showNumber)) {
    captionParts.push(`Hình ${ctx.figureCounter}.`);
  }
  if (fig.caption?.trim()) {
    captionParts.push(fig.caption.trim());
  }

  if (captionParts.length > 0) {
    xml += `<w:p><w:pPr><w:jc w:val="${jc}"/><w:spacing w:before="0" w:after="120"/></w:pPr>${textRunXml(
      captionParts.join(' '),
      false,
      ctx.style,
      true
    )}</w:p>`;
  }

  return xml;
}

function segmentToOoxml(
  seg: InlineSegment,
  ctx: DocxBuildContext,
  isHeading = false,
  isSoloDisplay = false
): string {
  if (seg.type === 'text') {
    return formatVietnameseTextRuns(seg.text, isHeading, ctx.style);
  }

  if (seg.type === 'figure') {
    const fig = ctx.figures?.get(seg.figureId);
    if (!fig) {
      return textRunXml(`[Hình: ${seg.figureId}]`, false, ctx.style, true);
    }
    ctx.figureCounter += 1;
    return buildDrawingRunXml(fig, ctx, true);
  }

  if (seg.ommlCompatible === false) {
    const lines = (seg.activeLatex || seg.raw).split(/\r?\n/);
    const runs = lines
      .map((line, i) => {
        const br = i > 0 ? '<w:br/>' : '';
        return `${br}<w:t xml:space="preserve">${escapeXml(line)}</w:t>`;
      })
      .join('');
    const noteRun =
      `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:i/><w:color w:val="B45309"/><w:sz w:val="20"/></w:rPr>` +
      `<w:br/><w:t xml:space="preserve">[Cảnh báo: Công thức cấu tạo 2D không tương thích Word Equation OMML tuyến tính — giữ nguyên định dạng văn bản]</w:t></w:r>`;
    return `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="22"/></w:rPr>${runs}</w:r>${noteRun}`;
  }

  let mathml = seg.mathml;
  if (!mathml && seg.activeLatex) {
    const rendered = renderLatexToSvg(seg.activeLatex, seg.displayMode);
    if (rendered.ok) {
      mathml = rendered.mathml;
    }
  }

  if (mathml && seg.validated) {
    const omml = mathmlToOmml(mathml, isSoloDisplay && seg.displayMode, {
      target: 'docx',
      includeNamespaces: false,
    });
    if (omml) {
      return omml;
    }
  }

  return `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="B91C1C"/></w:rPr><w:t xml:space="preserve">${escapeXml(seg.activeLatex || seg.raw)}</w:t></w:r>`;
}

function paragraphToOoxml(para: ParagraphBlock, ctx: DocxBuildContext): string {
  if (para.segments.length === 0) {
    return '<w:p/>';
  }

  // Standalone figure paragraph (only whitespace around a single figure token)
  const nonWsSegments = para.segments.filter((s) => s.type !== 'text' || s.text.trim().length > 0);
  if (nonWsSegments.length === 1 && nonWsSegments[0].type === 'figure') {
    return buildStandaloneFigureParagraphs(nonWsSegments[0], ctx);
  }

  const hasDisplayFormula = para.segments.some((s) => s.type === 'formula' && s.displayMode);
  if (!hasDisplayFormula) {
    const inner = para.segments.map((s) => segmentToOoxml(s, ctx, para.isHeading, false)).join('');
    const pPr = para.isHeading
      ? '<w:pPr><w:spacing w:before="180" w:after="120"/><w:keepNext/></w:pPr>'
      : '';
    return `<w:p>${pPr}${inner}</w:p>`;
  }

  const outParagraphs: string[] = [];
  let inlineBuffer: InlineSegment[] = [];

  const flushInline = () => {
    const nonEmpty = inlineBuffer.some((s) => s.type !== 'text' || s.text.trim().length > 0);
    if (nonEmpty) {
      const inner = inlineBuffer.map((s) => segmentToOoxml(s, ctx, para.isHeading, false)).join('');
      outParagraphs.push(`<w:p>${inner}</w:p>`);
    }
    inlineBuffer = [];
  };

  for (const seg of para.segments) {
    if (seg.type === 'formula' && seg.displayMode) {
      flushInline();
      const ommlPara = segmentToOoxml(seg, ctx, false, true);
      outParagraphs.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${ommlPara}</w:p>`);
    } else {
      inlineBuffer.push(seg);
    }
  }
  flushInline();

  return outParagraphs.join('');
}

function tableToOoxml(table: TableBlock, ctx: DocxBuildContext): string {
  const tblPr = `<w:tblPr>
    <w:tblW w:w="0" w:type="auto"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="80" w:type="dxa"/>
      <w:left w:w="120" w:type="dxa"/>
      <w:bottom w:w="80" w:type="dxa"/>
      <w:right w:w="120" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>`;

  const rowsXml = table.rows
    .map((row) => {
      const cellsXml = row
        .map((cell) => {
          const cellBody = cell.paragraphs.map((p) => paragraphToOoxml(p, ctx)).join('') || '<w:p/>';
          return `<w:tc>${cellBody}</w:tc>`;
        })
        .join('');
      return `<w:tr>${cellsXml}</w:tr>`;
    })
    .join('');

  return `<w:tbl>${tblPr}${rowsXml}</w:tbl>`;
}

export function buildExamHeaderOoxml(
  header: ExamHeaderConfig,
  style: ExamStyleSettings = DEFAULT_EXAM_STYLE
): string {
  if (!hasAnyHeaderContent(header)) return '';

  const centerPara = (text: string, bold = false) =>
    text.trim()
      ? `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>${textRunXml(text.trim(), bold, style)}</w:p>`
      : '';

  const leftCell = [
    centerPara(header.schoolName.toUpperCase(), true),
    centerPara(header.department, true),
    header.schoolYear.trim() ? centerPara(`Năm học: ${header.schoolYear.trim()}`, false) : '',
  ]
    .filter(Boolean)
    .join('') || '<w:p/>';

  const subjectGradeLine = [
    header.subject.trim() ? `Môn: ${header.subject.trim()}` : '',
    header.grade.trim() ? `Khối: ${header.grade.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' – ');

  const rightCell = [
    centerPara(header.examTitle.toUpperCase(), true),
    centerPara(subjectGradeLine, true),
    header.duration.trim() ? centerPara(`Thời gian làm bài: ${header.duration.trim()}`, false) : '',
    header.examCode.trim() ? centerPara(`Mã đề: ${header.examCode.trim()}`, true) : '',
  ]
    .filter(Boolean)
    .join('') || '<w:p/>';

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="334155"/><w:right w:val="none"/>
        <w:insideH w:val="none"/><w:insideV w:val="none"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tr>
      <w:tc><w:tcPr><w:tcW w:w="2200" w:type="pct"/></w:tcPr>${leftCell}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="2800" w:type="pct"/></w:tcPr>${rightCell}</w:tc>
    </w:tr>
  </w:tbl><w:p/>`;
}

function buildDocumentWithContext(
  doc: ProcessedDocument,
  options?: DocxExportOptions
): { xml: string; media: EmbeddedMediaEntry[] } {
  const style = options?.style ?? DEFAULT_EXAM_STYLE;
  const ctx: DocxBuildContext = {
    style,
    figures: options?.figures,
    media: [],
    nextRelNum: 3,
    nextDocPrId: 1,
    figureCounter: 0,
  };

  const headerXml = options?.header ? buildExamHeaderOoxml(options.header, style) : '';

  const bodyBlocks = doc.blocks
    .map((block: DocumentBlock) =>
      block.type === 'paragraph' ? paragraphToOoxml(block, ctx) : tableToOoxml(block, ctx)
    )
    .join('');

  const topTw = mmToTwips(style.marginTopMm);
  const rightTw = mmToTwips(style.marginRightMm);
  const bottomTw = mmToTwips(style.marginBottomMm);
  const leftTw = mmToTwips(style.marginLeftMm);

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${headerXml}${bodyBlocks}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="${topTw}" w:right="${rightTw}" w:bottom="${bottomTw}" w:left="${leftTw}" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  return { xml, media: ctx.media };
}

export function buildDocumentXml(doc: ProcessedDocument, options?: DocxExportOptions): string {
  return buildDocumentWithContext(doc, options).xml;
}

export async function generateDocxBuffer(
  doc: ProcessedDocument,
  options?: DocxExportOptions
): Promise<Uint8Array> {
  const style = options?.style ?? DEFAULT_EXAM_STYLE;
  const { xml, media } = buildDocumentWithContext(doc, options);
  const hasPng = media.some((m) => m.ext === 'png');
  const hasSvg = media.some((m) => m.ext === 'svg');

  const zip = new JSZip();
  zip.file('[Content_Types].xml', buildContentTypesXml(hasPng, hasSvg));
  zip.folder('_rels')?.file('.rels', ROOT_RELS_XML);
  const wordFolder = zip.folder('word');
  wordFolder?.folder('_rels')?.file('document.xml.rels', buildDocumentRelsXml(media));
  wordFolder?.file('styles.xml', buildStylesXml(style));
  wordFolder?.file('settings.xml', SETTINGS_XML);
  wordFolder?.file('document.xml', xml);

  for (const m of media) {
    wordFolder?.file(m.target, m.data);
  }

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function exportDocxFile(
  doc: ProcessedDocument,
  filename = 'MathFix-EDU-Tai-Lieu.docx',
  options?: DocxExportOptions
): Promise<void> {
  const bytes = await generateDocxBuffer(doc, options);
  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function exportSingleFormulaDocx(
  formula: FormulaSegment,
  filename = 'MathFix-EDU-Cong-Thuc.docx'
): Promise<void> {
  const singleDoc: ProcessedDocument = {
    sourceType: 'plain',
    blocks: [
      {
        id: 'p_single',
        type: 'paragraph',
        segments: [formula],
      },
    ],
    stats: {
      totalFormulas: 1,
      validCount: formula.validated ? 1 : 0,
      autoFixedCount: 0,
      needsReviewCount: 0,
      unrecoverableCount: formula.validated ? 0 : 1,
    },
    warnings: [],
  };
  await exportDocxFile(singleDoc, filename);
}
