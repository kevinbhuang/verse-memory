export type EsvPassageText = {
  reference: string;
  canonicalReference: string;
  text: string;
  translation: 'ESV';
};

/**
 * Fetch ESV passage text via the same-origin proxy (Vite / Netlify).
 * The API token never enters the browser bundle.
 */
export async function fetchPassageText(
  reference: string,
): Promise<EsvPassageText> {
  const trimmed = reference.trim();
  if (!trimmed) {
    throw new Error('Enter a verse reference (for example, John 3:16).');
  }

  const response = await fetch(
    `/api/esv-text?q=${encodeURIComponent(trimmed)}`,
  );
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    reference?: string;
    canonicalReference?: string;
    text?: string;
    translation?: 'ESV';
  };

  if (!response.ok) {
    throw new Error(body.error ?? `Could not fetch “${trimmed}”.`);
  }

  if (!body.text?.trim() || !body.canonicalReference?.trim()) {
    throw new Error(`No ESV passage found for “${trimmed}”.`);
  }

  return {
    reference: body.reference?.trim() || trimmed,
    canonicalReference: body.canonicalReference.trim(),
    text: body.text.trim(),
    translation: 'ESV',
  };
}
