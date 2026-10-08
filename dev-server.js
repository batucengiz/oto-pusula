const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const files = new Map([
  ['/', ['dashboard.html', 'text/html; charset=utf-8']],
  ['/dashboard.html', ['dashboard.html', 'text/html; charset=utf-8']],
  ['/dashboard.css', ['dashboard.css', 'text/css; charset=utf-8']],
  ['/dashboard.js', ['dashboard.js', 'text/javascript; charset=utf-8']],
  ['/core.js', ['core.js', 'text/javascript; charset=utf-8']]
]);

const server = http.createServer(async (request, response) => {
  const selected = files.get(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!selected) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const body = await fs.readFile(path.join(__dirname, selected[0]));
    response.writeHead(200, { 'Content-Type': selected[1], 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(500); response.end('Server error');
  }
});

server.listen(4173, '127.0.0.1', () => {
  process.stdout.write('Oto Pusula: http://127.0.0.1:4173\n');
});
