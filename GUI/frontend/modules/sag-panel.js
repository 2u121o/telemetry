/**
 * SAG PANEL MODULE
 * Selects a time window on travel plots and reports edge-average travel delta.
 */

import DataStore from './data-store.js';

const SagPanel = (() => {
  let areaEl = null;
  let resultsEl = null;
  let plotEl = null;
  let selectedWindow = null;

  const channels = [
    { label: 'Posteriore', mm: 'travel_r_mm', pct: 'travel_r_pct', color: '#58a6ff' },
    { label: 'Anteriore', mm: 'travel_f_mm', pct: 'travel_f_pct', color: '#f78166' },
  ];
  const EDGE_SAMPLE_MAX = 20;

  function init(area, results) {
    areaEl = area;
    resultsEl = results;
    plotEl = document.getElementById('sagPlot');

    DataStore.on('data-loaded', () => render());
    DataStore.on('data-filtered', () => render());
    DataStore.on('settings-changed', ({ key }) => {
      if (key === null || key?.startsWith('travel_')) render();
    });

    document.getElementById('btnSagClear')?.addEventListener('click', clearSelection);
    renderResults(null);
  }

  function show() {
    areaEl?.classList.remove('hidden');
    render();
  }

  function hide() {
    areaEl?.classList.add('hidden');
  }

  function render() {
    if (!plotEl || !areaEl || areaEl.classList.contains('hidden')) {
      renderResults(selectedWindow);
      return;
    }

    const data = DataStore.getFilteredData();
    const columns = DataStore.getColumns();
    const available = channels.filter(ch => columns.includes(ch.mm) && columns.includes(ch.pct));

    if (data.length === 0 || available.length === 0) {
      Plotly.react(plotEl, [], emptyLayout('Carica dati travel per calcolare il SAG'), plotConfig());
      renderResults(null);
      return;
    }

    if (selectedWindow) {
      selectedWindow = calculateWindow(selectedWindow.relStart, selectedWindow.relEnd);
    }

    const startOffset = DataStore.getStartOffset();
    const x = data.map(row => row.timestamp - startOffset);
    const traces = available.map(ch => ({
      type: 'scattergl',
      mode: 'lines',
      x,
      y: data.map(row => row[ch.mm]),
      name: `${ch.label} (mm)`,
      line: { color: ch.color, width: 1.8 },
      hovertemplate: '%{x:.3f}s<br>%{y:.3f} mm<extra>%{fullData.name}</extra>',
    }));

    const layout = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(15,20,30,0.6)',
      font: { color: '#8b949e', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial', size: 11 },
      margin: { l: 60, r: 20, t: 10, b: 45 },
      dragmode: 'select',
      hovermode: 'x unified',
      xaxis: {
        title: { text: 'Tempo (s)', font: { size: 11 } },
        gridcolor: 'rgba(30,42,58,0.8)',
        zerolinecolor: 'rgba(30,42,58,0.8)',
      },
      yaxis: {
        title: { text: 'Travel (mm)', font: { size: 11 } },
        gridcolor: 'rgba(30,42,58,0.8)',
        zerolinecolor: 'rgba(30,42,58,0.8)',
      },
      legend: { bgcolor: 'rgba(0,0,0,0)', font: { size: 10 } },
      shapes: selectedWindow ? [{
        type: 'rect',
        x0: selectedWindow.relStart,
        x1: selectedWindow.relEnd,
        y0: 0,
        y1: 1,
        yref: 'paper',
        fillcolor: 'rgba(88,166,255,0.14)',
        line: { color: '#58a6ff', width: 1, dash: 'dot' },
      }] : [],
    };

    Plotly.react(plotEl, traces, layout, plotConfig());
    plotEl.removeAllListeners?.('plotly_selected');
    plotEl.on('plotly_selected', handleSelection);
    renderResults(selectedWindow);
  }

  function handleSelection(eventData) {
    const rangeX = eventData?.range?.x || eventData?.lassoPoints?.x || [];
    const points = eventData?.points || [];
    const xValues = rangeX.length > 0
      ? rangeX.filter(Number.isFinite)
      : points.map(point => point.x).filter(Number.isFinite);
    if (xValues.length === 0) return;

    const relStart = Math.min(...xValues);
    const relEnd = Math.max(...xValues);
    selectedWindow = calculateWindow(relStart, relEnd);
    render();
  }

  function calculateWindow(relStart, relEnd) {
    const absStart = DataStore.fromRelativeTime(relStart);
    const absEnd = DataStore.fromRelativeTime(relEnd);
    const data = DataStore.getFilteredData().filter(row =>
      row.timestamp >= absStart && row.timestamp <= absEnd
    );

    if (data.length < 2) {
      return { relStart, relEnd, absStart, absEnd, count: data.length, results: [] };
    }

    const edgeSampleCount = Math.max(1, Math.min(EDGE_SAMPLE_MAX, Math.floor(data.length * 0.1)));
    const startRows = data.slice(0, edgeSampleCount);
    const endRows = data.slice(-edgeSampleCount);
    const results = channels.map(ch => {
      const firstMm = meanFor(startRows, ch.mm);
      const lastMm = meanFor(endRows, ch.mm);
      const firstPct = meanFor(startRows, ch.pct);
      const lastPct = meanFor(endRows, ch.pct);
      if (![firstMm, lastMm, firstPct, lastPct].every(Number.isFinite)) return null;
      return {
        label: ch.label,
        deltaMm: lastMm - firstMm,
        deltaPct: lastPct - firstPct,
        firstMm,
        lastMm,
        firstPct,
        lastPct,
      };
    }).filter(Boolean);

    return { relStart, relEnd, absStart, absEnd, count: data.length, edgeSampleCount, results };
  }

  function renderResults(windowData) {
    if (!resultsEl) return;
    if (!windowData) {
      resultsEl.innerHTML = `
        <p class="muted">Seleziona una finestra sul plot SAG con il mouse.</p>
        <p class="muted small">Il risultato usa la media di pochi campioni a inizio/fine finestra.</p>
      `;
      return;
    }

    if (windowData.count < 2 || windowData.results.length === 0) {
      resultsEl.innerHTML = `
        <div class="sag-result-card">
          <div class="sag-result-title">Finestra selezionata</div>
          <div class="sag-result-sub">${formatTime(windowData.relStart)}s - ${formatTime(windowData.relEnd)}s · ${windowData.count} campioni</div>
          <p class="muted small">Servono almeno 2 campioni validi con travel in mm e %.</p>
        </div>
      `;
      return;
    }

    resultsEl.innerHTML = `
      <div class="sag-result-card">
        <div class="sag-result-title">Finestra selezionata</div>
        <div class="sag-result-sub">${formatTime(windowData.relStart)}s - ${formatTime(windowData.relEnd)}s · ${windowData.count} campioni · media ${windowData.edgeSampleCount} + ${windowData.edgeSampleCount}</div>
      </div>
      ${windowData.results.map(result => `
        <div class="sag-result-card">
          <div class="sag-result-title">${result.label}</div>
          <div class="sag-result-main">${formatSigned(result.deltaMm)} mm</div>
          <div class="sag-result-main">${formatSigned(result.deltaPct)} %</div>
          <div class="sag-result-sub">
            media start ${formatValue(result.firstMm)} → media end ${formatValue(result.lastMm)} mm<br>
            media start ${formatValue(result.firstPct)} → media end ${formatValue(result.lastPct)} %
          </div>
        </div>
      `).join('')}
    `;
  }

  function clearSelection() {
    selectedWindow = null;
    render();
  }

  function emptyLayout(message) {
    return {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(15,20,30,0.6)',
      font: { color: '#8b949e' },
      margin: { l: 30, r: 20, t: 20, b: 30 },
      annotations: [{ text: message, showarrow: false, xref: 'paper', yref: 'paper', x: 0.5, y: 0.5 }],
    };
  }

  function plotConfig() {
    return { responsive: true, displayModeBar: true, displaylogo: false };
  }

  function meanFor(rows, column) {
    const values = rows.map(row => row[column]).filter(Number.isFinite);
    if (values.length === 0) return NaN;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function formatTime(value) {
    return Number.isFinite(value) ? value.toFixed(3) : '—';
  }

  function formatValue(value) {
    return Number.isFinite(value) ? value.toFixed(2) : '—';
  }

  function formatSigned(value) {
    if (!Number.isFinite(value)) return '—';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
  }

  return { init, show, hide, render, clearSelection };
})();

export default SagPanel;
