/**
 * Split pasted input into individual Bible references.
 * Accepts newlines, semicolons, or commas before a new book name
 * (so "John 3:16, Romans 8:28" works; "Matthew 5:3,4" stays one item).
 */
export function parseReferenceList(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const parts = normalized.split(
    /[\n;]+|,\s*(?=(?:[1-3]\s+)?[A-Za-z])/,
  );

  const seen = new Set<string>();
  const results: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim().replace(/,+$/, '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(trimmed);
  }
  return results;
}
