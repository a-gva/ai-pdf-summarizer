import fs from 'fs-extra';
import path from 'path';

// PDF.js import
import { extractTextFromPDF } from '~/utils/extract-text-from-pdf';
/**
 * Read file content from .txt or .pdf
 */
export async function readFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.txt') {
    return await fs.readFile(filePath, 'utf-8');
  } else if (ext === '.pdf') {
    return await extractTextFromPDF(filePath);
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
}
