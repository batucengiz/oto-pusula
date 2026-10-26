const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const files = new Map([
  ['/', ['dashboard.html', 'text/html; charset=utf-8']],
  ['/dashboard.html', ['dashboard.html', 'text/html; charset=utf-8']],
  ['/dashboard.css', ['dashboard.css', 'text/css; charset=utf-8']],
  ['/theme.css', ['theme.css', 'text/css; charset=utf-8']],
  ['/favicon.ico', ['icons/icon32.png', 'image/png']],
  ['/popup.html', ['popup.html', 'text/html; charset=utf-8']],
  ['/popup.css', ['popup.css', 'text/css; charset=utf-8']],
  ['/popup-theme.css', ['popup-theme.css', 'text/css; charset=utf-8']],
  ['/chat.css', ['chat.css', 'text/css; charset=utf-8']],
  ['/negotiation.css', ['negotiation.css', 'text/css; charset=utf-8']],
  ['/ai-setup.html', ['ai-setup.html', 'text/html; charset=utf-8']],
  ['/ai-setup.css', ['ai-setup.css', 'text/css; charset=utf-8']],
  ['/ai-setup.js', ['ai-setup.js', 'text/javascript; charset=utf-8']],
  ['/remote-ai.js', ['remote-ai.js', 'text/javascript; charset=utf-8']],
  ['/dashboard-ui.js', ['dashboard-ui.js', 'text/javascript; charset=utf-8']],
  ['/dashboard.js', ['dashboard.js', 'text/javascript; charset=utf-8']],
  ['/core-records.js', ['core-records.js', 'text/javascript; charset=utf-8']],
  ['/core-csv.js', ['core-csv.js', 'text/javascript; charset=utf-8']],
  ['/core-price.js', ['core-price.js', 'text/javascript; charset=utf-8']],
  ['/core-limits.js', ['core-limits.js', 'text/javascript; charset=utf-8']],
  ['/negotiation.js', ['negotiation.js', 'text/javascript; charset=utf-8']],
  ['/core-deal.js', ['core-deal.js', 'text/javascript; charset=utf-8']],
  ['/core.js', ['core.js', 'text/javascript; charset=utf-8']],
  ['/store.js', ['store.js', 'text/javascript; charset=utf-8']],
  ['/open-gate.js', ['open-gate.js', 'text/javascript; charset=utf-8']],
  ['/alerts.js', ['alerts.js', 'text/javascript; charset=utf-8']],
  ['/alerts-ui.js', ['alerts-ui.js', 'text/javascript; charset=utf-8']],
  ['/listing.js', ['listing.js', 'text/javascript; charset=utf-8']],
  ['/charts.js', ['charts.js', 'text/javascript; charset=utf-8']],
  ['/price-timeline.js', ['price-timeline.js', 'text/javascript; charset=utf-8']],
  ['/price-timeline.css', ['price-timeline.css', 'text/css; charset=utf-8']],
  ['/flip.js', ['flip.js', 'text/javascript; charset=utf-8']],
  ['/flip.css', ['flip.css', 'text/css; charset=utf-8']],
  ['/xlsx.js', ['xlsx.js', 'text/javascript; charset=utf-8']],
  ['/popup.js', ['popup.js', 'text/javascript; charset=utf-8']],
  ['/report.html', ['report.html', 'text/html; charset=utf-8']],
  ['/report.css', ['report.css', 'text/css; charset=utf-8']],
  ['/report.js', ['report.js', 'text/javascript; charset=utf-8']],
  ['/report-page.js', ['report-page.js', 'text/javascript; charset=utf-8']],
  ['/theme-mode.js', ['theme-mode.js', 'text/javascript; charset=utf-8']],
  ['/icons/icon16.png', ['icons/icon16.png', 'image/png']],
  ['/icons/icon32.png', ['icons/icon32.png', 'image/png']],
  ['/icons/icon48.png', ['icons/icon48.png', 'image/png']],
  ['/icons/icon128.png', ['icons/icon128.png', 'image/png']]
]);

const server = http.createServer(async (request, response) => {
  const selected = files.get(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!selected) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  try {
    const body = await fs.readFile(path.join(__dirname, selected[0]));
    response.writeHead(200, { 'Content-Type': selected[1], 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(500);
    response.end('Server error');
  }
});

server.listen(4173, '127.0.0.1', () => {
  process.stdout.write('Oto Pusula: http://127.0.0.1:4173\n');
});
