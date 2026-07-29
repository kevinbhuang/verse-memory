/**
 * Netlify function: proxy Crossway ESV passage audio without exposing the API token.
 *
 * GET /.netlify/functions/esv-audio?q=John+3:16
 * → 302 to the official MP3 (or 503 if ESV_API_TOKEN is unset)
 */
export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' } };
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const q = event.queryStringParameters?.q?.trim();
  if (!q) {
    return { statusCode: 400, body: 'Missing q (passage reference)' };
  }

  const token = process.env.ESV_API_TOKEN;
  if (!token) {
    return {
      statusCode: 503,
      body: 'ESV audio is not configured (set ESV_API_TOKEN on the server).',
    };
  }

  try {
    const upstream = await fetch(
      `https://api.esv.org/v3/passage/audio/?q=${encodeURIComponent(q)}`,
      {
        headers: { Authorization: `Token ${token}` },
        redirect: 'manual',
      },
    );

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get('location');
      if (!location) {
        return { statusCode: 502, body: 'ESV audio redirect missing Location.' };
      }
      return {
        statusCode: 302,
        headers: {
          Location: location,
          'Cache-Control': 'public, max-age=86400',
        },
      };
    }

    if (!upstream.ok) {
      return {
        statusCode: upstream.status === 401 ? 502 : upstream.status,
        body: `ESV audio request failed (${upstream.status}).`,
      };
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
      body: bytes.toString('base64'),
    };
  } catch (error) {
    return {
      statusCode: 502,
      body:
        error instanceof Error
          ? `ESV audio proxy error: ${error.message}`
          : 'ESV audio proxy error',
    };
  }
}
