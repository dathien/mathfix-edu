import JSZip from 'jszip';
import { DocumentBlock, InlineSegment, ParagraphBlock, ProcessedDocument, TableBlock } from './types';
import { escapeXml, mathmlToOmml } from './mathmlConverter';
import { renderLatexToSvg } from './mathjaxRenderer';

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

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/>
        <w:sz w:val="26"/>
        <w:szCs w:val="26"/>
        <w:lang w:val="vi-VN"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;

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

function textRunXml(text: string, bold = false): string {
  if (!text) return '';
  const rPr = bold
    ? `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="26"/></w:rPr>`
    : `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="26"/></w:rPr>`;
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/**
 * Bold standard Vietnamese exam lead-ins like "Câu 1.", "Bài 2:", "A.", "B.", "C.", "D."
 * without changing a single character of the original text.
 */
function formatVietnameseTextRuns(text: string, isHeading = false): string {
  if (isHeading) {
    return textRunXml(text, true);
  }
  const leadMatch = text.match(/^(\s*(?:Câu\s+\d+[.:]|Bài\s+\d+[.:]|Phần\s+[IVX0-9]+[.:]?|[A-D]\.|[a-d]\)))([\s\S]*)$/);
  if (leadMatch) {
    return textRunXml(leadMatch[1], true) + textRunXml(leadMatch[2], false);
  }
  return textRunXml(text, false);
}

function segmentToOoxml(seg: InlineSegment, isHeading = false, isSoloDisplay = false): string {
  if (seg.type === 'text') {
    return formatVietnameseTextRuns(seg.text, isHeading);
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

function paragraphToOoxml(para: ParagraphBlock): string {
  if (para.segments.length === 0) {
    return '<w:p/>';
  }

  // Split around display formulas so standalone display equations get proper <m:oMathPara> paragraphs
  const hasDisplayFormula = para.segments.some((s) => s.type === 'formula' && s.displayMode);
  if (!hasDisplayFormula) {
    const inner = para.segments.map((s) => segmentToOoxml(s, para.isHeading, false)).join('');
    const pPr = para.isHeading
      ? '<w:pPr><w:spacing w:before="180" w:after="120"/><w:keepNext/></w:pPr>'
      : '';
    return `<w:p>${pPr}${inner}</w:p>`;
  }

  // Group into runs of inline segments separated by display equations
  const outParagraphs: string[] = [];
  let inlineBuffer: InlineSegment[] = [];

  const flushInline = () => {
    const nonEmpty = inlineBuffer.some((s) => s.type === 'formula' || s.text.trim().length > 0);
    if (nonEmpty) {
      const inner = inlineBuffer.map((s) => segmentToOoxml(s, para.isHeading, false)).join('');
      outParagraphs.push(`<w:p>${inner}</w:p>`);
    }
    inlineBuffer = [];
  };

  for (const seg of para.segments) {
    if (seg.type === 'formula' && seg.displayMode) {
      flushInline();
      const ommlPara = segmentToOoxml(seg, false, true);
      outParagraphs.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${ommlPara}</w:p>`);
    } else {
      inlineBuffer.push(seg);
    }
  }
  flushInline();

  return outParagraphs.join('');
}

function tableToOoxml(table: TableBlock): string {
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
          const cellBody = cell.paragraphs.map(paragraphToOoxml).join('') || '<w:p/>';
          return `<w:tc>${cellBody}</w:tc>`;
        })
        .join('');
      return `<w:tr>${cellsXml}</w:tr>`;
    })
    .join('');

  return `<w:tbl>${tblPr}${rowsXml}</w:tbl>`;
}

export function buildDocumentXml(doc: ProcessedDocument): string {
  const bodyBlocks = doc.blocks
    .map((block: DocumentBlock) =>
      block.type === 'paragraph' ? paragraphToOoxml(block) : tableToOoxml(block)
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyBlocks}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

export async function generateDocxBuffer(doc: ProcessedDocument): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.folder('_rels')?.file('.rels', ROOT_RELS_XML);
  const wordFolder = zip.folder('word');
  wordFolder?.folder('_rels')?.file('document.xml.rels', DOCUMENT_RELS_XML);
  wordFolder?.file('styles.xml', STYLES_XML);
  wordFolder?.file('settings.xml', SETTINGS_XML);
  wordFolder?.file('document.xml', buildDocumentXml(doc));

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function exportDocxFile(doc: ProcessedDocument, filename = 'MathFix-EDU-Tai-Lieu.docx'): Promise<void> {
  const bytes = await generateDocxBuffer(doc);
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
