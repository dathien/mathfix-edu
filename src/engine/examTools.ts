/**
 * Exam Normalization & Exam Formatting Tools Engine (Sections XVI & XVII).
 * Strictly preserves teacher's question wording, numbers, answers, and math formulas.
 * Never solves exercises, never alters meaning, never fabricates school names.
 */

export interface ExamNormalizationOptions {
  normalizeFormulas: boolean;
  normalizeSpaces: boolean;
  removeExtraBlankLines: boolean;
  normalizeQuestionLabels: boolean;
  normalizeOptions: boolean;
  normalizeTables: boolean;
}

export const DEFAULT_NORMALIZATION_OPTIONS: ExamNormalizationOptions = {
  normalizeFormulas: true,
  normalizeSpaces: true,
  removeExtraBlankLines: true,
  normalizeQuestionLabels: true,
  normalizeOptions: true,
  normalizeTables: true,
};

export interface ExamStyleSettings {
  fontFamily: 'Times New Roman' | 'Arial' | 'Cambria' | 'Plus Jakarta Sans';
  fontSizePt: 12 | 13 | 14;
  lineHeight: 1.15 | 1.3 | 1.5;
  paragraphSpacingPt: 0 | 4 | 6;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
}

export const DEFAULT_EXAM_STYLE: ExamStyleSettings = {
  fontFamily: 'Times New Roman',
  fontSizePt: 13,
  lineHeight: 1.3,
  paragraphSpacingPt: 6,
  marginTopMm: 20,
  marginBottomMm: 20,
  marginLeftMm: 25,
  marginRightMm: 20,
};

export interface ExamHeaderConfig {
  enabled: boolean;
  schoolName: string;
  department: string;
  subject: string;
  grade: string;
  examTitle: string;
  duration: string;
  examCode: string;
  schoolYear: string;
}

export const EMPTY_EXAM_HEADER: ExamHeaderConfig = {
  enabled: false,
  schoolName: '',
  department: '',
  subject: '',
  grade: '',
  examTitle: '',
  duration: '',
  examCode: '',
  schoolYear: '',
};

export interface ExamNormalizationReport {
  text: string;
  changesCount: number;
  summary: string[];
}

/**
 * Normalize exam text selectively according to teacher's chosen checkboxes.
 * Preserves every character of question content, numerical values, and formula delimiters.
 */
