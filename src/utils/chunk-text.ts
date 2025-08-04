/**
 * Split text into smaller chunks; for RAG, shorter chunks are easier to retrieve
 */
export function chunkText(text: string, maxChunkLength = 2500) {
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
