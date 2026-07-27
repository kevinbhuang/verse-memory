import fs from 'node:fs';
import type { Plugin } from 'vite';

/**
 * Vite/Vitest plugin: import './file.ttf?base64' → default export base64 string.
 */
export function ttfBase64Plugin(): Plugin {
  return {
    name: 'ttf-base64',
    enforce: 'pre',
    load(id) {
      const queryIndex = id.indexOf('?');
      if (queryIndex === -1) return null;
      const filePath = id.slice(0, queryIndex);
      const query = id.slice(queryIndex + 1);
      if (!filePath.endsWith('.ttf') || !query.split('&').includes('base64')) {
        return null;
      }
      const base64 = fs.readFileSync(filePath).toString('base64');
      return `export default ${JSON.stringify(base64)};`;
    },
  };
}
