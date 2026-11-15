import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wav': 'audio/wav', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const path = resolve(root, '.' + name);
    const parts = name.split('/');
    if (!path.startsWith(root + sep) || parts.some(part => part.startsWith('.')) || !['.html', '.css', '.js', '.mjs', '.wav', '.svg'].includes(extname(path))) {
      res.writeHead(403).end('Forbidden'); return;
    }
    res.writeHead(200, { 'Content-Type': mime[extname(path)], 'Cache-Control': 'no-store' });
    res.end(await readFile(path));
  } catch { if (!res.headersSent) res.writeHead(404); res.end('Not found'); }
});
server.listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
