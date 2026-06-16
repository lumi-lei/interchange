import path from 'node:path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import readSheet from 'read-excel-file/node';

export type ParsedInput = {
  sourceType: string;
  filename: string;
  text: string;
};

const imageExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif']);
const excelExts = new Set(['.xlsx', '.xls', '.xlsm', '.csv']);
const textExts = new Set(['.txt', '.md', '.markdown', '.json', '.log']);

export async function parseUploadedFile(file: Express.Multer.File): Promise<ParsedInput> {
  const filename = file.originalname ?? 'upload';
  const ext = path.extname(filename).toLowerCase();

  if (textExts.has(ext) || file.mimetype.startsWith('text/')) {
    return { sourceType: 'text', filename, text: file.buffer.toString('utf8') };
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return { sourceType: 'word', filename, text: result.value.trim() };
  }

  if (ext === '.pdf') {
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      return { sourceType: 'pdf', filename, text: result.text.trim() };
    } finally {
      await parser.destroy();
    }
  }

  if (excelExts.has(ext)) {
    if (ext === '.csv') {
      return { sourceType: 'excel', filename, text: file.buffer.toString('utf8').trim() };
    }
    if (ext === '.xls') {
      const error = new Error('Legacy .xls files are not supported yet. Please save the spreadsheet as .xlsx or .csv.');
      Object.assign(error, { status: 415 });
      throw error;
    }
    const rows = await readSheet(file.buffer);
    const text = rows
      .map((row: unknown[]) => row.map((cell: unknown) => String(cell ?? '')).join(','))
      .join('\n');
    return { sourceType: 'excel', filename, text: text.trim() };
  }

  if (imageExts.has(ext) || file.mimetype.startsWith('image/')) {
    const worker = await createWorker('eng+chi_sim');
    try {
      const result = await worker.recognize(file.buffer);
      return { sourceType: 'image', filename, text: result.data.text.trim() };
    } finally {
      await worker.terminate();
    }
  }

  const error = new Error(`Unsupported file type: ${ext || file.mimetype}`);
  Object.assign(error, { status: 415 });
  throw error;
}
