/**
 * Netlify function: proxy Crossway ESV passage text without exposing the API token.
 *
 * GET /.netlify/functions/esv-text?q=John+3:16
 * → { reference, canonicalReference, text }
 */

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' } };
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const q = event.queryStringParameters?.q?.trim();
  if (!q) {
    return json(400, { error: 'Missing q (passage reference)' });
  }

  const token = process.env.ESV_API_TOKEN;
  if (!token) {
    return json(503, {
      error: 'ESV text is not configured (set ESV_API_TOKEN on the server).',
    });
  }

  try {
    const url = new URL('https://api.esv.org/v3/passage/text/');
    url.searchParams.set('q', q);
    url.searchParams.set('include-headings', 'false');
    url.searchParams.set('include-footnotes', 'false');
    url.searchParams.set('include-verse-numbers', 'false');
    url.searchParams.set('include-short-copyright', 'false');
    url.searchParams.set('include-passage-references', 'false');

    const upstream = await fetch(url, {
      headers: { Authorization: `Token ${token}` },
    });

    if (!upstream.ok) {
      return json(
        upstream.status === 401 ? 502 : upstream.status,
        { error: `ESV text request failed (${upstream.status}).` },
      );
    }

    const body = await upstream.json();
    const passages = body.passages ?? [];
    if (passages.length === 0) {
      return json(404, { error: `No ESV passage found for “${q}”.` });
    }

    const text = passages.join(' ').replace(/\s+/g, ' ').trim();
    const canonicalReference =
      typeof body.canonical === 'string' && body.canonical.trim()
        ? body.canonical.trim()
        : q;

    return json(200, {
      reference: q,
      canonicalReference,
      text,
      translation: 'ESV',
    });
  } catch (error) {
    return json(502, {
      error:
        error instanceof Error
          ? `ESV text proxy error: ${error.message}`
          : 'ESV text proxy error',
    });
  }
}
