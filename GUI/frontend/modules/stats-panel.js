/**
 * STATS PANEL MODULE
 * Displays summary statistics for each telemetry channel.
 */

import DataStore from './data-store.js';

const StatsPanel = (() => {
  let containerEl = null;

  function init(container) {
    containerEl = container;

    DataStore.on('data-filtered', () => render());
    DataStore.on('data-loaded', () => render());
  }

  function render() {
    if (!containerEl) return;

    const cols = DataStore.getColumns();
    const meta = DataStore.getColumnMeta();
    const total = DataStore.getRowCount();
    const filtered = DataStore.getFilteredRowCount();

    if (cols.length === 0) {
      containerEl.innerHTML = '<p class="muted">Carica un file per vedere le statistiche</p>';
      return;
    }

    let html = `
      <div class="stat-item" style="border-left: 3px solid var(--accent);">
        <div class="stat-label">Campioni</div>
        <div class="stat-value">${filtered.toLocaleString()}</div>
        <div class="stat-sub">${total !== filtered ? `di ${total.toLocaleString()} totali (filtrati)` : 'totali'}</div>
      </div>
    `;

    // Duration estimate from timestamp (already in seconds)
    if (meta.timestamp) {
      const durationSec = meta.timestamp.max - meta.timestamp.min;
      const sampleRate = filtered > 1 ? ((filtered - 1) / durationSec).toFixed(1) : '—';
      html += `
        <div class="stat-item">
          <div class="stat-label">Durata</div>
          <div class="stat-value">${durationSec.toFixed(2)}s</div>
          <div class="stat-sub">~${sampleRate} Hz sample rate</div>
        </div>
      `;
    }

    html += '<div style="margin-top: 8px; border-top: 1px solid var(--border); padding-top: 8px;"></div>';

    for (const col of cols) {
      const m = meta[col];
      if (!m) continue;

      html += `
        <div class="stat-item">
          <div class="stat-label">${m.label} ${m.unit ? `(${m.unit})` : ''}</div>
          <div style="display: flex; justify-content: space-between; gap: 8px;">
            <div>
              <div class="stat-sub">Min</div>
              <div style="font-weight: 600; font-size: 0.85rem; font-variant-numeric: tabular-nums;">${formatValue(m.min)}</div>
            </div>
            <div>
              <div class="stat-sub">Media</div>
              <div style="font-weight: 600; font-size: 0.85rem; font-variant-numeric: tabular-nums;">${formatValue(m.mean)}</div>
            </div>
            <div>
              <div class="stat-sub">Max</div>
              <div style="font-weight: 600; font-size: 0.85rem; font-variant-numeric: tabular-nums;">${formatValue(m.max)}</div>
            </div>
          </div>
          <div class="stat-sub" style="margin-top: 2px;">\u03C3 = ${formatValue(m.std)}</div>
        </div>
      `;
    }

    containerEl.innerHTML = `<div class="stats-grid">${html}</div>`;
  }

  function formatValue(v) {
    if (v === null || v === undefined) return '—';
    if (Math.abs(v) >= 1000) return v.toFixed(2);
    if (Math.abs(v) >= 1) return v.toFixed(4);
    return v.toFixed(6);
  }

  return { init, render };
})();

export default StatsPanel;
