import { calculateTextSimilarity } from '~/utils/calculate-text-similarity';

/**
 * Retrieve top_k chunks that are most similar to the query using text similarity
 */
export function retrieveRelevantChunks(
  query: string,
  chunks: string[],
  topK = 3
) {
  const similarities = chunks.map((chunk) => ({
    chunk,
    similarity: calculateTextSimilarity(query, chunk),
  }));

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .map((item) => item.chunk);
}
