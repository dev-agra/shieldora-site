'use strict';
// Local-only server that mimics Vercel: static files + /api/* functions. Run: node dev-server.js
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
try {
  for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname.startsWith('/api/')) {
    const file = path.join(root, u.pathname + '.js');
    if (!file.startsWith(path.join(root, 'api')) || u.pathname.includes('/_lib') || !fs.existsSync(file)) { res.statusCode = 404; return res.end('{"error":"Not found"}'); }
    let raw = ''; for await (const c of req) raw += c;
    req.query = Object.fromEntries(u.searchParams);
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    try { return await require(file)(req, res); } catch (e) { console.error(e); res.statusCode = 500; return res.end('{"error":"Server error"}'); }
  }
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith('/')) p += 'index.html';
  if (p === '/admin') { res.statusCode = 301; res.setHeader('Location', '/admin/'); return res.end(); }
  const f = path.join(root, p);
  if (!f.startsWith(root) || /[\/](api|\.data)[\/]|\.env|dev-server/.test(p) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
}).listen(process.env.PORT || 8123, () => console.log('http://localhost:' + (process.env.PORT || 8123)));