export function normalizeExamText(
  rawText: string,
  options: ExamNormalizationOptions
): ExamNormalizationReport {
  const normalizedInput = rawText.replace(/\r\n/g, '\n');
  let lines = normalizedInput.split('\n');
  let changesCount = 0;
  const summary: string[] = [];

  // Track if we are inside a multi-line LaTeX display block ($$...$$, \[...\], \begin{...})
  let insideMathBlock = false;

  let spaceFixes = 0;
  let questionFixes = 0;
  let optionFixes = 0;
  let tableFixes = 0;

  lines = lines.map((line) => {
    const trimmed = line.trim();
    if (/^\$\$|^\\\[|^\\begin\{/.test(trimmed) && !/\$\$$|\\\]$|\\end\{/.test(trimmed)) {
      insideMathBlock = true;
      return line;
    }
    if (insideMathBlock) {
      if (/\$\$|\\\]|\\end\{/.test(trimmed)) insideMathBlock = false;
      return line;
    }

    // Do not touch ASCII 2D structural chemistry alignment lines
    if (/^\s*[|/\\]+\s*$/.test(line) || /^\s*(?:CH[23]?|OH|NH2|C)\s*$/.test(line)) {
      return line;
    }

    let next = line;

    // 1. Table normalization
    if (options.normalizeTables && /^\s*\|.+\|\s*$/.test(next)) {
      const cells = next
        .trim()
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      const rebuilt = `| ${cells.join(' | ')} |`;
      if (rebuilt !== next) {
        next = rebuilt;
        tableFixes++;
      }
      return next;
    }

    // 2. Question numbering label standardization (e.g. "câu  1 :", "CÂU 1)", "Cau 1." -> "Câu 1.")
    // Preserves cluster questions like "Câu 1-3." or "Câu 1 - 2:"
    if (options.normalizeQuestionLabels) {
      const qMatch = next.match(/^\s*(?:câu|cau|CÂU|CAU)\s+(\d+(?:\s*[-–]\s*\d+)?)\s*([.:)])\s*(.*)$/i);
      if (qMatch) {
        const num = qMatch[1].replace(/\s*[-–]\s*/, '–');
        const rest = qMatch[3];
        const standardized = `Câu ${num}. ${rest}`.trimEnd();
        if (standardized !== next) {
          next = standardized;
          questionFixes++;
        }
      }
      const bMatch = next.match(/^\s*(?:bài|bai|BÀI|BAI)\s+(\d+)\s*([.:)])\s*(.*)$/i);
      if (bMatch) {
        const standardized = `Bài ${bMatch[1]}. ${bMatch[3]}`.trimEnd();
        if (standardized !== next) {
          next = standardized;
          questionFixes++;
        }
      }
    }

    // 3. Multiple-choice & True/False option label standardization
    if (options.normalizeOptions) {
      // Standardize standalone option lines: "A ) text" or "a. text" (only uppercase A-D or clear option line)
      const mcqLine = next.match(/^\s*([A-D])\s*[.):]\s+(.*)$/);
      if (mcqLine) {
        const standardized = `${mcqLine[1]}. ${mcqLine[2]}`;
        if (standardized !== next) {
          next = standardized;
          optionFixes++;
        }
      } else {
        // True/False sub-items: "a ) text", "b. text", "c)  text" -> "a) text"
        const tfLine = next.match(/^\s*([a-d])\s*[.):]\s+(.*)$/);
        if (tfLine) {
          const standardized = `${tfLine[1]}) ${tfLine[2]}`;
          if (standardized !== next) {
            next = standardized;
            optionFixes++;
          }
        }
      }
    }

    // 4. Clean redundant spaces/tabs outside math delimiters
    if (options.normalizeSpaces) {
      const cleaned = cleanSpacesOutsideMath(next);
      if (cleaned !== next) {
        next = cleaned;
        spaceFixes++;
      }
    }

    return next;
  });

  // 5. Collapse excess blank lines when requested
  let blankLineFixes = 0;
  if (options.removeExtraBlankLines) {
    const compacted: string[] = [];
    let consecutiveEmpty = 0;
    for (const l of lines) {
      if (l.trim() === '') {
        consecutiveEmpty++;
        if (consecutiveEmpty <= 1) {
          compacted.push('');
        } else {
          blankLineFixes++;
        }
      } else {
        consecutiveEmpty = 0;
        compacted.push(l);
      }
    }
    lines = compacted;
  }

  if (questionFixes > 0) {
    changesCount += questionFixes;
    summary.push(`Chuẩn hóa nhãn câu hỏi (${questionFixes} dòng)`);
  }
  if (optionFixes > 0) {
    changesCount += optionFixes;
    summary.push(`Chuẩn hóa nhãn phương án A/B/C/D và a)/b)/c)/d) (${optionFixes} dòng)`);
  }
  if (spaceFixes > 0) {
    changesCount += spaceFixes;
    summary.push(`Xóa khoảng trắng thừa ngoài công thức (${spaceFixes} dòng)`);
  }
  if (blankLineFixes > 0) {
    changesCount += blankLineFixes;
    summary.push(`Xóa ${blankLineFixes} dòng trống thừa`);
  }
  if (tableFixes > 0) {
    changesCount += tableFixes;
    summary.push(`Chuẩn hóa căn chỉnh bảng biểu (${tableFixes} hàng)`);
  }

  return {
    text: lines.join('\n'),
    changesCount,
    summary,
  };
}

function cleanSpacesOutsideMath(line: string): string {
  // Split around delimited math ($...$, $$...$$, \(...\), \[...\]) so math spacing is untouched
  const tokens = line.split(/(\$\$[\s\S]*?\$\$|\$[^$]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g);
  return tokens
    .map((tok, i) => {
      if (i % 2 === 1) return tok; // inside delimited math
      return tok
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\s+([,;:.!?])(?!\d)/g, '$1');
    })
    .join('')
    .trimEnd();
}

export interface RenumberOptions {
  startNumber: number;
  fromLineIndex?: number; // 0-based line index; defaults to 0 (renumber entire document)
  prefix?: 'Câu' | 'Bài';
}

