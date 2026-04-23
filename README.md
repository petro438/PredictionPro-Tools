# Kalshi Volume Dashboard — PredictionPro.com

A live Kalshi market volume dashboard built for embedding on PredictionPro.com via iframe.

## Architecture

```
index.html          ← The dashboard (embed this via iframe on WordPress)
server.js           ← CORS proxy (deploy to Vercel)
cron/
  build-snapshot.js ← Fetches Kalshi API daily, writes data/snapshot.json
data/
  snapshot.json     ← Auto-generated daily by GitHub Actions (gitignored initially)
.github/
  workflows/
    snapshot.yml    ← GitHub Actions cron job
```

## Setup

### 1. Push to GitHub

```bash
cd kalshi-dashboard
git init
git add .
git commit -m "Initial Kalshi dashboard"
git remote add origin https://github.com/petro438/kalshi-dashboard.git
git push -u origin main
```

### 2. Deploy the Proxy to Vercel

The Kalshi API doesn't send CORS headers, so the browser can't hit it directly.
The proxy server handles this.

```bash
npm install -g vercel
vercel --prod
```

Note the Vercel URL (e.g. `https://kalshi-dashboard-abc.vercel.app`).

Add your WordPress domain to the `ALLOWED_ORIGINS` array in `server.js` before deploying.

### 3. Set KALSHI_PROXY_URL in index.html

In `index.html`, find this line near the top of the `<script>` block:

```js
const PROXY_URL = (window.KALSHI_PROXY_URL || '').replace(/\/$/, '');
```

You can either:
- **Hardcode it**: replace with `const PROXY_URL = 'https://your-vercel-app.vercel.app';`
- **Set it via WordPress**: add `<script>window.KALSHI_PROXY_URL = 'https://...'</script>` before the iframe

### 4. Enable GitHub Actions for Daily Snapshots

The snapshot cron runs daily at 6 AM ET. It fetches live data and commits
`data/snapshot.json` back to the repo. This powers:
- The dashboard fallback if the live proxy is down
- Historical weekly rollup data for the stacked bar chart

Make sure your repo has **Actions enabled** in GitHub Settings → Actions.

### 5. Embed on WordPress

Add a Custom HTML block on your PredictionPro page:

```html
<script>
  window.KALSHI_PROXY_URL = 'https://your-vercel-app.vercel.app';
</script>
<iframe
  src="https://petro438.github.io/kalshi-dashboard/index.html"
  width="100%"
  height="900"
  frameborder="0"
  scrolling="no"
  style="border:none;"
></iframe>
```

Or host `index.html` on GitHub Pages (Settings → Pages → deploy from main branch).

## Local Development

```bash
# Run the proxy
node server.js
# → http://localhost:3001

# In index.html, set:
const PROXY_URL = 'http://localhost:3001';

# Build a snapshot manually
node cron/build-snapshot.js
```

## Data Sources

- **Live data**: `GET /trade-api/v2/markets` — public, no auth required
- **Base URL**: `https://api.elections.kalshi.com/trade-api/v2`
- **Rate limits**: No documented public limit; snapshot cron runs once/day

## Notes

- Volume figures are **notional** (contracts × price), not raw contract counts
- Sports sub-breakdown uses keyword matching on market titles — add keywords in `build-snapshot.js` as new sports markets appear
- The Kalshi API doesn't expose historical daily/weekly volume — the GitHub Actions cron builds this over time by appending daily snapshots
- Unique traders is not available in the public API and shows `—`
