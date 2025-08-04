import fs from 'fs-extra';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { processFile } from '~/utils/process-file';

// PDF.js import
import { measureExecutionTime } from '~/utils/timing';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main function
 */
async function main() {
  await measureExecutionTime(async () => {
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
  }, 'Summarize PDFs');
}

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