/**
 * Auto-number or renumber exam questions while preserving cluster questions (Câu 1–3)
 * and sub-items a), b), c), d) (Section XVII.1).
 */
export function renumberQuestions(
  rawText: string,
  options: RenumberOptions = { startNumber: 1, fromLineIndex: 0, prefix: 'Câu' }
): { text: string; renumberedCount: number } {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const startLine = Math.max(0, options.fromLineIndex ?? 0);
  const prefix = options.prefix ?? 'Câu';
  let currentNum = Math.max(1, Math.floor(options.startNumber || 1));
  let renumberedCount = 0;

  const updated = lines.map((line, idx) => {
    if (idx < startLine) return line;

    // Preserve cluster/grouped question headers like "Câu 1–3." or "Câu 1 - 3:" untouched!
    if (/^\s*(?:Câu|Bài)\s+\d+\s*[-–]\s*\d+/i.test(line)) {
      return line;
    }

    // Match single question header: "Câu 5." / "Câu 5:" / "Bài 2." / "1." (only if matching target prefix or Câu/Bài)
    const match = line.match(/^\s*(Câu|Bài)\s+(\d+)\s*([.:)])\s*(.*)$/i);
    if (match) {
      const matchedPrefix = match[1].toLowerCase() === 'bài' ? 'Bài' : 'Câu';
      if (prefix === matchedPrefix || !options.prefix) {
        const nextLine = `${matchedPrefix} ${currentNum}. ${match[4]}`.trimEnd();
        currentNum++;
        renumberedCount++;
        return nextLine;
      }
    }
    return line;
  });

  return { text: updated.join('\n'), renumberedCount };
}

export type OptionLayoutColumns = 1 | 2 | 4;

/**
 * Align multiple-choice options A, B, C, D into 1 column, 2 columns, or 4 on a single line.
 * Automatically wraps to fewer columns when option text is long so nothing overflows (Section XVII.2).
 */
export function formatMultipleChoiceOptions(
  rawText: string,
  columns: OptionLayoutColumns
): { text: string; blocksFormatted: number } {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let blocksFormatted = 0;
  let i = 0;

  // Helper to extract A., B., C., D. whether on separate lines or joined on 1-2 lines
  const parseInlineOptions = (line: string): Array<{ label: string; body: string }> | null => {
    const matches = Array.from(line.matchAll(/(?:^|\s{2,}|\t)([A-D])\.\s+/g));
    if (matches.length < 2) return null;
    const opts: Array<{ label: string; body: string }> = [];
    for (let k = 0; k < matches.length; k++) {
      const m = matches[k];
      const label = m[1];
      const bodyStart = (m.index ?? 0) + m[0].length;
      const bodyEnd = k + 1 < matches.length ? (matches[k + 1].index ?? line.length) : line.length;
      opts.push({ label, body: line.slice(bodyStart, bodyEnd).trim() });
    }
    return opts;
  };

  while (i < lines.length) {
    // Try collecting a contiguous A, B, C, D group
    const collected: Array<{ label: string; body: string }> = [];
    let j = i;

    while (j < lines.length && collected.length < 4) {
      const line = lines[j];
      const inline = parseInlineOptions(line);
      if (inline) {
        collected.push(...inline);
        j++;
        continue;
      }
      const single = line.match(/^\s*([A-D])\s*[.)]\s+(.*)$/);
      if (single) {
        collected.push({ label: single[1], body: single[2].trim() });
        j++;
        continue;
      }
      break;
    }

    const isValidABCD =
      collected.length === 4 &&
      collected[0].label === 'A' &&
      collected[1].label === 'B' &&
      collected[2].label === 'C' &&
      collected[3].label === 'D';

    if (isValidABCD) {
      blocksFormatted++;
      const maxLen = Math.max(...collected.map((o) => o.body.length));
      // Smart auto-wrap guard when options are long
      let effectiveCols: OptionLayoutColumns = columns;
      if (columns === 4 && maxLen > 24) effectiveCols = 2;
      if (effectiveCols === 2 && maxLen > 52) effectiveCols = 1;

      if (effectiveCols === 1) {
        for (const o of collected) {
          out.push(`${o.label}. ${o.body}`);
        }
      } else if (effectiveCols === 2) {
        out.push(`${collected[0].label}. ${collected[0].body}    ${collected[1].label}. ${collected[1].body}`);
        out.push(`${collected[2].label}. ${collected[2].body}    ${collected[3].label}. ${collected[3].body}`);
      } else {
        out.push(collected.map((o) => `${o.label}. ${o.body}`).join('    '));
      }
      i = j;
      continue;
    }

    out.push(lines[i]);
    i++;
  }

  return { text: out.join('\n'), blocksFormatted };
}

