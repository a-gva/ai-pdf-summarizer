import fs from 'fs-extra';
import { Ollama } from 'ollama';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

// PDF.js import
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Ollama client
const ollama = new Ollama();

/**
 * Count words in a text
 */
function countWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Calculate target word count based on reduction factor
 */
function calculateTargetWordCount(originalWordCount, reductionFactor = 0.1) {
  return Math.max(100, Math.round(originalWordCount * reductionFactor));
}

function parseArguments() {
  const args = process.argv.slice(2);
  let targetWords = null;
  let reductionFactor = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target-words' && args[i + 1]) {
      targetWords = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--reduction-factor' && args[i + 1]) {
      reductionFactor = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--help') {
      console.log(`
  Usage: node summarizer.js [options]
  
  Options:
    --target-words <number>     Target word count for summary (e.g., 1000, 2000, 5000)
    --reduction-factor <float>  Reduction factor (0.1 = 10%, 0.2 = 20%, etc.)
    --help                      Show this help message
  
  Examples:
    node summarizer.js --target-words 1000
    node summarizer.js --reduction-factor 0.1
    node summarizer.js --target-words 2000
        `);
      process.exit(0);
    }
  }

  return { targetWords, reductionFactor };
}
/**
 * Simple text-based similarity using TF-IDF-like approach
 */
function calculateTextSimilarity(text1, text2) {
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

  const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
  const norm1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
  const norm2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));

  return dotProduct / (norm1 * norm2 + 1e-10);
}

/**
 * Extract text from PDF using pdfjs-dist
 */
async function extractTextFromPDF(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    // Convert Buffer to Uint8Array
    const data = new Uint8Array(buffer);
    const doc = await pdfjs.getDocument({ data }).promise;
    let text = '';

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
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
async function readFile(filePath) {
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
function cleanText(text) {
  const match = text.match(/(Bibliography|References)/i);
  return match ? text.substring(0, match.index) : text;
}

/**
 * Split text into smaller chunks; for RAG, shorter chunks are easier to retrieve
 */
function chunkText(text, maxChunkLength = 2500) {
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
function retrieveRelevantChunks(query, chunks, topK = 3) {
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
  documentText,
  query,
  language = 'português',
  targetWordCount = null
) {
  const cleanedText = cleanText(documentText);
  const chunks = chunkText(cleanedText);
  const originalWordCount = countWords(cleanedText);

  console.log(`Document split into ${chunks.length} chunks.`);
  console.log(`Original document: ${originalWordCount} words`);

  if (targetWordCount) {
    console.log(`Target summary: ${targetWordCount} words`);
  }

  const relevantChunks = retrieveRelevantChunks(query, chunks, 3);
  const context = relevantChunks.join('\n');

  let lengthInstruction = '';
  if (targetWordCount) {
    lengthInstruction = ` O resumo deve ter aproximadamente ${targetWordCount} palavras.`;
  }

  const prompt = `Pergunta: ${query}\n\nContexto:\n${context}\n\nResponda de forma concisa baseado no contexto, em ${language}.${lengthInstruction} Mantenha apenas os pontos mais importantes:`;

  try {
    const response = await ollama.generate({
      model: 'qwen3:4b',
      prompt: prompt,
    });

    const summary = response.response?.trim() || '';
    const summaryWordCount = countWords(summary);
    console.log(`Generated summary: ${summaryWordCount} words`);

    return summary;
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
  filePath,
  outputFolder,
  query,
  language = 'português',
  targetWordCount = null
) {
  try {
    const text = await readFile(filePath);
    const originalWordCount = countWords(text);

    // If targetWordCount is not specified, use a default reduction factor
    const finalTargetWordCount =
      targetWordCount || calculateTargetWordCount(originalWordCount, 0.1);

    const answer = await ragSummarize(
      text,
      query,
      language,
      finalTargetWordCount
    );

    const fileName = path.basename(filePath, path.extname(filePath));
    const outputFile = path.join(outputFolder, `${fileName}_rag_answer.txt`);

    // Add word count info to the output file
    const wordCountInfo = `[Original: ${originalWordCount} words | Summary: ${countWords(answer)} words | Target: ${finalTargetWordCount} words]\n\n`;
    const fullOutput = wordCountInfo + answer;

    await fs.writeFile(outputFile, fullOutput, 'utf-8');
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

  // Parse command line arguments
  const { targetWords, reductionFactor } = parseArguments();

  // Ensure output folder exists
  await fs.ensureDir(outputFolder);

  const query =
    'Resumir os pontos-chave deste documento ou o argumento principal.';
  const language = 'português';

  console.log('\n=== PDF Summarizer with Word Count Control ===');
  if (targetWords) {
    console.log(`Target word count: ${targetWords} words`);
  } else if (reductionFactor) {
    console.log(`Reduction factor: ${reductionFactor * 100}%`);
  } else {
    console.log('Using default reduction factor: 10%');
  }
  console.log('===============================================\n');

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

    // Calculate target word count for this file if using reduction factor
    let fileTargetWords = targetWords;
    if (!targetWords && reductionFactor) {
      const text = await readFile(file);
      const originalWordCount = countWords(text);
      fileTargetWords = calculateTargetWordCount(
        originalWordCount,
        reductionFactor
      );
    }

    const result = await processFile(
      file,
      outputFolder,
      query,
      language,
      fileTargetWords
    );
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
