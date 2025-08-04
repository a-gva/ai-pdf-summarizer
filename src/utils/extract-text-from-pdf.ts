import fs from 'fs-extra';

// PDF.js import
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
/**
 * Extract text from PDF using pdfjs-dist
 */
export async function extractTextFromPDF(filePath: string) {
  try {
    const buffer = await fs.readFile(filePath);
    // Convert Buffer to Uint8Array
    const data = new Uint8Array(buffer);
    const doc = await pdfjs.getDocument({ data }).promise;
    let text = '';

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => (item as TextItem).str)
        .join(' ');
      text += pageText + '\n';
    }

    return text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}
