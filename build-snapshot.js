/**
 * cron/build-snapshot.js
 * 
 * Fetches live Kalshi market data and writes data/snapshot.json
 * Run by GitHub Actions daily, or locally with: node cron/build-snapshot.js
 * 
 * The snapshot powers:
 *  1. The dashboard fallback when the proxy is unavailable
 *  2. Historical weekly rollups for the stacked bar chart
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

const CAT_MAP = {
  'Sports': 'Sports', 'Politics': 'Politics',
  'Crypto': 'Crypto', 'Cryptocurrency': 'Crypto',
  'Economics': 'Economics', 'Economic': 'Economics',
  'Financials': 'Financials', 'Finance': 'Financials',
  'Entertainment': 'Entertainment',
  'Climate': 'Other', 'Science': 'Other', 'Technology': 'Other',
  'Health': 'Other', 'World': 'Other', 'Education': 'Other',
  'Transportation': 'Other',
};

const CAT_COLORS = {
  Sports: '#1a3aff', Politics: '#6741D9', Crypto: '#E8590C',
  Economics: '#2F9E44', Financials: '#1971C2', Entertainment: '#F08C00', Other: '#adb5bd',
};

const SPORT_KEYWORDS = {
  NFL:    ['nfl','football','super bowl','chiefs','eagles','patriots','cowboys'],
  NBA:    ['nba','basketball','celtics','lakers','warriors','heat','knicks'],
  MLB:    ['mlb','baseball','world series','dodgers','yankees','mets'],
  Golf:   ['golf','masters','pga','lpga','ryder cup','mcilroy'],
  NHL:    ['nhl','hockey','stanley cup','oilers','bruins','rangers'],
  Soccer: ['soccer','mls','premier league','world cup','champions league'],
  Tennis: ['tennis','wimbledon','us open','french open','australian open'],
};

function get(urlStr) {
  return new Promise((resolve, reject) => {
    https.get(urlStr, { headers: { 'Accept': 'application/json', 'User-Agent': 'PredictionPro-Cron/1.0' } }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('JSON parse error: ' + body.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

async function fetchAllMarkets() {
  let all = [], cursor = '', page = 0;
  do {
    const qs = `limit=1000&status=open${cursor ? '&cursor=' + cursor : ''}`;
    const data = await get(`${KALSHI_BASE}/markets?${qs}`);
    all = all.concat(data.markets || []);
    cursor = data.cursor || '';
    page++;
    console.log(`  Page ${page}: ${all.length} markets so far`);
  } while (cursor && page < 10);
  return all;
}

function processMarkets(markets) {
  const catVol = {}, catOI = {}, catTxn = {}, catMktCount = {};
  const sportVol = {}, sportTxn = {};
  ['Sports','Politics','Crypto','Economics','Financials','Entertainment','Other'].forEach(c => {
    catVol[c] = 0; catOI[c] = 0; catTxn[c] = 0; catMktCount[c] = 0;
  });
  Object.keys(SPORT_KEYWORDS).forEach(s => { sportVol[s] = 0; sportTxn[s] = 0; });
  sportVol['Other'] = 0; sportTxn['Other'] = 0;

  let totalVol = 0, totalOI = 0, totalTxn = 0;
  const topMkts = [];

  markets.forEach(m => {
    const notional = parseFloat(m.notional_value_dollars || 0.5);
    const vol = notional * parseFloat(m.volume_fp || 0);
    const oi = parseFloat(m.open_interest_fp || 0) * notional;
    const txn = parseInt(m.volume_fp || 0);
    const cat = CAT_MAP[m.category] || 'Other';

    totalVol += vol; totalOI += oi; totalTxn += txn;
    catVol[cat] = (catVol[cat] || 0) + vol;
    catOI[cat] = (catOI[cat] || 0) + oi;
    catTxn[cat] = (catTxn[cat] || 0) + txn;
    catMktCount[cat] = (catMktCount[cat] || 0) + 1;

    if (cat === 'Sports') {
      const t = (m.title || '').toLowerCase();
      let hit = false;
      for (const [sport, kws] of Object.entries(SPORT_KEYWORDS)) {
        if (kws.some(kw => t.includes(kw))) {
          sportVol[sport] += vol; sportTxn[sport] += txn; hit = true; break;
        }
      }
      if (!hit) { sportVol['Other'] += vol; sportTxn['Other'] += txn; }
    }

    topMkts.push({
      name: m.title || m.ticker, ticker: m.ticker,
      cat, color: CAT_COLORS[cat] || '#adb5bd',
      vol, txn,
      vol24h: parseFloat(m.volume_24h_fp || 0) * notional,
    });
  });

  topMkts.sort((a, b) => b.vol - a.vol);

  return {
    totalVol, totalOI, totalTxn, totalMarkets: markets.length,
    catVol, catOI, catTxn, catMktCount,
    sportVol, sportTxn,
    topMarkets: topMkts.slice(0, 20),
    // Single-bar chart data (current period only — weekly rollups require historical cron)
    weeklyLabels: [new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })],
    weeklyVol: Object.fromEntries(
      Object.keys(CAT_COLORS).map(cat => [cat, [catVol[cat] || 0]])
    ),
  };
}

async function loadExistingSnapshot() {
  const snapPath = path.join(__dirname, '../data/snapshot.json');
  try {
    const raw = fs.readFileSync(snapPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildWeeklyHistory(current, existing) {
  if (!existing) return current;

  // Append today's data to existing weekly series (keep last 12 weeks)
  const label = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const labels = [...(existing.weeklyLabels || []), label].slice(-12);
  const weeklyVol = {};
  Object.keys(CAT_COLORS).forEach(cat => {
    const prev = existing.weeklyVol?.[cat] || [];
    weeklyVol[cat] = [...prev, current.catVol[cat] || 0].slice(-12);
  });

  return { ...current, weeklyLabels: labels, weeklyVol, prior: {
    totalVol: existing.totalVol,
    totalOI: existing.totalOI,
    totalMarkets: existing.totalMarkets,
    cachedAt: existing.cachedAt,
  }};
}

async function main() {
  console.log('Building Kalshi snapshot…');
  console.log('Fetching markets from Kalshi API…');

  const markets = await fetchAllMarkets();
  console.log(`Total markets fetched: ${markets.length}`);

  const processed = processMarkets(markets);
  const existing = await loadExistingSnapshot();
  const snapshot = buildWeeklyHistory(processed, existing);

  snapshot.cachedAt = new Date().toISOString();
  snapshot.marketCount = markets.length;

  // Ensure data directory exists
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const snapPath = path.join(dataDir, 'snapshot.json');
  fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot written to ${snapPath}`);
  console.log(`  Total volume: $${(snapshot.totalVol / 1e9).toFixed(2)}B`);
  console.log(`  Active markets: ${snapshot.totalMarkets}`);
  console.log(`  Top market: ${snapshot.topMarkets[0]?.name}`);
}

main().catch(err => {
  console.error('Snapshot build failed:', err);
  process.exit(1);
});
