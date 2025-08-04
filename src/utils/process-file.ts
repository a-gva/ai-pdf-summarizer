import fs from 'fs-extra';
import path from 'path';
import { calculateTargetWordCount } from '~/utils/calculate-target-word-count';
import { countWords } from '~/utils/count-words';
import { ragSummarize } from '~/utils/rag-summarize';
import { readFile } from '~/utils/read-file';

/**
 * Process a file using RAG: read the file, summarize it,
 * save the summary as a .md file, and return [filename, summary]
 */
export async function processFile(
  filePath: string,
  outputFolder: string,
  query: string,
  language = 'português',
  targetWordCount: number | null = null
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
    const outputFile = path.join(outputFolder, `${fileName}_rag_answer.md`);

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
