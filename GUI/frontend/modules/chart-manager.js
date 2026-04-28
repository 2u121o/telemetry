/**
 * CHART MANAGER MODULE
 * Handles creation, configuration, and rendering of 2D/3D charts.
 * Uses Plotly.js for rendering.
 * 
 * Features:
 *  - 2D: line, scatter, histogram, bar
 *  - 3D: scatter3d
 *  - Crosshair sync: hover on one chart → cursor on all charts + map
 *  - Splits: vertical lines for partenza/arrivo/intermedi
 *  - Configurable X/Y/Z axes
 */

import DataStore from './data-store.js';

function getSetting(key, fallback) {
  return window.__telemetrySettings?.get?.(key) ?? fallback;
}

const CHART_COLORS = [
  '#58a6ff', '#f78166', '#3fb950', '#d2a8ff',
  '#d29922', '#ff7b72', '#79c0ff', '#56d364',
  '#ffa657', '#bc8cff', '#a5d6ff', '#7ee787',
];

const SPLIT_COLORS = {
  start: '#3fb950',
  end: '#f85149',
  intermediate: '#d29922',
};

const CHART_TYPES = [
  { value: 'line', label: 'Linea' },
  { value: 'scatter', label: 'Scatter' },
  { value: 'scatter3d', label: 'Scatter 3D' },
  { value: 'histogram', label: 'Istogramma' },
  { value: 'bar', label: 'Barre' },
];

const PLOTLY_LAYOUT_BASE = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(15,20,30,0.6)',
  font: { color: '#8b949e', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial', size: 11 },
  margin: { l: 55, r: 20, t: 10, b: 45 },
  xaxis: {
    gridcolor: 'rgba(30,42,58,0.8)',
    zerolinecolor: 'rgba(30,42,58,0.8)',
    tickfont: { size: 10 },
  },
  yaxis: {
    gridcolor: 'rgba(30,42,58,0.8)',
    zerolinecolor: 'rgba(30,42,58,0.8)',
    tickfont: { size: 10 },
  },
  legend: {
    bgcolor: 'rgba(0,0,0,0)',
    font: { size: 10 },
  },
  hovermode: 'x unified',
  dragmode: 'zoom',
};

