import JSZip from 'jszip';
import {
  DocumentBlock,
  FormulaSegment,
  InlineSegment,
  ParagraphBlock,
  ProcessedDocument,
  TableBlock,
} from './types';
import { escapeXml, mathmlToOmml } from './mathmlConverter';
import { renderLatexToSvg } from './mathjaxRenderer';
import {
  DEFAULT_EXAM_STYLE,
  ExamHeaderConfig,
  ExamStyleSettings,
  hasAnyHeaderContent,
} from './examTools';

export interface DocxExportOptions {
  style?: ExamStyleSettings;
  header?: ExamHeaderConfig;
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

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

function textRunXml(text: string, bold = false, style: ExamStyleSettings = DEFAULT_EXAM_STYLE): string {
  if (!text) return '';
  const font = escapeXml(style.fontFamily === 'Plus Jakarta Sans' ? 'Calibri' : style.fontFamily);
  const szHalfPt = style.fontSizePt * 2;
  const rPr = bold
    ? `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:b/><w:sz w:val="${szHalfPt}"/></w:rPr>`
    : `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${szHalfPt}"/></w:rPr>`;
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/**
 * Bold standard Vietnamese exam lead-ins like "Câu 1.", "Bài 2:", "A.", "B.", "C.", "D."
 * without changing a single character of the original text.
 */
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

function segmentToOoxml(
  seg: InlineSegment,
  isHeading = false,
  isSoloDisplay = false,
  style: ExamStyleSettings = DEFAULT_EXAM_STYLE
): string {
  if (seg.type === 'text') {
    return formatVietnameseTextRuns(seg.text, isHeading, style);
  }

  // Complex 2D structural chemistry is explicitly flagged as non-OMML: preserve line breaks cleanly
  // in monospace text + honest warning note instead of emitting broken Word Equation XML.
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

  // Fallback only if formula is genuinely unrecoverable (never leave silent blank)
  return `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="B91C1C"/></w:rPr><w:t xml:space="preserve">${escapeXml(seg.activeLatex || seg.raw)}</w:t></w:r>`;
}

function paragraphToOoxml(para: ParagraphBlock, style: ExamStyleSettings = DEFAULT_EXAM_STYLE): string {
  if (para.segments.length === 0) {
    return '<w:p/>';
  }

  const hasDisplayFormula = para.segments.some((s) => s.type === 'formula' && s.displayMode);
  if (!hasDisplayFormula) {
    const inner = para.segments.map((s) => segmentToOoxml(s, para.isHeading, false, style)).join('');
    const pPr = para.isHeading
      ? '<w:pPr><w:spacing w:before="180" w:after="120"/><w:keepNext/></w:pPr>'
      : '';
    return `<w:p>${pPr}${inner}</w:p>`;
  }

  const outParagraphs: string[] = [];
  let inlineBuffer: InlineSegment[] = [];

  const flushInline = () => {
    const nonEmpty = inlineBuffer.some((s) => s.type === 'formula' || s.text.trim().length > 0);
    if (nonEmpty) {
      const inner = inlineBuffer.map((s) => segmentToOoxml(s, para.isHeading, false, style)).join('');
      outParagraphs.push(`<w:p>${inner}</w:p>`);
    }
    inlineBuffer = [];
  };

  for (const seg of para.segments) {
    if (seg.type === 'formula' && seg.displayMode) {
      flushInline();
      const ommlPara = segmentToOoxml(seg, false, true, style);
      outParagraphs.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${ommlPara}</w:p>`);
    } else {
      inlineBuffer.push(seg);
    }
  }
  flushInline();

  return outParagraphs.join('');
}

function tableToOoxml(table: TableBlock, style: ExamStyleSettings = DEFAULT_EXAM_STYLE): string {
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
          const cellBody = cell.paragraphs.map((p) => paragraphToOoxml(p, style)).join('') || '<w:p/>';
          return `<w:tc>${cellBody}</w:tc>`;
        })
        .join('');
      return `<w:tr>${cellsXml}</w:tr>`;
    })
    .join('');

  return `<w:tbl>${tblPr}${rowsXml}</w:tbl>`;
}

/**
 * Build standard Vietnamese 2-column borderless exam header block in OOXML (Section XVII.6).
 */
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

export function buildDocumentXml(doc: ProcessedDocument, options?: DocxExportOptions): string {
  const style = options?.style ?? DEFAULT_EXAM_STYLE;
  const headerXml = options?.header ? buildExamHeaderOoxml(options.header, style) : '';

  const bodyBlocks = doc.blocks
    .map((block: DocumentBlock) =>
      block.type === 'paragraph' ? paragraphToOoxml(block, style) : tableToOoxml(block, style)
    )
    .join('');

  const topTw = mmToTwips(style.marginTopMm);
  const rightTw = mmToTwips(style.marginRightMm);
  const bottomTw = mmToTwips(style.marginBottomMm);
  const leftTw = mmToTwips(style.marginLeftMm);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${headerXml}${bodyBlocks}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="${topTw}" w:right="${rightTw}" w:bottom="${bottomTw}" w:left="${leftTw}" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

export async function generateDocxBuffer(
  doc: ProcessedDocument,
  options?: DocxExportOptions
): Promise<Uint8Array> {
  const style = options?.style ?? DEFAULT_EXAM_STYLE;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.folder('_rels')?.file('.rels', ROOT_RELS_XML);
  const wordFolder = zip.folder('word');
  wordFolder?.folder('_rels')?.file('document.xml.rels', DOCUMENT_RELS_XML);
  wordFolder?.file('styles.xml', buildStylesXml(style));
  wordFolder?.file('settings.xml', SETTINGS_XML);
  wordFolder?.file('document.xml', buildDocumentXml(doc, options));

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

/**
 * Export a single FormulaSegment directly as a clean .docx file containing a real editable Word Equation (OMML).
 */
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
