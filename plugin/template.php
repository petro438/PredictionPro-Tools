<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>

<div class="kd-wrap" id="kalshi-dashboard-root">

  <div class="kd-controls-strip">
    <div class="kd-preset-group" id="kd-presets">
      <button class="kd-preset-btn" data-preset="7d">7D</button>
      <button class="kd-preset-btn" data-preset="30d">30D</button>
      <button class="kd-preset-btn kd-on" data-preset="3m">3M</button>
      <button class="kd-preset-btn" data-preset="6m">6M</button>
      <button class="kd-preset-btn" data-preset="ytd">YTD</button>
      <button class="kd-preset-btn" data-preset="1y">1Y</button>
    </div>
    <div class="kd-strip-sep"></div>
    <div class="kd-vol-toggle" id="kd-vol-toggle">
      <button class="kd-vt-btn kd-on" data-mode="notional">Volume by $</button>
      <button class="kd-vt-btn" data-mode="txn">By # Txn</button>
    </div>
    <div class="kd-custom-date">
      <span class="kd-custom-lbl">Custom:</span>
      <input type="date" class="kd-date-input" id="kd-from">
      <span class="kd-custom-lbl">–</span>
      <input type="date" class="kd-date-input" id="kd-to">
      <button class="kd-apply-btn" id="kd-apply">Apply</button>
    </div>
  </div>

  <div id="kd-state-bar" class="kd-state-bar kd-loading">
    <div class="kd-spinner"></div>
    <span id="kd-state-msg">Loading live Kalshi data…</span>
  </div>

  <table class="kd-metrics-table">
    <thead>
      <tr>
        <th>Metric</th>
        <th>Value</th>
        <th>vs. prior period</th>
        <th>Prior period</th>
        <th>Trend</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="kd-m-lbl">Total volume</span></td>
        <td><span class="kd-m-val" id="kd-mv1">—</span></td>
        <td><span class="kd-m-d" id="kd-md1">—</span></td>
        <td><span class="kd-m-d kd-muted" id="kd-mp1">—</span></td>
        <td><canvas class="kd-spark" id="kd-sp1" role="img" aria-label="Volume trend"></canvas></td>
      </tr>
      <tr>
        <td><span class="kd-m-lbl">Open interest</span></td>
        <td><span class="kd-m-val" id="kd-mv2">—</span></td>
        <td><span class="kd-m-d" id="kd-md2">—</span></td>
        <td><span class="kd-m-d kd-muted" id="kd-mp2">—</span></td>
        <td><canvas class="kd-spark" id="kd-sp2" role="img" aria-label="OI trend"></canvas></td>
      </tr>
      <tr>
        <td><span class="kd-m-lbl">Active markets</span></td>
        <td><span class="kd-m-val" id="kd-mv3">—</span></td>
        <td><span class="kd-m-d" id="kd-md3">—</span></td>
        <td><span class="kd-m-d kd-muted" id="kd-mp3">—</span></td>
        <td><canvas class="kd-spark" id="kd-sp3" role="img" aria-label="Markets trend"></canvas></td>
      </tr>
    </tbody>
  </table>

  <div class="kd-panel kd-full-panel">
    <div class="kd-panel-hd">
      <span class="kd-panel-title" id="kd-chart-title">Weekly volume by $ · by category</span>
      <span class="kd-panel-sub" id="kd-vol-lbl">Loading…</span>
    </div>
    <div class="kd-legend" id="kd-legend"></div>
    <div class="kd-chart-wrap">
      <canvas id="kd-stack-chart" role="img" aria-label="Stacked bar chart of Kalshi volume by category">Volume by category.</canvas>
    </div>
  </div>

  <div class="kd-grid-bot">
    <div class="kd-panel">
      <div class="kd-panel-hd"><span class="kd-panel-title">Volume by category</span></div>
      <div id="kd-cat-rows"><p class="kd-loading-text">Loading…</p></div>
    </div>
    <div class="kd-panel">
      <div class="kd-panel-hd"><span class="kd-panel-title">Sports breakdown</span></div>
      <div id="kd-sport-rows"><p class="kd-loading-text">Loading…</p></div>
    </div>
  </div>

  <div class="kd-panel kd-mkt-panel">
    <div class="kd-panel-hd">
      <span class="kd-panel-title">Top markets by volume</span>
      <span class="kd-panel-sub" id="kd-mkt-lbl">Loading…</span>
    </div>
    <div class="kd-mkt-grid" id="kd-mkt-list"><p class="kd-loading-text">Loading…</p></div>
  </div>

  <p class="kd-footnote" id="kd-footnote">Data: Kalshi Trade API v2 · PredictionPro.com</p>

</div>
