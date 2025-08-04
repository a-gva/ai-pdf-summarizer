import fs from 'fs-extra';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

// PDF.js import
import { calculateTargetWordCount } from '~/utils/calculate-target-word-count';
import { countWords } from '~/utils/count-words';
import { parseArguments } from '~/utils/parse-arguments';
import { processFile } from '~/utils/process-file';
import { readFile } from '~/utils/read-file';
import { measureExecutionTime } from '~/utils/timing';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Simple text-based similarity using TF-IDF-like approach
 */

/**
 * Main function
 */
async function main() {
  await measureExecutionTime(async () => {
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
  }, 'Reduce PDFs');
}

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
