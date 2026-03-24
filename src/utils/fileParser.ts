// Lazy-load heavy parsing libraries to avoid adding ~300KB to the main bundle
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }
  return pdfjsLib;
}

export interface ParsedFile {
  name: string;
  size: number;
  type: string;
  text: string;
  pageCount?: number;
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  let text = '';
  let pageCount: number | undefined;

  switch (ext) {
    case 'pdf': {
      const result = await parsePDF(file);
      text = result.text;
      pageCount = result.pageCount;
      break;
    }
    case 'docx':
    case 'doc': {
      text = await parseDOCX(file);
      break;
    }
    case 'txt': {
      text = await file.text();
      break;
    }
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }

  return {
    name: file.name,
    size: file.size,
    type: ext || 'unknown',
    text: text.trim(),
    pageCount,
  };
}

async function parsePDF(file: File): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  return {
    text: pages.join('\n\n'),
    pageCount: pdf.numPages,
  };
}

async function parseDOCX(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.default.extractRawText({ arrayBuffer });
  return result.value;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPTED_TYPES = '.pdf,.docx,.doc,.txt';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export { ACCEPTED_TYPES, MAX_FILE_SIZE };
