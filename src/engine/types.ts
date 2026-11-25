export type FormulaStatus = 'valid' | 'auto_fixed' | 'needs_review' | 'unrecoverable';

export type SubjectMode = 'auto' | 'math' | 'physics' | 'chemistry';

export type FormulaSubject = 'math' | 'physics' | 'chemistry';

export type SubjectConfidence = 'high' | 'medium' | 'low';

export type FormulaSourceFormat =
  | 'dollar_inline'
  | 'dollar_display'
  | 'paren_inline'
  | 'bracket_display'
  | 'bare_latex'
  | 'mathml'
  | 'unicodemath'
  | 'omml'
  | 'mathlive'
  | 'mhchem'
  | 'bare_chemistry'
  | 'bare_physics';

export type UserDecision = 'pending' | 'accepted' | 'rejected' | 'edited';

export interface FixNote {
  code: string;
  message: string;
  severity: 'safe' | 'ambiguous' | 'error';
}

export interface TextSegment {
  id: string;
  type: 'text';
  text: string;
}

export interface FormulaSegment {
  id: string;
  type: 'formula';
  raw: string;
  originalLatex: string;
  fixedLatex: string;
  activeLatex: string;
  displayMode: boolean;
  sourceFormat: FormulaSourceFormat;
  subject: FormulaSubject;
  subjectConfidence?: SubjectConfidence;
  subjectManualOverride?: boolean;
  ommlCompatible?: boolean;
  ommlWarning?: string;
  status: FormulaStatus;
  userDecision: UserDecision;
  notes: FixNote[];
  svg: string;
  mathml: string;
  validated: boolean;
  errorMessage?: string;
}

export interface FigureSegment {
  id: string;
  type: 'figure';
  figureId: string;
  raw: string;
}

export type InlineSegment = TextSegment | FormulaSegment | FigureSegment;

export interface ParagraphBlock {
  id: string;
  type: 'paragraph';
  segments: InlineSegment[];
  isHeading?: boolean;
  listLevel?: number;
}

export interface TableCellData {
  id: string;
  paragraphs: ParagraphBlock[];
}

export interface TableBlock {
  id: string;
  type: 'table';
  rows: TableCellData[][];
}

export type DocumentBlock = ParagraphBlock | TableBlock;

export type InputSourceType =
  | 'plain'
  | 'html'
  | 'chatgpt'
  | 'gemini'
  | 'word'
  | 'google_docs'
  | 'docx'
  | 'pdf'
  | 'web';

export interface DocumentStats {
  totalFormulas: number;
  validCount: number;
  autoFixedCount: number;
  needsReviewCount: number;
  unrecoverableCount: number;
  mathCount?: number;
  physicsCount?: number;
  chemistryCount?: number;
}

export interface ProcessedDocument {
  blocks: DocumentBlock[];
  sourceType: InputSourceType;
  subjectMode?: SubjectMode;
  stats: DocumentStats;
  warnings: string[];
}

export interface SampleItem {
  id: string;
  index: number;
  title: string;
  category: string;
  subject?: SubjectMode;
  description: string;
  content: string;
}
