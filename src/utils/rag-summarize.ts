import { Ollama } from 'ollama';
import { chunkText } from '~/utils/chunk-text';
import { cleanText } from '~/utils/clean-text';
import { countWords } from '~/utils/count-words';
import { retrieveRelevantChunks } from '~/utils/retrieve-relevant-chunks';

// Initialize Ollama client
const ollama = new Ollama();

/**
 * Given a document and a query, retrieve top relevant chunks and use them to prompt the LLM
 */
export async function ragSummarize(
  documentText: string,
  query: string,
  language = 'português',
  targetWordCount: number | null = null
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
      model: 'gemma3:4b',
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
