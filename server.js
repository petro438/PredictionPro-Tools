/**
 * Kalshi Dashboard — Proxy Server
 * 
 * Proxies requests to the Kalshi API to avoid CORS issues in the browser.
 * Deploy to Vercel (vercel.json included) or run locally with `node server.js`
 * 
 * Local dev:  node server.js        → http://localhost:3001
 * Production: deploy to Vercel, set KALSHI_PROXY_URL in your HTML to the Vercel URL
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3001;
const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

// Allowed origins — add your WordPress domain here
const ALLOWED_ORIGINS = [
  'https://predictionpro.com',
  'https://www.predictionpro.com',
  'http://localhost:3000',
  'http://localhost:8080',
  'null', // for file:// testing
];

function setCORSHeaders(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=300'); // 5 min cache
}

function proxyRequest(targetPath, res) {
  const targetUrl = KALSHI_BASE + targetPath;
  console.log('[proxy]', targetUrl);

  https.get(targetUrl, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'PredictionPro-Dashboard/1.0',
    }
  }, (apiRes) => {
    let body = '';
    apiRes.on('data', chunk => body += chunk);
    apiRes.on('end', () => {
      res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
      res.end(body);
    });
  }).on('error', (err) => {
    console.error('[proxy error]', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upstream API error', message: err.message }));
  });
}

const server = http.createServer((req, res) => {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;

  // Route: /api/kalshi/markets
  if (path === '/api/kalshi/markets') {
    const qs = new URLSearchParams(parsed.query).toString();
    proxyRequest(`/markets${qs ? '?' + qs : ''}`, res);
    return;
  }

  // Route: /api/kalshi/exchange/status
  if (path === '/api/kalshi/exchange/status') {
    proxyRequest('/exchange/status', res);
    return;
  }

  // Route: /api/kalshi/events (optional — for event-level data)
  if (path === '/api/kalshi/events') {
    const qs = new URLSearchParams(parsed.query).toString();
    proxyRequest(`/events${qs ? '?' + qs : ''}`, res);
    return;
  }

  // Health check
  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ts: new Date().toISOString() }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Kalshi proxy running on http://localhost:${PORT}`);
  console.log(`Test: http://localhost:${PORT}/api/kalshi/markets?limit=10&status=open`);
});
