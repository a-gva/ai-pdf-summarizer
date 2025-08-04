export function calculateTextSimilarity(text1: string, text2: string) {
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
