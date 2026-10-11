import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = resolve('dist');
const port = Number(process.env.PORT || process.argv.find(arg => arg.startsWith('--port='))?.slice(7) || 5175);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid static-server port');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const cache = new Map();
let retainedBytes = 0;
async function file(path) {
  const metadata = await stat(path);
  if (!metadata.isFile()) throw new Error('Not a file');
  const prior = cache.get(path);
  if (prior?.mtime === metadata.mtimeMs) return prior;
  const body = await readFile(path);
  const compressed = /\.(js|css|html|json|f32|u8)$/.test(path) ? gzipSync(body) : null;
  const item = { body, compressed, mtime: metadata.mtimeMs, etag: `"${createHash('sha256').update(body).digest('base64url')}"` };
  if (prior) { retainedBytes -= prior.body.length + (prior.compressed?.length || 0); cache.delete(path); }
  const bytes = body.length + (compressed?.length || 0);
  if (bytes <= 32 * 1024 * 1024) {
    while (cache.size && retainedBytes + bytes > 32 * 1024 * 1024) {
      const oldest = cache.keys().next().value, removed = cache.get(oldest);
      retainedBytes -= removed.body.length + (removed.compressed?.length || 0); cache.delete(oldest);
    }
    cache.set(path, item); retainedBytes += bytes;
  }
  return item;
}

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    const item = await file(path);
    const compressed = item.compressed && /\bgzip\b/.test(request.headers['accept-encoding'] || '');
    const body = compressed ? item.compressed : item.body;
    const headers = { 'Content-Type': types[extname(path)] || 'application/octet-stream',
      'Cache-Control': path.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff', ETag: item.etag, Vary: 'Accept-Encoding' };
    if (request.headers['if-none-match'] === item.etag) { response.writeHead(304, headers); response.end(); return; }
    response.writeHead(200, { ...headers, 'Content-Length': body.length, ...(compressed ? { 'Content-Encoding': 'gzip' } : {}) });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`FRB Atlas production: http://127.0.0.1:${port}/`));