const ChartManager = (() => {
  let charts = [];
  let nextId = 1;
  let chartsAreaEl = null;
  let configsEl = null;
  let isSyncingCursor = false; // prevent infinite loop

  function init(chartsArea, configsContainer) {
    chartsAreaEl = chartsArea;
    configsEl = configsContainer;

    DataStore.on('data-filtered', () => {
      charts.forEach(c => renderChart(c));
    });

    DataStore.on('data-loaded', () => {
      charts.forEach(c => refreshConfigSelects(c));
    });

    DataStore.on('splits-changed', () => {
      charts.forEach(c => renderChart(c));
    });

    DataStore.on('settings-changed', ({ key }) => {
      if (!key || key?.startsWith('chart_')) {
        // Update chart container heights
        if (!key || key === 'chart_height') {
          const height = getSetting('chart_height', 300);
          document.querySelectorAll('.chart-container').forEach(el => {
            el.style.height = `${height}px`;
          });
        }
        charts.forEach(c => renderChart(c));
      }
    });

    // When cursor changes from another source, draw crosshair on all charts
    DataStore.on('cursor-changed', ({ timestamp }) => {
      if (isSyncingCursor) return;
      charts.forEach(c => drawCursorLine(c, timestamp));
    });
  }

  function getAvailableColumns() { return DataStore.getColumns(); }
  function getColumnMeta() { return DataStore.getColumnMeta(); }

  // ---- Draw cursor vertical line on a chart ----
  function drawCursorLine(chart, timestamp) {
    const plotEl = document.getElementById(`chart-plot-${chart.id}`);
    if (!plotEl || !plotEl.data) return;
    if (chart.config.type === 'scatter3d' || chart.config.type === 'histogram') return;

    // If X axis is timestamp, convert to relative time for the cursor line
    const xIsTimestamp = chart.config.xColumn === 'timestamp';
    const cursorX = xIsTimestamp ? DataStore.toRelativeTime(timestamp) : timestamp;

    const layout = {
      shapes: buildSplitShapes(chart).concat([{
        type: 'line',
        x0: cursorX, x1: cursorX,
        y0: 0, y1: 1,
        yref: 'paper',
        line: { color: '#ffffff', width: 1.5, dash: 'dot' },
      }]),
    };
    Plotly.relayout(plotEl, layout);
  }

  // ---- Build vertical line shapes for splits ----
  function buildSplitShapes(chart) {
    if (chart.config.type === 'scatter3d' || chart.config.type === 'histogram') return [];
    const allSplits = DataStore.getAllSplitTimestamps();
    const xIsTimestamp = chart.config.xColumn === 'timestamp';
    return allSplits.map(s => ({
      type: 'line',
      x0: xIsTimestamp ? s.relTime : s.time,
      x1: xIsTimestamp ? s.relTime : s.time,
      y0: 0, y1: 1,
      yref: 'paper',
      line: {
        color: SPLIT_COLORS[s.type] || '#d29922',
        width: 2,
        dash: s.type === 'intermediate' ? 'dash' : 'solid',
      },
    }));
  }

  // ---- Build split annotations ----
  function buildSplitAnnotations(chart) {
    if (chart.config.type === 'scatter3d' || chart.config.type === 'histogram') return [];
    const allSplits = DataStore.getAllSplitTimestamps();
    const xIsTimestamp = chart.config.xColumn === 'timestamp';
    return allSplits.map(s => ({
      x: xIsTimestamp ? s.relTime : s.time,
      y: 1,
      yref: 'paper',
      text: `${s.label} (${s.relTime.toFixed(1)}s)`,
      showarrow: false,
      font: { size: 9, color: SPLIT_COLORS[s.type] || '#d29922' },
      yanchor: 'bottom',
      bgcolor: 'rgba(10,14,20,0.8)',
      borderpad: 2,
    }));
  }

  // ---- Create chart config UI in sidebar ----
  function createConfigCard(chart) {
    const cols = getAvailableColumns();
    const meta = getColumnMeta();

    const card = document.createElement('div');
    card.className = 'config-card';
    card.dataset.chartId = chart.id;

    const typeOptions = CHART_TYPES.map(t =>
      `<option value="${t.value}" ${t.value === chart.config.type ? 'selected' : ''}>${t.label}</option>`
    ).join('');

    const colOptions = cols.map(c =>
      `<option value="${c}">${meta[c]?.label || c}</option>`
    ).join('');

    const is3D = chart.config.type === 'scatter3d';

    card.innerHTML = `
      <div class="config-card-header">
        <span>Grafico #${chart.id}</span>
        <button class="btn btn-danger btn-sm btn-remove-chart" data-chart-id="${chart.id}" title="Rimuovi">✕</button>
      </div>
      <div class="control-group">
        <label class="control-label">Tipo</label>
        <select class="select-input chart-type-select" data-chart-id="${chart.id}">${typeOptions}</select>
      </div>
      <div class="control-group">
        <label class="control-label">Asse X</label>
        <select class="select-input chart-x-select" data-chart-id="${chart.id}">${colOptions}</select>
      </div>
      <div class="control-group">
        <label class="control-label">Asse Y (multi-selezione)</label>
        <div class="axis-multi-select chart-y-select" data-chart-id="${chart.id}">
          ${cols.map(c => `<label><input type="checkbox" value="${c}" ${chart.config.yColumns.includes(c) ? 'checked' : ''} />${meta[c]?.label || c}</label>`).join('')}
        </div>
      </div>
      <div class="control-group chart-z-group ${is3D ? '' : 'hidden'}" data-chart-id="${chart.id}">
        <label class="control-label">Asse Z (3D)</label>
        <select class="select-input chart-z-select" data-chart-id="${chart.id}">${colOptions}</select>
      </div>
      <button class="btn btn-primary btn-sm btn-block btn-update-chart" data-chart-id="${chart.id}" style="margin-top: 8px;">Aggiorna Grafico</button>
    `;

    const xSel = card.querySelector('.chart-x-select');
    if (chart.config.xColumn) xSel.value = chart.config.xColumn;
    const zSel = card.querySelector('.chart-z-select');
    if (chart.config.zColumn) zSel.value = chart.config.zColumn;

    card.querySelector('.chart-type-select').addEventListener('change', (e) => {
      const zGroup = card.querySelector('.chart-z-group');
      if (e.target.value === 'scatter3d') zGroup.classList.remove('hidden');
      else zGroup.classList.add('hidden');
    });
    card.querySelector('.btn-remove-chart').addEventListener('click', () => removeChart(chart.id));
    card.querySelector('.btn-update-chart').addEventListener('click', () => updateChartFromConfig(chart.id, card));

    return card;
  }

  function refreshConfigSelects(chart) {
    const card = configsEl?.querySelector(`[data-chart-id="${chart.id}"]`);
    if (!card) return;
    const cols = getAvailableColumns();
    const meta = getColumnMeta();
    const colOptions = cols.map(c => `<option value="${c}">${meta[c]?.label || c}</option>`).join('');

    const xSel = card.querySelector('.chart-x-select');
    const prevX = xSel.value;
    xSel.innerHTML = colOptions;
    if (cols.includes(prevX)) xSel.value = prevX;

    const zSel = card.querySelector('.chart-z-select');
    const prevZ = zSel.value;
    zSel.innerHTML = colOptions;
    if (cols.includes(prevZ)) zSel.value = prevZ;

    const yContainer = card.querySelector('.chart-y-select');
    const prevY = Array.from(yContainer.querySelectorAll('input:checked')).map(i => i.value);
    yContainer.innerHTML = cols.map(c => `<label><input type="checkbox" value="${c}" ${prevY.includes(c) ? 'checked' : ''} />${meta[c]?.label || c}</label>`).join('');
  }

  function updateChartFromConfig(chartId, card) {
    const chart = charts.find(c => c.id === chartId);
    if (!chart) return;
    const type = card.querySelector('.chart-type-select').value;
    const xColumn = card.querySelector('.chart-x-select').value;
    const yColumns = Array.from(card.querySelectorAll('.chart-y-select input:checked')).map(i => i.value);
    const zColumn = card.querySelector('.chart-z-select').value;
    if (yColumns.length === 0) { showToast('Seleziona almeno una colonna per l\'asse Y', 'error'); return; }
    chart.config = { ...chart.config, type, xColumn, yColumns, zColumn };
    renderChart(chart);
    showToast(`Grafico #${chartId} aggiornato`, 'success');
  }

  // ---- Create chart display area ----
  function createChartElement(chart) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-card';
    wrapper.dataset.chartId = chart.id;

    wrapper.innerHTML = `
      <div class="chart-card-header">
        <h4>Grafico #${chart.id}</h4>
        <div class="chart-card-actions">
          <button class="btn btn-ghost btn-sm btn-fullscreen-chart" data-chart-id="${chart.id}" title="Espandi">⛶</button>
          <button class="btn btn-danger btn-sm btn-close-chart" data-chart-id="${chart.id}" title="Chiudi">✕</button>
        </div>
      </div>
      <div class="chart-container" id="chart-plot-${chart.id}" style="height: ${getSetting('chart_height', 300)}px;"></div>
    `;

    wrapper.querySelector('.btn-close-chart').addEventListener('click', () => removeChart(chart.id));
    wrapper.querySelector('.btn-fullscreen-chart').addEventListener('click', () => {
      const plotEl = wrapper.querySelector('.chart-container');
      if (plotEl.requestFullscreen) plotEl.requestFullscreen();
    });

    return wrapper;
  }

  // ---- Render chart with Plotly ----
  function renderChart(chart) {
    const plotEl = document.getElementById(`chart-plot-${chart.id}`);
    if (!plotEl) return;

    const data = DataStore.getFilteredData();
    if (data.length === 0) return;

    const { type, xColumn, yColumns, zColumn } = chart.config;
    const meta = getColumnMeta();
    const traces = [];

    // When X axis is timestamp, use relative time (partenza = 0s)
    const xIsTimestamp = xColumn === 'timestamp';
    const startOffset = DataStore.getStartOffset();

    // Helper to get X values: relative if timestamp, raw otherwise
    const getXValues = () => {
      if (xIsTimestamp) {
        return data.map(r => r.timestamp !== null && r.timestamp !== undefined ? r.timestamp - startOffset : null);
      }
      return data.map(r => r[xColumn]);
    };

    if (type === 'scatter3d') {
      const yCol = yColumns[0] || xColumn;
      traces.push({
        type: 'scatter3d',
        mode: 'markers',
        x: getXValues(),
        y: data.map(r => r[yCol]),
        z: data.map(r => r[zColumn]),
        marker: {
          size: 2.5,
          color: data.map(r => r[zColumn]),
          colorscale: 'Viridis',
          showscale: true,
          colorbar: { title: meta[zColumn]?.label || zColumn, tickfont: { size: 10 } },
        },
        name: `${meta[xColumn]?.label || xColumn} / ${meta[yCol]?.label || yCol} / ${meta[zColumn]?.label || zColumn}`,
      });

      const xTitle = xIsTimestamp ? 'Tempo (s)' : (meta[xColumn]?.label || xColumn);
      const layout3D = {
        ...PLOTLY_LAYOUT_BASE,
        margin: { l: 0, r: 0, t: 0, b: 0 },
        scene: {
          xaxis: { title: xTitle, gridcolor: 'rgba(30,42,58,0.5)', backgroundcolor: 'rgba(15,20,30,0.4)' },
          yaxis: { title: meta[yCol]?.label || yCol, gridcolor: 'rgba(30,42,58,0.5)', backgroundcolor: 'rgba(15,20,30,0.4)' },
          zaxis: { title: meta[zColumn]?.label || zColumn, gridcolor: 'rgba(30,42,58,0.5)', backgroundcolor: 'rgba(15,20,30,0.4)' },
          bgcolor: 'rgba(15,20,30,0.6)',
        },
      };
      Plotly.react(plotEl, traces, layout3D, { responsive: true, displayModeBar: true, displaylogo: false });
      return;
    }

    if (type === 'histogram') {
      yColumns.forEach((col, i) => {
        traces.push({
          type: 'histogram',
          x: data.map(r => r[col]),
          name: meta[col]?.label || col,
          marker: { color: CHART_COLORS[i % CHART_COLORS.length] },
          opacity: 0.7,
        });
      });
    } else if (type === 'bar') {
      yColumns.forEach((col, i) => {
        traces.push({
          type: 'bar',
          x: getXValues(),
          y: data.map(r => r[col]),
          name: meta[col]?.label || col,
          marker: { color: CHART_COLORS[i % CHART_COLORS.length] },
        });
      });
    } else {
      // line or scatter
      const xVals = getXValues();
      yColumns.forEach((col, i) => {
        traces.push({
          type: 'scattergl',
          mode: type === 'scatter' ? 'markers' : 'lines',
          x: xVals,
          y: data.map(r => r[col]),
          name: meta[col]?.label || col,
          line: { color: CHART_COLORS[i % CHART_COLORS.length], width: getSetting('chart_lineWidth', 1.5) },
          marker: { color: CHART_COLORS[i % CHART_COLORS.length], size: 3 },
          hovertemplate: `%{x:.3f}s<br>%{y:.6f}<extra>${meta[col]?.label || col}</extra>`,
        });
      });
    }

    const xAxisTitle = xIsTimestamp ? 'Tempo (s)' : ((meta[xColumn]?.label || xColumn) + (meta[xColumn]?.unit ? ` (${meta[xColumn].unit})` : ''));

    const showGrid = getSetting('chart_showGrid', true);
    const gridColor = showGrid ? 'rgba(30,42,58,0.8)' : 'rgba(0,0,0,0)';

    const layout = {
      ...PLOTLY_LAYOUT_BASE,
      shapes: buildSplitShapes(chart),
      annotations: buildSplitAnnotations(chart),
      xaxis: {
        ...PLOTLY_LAYOUT_BASE.xaxis,
        title: { text: xAxisTitle, font: { size: 11 } },
        gridcolor: gridColor,
        showgrid: showGrid,
      },
      yaxis: {
        ...PLOTLY_LAYOUT_BASE.yaxis,
        title: {
          text: yColumns.length === 1 ? (meta[yColumns[0]]?.label || yColumns[0]) : 'Valore',
          font: { size: 11 },
        },
        gridcolor: gridColor,
        showgrid: showGrid,
      },
    };

    Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: true, displaylogo: false });

    // Attach hover event for crosshair sync
    plotEl.removeAllListeners?.('plotly_hover');
    plotEl.on('plotly_hover', (eventData) => {
      if (isSyncingCursor) return;
      const pt = eventData.points?.[0];
      if (!pt) return;
      const xVal = pt.x;
      if (typeof xVal !== 'number') return;
      isSyncingCursor = true;
      // Convert relative time back to absolute for setCursor
      const absTime = xIsTimestamp ? DataStore.fromRelativeTime(xVal) : xVal;
      DataStore.setCursor(absTime);
      isSyncingCursor = false;
    });

    plotEl.on('plotly_click', (eventData) => {
      const pt = eventData.points?.[0];
      if (!pt) return;
      const xVal = pt.x;
      if (typeof xVal !== 'number') return;
      const absTime = xIsTimestamp ? DataStore.fromRelativeTime(xVal) : xVal;
      DataStore.setCursor(absTime);
    });
  }

  // ---- Add / Remove charts ----
  function addChart(config = null) {
    const cols = getAvailableColumns();
    if (cols.length === 0) { showToast('Carica prima un file di dati', 'error'); return; }

    const defaultConfig = config || {
      type: 'line',
      xColumn: cols[0],
      yColumns: cols.length > 1 ? [cols[1]] : [cols[0]],
      zColumn: cols.length > 2 ? cols[2] : cols[0],
    };

    const chart = { id: nextId++, config: defaultConfig, plotEl: null };
    charts.push(chart);

    const configCard = createConfigCard(chart);
    configsEl.appendChild(configCard);

    const chartEl = createChartElement(chart);
    chartsAreaEl.appendChild(chartEl);

    renderChart(chart);
    return chart;
  }

  function removeChart(chartId) {
    const idx = charts.findIndex(c => c.id === chartId);
    if (idx === -1) return;

    const configCard = configsEl?.querySelector(`[data-chart-id="${chartId}"]`);
    if (configCard) configCard.remove();

    const chartCard = chartsAreaEl?.querySelector(`[data-chart-id="${chartId}"]`);
    if (chartCard) {
      const plotEl = chartCard.querySelector('.chart-container');
      if (plotEl) Plotly.purge(plotEl);
      chartCard.remove();
    }
    charts.splice(idx, 1);
  }

  function removeAllCharts() {
    [...charts].forEach(c => removeChart(c.id));
  }

  function getCharts() { return charts; }

  // Get serializable chart configs for session saving
  function getConfigs() {
    return charts.map(c => ({ ...c.config }));
  }

  // Restore charts from saved configs
  function restoreConfigs(configs) {
    removeAllCharts();
    if (configs && Array.isArray(configs)) {
      configs.forEach(cfg => addChart(cfg));
    }
  }

  return { init, addChart, removeChart, removeAllCharts, getCharts, getConfigs, restoreConfigs, CHART_TYPES };
})();

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export default ChartManager;
