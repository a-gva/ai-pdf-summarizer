/**
 * Remove sections like 'Bibliography' or 'References' if present
 */
export function cleanText(text: string) {
  const match = text.match(/(Bibliography|References)/i);
  return match ? text.substring(0, match.index) : text;
}
