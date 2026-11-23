import JSZip from 'jszip';
import { ommlToLatex, parseXml, XmlNode } from './mathmlConverter';

export interface DocxImportResult {
  text: string;
  ommlCount: number;
  tableCount: number;
  warnings: string[];
}

function serializeXmlNode(node: XmlNode): string {
  if (node.type === 'text') return node.text || '';
  const tag = node.fullTag || node.tag || 'node';
  const attrs = Object.entries(node.attrs || {})
    .map(([k, v]) => ` ${k}="${v.replace(/"/g, '&quot;')}"`)
    .join('');
  const children = (node.children || []).map(serializeXmlNode).join('');
  if (!children) return `<${tag}${attrs}/>`;
  return `<${tag}${attrs}>${children}</${tag}>`;
}

function extractParagraphContent(pNode: XmlNode, stats: { ommlCount: number }): string {
  const parts: string[] = [];

  function walk(node: XmlNode) {
    if (node.type !== 'element') return;

    if (node.tag === 'oMathPara') {
      const latex = ommlToLatex(serializeXmlNode(node));
      if (latex) {
        stats.ommlCount += 1;
        parts.push(`$$${latex}$$`);
      }
      return;
    }

    if (node.tag === 'oMath') {
      const latex = ommlToLatex(serializeXmlNode(node));
      if (latex) {
        stats.ommlCount += 1;
        parts.push(`$${latex}$`);
      }
      return;
    }

    if (node.tag === 't') {
      const text = (node.children || []).map((c) => c.text || '').join('');
      parts.push(text);
      return;
    }

    if (node.tag === 'tab') {
      parts.push('\t');
      return;
    }

    if (node.tag === 'br' || node.tag === 'cr') {
      parts.push('\n');
      return;
    }

    for (const child of node.children || []) {
      walk(child);
    }
  }

  for (const child of pNode.children || []) {
    walk(child);
  }

  return parts.join('');
}

export async function importDocxFromArrayBuffer(buffer: ArrayBuffer | Uint8Array): Promise<DocxImportResult> {
  const zip = await JSZip.loadAsync(buffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('Tệp DOCX không hợp lệ hoặc thiếu word/document.xml');
  }

  const docXml = await docXmlFile.async('string');
  const root = parseXml(docXml);
  if (!root) {
    throw new Error('Không thể đọc cấu trúc XML trong tệp DOCX');
  }

  const body = (root.children || []).find((c) => c.type === 'element' && c.tag === 'body');
  if (!body) {
    throw new Error('Không tìm thấy nội dung (w:body) trong tệp DOCX');
  }

  const lines: string[] = [];
  const stats = { ommlCount: 0 };
  let tableCount = 0;
  const warnings: string[] = [];

  for (const child of body.children || []) {
    if (child.type !== 'element') continue;

    if (child.tag === 'p') {
      lines.push(extractParagraphContent(child, stats));
    } else if (child.tag === 'tbl') {
      tableCount += 1;
      const rows = (child.children || []).filter((r) => r.type === 'element' && r.tag === 'tr');
      for (const row of rows) {
        const cells = (row.children || []).filter((c) => c.type === 'element' && c.tag === 'tc');
        const cellTexts = cells.map((cell) => {
          const cellParas = (cell.children || [])
            .filter((p) => p.type === 'element' && p.tag === 'p')
            .map((p) => extractParagraphContent(p, stats).trim())
            .filter(Boolean);
          return cellParas.join(' ');
        });
        lines.push(`| ${cellTexts.join(' | ')} |`);
      }
      lines.push('');
    }
  }

  // Detect embedded legacy MathType/OLE images if present
  const hasOleObjects = Object.keys(zip.files).some((name) => /word\/embeddings\/|oleObject/i.test(name));
  if (hasOleObjects) {
    warnings.push(
      'Tệp DOCX có chứa đối tượng nhúng cũ (MathType/OLE). Các công thức OMML Word Equation và văn bản đã được trích xuất; đối tượng ảnh/OLE cần nhập lại hoặc chuyển sang OMML trong Word.'
    );
  }

  return {
    text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    ommlCount: stats.ommlCount,
    tableCount,
    warnings,
  };
}