/**
 * Format True/False question items a), b), c), d) preserving exact order and content (Section XVII.3).
 */
export function formatTrueFalseItems(rawText: string): { text: string; formattedCount: number } {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  let formattedCount = 0;

  const updated = lines.map((line) => {
    const m = line.match(/^\s*([a-d])\s*[.):]\s*(.+)$/);
    if (m) {
      const next = `${m[1]}) ${m[2].trim()}`;
      if (next !== line) formattedCount++;
      return next;
    }
    return line;
  });

  return { text: updated.join('\n'), formattedCount };
}

/**
 * Format Short Answer question template / append answer line when requested (Section XVII.4).
 */
export function appendShortAnswerBoxes(rawText: string): { text: string; insertedCount: number } {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let insertedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);
    const isQuestion = /^\s*Câu\s+\d+\./i.test(line);
    if (!isQuestion) continue;

    // Look ahead to see if next non-empty line is already an option or answer box
    const nextLine = (lines[i + 1] || '').trim();
    const hasOptionsOrBox =
      /^[A-D]\./.test(nextLine) ||
      /^[a-d]\)/.test(nextLine) ||
      /^Đáp án:/i.test(nextLine) ||
      /^Trả lời:/i.test(nextLine);

    if (!hasOptionsOrBox) {
      out.push('Trả lời: ..............................');
      insertedCount++;
    }
  }

  return { text: out.join('\n'), insertedCount };
}

/**
 * Format Essay question template / insert writing space when requested (Section XVII.5).
 */
export function appendEssayWritingSpace(
  rawText: string,
  lineCount = 3
): { text: string; insertedCount: number } {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let insertedCount = 0;
  const dots = '................................................................................';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);
    const isEssay = /^\s*(?:Bài|Câu)\s+\d+\./i.test(line);
    if (!isEssay) continue;

    const nextLine = (lines[i + 1] || '').trim();
    const hasSubOrLines =
      /^[A-D]\./.test(nextLine) ||
      /^[a-d]\)/.test(nextLine) ||
      /^Bài làm:/i.test(nextLine);

    if (!hasSubOrLines) {
      out.push('Bài làm:');
      for (let k = 0; k < Math.max(1, Math.min(8, lineCount)); k++) {
        out.push(dots);
      }
      insertedCount++;
    }
  }

  return { text: out.join('\n'), insertedCount };
}

/**
 * Insert a clean, ready-to-use question skeleton at cursor (for MCQ / True-False / Short Answer / Essay).
 */
export function buildQuestionTemplate(
  kind: 'mcq' | 'true_false' | 'short_answer' | 'essay',
  questionNumber = 1
): string {
  switch (kind) {
    case 'mcq':
      return `Câu ${questionNumber}. [Nhập nội dung câu hỏi tại đây]\nA. \nB. \nC. \nD. `;
    case 'true_false':
      return `Câu ${questionNumber}. [Nhập câu dẫn câu hỏi Đúng/Sai tại đây]\na) \nb) \nc) \nd) `;
    case 'short_answer':
      return `Câu ${questionNumber}. [Nhập nội dung câu hỏi trả lời ngắn tại đây]\nTrả lời: ..............................`;
    case 'essay':
      return `Bài ${questionNumber}. [Nhập nội dung bài tập tự luận tại đây]\na) \nb) \nBài làm:\n................................................................................\n................................................................................`;
  }
}

export function hasAnyHeaderContent(header: ExamHeaderConfig): boolean {
  return Boolean(
    header.enabled &&
      (header.schoolName.trim() ||
        header.department.trim() ||
        header.subject.trim() ||
        header.grade.trim() ||
        header.examTitle.trim() ||
        header.duration.trim() ||
        header.examCode.trim() ||
        header.schoolYear.trim())
  );
}
