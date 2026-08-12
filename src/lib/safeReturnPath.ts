/**
 * Allow only same-app relative paths for post-session navigation.
 * Blocks protocol-relative URLs and external schemes.
 */
export function safeReturnPath(
  raw: string | null | undefined,
  fallback = '/quiz',
): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (raw.includes('://')) return fallback;
  return raw;
}
