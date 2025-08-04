import fs from 'fs-extra';
import { Ollama } from 'ollama';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

// PDF.js import
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Ollama client
const ollama = new Ollama();

/**
 * Simple text-based similarity using TF-IDF-like approach
 */
function calculateTextSimilarity(text1: string, text2: string) {
  const words1 = text1
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);
  const words2 = text2
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);

  const allWords = [...new Set([...words1, ...words2])];

  const vector1 = allWords.map(
    (word) => words1.filter((w) => w === word).length
  );
  const vector2 = allWords.map(
    (word) => words2.filter((w) => w === word).length
  );

  const dotProduct = vector1.reduce(
    (sum, val, i) => sum + val * (vector2?.[i] || 0),
    0
  );
  const norm1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
  const norm2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));

  return dotProduct / (norm1 * norm2 + 1e-10);
}

/**
 * Extract text from PDF using pdfjs-dist
 */
async function extractTextFromPDF(filePath: string) {
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

/**
 * Read file content from .txt or .pdf
 */
async function readFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.txt') {
    return await fs.readFile(filePath, 'utf-8');
  } else if (ext === '.pdf') {
    return await extractTextFromPDF(filePath);
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
}

/**
 * Remove sections like 'Bibliography' or 'References' if present
 */
function cleanText(text: string) {
  const match = text.match(/(Bibliography|References)/i);
  return match ? text.substring(0, match.index) : text;
}

/**
 * Split text into smaller chunks; for RAG, shorter chunks are easier to retrieve
 */
function chunkText(text: string, maxChunkLength = 2500) {
  const paragraphs = text.split('\n');
  const chunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 1 > maxChunkLength) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = para + '\n';
    } else {
      currentChunk += para + '\n';
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Retrieve top_k chunks that are most similar to the query using text similarity
 */
function retrieveRelevantChunks(query: string, chunks: string[], topK = 3) {
  const similarities = chunks.map((chunk) => ({
    chunk,
    similarity: calculateTextSimilarity(query, chunk),
  }));

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .map((item) => item.chunk);
}

/**
 * Given a document and a query, retrieve top relevant chunks and use them to prompt the LLM
 */
async function ragSummarize(
  documentText: string,
  query: string,
  language = 'português'
) {
  const cleanedText = cleanText(documentText);
  const chunks = chunkText(cleanedText);
  console.log(`Document split into ${chunks.length} chunks.`);

  const relevantChunks = retrieveRelevantChunks(query, chunks, 3);
  const context = relevantChunks.join('\n');

  const prompt = `Pergunta: ${query}\n\nContexto:\n${context}\n\nResponda de forma concisa baseado no contexto, em ${language}:`;

  try {
    const response = await ollama.generate({
      model: 'qwen3:4b',
      prompt: prompt,
    });
    return response.response?.trim() || '';
  } catch (error) {
    console.error('Error generating response from Ollama:', error);
    return 'Error: Could not generate summary';
  }
}

/**
 * Process a file using RAG: read the file, summarize it,
 * save the summary as a .txt file, and return [filename, summary]
 */
async function processFile(
  filePath: string,
  outputFolder: string,
  query: string,
  language = 'português'
) {
  try {
    const text = await readFile(filePath);
    const answer = await ragSummarize(text, query, language);

    const fileName = path.basename(filePath, path.extname(filePath));
    const outputFile = path.join(outputFolder, `${fileName}_rag_answer.txt`);

    await fs.writeFile(outputFile, answer, 'utf-8');
    console.log(
      `RAG answer for ${path.basename(filePath)} saved to ${outputFile}`
    );

    return [path.basename(filePath), answer];
  } catch (error) {
    console.error(`Error processing ${path.basename(filePath)}:`, error);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  const inputFolder = path.join(__dirname, 'input');
  const outputFolder = path.join(__dirname, 'output_rag');

  // Ensure output folder exists
  await fs.ensureDir(outputFolder);

  const query =
    'Resumir os pontos-chave deste documento ou o argumento principal.';
  const language = 'português';

  // Find all supported files
  const files = [];
  try {
    const dirContents = await fs.readdir(inputFolder);
    for (const file of dirContents) {
      const ext = path.extname(file).toLowerCase();
      if (['.txt', '.pdf'].includes(ext)) {
        files.push(path.join(inputFolder, file));
      }
    }
  } catch (error) {
    console.error('Error reading input folder:', error);
    return;
  }

  if (files.length === 0) {
    console.log('No supported files found in the input folder.');
    return;
  }

  const results = [];
  for (const file of files) {
    console.log(`\nProcessing file: ${path.basename(file)} with RAG.`);
    const result = await processFile(file, outputFolder, query, language);
    if (result) {
      results.push(result);
    }
  }

  if (results.length > 0) {
    // Create Excel file
    const ws = XLSX.utils.aoa_to_sheet([['Filename', 'Summary'], ...results]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Summaries');

    const excelPath = path.join(outputFolder, 'summaries.xlsx');
    XLSX.writeFile(wb, excelPath);
    console.log(`\nAll summaries saved to ${excelPath}`);
  }
}

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
