/**
 * kalshi-dashboard.js
 * Loaded by WordPress via wp_enqueue_script after Chart.js.
 * Config (proxyUrl, cacheFile) injected via wp_localize_script as window.KalshiConfig.
 */
(function () {
  'use strict';

  // ── Config from WordPress ──────────────────────────────────────────────
  const cfg = window.KalshiConfig || {};
  const PROXY_URL  = (cfg.proxyUrl  || '').replace(/\/$/, '');
  const CACHE_FILE = cfg.cacheFile  || '';

  // ── Category config ────────────────────────────────────────────────────
  const CAT_CFG = {
    Sports:        '#1a3aff',
    Politics:      '#6741D9',
    Crypto:        '#E8590C',
    Economics:     '#2F9E44',
    Financials:    '#1971C2',
    Entertainment: '#F08C00',
    Other:         '#adb5bd',
  };

  const CAT_MAP = {
    Sports:'Sports', Politics:'Politics',
    Crypto:'Crypto', Cryptocurrency:'Crypto',
    Economics:'Economics', Economic:'Economics',
    Financials:'Financials', Finance:'Financials',
    Entertainment:'Entertainment',
    Climate:'Other', Science:'Other', Technology:'Other',
    Health:'Other', World:'Other', Education:'Other', Transportation:'Other',
  };

  const SPORT_KW = {
    NFL:    ['nfl','football','super bowl','chiefs','eagles','patriots','cowboys'],
    NBA:    ['nba','basketball','celtics','lakers','warriors','heat','knicks'],
    MLB:    ['mlb','baseball','world series','dodgers','yankees','mets'],
    Golf:   ['golf','masters','pga','lpga','ryder cup','mcilroy'],
    NHL:    ['nhl','hockey','stanley cup','oilers','bruins','rangers'],
    Soccer: ['soccer','mls','premier league','world cup','champions league'],
    Tennis: ['tennis','wimbledon','us open','french open','australian open'],
  };

  // ── State ──────────────────────────────────────────────────────────────
  let stackChart = null;
  let liveData   = null;
  let volMode    = 'notional';

  // ── Utils ──────────────────────────────────────────────────────────────
  function fmtV(v) {
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
    return '$' + Math.round(v);
  }
  function fmtT(v) {
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
    return String(v);
  }
  function fmtPct(a, b) {
    if (!b) return '—';
    const p = ((a - b) / b) * 100;
    return (p >= 0 ? '↑ ' : '↓ ') + Math.abs(p).toFixed(1) + '%';
  }
  function el(id) { return document.getElementById(id); }

  function setState(type, msg) {
    const bar = el('kd-state-bar');
    if (!bar) return;
    bar.className = 'kd-state-bar kd-' + type;
    bar.innerHTML = type === 'loading'
      ? '<div class="kd-spinner"></div><span>' + msg + '</span>'
      : '<span>' + msg + '</span>';
  }

  function drawSpark(id, vals, up) {
    const canvas = el(id);
    if (!canvas || !vals || vals.length < 2) return;
    canvas.width = 40; canvas.height = 12;
    const ctx = canvas.getContext('2d');
    const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
    ctx.strokeStyle = up ? '#2f9e44' : '#c92a2a';
    ctx.lineWidth = 1.2; ctx.beginPath();
    vals.forEach((v, i) => {
      const x = (i / (vals.length - 1)) * 38 + 1;
      const y = 10 - ((v - mn) / rng) * 8;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // ── API fetch ──────────────────────────────────────────────────────────
  async function fetchMarkets(params) {
    const qs = new URLSearchParams({ limit: 1000, status: 'open', ...params }).toString();
    if (PROXY_URL) {
      const r = await fetch(PROXY_URL + '/api/kalshi/markets?' + qs);
      if (!r.ok) throw new Error('Proxy ' + r.status);
      return r.json();
    }
    if (CACHE_FILE) {
      const r = await fetch(CACHE_FILE);
      if (!r.ok) throw new Error('Cache unavailable');
      return r.json();
    }
    throw new Error('No PROXY_URL configured. Define KALSHI_PROXY_URL in wp-config.php.');
  }

  function inferCategory(title, ticker) {
    const t = title.toLowerCase();
    const tk = ticker.toUpperCase();
    if (tk.startsWith('KXNBA') || tk.startsWith('KXNFL') || tk.startsWith('KXMLB') ||
        tk.startsWith('KXNHL') || tk.startsWith('KXPGA') || tk.startsWith('KXSOC') ||
        tk.startsWith('KXTEN') || tk.startsWith('KXNCAA') || tk.startsWith('KXMMA') ||
        t.includes('nba') || t.includes('nfl') || t.includes('mlb') ||
        t.includes('nhl') || t.includes('golf') || t.includes('soccer') ||
        t.includes('tennis') || t.includes('playoff') || t.includes('championship')) {
      return 'Sports';
    }
    if (tk.startsWith('KXBTC') || tk.startsWith('KXETH') || t.includes('bitcoin') ||
        t.includes('crypto') || t.includes('ethereum')) return 'Crypto';
    if (t.includes('fed') || t.includes('gdp') || t.includes('inflation') ||
        t.includes('unemployment') || t.includes('jobs') || t.includes('cpi')) return 'Economics';
    if (t.includes('election') || t.includes('president') || t.includes('congress') ||
        t.includes('senate') || t.includes('trump') || t.includes('bill passes')) return 'Politics';
    return 'Other';
  }
  
  
  // ── Data processing ────────────────────────────────────────────────────
  function processMarkets(markets) {
    // Filter out MVE combo markets — they have comma-separated titles,
    // start with "yes ", have no real category, and zero volume
    const clean = markets.filter(m => {
      const title = m.title || '';
      const isMVE = title.startsWith('yes ') && title.includes(',');
      const hasVolume = parseFloat(m.volume_fp || 0) > 0;
      return !isMVE; // keep all non-MVE, even zero volume (they're real markets)
    });
  
    const catVol = {}, catTxn = {}, catOI = {};
    const sportVol = {}, sportTxn = {};
    Object.keys(CAT_CFG).forEach(c => { catVol[c] = 0; catTxn[c] = 0; catOI[c] = 0; });
    Object.keys(SPORT_KW).forEach(s => { sportVol[s] = 0; sportTxn[s] = 0; });
    sportVol['Other'] = 0; sportTxn['Other'] = 0;
  
    let totalVol = 0, totalTxn = 0, totalOI = 0;
    const tops = [];
  
    clean.forEach(m => {
      // volume_fp is number of contracts (in fractional shares)
      // notional_value_dollars is the $1 max payout per contract
      // actual dollar volume = contracts × avg_price (approx 0.5 if unknown)
      const contracts = parseFloat(m.volume_fp || 0);
      const lastPrice = parseFloat(m.last_price_dollars || 0.5);
      const vol = contracts * lastPrice;
      const txn = Math.round(contracts);
      const oi  = parseFloat(m.open_interest_fp || 0) * lastPrice;
  
      // Category — try several field names Kalshi uses
      const rawCat = m.category || m.series_category || '';
      const cat = CAT_MAP[rawCat] || inferCategory(m.title || '', m.event_ticker || '');
  
      totalVol += vol; totalTxn += txn; totalOI += oi;
      catVol[cat]  = (catVol[cat]  || 0) + vol;
      catTxn[cat]  = (catTxn[cat]  || 0) + txn;
      catOI[cat]   = (catOI[cat]   || 0) + oi;
  
      if (cat === 'Sports') {
        const t = (m.title || '').toLowerCase();
        let hit = false;
        for (const [s, kws] of Object.entries(SPORT_KW)) {
          if (kws.some(k => t.includes(k))) {
            sportVol[s] += vol; sportTxn[s] += txn; hit = true; break;
          }
        }
        if (!hit) { sportVol['Other'] += vol; sportTxn['Other'] += txn; }
      }
  
      if (contracts > 0) {
        tops.push({ name: m.title || m.ticker, cat, color: CAT_CFG[cat] || '#adb5bd', vol, txn });
      }
    });
  
    tops.sort((a, b) => b.vol - a.vol);
  
    return {
      totalVol, totalTxn, totalOI, totalMarkets: clean.length,
      catVol, catTxn, catOI, sportVol, sportTxn,
      topMarkets: tops.slice(0, 16),
      weeklyLabels: [new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })],
      weeklyVol: Object.fromEntries(Object.keys(CAT_CFG).map(c => [c, [catVol[c] || 0]])),
    };
  }
  

  // ── Render ─────────────────────────────────────────────────────────────
  function buildLegend() {
    const container = el('kd-legend');
    if (!container) return;
    container.innerHTML = Object.entries(CAT_CFG).map(([name, color]) =>
      `<span class="kd-leg-item"><span class="kd-leg-dot" style="background:${color}"></span>${name}</span>`
    ).join('');
  }

  function buildStackChart(data) {
    const canvas = el('kd-stack-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (stackChart) stackChart.destroy();

    const isN = volMode === 'notional';
    const labels = data.weeklyLabels || ['Now'];
    const datasets = Object.entries(CAT_CFG).map(([name, color]) => ({
      label: name,
      data: data.weeklyVol?.[name] || [data.catVol?.[name] || 0],
      backgroundColor: color,
      stack: 's',
    }));

    stackChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index', intersect: false,
            backgroundColor: '#fff', borderColor: '#dee2e6', borderWidth: 1,
            titleColor: '#495057', titleFont: { family: 'Inter,sans-serif', size: 10, weight: '600' },
            bodyColor: '#1a1a2e', bodyFont: { family: 'IBM Plex Mono,monospace', size: 9 },
            padding: 8,
            callbacks: {
              label(c) {
                const v = c.parsed.y;
                const tot = datasets.reduce((s, d) => s + (d.data[c.dataIndex] || 0), 0) || 1;
                const pct = ((v / tot) * 100).toFixed(1);
                return ' ' + c.dataset.label + ': ' + (isN ? fmtV(v) : fmtT(v) + ' txn') + ' (' + pct + '%)';
              },
              footer(items) {
                const tot = datasets.reduce((s, d) => s + (d.data[items[0].dataIndex] || 0), 0);
                return 'Total: ' + (isN ? fmtV(tot) : fmtT(tot) + ' txn');
              },
            },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: '#adb5bd', font: { family: 'IBM Plex Mono,monospace', size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: { stacked: true, grid: { color: '#f1f3f5' }, border: { display: false }, ticks: { color: '#adb5bd', font: { family: 'IBM Plex Mono,monospace', size: 8 }, callback: v => isN ? fmtV(v) : fmtT(v) } },
        },
      },
    });
  }

  function buildMetrics(data) {
    el('kd-mv1').textContent = fmtV(data.totalVol);
    el('kd-mv2').textContent = fmtV(data.totalOI);
    el('kd-mv3').textContent = data.totalMarkets.toLocaleString();

    if (data.prior) {
      const setD = (valId, deltaId, prevId, curr, prev) => {
        el(valId); // already set above
        const pct = fmtPct(curr, prev);
        el(deltaId).textContent = pct;
        el(deltaId).className = 'kd-m-d ' + (curr >= prev ? 'kd-up' : 'kd-dn');
        el(prevId).textContent = fmtV(prev);
      };
      setD('kd-mv1', 'kd-md1', 'kd-mp1', data.totalVol,     data.prior.totalVol);
      setD('kd-mv2', 'kd-md2', 'kd-mp2', data.totalOI,      data.prior.totalOI);
      setD('kd-mv3', 'kd-md3', 'kd-mp3', data.totalMarkets, data.prior.totalMarkets);
      drawSpark('kd-sp1', data.sparkVol     || [data.prior.totalVol, data.totalVol],     data.totalVol > data.prior.totalVol);
      drawSpark('kd-sp2', data.sparkOI      || [data.prior.totalOI, data.totalOI],       data.totalOI  > data.prior.totalOI);
      drawSpark('kd-sp3', data.sparkMarkets || [data.prior.totalMarkets, data.totalMarkets], true);
    } else {
      ['kd-md1','kd-md2','kd-md3'].forEach(id => { el(id).textContent = '—'; el(id).className = 'kd-m-d'; });
    }
  }

  function buildCats(data) {
    const isN = volMode === 'notional';
    const entries = Object.entries(CAT_CFG).map(([name, color]) => ({
      name, color, val: isN ? (data.catVol[name] || 0) : (data.catTxn[name] || 0),
    })).sort((a, b) => b.val - a.val);
    const maxVal = entries[0]?.val || 1;
    const total  = entries.reduce((s, e) => s + e.val, 0) || 1;

    el('kd-cat-rows').innerHTML = entries.map(c => {
      const pct = ((c.val / total) * 100).toFixed(1);
      return `<div class="kd-cat-item">
        <div class="kd-cat-dot" style="background:${c.color}"></div>
        <div class="kd-cat-nm">${c.name}</div>
        <div class="kd-cat-bar-bg"><div class="kd-cat-bar-fg" style="width:${Math.round((c.val/maxVal)*100)}%;background:${c.color};"></div></div>
        <div class="kd-cat-vol">${isN ? fmtV(c.val) : fmtT(c.val)}</div>
        <div class="kd-cat-pct">${pct}%</div>
      </div>`;
    }).join('');
  }

  function buildSports(data) {
    const isN = volMode === 'notional';
    const src = isN ? data.sportVol : data.sportTxn;
    const entries = Object.entries(src).map(([name, val]) => ({ name, val }))
      .filter(e => e.val > 0).sort((a, b) => b.val - a.val);
    const maxVal = entries[0]?.val || 1;
    const total  = entries.reduce((s, e) => s + e.val, 0) || 1;

    el('kd-sport-rows').innerHTML = entries.map((s, i) => {
      const pct = ((s.val / total) * 100).toFixed(1);
      return `<div class="kd-sport-item">
        <div class="kd-sport-rank">${i + 1}</div>
        <div class="kd-sport-nm">${s.name}</div>
        <div class="kd-sport-bar-bg"><div class="kd-sport-bar-fg" style="width:${Math.round((s.val/maxVal)*100)}%"></div></div>
        <div class="kd-sport-vol">${isN ? fmtV(s.val) : fmtT(s.val)}</div>
        <div class="kd-sport-pct">${pct}%</div>
      </div>`;
    }).join('');
  }

  function buildMarkets(data) {
    const isN = volMode === 'notional';
    const sorted = [...data.topMarkets].sort((a, b) => isN ? b.vol - a.vol : b.txn - a.txn).slice(0, 16);
    const total  = sorted.reduce((s, m) => s + (isN ? m.vol : m.txn), 0) || 1;

    el('kd-mkt-list').innerHTML = sorted.map((m, i) => {
      const val = isN ? m.vol : m.txn;
      const pct = ((val / total) * 100).toFixed(1) + '%';
      return `<div class="kd-mkt-item">
        <div class="kd-mkt-rank">${i + 1}</div>
        <div class="kd-mkt-name">${m.name}</div>
        <div class="kd-mkt-cat" style="background:${m.color}18;color:${m.color};">${m.cat}</div>
        <div class="kd-mkt-vol">${isN ? fmtV(val) : fmtT(val)} <span class="kd-mkt-pct">${pct}</span></div>
      </div>`;
    }).join('');
  }

  function renderAll(data) {
    buildMetrics(data);
    buildCats(data);
    buildSports(data);
    buildMarkets(data);
    buildStackChart(data);

    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    el('kd-vol-lbl').textContent = 'Live · as of ' + now;
    el('kd-mkt-lbl').textContent = 'Open markets · ' + now;
    el('kd-footnote').textContent = 'Data: Kalshi Trade API v2 · ' + now + ' ET · PredictionPro.com';
  }

  // ── Load data ──────────────────────────────────────────────────────────
  async function loadData() {
    setState('loading', 'Loading live Kalshi data…');
    try {
      let all = [], cursor = '', page = 0;
      do {
        const params = { limit: 1000, status: 'open', with_nested_markets: 'false' };
        if (cursor) params.cursor = cursor;
        const json = await fetchMarkets(params);
        all = all.concat(json.markets || []);
        cursor = json.cursor || '';
        page++;
      } while (cursor && page < 5);

      if (!all.length) throw new Error('No markets returned');
      liveData = processMarkets(all);
      renderAll(liveData);
      setState('cached', '✓ Live data · ' + all.length.toLocaleString() + ' markets loaded');
    } catch (err) {
      console.warn('Kalshi live fetch failed:', err.message);
      try {
        setState('loading', 'Falling back to cached snapshot…');
        const r = await fetch(CACHE_FILE);
        if (!r.ok) throw new Error('Cache unavailable');
        liveData = await r.json();
        renderAll(liveData);
        setState('cached', '⚠ Cached snapshot · ' + (liveData.cachedAt ? new Date(liveData.cachedAt).toLocaleDateString() : 'unknown date'));
      } catch (cacheErr) {
        setState('error', 'Error: ' + err.message + ' — set KALSHI_PROXY_URL in wp-config.php');
      }
    }
  }

  // ── Controls ──────────────────────────────────────────────────────────
  function rebuildCharts() {
    if (!liveData) return;
    buildCats(liveData); buildSports(liveData); buildMarkets(liveData); buildStackChart(liveData);
  }

  function init() {
    buildLegend();

    // Date defaults
    const today = new Date().toISOString().split('T')[0];
    const ago90 = new Date(Date.now() - 90 * 864e5).toISOString().split('T')[0];
    const fromEl = el('kd-from'), toEl = el('kd-to');
    if (fromEl) fromEl.value = ago90;
    if (toEl)   toEl.value   = today;

    // Preset buttons
    document.querySelectorAll('.kd-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.kd-preset-btn').forEach(b => b.classList.remove('kd-on'));
        btn.classList.add('kd-on');
        if (liveData) renderAll(liveData);
      });
    });

    // Volume toggle
    document.querySelectorAll('.kd-vt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.kd-vt-btn').forEach(b => b.classList.remove('kd-on'));
        btn.classList.add('kd-on');
        volMode = btn.dataset.mode;
        const isN = volMode === 'notional';
        const titleEl = el('kd-chart-title');
        if (titleEl) titleEl.textContent = isN
          ? 'Weekly volume by $ · by category'
          : 'Weekly volume by # transactions · by category';
        rebuildCharts();
      });
    });

    // Custom apply
    const applyBtn = el('kd-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        document.querySelectorAll('.kd-preset-btn').forEach(b => b.classList.remove('kd-on'));
        if (liveData) renderAll(liveData);
      });
    }

    loadData();
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
