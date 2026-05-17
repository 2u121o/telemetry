/**
 * COMPARE VIEW MODULE
 * Multi-run comparison: overlay charts, split times, setup diffs, map tracks.
 *
 * Architecture:
 *  - Each loaded run is a self-contained data object (parsed CSV + metadata)
 *  - Runs are stored in an array; each has a unique color
 *  - Charts overlay the same channel from multiple runs
 *  - Split times are compared in a table
 *  - Setup / conditions are shown side-by-side
 *  - Map shows all tracks with per-run colors
 */

// ===== Run colors (10 distinct, high-contrast on dark bg) =====
const RUN_COLORS = [
  '#58a6ff', '#f78166', '#3fb950', '#d2a8ff', '#d29922',
  '#ff7b72', '#79c0ff', '#56d364', '#ffa657', '#bc8cff',
];

// ===== Known metadata =====
const KNOWN_UNITS = {
  timestamp: 's', ax: 'g', ay: 'g', az: 'g',
  wx: 'rad/s', wy: 'rad/s', wz: 'rad/s',
  lat: '°', lon: '°', alt_m: 'm',
  travel_r_v: 'V', travel_r_mm: 'mm', travel_r_pct: '%',
};
const KNOWN_LABELS = {
  timestamp: 'Tempo', ax: 'Accel X', ay: 'Accel Y', az: 'Accel Z',
  wx: 'Gyro X', wy: 'Gyro Y', wz: 'Gyro Z',
  lat: 'Latitudine', lon: 'Longitudine', alt_m: 'Altitudine',
  travel_r_v: 'Travel Rear (V)', travel_r_mm: 'Travel Rear (mm)', travel_r_pct: 'Travel Rear (%)',
};

import ApiClient from './api-client.js';
import DataStore from './data-store.js';

// ===== Settings defaults (read from localStorage) =====
function getSettings() {
  try {
    const j = localStorage.getItem('bike-telemetry-settings');
    return j ? JSON.parse(j) : {};
  } catch { return {}; }
}

function getSetting(key, fallback) {
  const s = getSettings();
  return s[key] ?? fallback;
}

function getBikes() {
  try { return JSON.parse(localStorage.getItem('bike-telemetry-bikes')) || []; } catch { return []; }
}
function getSetups() {
  try { return JSON.parse(localStorage.getItem('bike-telemetry-setups')) || []; } catch { return []; }
}
function getRunNotes() {
  try { return JSON.parse(localStorage.getItem('bike-telemetry-run-notes')) || {}; } catch { return {}; }
}
function getBikeById(id) { return getBikes().find(b => b.id === id) || null; }
function getSetupById(id) { return getSetups().find(s => s.id === id) || null; }

// ===== API helpers =====
let isBackendOnline = false;
async function checkBackend() {
  try { await ApiClient.health(); isBackendOnline = true; } catch { isBackendOnline = false; }
  return isBackendOnline;
}

// ===== CSV Parser (standalone, same as data-store) =====
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('File vuoto o formato non valido');
  const header = lines[0].split(',').map(h => h.trim().replace(/\s+/g, '_'));
  const data = [];
  const tsUnit = getSetting('timestampUnit', 'ms_to_s');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length !== header.length) continue;
    const row = {};
    for (let j = 0; j < header.length; j++) {
      const val = parts[j].trim();
      let num = val === '' ? null : Number(val);
      if (header[j] === 'timestamp' && num !== null && tsUnit === 'ms_to_s') {
        num = num / 1000;
      }
      row[header[j]] = num;
    }
    data.push(row);
  }
  return { columns: header, data };
}

// ===== Travel conversion =====
function applyTravelConversion(data, columns) {
  if (!columns.includes('travel_r_v')) return;
  const s = getSettings();
  const vMax = s.travel_vMax ?? 3.3;
  const vMin = s.travel_vMin ?? 0;
  const stroke = s.travel_strokeMm ?? 200;
  const inv = s.travel_inverted ?? false;

  if (!columns.includes('travel_r_mm')) columns.push('travel_r_mm');
  if (!columns.includes('travel_r_pct')) columns.push('travel_r_pct');

  for (const row of data) {
    const v = row.travel_r_v;
    if (v !== null && v !== undefined && !isNaN(v)) {
      let r = inv ? (v - vMin) / (vMax - vMin) : 1 - (v - vMin) / (vMax - vMin);
      r = Math.max(0, Math.min(1, r));
      row.travel_r_mm = r * stroke;
      row.travel_r_pct = r * 100;
    } else {
      row.travel_r_mm = null;
      row.travel_r_pct = null;
    }
  }
}

// ===== Column metadata =====
function computeColumnMeta(data, columns) {
  const meta = {};
  for (const col of columns) {
    const values = data.map(r => r[col]).filter(v => v !== null && v !== undefined && !isNaN(v));
    const n = values.length;
    if (n === 0) { meta[col] = { min: 0, max: 0, mean: 0, unit: KNOWN_UNITS[col] || '', label: KNOWN_LABELS[col] || col }; continue; }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / n;
    meta[col] = { min, max, mean, unit: KNOWN_UNITS[col] || '', label: KNOWN_LABELS[col] || col, count: n };
  }
  return meta;
}

// ===== Plotly layout =====
const PLOTLY_LAYOUT_BASE = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(15,20,30,0.6)',
  font: { color: '#8b949e', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial', size: 11 },
  margin: { l: 55, r: 20, t: 10, b: 45 },
  xaxis: { gridcolor: 'rgba(30,42,58,0.8)', zerolinecolor: 'rgba(30,42,58,0.8)', tickfont: { size: 10 } },
  yaxis: { gridcolor: 'rgba(30,42,58,0.8)', zerolinecolor: 'rgba(30,42,58,0.8)', tickfont: { size: 10 } },
  legend: { bgcolor: 'rgba(0,0,0,0)', font: { size: 10 } },
  hovermode: 'x unified',
  dragmode: 'zoom',
};

// ===================================================================
// MAIN MODULE
// ===================================================================
const CompareView = (() => {
  let runs = [];       // [{id, fileName, color, data, columns, columnMeta, splits, visible, notes, bike, setup}]
  let nextRunId = 1;
  let charts = [];     // [{id, config: {yColumn, normalize}}]
  let nextChartId = 1;
  let map = null;
  let mapLayers = {};  // {runId: layerGroup}

  // DOM refs
  const btnAddRun = document.getElementById('btnAddRun');
  const btnAddRunWelcome = document.getElementById('btnAddRunWelcome');
  const btnLoadFromDB = document.getElementById('btnLoadFromDB');
  const btnLoadFromDBWelcome = document.getElementById('btnLoadFromDBWelcome');
  const btnImportBundle = document.getElementById('btnImportBundle');
  const runFileInput = document.getElementById('runFileInput');
  const runCountEl = document.getElementById('runCount');
  const runsListEl = document.getElementById('runsList');
  const btnClearAll = document.getElementById('btnClearAll');
  const compareWelcome = document.getElementById('compareWelcome');
  const compareDashboard = document.getElementById('compareDashboard');
  const runsSummaryArea = document.getElementById('runsSummaryArea');
  const setupComparisonArea = document.getElementById('setupComparisonArea');
  const splitTimesArea = document.getElementById('splitTimesArea');
  const chartsArea = document.getElementById('compareChartsArea');
  const mapContainer = document.getElementById('compareMapContainer');
  const mapArea = document.getElementById('compareMapArea');
  const chartConfigsEl = document.getElementById('compareChartConfigs');
  const btnAddChart = document.getElementById('btnAddCompareChart');
  const splitSourceSelect = document.getElementById('splitSourceRun');
  const btnApplySplitsToAll = document.getElementById('btnApplySplitsToAll');
  const chkShowSetupDiff = document.getElementById('chkShowSetupDiff');
  const chkShowWeather = document.getElementById('chkShowWeather');
  const compareMapColorBy = document.getElementById('compareMapColorBy');

  // ===== Init =====
  function init() {
    btnAddRun?.addEventListener('click', () => runFileInput?.click());
    btnAddRunWelcome?.addEventListener('click', () => runFileInput?.click());
    btnLoadFromDB?.addEventListener('click', () => openRunPickerModal());
    btnLoadFromDBWelcome?.addEventListener('click', () => openRunPickerModal());
    btnImportBundle?.addEventListener('click', () => importRunBundle());
    btnClearAll?.addEventListener('click', clearAllRuns);
    btnAddChart?.addEventListener('click', () => addChart());
    btnApplySplitsToAll?.addEventListener('click', applySplitsToAll);
    chkShowSetupDiff?.addEventListener('change', renderAll);
    chkShowWeather?.addEventListener('change', renderAll);
    compareMapColorBy?.addEventListener('change', updateMap);

    // Check backend
    checkBackend();

    runFileInput?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      for (const file of files) {
        try {
          const buffer = await file.arrayBuffer();
          if (DataStore.hasBinaryMagic(buffer)) {
            addParsedRun(DataStore.parseBinary(buffer), file.name);
          } else {
            addRun(new TextDecoder().decode(buffer), file.name);
          }
        } catch (err) {
          showToast(`Errore "${file.name}": ${err.message}`, 'error');
        }
      }
      runFileInput.value = '';
    });

    // Drag & drop
    document.addEventListener('dragover', (e) => { e.preventDefault(); document.body.style.outline = '2px dashed var(--accent)'; document.body.style.outlineOffset = '-4px'; });
    document.addEventListener('dragleave', () => { document.body.style.outline = 'none'; });
    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      document.body.style.outline = 'none';
      const files = Array.from(e.dataTransfer?.files || []);
      for (const file of files) {
        try {
          const buffer = await file.arrayBuffer();
          if (DataStore.hasBinaryMagic(buffer)) {
            addParsedRun(DataStore.parseBinary(buffer), file.name);
          } else {
            addRun(new TextDecoder().decode(buffer), file.name);
          }
        } catch (err) {
          showToast(`Errore "${file.name}": ${err.message}`, 'error');
        }
      }
    });
  }

  // ===== Add a run =====
  function addRun(text, fileName) {
    const { columns, data } = parseCSV(text);
    addParsedRun({ columns, data }, fileName);
  }

  function addParsedRun(parsed, fileName) {
    const { columns, data } = parsed;
    applyTravelConversion(data, columns);
    const columnMeta = computeColumnMeta(data, columns);

    // Try to load splits from session or localStorage
    let splits = { start: null, end: null, intermediates: [] };
    try {
      const sessionKey = `bike-telemetry-session-${fileName}`;
      const sessionJson = localStorage.getItem(sessionKey);
      if (sessionJson) {
        const session = JSON.parse(sessionJson);
        if (session.splits) splits = session.splits;
      }
    } catch {}

    // Load run notes, bike, setup from localStorage
    const allNotes = getRunNotes();
    const notes = allNotes[fileName] || null;
    const bike = notes?.bike_id ? getBikeById(notes.bike_id) : null;
    const setup = notes?.setup_id ? getSetupById(notes.setup_id) : null;

    const color = RUN_COLORS[(nextRunId - 1) % RUN_COLORS.length];
    const run = {
      id: nextRunId++,
      fileName,
      color,
      data,
      columns,
      columnMeta,
      splits,
      visible: true,
      notes,
      bike,
      setup,
    };

    runs.push(run);
    showToast(`"${fileName}" caricato (${data.length} campioni)`, 'success');

    // Auto-create default charts on first 2 runs
    if (runs.length === 1) {
      createDefaultCharts(columns);
    }

    updateUI();
    renderAll();
  }

  // ===== Remove a run =====
  function removeRun(runId) {
    runs = runs.filter(r => r.id !== runId);
    updateUI();
    renderAll();
  }

  function clearAllRuns() {
    runs = [];
    charts = [];
    nextRunId = 1;
    nextChartId = 1;
    if (chartConfigsEl) chartConfigsEl.innerHTML = '';
    updateUI();
    renderAll();
  }

  function toggleRunVisibility(runId) {
    const run = runs.find(r => r.id === runId);
    if (run) {
      run.visible = !run.visible;
      updateRunsList();
      renderAll();
    }
  }

  // ===== Default charts =====
  function createDefaultCharts(columns) {
    // Travel %
    if (columns.includes('travel_r_pct')) {
      addChart({ yColumn: 'travel_r_pct', normalize: false });
    } else if (columns.includes('travel_r_mm')) {
      addChart({ yColumn: 'travel_r_mm', normalize: false });
    }
    // Accel Z (vertical)
    if (columns.includes('az')) {
      addChart({ yColumn: 'az', normalize: false });
    }
    // Altitude
    if (columns.includes('alt_m')) {
      addChart({ yColumn: 'alt_m', normalize: false });
    }
  }

  // ===== UI state =====
  function updateUI() {
    const count = runs.length;
    if (runCountEl) runCountEl.textContent = count > 0 ? `${count} run${count > 1 ? 's' : ''} caricata${count > 1 ? 'e' : ''}` : 'Nessuna run caricata';

    if (count > 0) {
      compareWelcome?.classList.add('hidden');
      compareDashboard?.classList.remove('hidden');
    } else {
      compareWelcome?.classList.remove('hidden');
      compareDashboard?.classList.add('hidden');
    }

    updateRunsList();
    updateSplitSourceSelect();
    updateColorBySelect();
  }

  function updateRunsList() {
    if (!runsListEl) return;
    if (runs.length === 0) {
      runsListEl.innerHTML = '<p class="muted small">Carica almeno 2 file per confrontare.</p>';
      return;
    }
    runsListEl.innerHTML = runs.map(r => {
      const samples = r.data.length;
      const duration = r.columnMeta.timestamp ? (r.columnMeta.timestamp.max - r.columnMeta.timestamp.min).toFixed(1) + 's' : '—';
      const setupName = r.setup ? r.setup.name : '';
      return `
        <div class="run-item" data-run-id="${r.id}">
          <div class="run-color-dot" style="background: ${r.color};"></div>
          <div class="run-item-info">
            <div class="run-item-name">${escHtml(r.fileName)}</div>
            <div class="run-item-meta">${samples} pt · ${duration}${setupName ? ' · ' + escHtml(setupName) : ''}</div>
          </div>
          <div class="run-item-actions">
            <button class="btn btn-ghost btn-sm run-visibility-btn ${r.visible ? '' : 'hidden-run'}" data-run-id="${r.id}" title="${r.visible ? 'Nascondi' : 'Mostra'}">
              ${r.visible ? '👁' : '👁‍🗨'}
            </button>
            ${r.dbRunId ? `<button class="btn btn-ghost btn-sm btn-export-run" data-db-run-id="${r.dbRunId}" title="Esporta run completa">📦</button>` : ''}
            <button class="btn btn-danger btn-sm btn-remove-run" data-run-id="${r.id}" title="Rimuovi">✕</button>
          </div>
        </div>
      `;
    }).join('');

    // Bind events
    runsListEl.querySelectorAll('.btn-remove-run').forEach(btn => {
      btn.addEventListener('click', () => removeRun(parseInt(btn.dataset.runId)));
    });
    runsListEl.querySelectorAll('.run-visibility-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleRunVisibility(parseInt(btn.dataset.runId)));
    });
    runsListEl.querySelectorAll('.btn-export-run').forEach(btn => {
      btn.addEventListener('click', async () => {
        const dbRunId = parseInt(btn.dataset.dbRunId);
        try {
          await ApiClient.downloadExport(dbRunId, `run-${dbRunId}-export.json`);
          showToast('Run esportata!', 'success');
        } catch (err) {
          showToast(`Errore esportazione: ${err.message}`, 'error');
        }
      });
    });
  }

  function updateSplitSourceSelect() {
    if (!splitSourceSelect) return;
    splitSourceSelect.innerHTML = '<option value="">— Seleziona run —</option>' +
      runs.map(r => `<option value="${r.id}">${escHtml(r.fileName)}</option>`).join('');
  }

  function updateColorBySelect() {
    if (!compareMapColorBy) return;
    // Get union of all columns
    const allCols = new Set();
    runs.forEach(r => r.columns.forEach(c => allCols.add(c)));
    const cols = [...allCols].filter(c => c !== 'lat' && c !== 'lon');
    compareMapColorBy.innerHTML = '<option value="none">Run (colore unico)</option>' +
      cols.map(c => `<option value="${c}">${KNOWN_LABELS[c] || c}</option>`).join('');
  }

  // ===== Render everything =====
  function renderAll() {
    renderRunsSummary();
    renderSetupComparison();
    renderSplitTimes();
    renderCharts();
    updateMap();
  }

  // ===== 1. Runs summary cards =====
  function renderRunsSummary() {
    if (!runsSummaryArea) return;
    const visibleRuns = runs.filter(r => r.visible);
    if (visibleRuns.length === 0) {
      runsSummaryArea.innerHTML = '';
      return;
    }

    // Compute total times for best/worst highlighting
    const totalTimes = visibleRuns.map(r => {
      const splits = r.splits;
      if (splits.start !== null && splits.end !== null) return splits.end - splits.start;
      if (r.columnMeta.timestamp) return r.columnMeta.timestamp.max - r.columnMeta.timestamp.min;
      return null;
    });
    const validTimes = totalTimes.filter(t => t !== null);
    const bestTime = validTimes.length > 0 ? Math.min(...validTimes) : null;
    const worstTime = validTimes.length > 0 ? Math.max(...validTimes) : null;

    runsSummaryArea.innerHTML = visibleRuns.map((r, idx) => {
      const totalTime = totalTimes[idx];
      const isBest = totalTime !== null && totalTime === bestTime && validTimes.length > 1;
      const isWorst = totalTime !== null && totalTime === worstTime && validTimes.length > 1 && bestTime !== worstTime;
      const n = r.notes;
      const showWeather = chkShowWeather?.checked;

      let conditionsHtml = '';
      if (showWeather && n) {
        const badges = [];
        if (n.weather) badges.push(`<span class="condition-badge weather">${weatherEmoji(n.weather)} ${n.weather}</span>`);
        if (n.temperature_c) badges.push(`<span class="condition-badge weather">🌡 ${n.temperature_c}°C</span>`);
        if (n.trail_condition) badges.push(`<span class="condition-badge trail">🏔 ${n.trail_condition}</span>`);
        if (n.feeling_rating) badges.push(`<span class="condition-badge feeling">${['😫','😕','😐','🙂','🤩'][(n.feeling_rating||3)-1]} ${n.feeling_rating}/5</span>`);
        if (badges.length > 0) conditionsHtml = `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">${badges.join('')}</div>`;
      }

      const bikeName = r.bike ? (r.bike.name || 'Bici') : '—';
      const setupName = r.setup ? (r.setup.name || 'Setup') : '—';

      return `
        <div class="run-summary-card" style="border-color: ${r.color}33;">
          <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: ${r.color};"></div>
          <div class="run-summary-header">
            <div class="run-summary-dot" style="background: ${r.color};"></div>
            <div class="run-summary-title">${escHtml(r.fileName)}</div>
          </div>
          <div class="run-summary-body">
            <div class="run-summary-row">
              <span class="run-summary-label">Tempo totale</span>
              <span class="run-summary-value ${isBest ? 'best' : ''} ${isWorst ? 'worst' : ''}">${totalTime !== null ? totalTime.toFixed(3) + 's' : '—'}${isBest ? ' 🏆' : ''}${isWorst ? ' 🐢' : ''}</span>
            </div>
            <div class="run-summary-row">
              <span class="run-summary-label">Campioni</span>
              <span class="run-summary-value">${r.data.length.toLocaleString()}</span>
            </div>
            <div class="run-summary-row">
              <span class="run-summary-label">🚲 Bici</span>
              <span class="run-summary-value" style="font-size: 0.78rem;">${escHtml(bikeName)}</span>
            </div>
            <div class="run-summary-row">
              <span class="run-summary-label">🔧 Setup</span>
              <span class="run-summary-value" style="font-size: 0.78rem;">${escHtml(setupName)}</span>
            </div>
            ${n?.location ? `<div class="run-summary-row"><span class="run-summary-label">📍 Luogo</span><span class="run-summary-value" style="font-size:0.78rem;">${escHtml(n.location)}${n.track_name ? ' — ' + escHtml(n.track_name) : ''}</span></div>` : ''}
            ${n?.date ? `<div class="run-summary-row"><span class="run-summary-label">📅 Data</span><span class="run-summary-value" style="font-size:0.78rem;">${escHtml(n.date)}</span></div>` : ''}
            ${conditionsHtml}
            ${n?.feeling_notes ? `<div style="margin-top: 6px; font-size: 0.72rem; color: var(--text-muted); font-style: italic;">"${escHtml(n.feeling_notes)}"</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // ===== 2. Setup comparison =====
  function renderSetupComparison() {
    if (!setupComparisonArea) return;
    if (!chkShowSetupDiff?.checked) { setupComparisonArea.innerHTML = ''; return; }

    const visibleRuns = runs.filter(r => r.visible);
    const runsWithSetup = visibleRuns.filter(r => r.setup);
    if (runsWithSetup.length < 2) {
      setupComparisonArea.innerHTML = '';
      return;
    }

    // Setup parameters to compare
    const sections = [
      { title: '🔽 Forcella', params: [
        ['Pressione (PSI)', 'fork_pressure_psi'], ['HSC', 'fork_hsc'], ['LSC', 'fork_lsc'],
        ['HSR', 'fork_hsr'], ['LSR', 'fork_lsr'], ['Tokens', 'fork_tokens'],
      ]},
      { title: '🔽 Ammortizzatore', params: [
        ['Pressione (PSI)', 'shock_pressure_psi'], ['HSC', 'shock_hsc'], ['LSC', 'shock_lsc'],
        ['HSR', 'shock_hsr'], ['LSR', 'shock_lsr'], ['Tokens', 'shock_tokens'],
      ]},
      { title: '🛞 Gomme', params: [
        ['Ant. Pressione (bar)', 'tyre_front_pressure_bar'], ['Ant. Inserto', 'tyre_front_insert'],
        ['Post. Pressione (bar)', 'tyre_rear_pressure_bar'], ['Post. Inserto', 'tyre_rear_insert'],
      ]},
    ];

    let tableHtml = `<tr><th class="param-name">Parametro</th>`;
    for (const r of visibleRuns) {
      tableHtml += `<th class="run-col-header" style="border-bottom-color: ${r.color};">${escHtml(r.fileName)}${r.setup ? '<br><span style="font-weight:400;text-transform:none;font-size:0.7rem;color:var(--text-muted);">' + escHtml(r.setup.name || '') + '</span>' : ''}</th>`;
    }
    tableHtml += '</tr>';

    for (const sec of sections) {
      tableHtml += `<tr><td colspan="${visibleRuns.length + 1}" class="param-section">${sec.title}</td></tr>`;
      for (const [label, key] of sec.params) {
        const values = visibleRuns.map(r => r.setup ? (r.setup[key] || '—') : '—');
        const allSame = values.every(v => v === values[0]);
        tableHtml += `<tr><td class="param-name">${escHtml(label)}</td>`;
        for (let i = 0; i < visibleRuns.length; i++) {
          const isDiff = !allSame && values[i] !== '—';
          tableHtml += `<td class="diff-cell ${isDiff ? 'diff-highlight' : ''}">${escHtml(String(values[i]))}</td>`;
        }
        tableHtml += '</tr>';
      }
    }

    setupComparisonArea.innerHTML = `
      <div class="setup-comparison-card">
        <div class="setup-comparison-header">
          <h3>🔧 Confronto Setup</h3>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Le celle evidenziate indicano differenze</span>
        </div>
        <div style="overflow-x: auto;">
          <table class="setup-comparison-table">
            <thead>${tableHtml.split('</tr>').slice(0, 1).join('</tr>') + '</tr>'}</thead>
            <tbody>${tableHtml.split('</tr>').slice(1).map(r => r + '</tr>').join('')}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ===== 3. Split times comparison =====
  function renderSplitTimes() {
    if (!splitTimesArea) return;

    const visibleRuns = runs.filter(r => r.visible);
    // Find runs that have splits configured
    const runsWithSplits = visibleRuns.filter(r => r.splits.start !== null && r.splits.end !== null);
    if (runsWithSplits.length < 2) {
      splitTimesArea.innerHTML = '';
      return;
    }

    // Build split segments for each run
    const runSegments = runsWithSplits.map(r => {
      const allSplitTimes = [];
      if (r.splits.start !== null) allSplitTimes.push({ type: 'start', time: r.splits.start, label: 'Partenza' });
      if (r.splits.intermediates) {
        r.splits.intermediates.forEach((t, i) => allSplitTimes.push({ type: 'intermediate', time: t, label: `Intermedio ${i + 1}` }));
      }
      if (r.splits.end !== null) allSplitTimes.push({ type: 'end', time: r.splits.end, label: 'Arrivo' });
      allSplitTimes.sort((a, b) => a.time - b.time);

      const segments = [];
      for (let i = 0; i < allSplitTimes.length - 1; i++) {
        segments.push({
          from: allSplitTimes[i].label,
          to: allSplitTimes[i + 1].label,
          time: allSplitTimes[i + 1].time - allSplitTimes[i].time,
        });
      }
      const totalTime = (r.splits.end || 0) - (r.splits.start || 0);
      return { run: r, segments, totalTime, splitCount: allSplitTimes.length };
    });

    // Find the max number of segments
    const maxSegments = Math.max(...runSegments.map(rs => rs.segments.length));
    if (maxSegments === 0) { splitTimesArea.innerHTML = ''; return; }

    // Build table
    let headerHtml = '<tr><th>Settore</th>';
    for (const rs of runSegments) {
      headerHtml += `<th class="run-col-header" style="border-bottom-color: ${rs.run.color};">${escHtml(rs.run.fileName)}</th>`;
    }
    headerHtml += '</tr>';

    let bodyHtml = '';
    for (let seg = 0; seg < maxSegments; seg++) {
      const segTimes = runSegments.map(rs => rs.segments[seg]?.time ?? null);
      const validTimes = segTimes.filter(t => t !== null);
      const bestSegTime = validTimes.length > 0 ? Math.min(...validTimes) : null;

      const segLabel = runSegments[0].segments[seg]
        ? `${runSegments[0].segments[seg].from} → ${runSegments[0].segments[seg].to}`
        : `Settore ${seg + 1}`;

      bodyHtml += `<tr><td class="param-name">${escHtml(segLabel)}</td>`;
      for (let i = 0; i < runSegments.length; i++) {
        const t = segTimes[i];
        if (t === null) {
          bodyHtml += '<td>—</td>';
        } else {
          const isBest = t === bestSegTime && validTimes.length > 1;
          const delta = bestSegTime !== null ? t - bestSegTime : 0;
          const deltaStr = delta > 0.001 ? `<span class="split-time-delta positive">+${delta.toFixed(3)}s</span>` : '';
          bodyHtml += `<td class="${isBest ? 'split-time-best' : ''}">${t.toFixed(3)}s ${isBest ? '🏆' : deltaStr}</td>`;
        }
      }
      bodyHtml += '</tr>';
    }

    // Total row
    const totalTimes = runSegments.map(rs => rs.totalTime);
    const bestTotal = Math.min(...totalTimes.filter(t => t > 0));
    bodyHtml += '<tr style="border-top: 2px solid var(--border); font-weight: 700;"><td class="param-name" style="color: var(--accent);">⏱ TOTALE</td>';
    for (let i = 0; i < runSegments.length; i++) {
      const t = totalTimes[i];
      const isBest = t === bestTotal && totalTimes.filter(tt => tt > 0).length > 1;
      const delta = t - bestTotal;
      const deltaStr = delta > 0.001 ? `<span class="split-time-delta positive">+${delta.toFixed(3)}s</span>` : '';
      bodyHtml += `<td class="${isBest ? 'split-time-best' : ''}">${t.toFixed(3)}s ${isBest ? '🏆' : deltaStr}</td>`;
    }
    bodyHtml += '</tr>';

    splitTimesArea.innerHTML = `
      <div class="split-times-card">
        <div class="split-times-header">
          <h3>⏱ Confronto Tempi Settore</h3>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${runsWithSplits.length} runs con splits</span>
        </div>
        <div style="overflow-x: auto;">
          <table class="split-times-table">
            <thead>${headerHtml}</thead>
            <tbody>${bodyHtml}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ===== 4. Overlay charts =====
  function addChart(config = null) {
    const allCols = getUnionColumns();
    if (allCols.length === 0) return;

    const defaultConfig = config || {
      yColumn: allCols.includes('travel_r_pct') ? 'travel_r_pct' : (allCols.includes('az') ? 'az' : allCols[1] || allCols[0]),
      normalize: false,
    };

    const chart = { id: nextChartId++, config: defaultConfig };
    charts.push(chart);

    // Create config card in sidebar
    createChartConfigCard(chart);
    // Create chart element in main area
    createChartElement(chart);
    renderChart(chart);
  }

  function removeChart(chartId) {
    charts = charts.filter(c => c.id !== chartId);
    document.querySelector(`.compare-config-card[data-chart-id="${chartId}"]`)?.remove();
    const chartCard = document.querySelector(`.compare-chart-card[data-chart-id="${chartId}"]`);
    if (chartCard) {
      const plotEl = chartCard.querySelector('.compare-chart-container');
      if (plotEl) Plotly.purge(plotEl);
      chartCard.remove();
    }
  }

  function getUnionColumns() {
    const allCols = new Set();
    runs.forEach(r => r.columns.forEach(c => allCols.add(c)));
    return [...allCols];
  }

  function createChartConfigCard(chart) {
    if (!chartConfigsEl) return;
    const allCols = getUnionColumns();
    const card = document.createElement('div');
    card.className = 'compare-config-card';
    card.dataset.chartId = chart.id;

    const colOptions = allCols.map(c => `<option value="${c}" ${c === chart.config.yColumn ? 'selected' : ''}>${KNOWN_LABELS[c] || c}</option>`).join('');

    card.innerHTML = `
      <div class="compare-config-header">
        <span>Grafico #${chart.id}</span>
        <button class="btn btn-danger btn-sm btn-remove-compare-chart" data-chart-id="${chart.id}">✕</button>
      </div>
      <div class="control-group">
        <label class="control-label">Canale Y</label>
        <select class="select-input compare-y-select" data-chart-id="${chart.id}">${colOptions}</select>
      </div>
      <div class="toggle-row" style="margin-top: 4px;">
        <label>Normalizza (0-1)</label>
        <input type="checkbox" class="compare-normalize-chk" data-chart-id="${chart.id}" ${chart.config.normalize ? 'checked' : ''} />
      </div>
    `;

    card.querySelector('.btn-remove-compare-chart').addEventListener('click', () => removeChart(chart.id));
    card.querySelector('.compare-y-select').addEventListener('change', (e) => {
      chart.config.yColumn = e.target.value;
      renderChart(chart);
    });
    card.querySelector('.compare-normalize-chk').addEventListener('change', (e) => {
      chart.config.normalize = e.target.checked;
      renderChart(chart);
    });

    chartConfigsEl.appendChild(card);
  }

  function createChartElement(chart) {
    if (!chartsArea) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'compare-chart-card';
    wrapper.dataset.chartId = chart.id;
    wrapper.innerHTML = `
      <div class="compare-chart-header">
        <h4>${KNOWN_LABELS[chart.config.yColumn] || chart.config.yColumn}</h4>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-ghost btn-sm btn-fullscreen-compare" data-chart-id="${chart.id}">⛶</button>
          <button class="btn btn-danger btn-sm btn-close-compare" data-chart-id="${chart.id}">✕</button>
        </div>
      </div>
      <div class="compare-chart-container" id="compare-plot-${chart.id}"></div>
    `;

    wrapper.querySelector('.btn-close-compare').addEventListener('click', () => removeChart(chart.id));
    wrapper.querySelector('.btn-fullscreen-compare').addEventListener('click', () => {
      const plotEl = wrapper.querySelector('.compare-chart-container');
      if (plotEl?.requestFullscreen) plotEl.requestFullscreen();
    });

    chartsArea.appendChild(wrapper);
  }

  function renderChart(chart) {
    const plotEl = document.getElementById(`compare-plot-${chart.id}`);
    if (!plotEl) return;

    const { yColumn, normalize } = chart.config;
    const visibleRuns = runs.filter(r => r.visible && r.columns.includes(yColumn));
    if (visibleRuns.length === 0) {
      Plotly.react(plotEl, [], { ...PLOTLY_LAYOUT_BASE, annotations: [{ text: 'Nessun dato', showarrow: false, font: { size: 14, color: '#8b949e' }, xref: 'paper', yref: 'paper', x: 0.5, y: 0.5 }] }, { responsive: true });
      return;
    }

    // Update header title
    const headerEl = plotEl.closest('.compare-chart-card')?.querySelector('h4');
    if (headerEl) headerEl.textContent = (KNOWN_LABELS[yColumn] || yColumn) + (normalize ? ' (normalizzato)' : '');

    const traces = [];
    for (const run of visibleRuns) {
      // Get filtered data (apply splits)
      let data = run.data;
      if (run.splits.start !== null || run.splits.end !== null) {
        data = data.filter(row => {
          const t = row.timestamp;
          if (t === null || t === undefined) return true;
          if (run.splits.start !== null && t < run.splits.start) return false;
          if (run.splits.end !== null && t > run.splits.end) return false;
          return true;
        });
      }

      // X axis: relative time (start = 0)
      const startOffset = run.splits.start ?? (run.columnMeta.timestamp?.min ?? 0);
      const xVals = data.map(r => r.timestamp !== null ? r.timestamp - startOffset : null);
      let yVals = data.map(r => r[yColumn]);

      if (normalize) {
        const meta = run.columnMeta[yColumn];
        if (meta && meta.max !== meta.min) {
          const range = meta.max - meta.min;
          yVals = yVals.map(v => v !== null && v !== undefined ? (v - meta.min) / range : null);
        }
      }

      traces.push({
        type: 'scattergl',
        mode: 'lines',
        x: xVals,
        y: yVals,
        name: run.fileName + (run.setup ? ` (${run.setup.name || 'setup'})` : ''),
        line: { color: run.color, width: 1.5 },
        hovertemplate: `%{x:.3f}s<br>%{y:.4f}<extra>${escHtml(run.fileName)}</extra>`,
      });
    }

    const yTitle = normalize ? `${KNOWN_LABELS[yColumn] || yColumn} (norm.)` : `${KNOWN_LABELS[yColumn] || yColumn}${KNOWN_UNITS[yColumn] ? ' (' + KNOWN_UNITS[yColumn] + ')' : ''}`;

    const layout = {
      ...PLOTLY_LAYOUT_BASE,
      xaxis: {
        ...PLOTLY_LAYOUT_BASE.xaxis,
        title: { text: 'Tempo (s)', font: { size: 11 } },
      },
      yaxis: {
        ...PLOTLY_LAYOUT_BASE.yaxis,
        title: { text: yTitle, font: { size: 11 } },
      },
    };

    Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: true, displaylogo: false });
  }

  function renderCharts() {
    charts.forEach(c => renderChart(c));
  }

  // ===== 5. Map with all tracks =====
  function initMap() {
    if (map) return;
    if (!mapContainer) return;

    map = L.map(mapContainer, {
      zoomControl: true,
      attributionControl: true,
      maxZoom: 22,
    }).setView([41.9, 12.5], 13);

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 22, maxNativeZoom: 19,
    });

    const labelsOverlay = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 22, maxNativeZoom: 19, opacity: 0.6,
    });

    const dark = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd', maxZoom: 22, maxNativeZoom: 19,
    });

    satellite.addTo(map);
    labelsOverlay.addTo(map);

    L.control.layers({
      'Satellite': satellite,
      'Dark': dark,
    }, {
      'Etichette strade': labelsOverlay,
    }, { position: 'topright', collapsed: true }).addTo(map);
  }

  function updateMap() {
    if (!mapContainer) return;
    initMap();

    // Clear all run layers
    Object.values(mapLayers).forEach(lg => { if (map.hasLayer(lg)) map.removeLayer(lg); });
    mapLayers = {};

    const visibleRuns = runs.filter(r => r.visible);
    if (visibleRuns.length === 0) return;

    const allBounds = [];

    for (const run of visibleRuns) {
      const gpsPoints = run.data.filter(r => r.lat && r.lon && Math.abs(r.lat) > 0.001 && Math.abs(r.lon) > 0.001);
      if (gpsPoints.length === 0) continue;

      const lg = L.layerGroup().addTo(map);
      mapLayers[run.id] = lg;

      const latlngs = gpsPoints.map(p => [p.lat, p.lon]);
      allBounds.push(...latlngs);

      L.polyline(latlngs, {
        color: run.color,
        weight: 3.5,
        opacity: 0.85,
      }).addTo(lg);

      // Start/end markers
      if (latlngs.length > 0) {
        // Start marker
        L.circleMarker(latlngs[0], {
          radius: 6, color: run.color, fillColor: '#3fb950', fillOpacity: 1, weight: 2,
        }).bindPopup(`<b>${escHtml(run.fileName)}</b><br>Partenza`).addTo(lg);

        // End marker
        L.circleMarker(latlngs[latlngs.length - 1], {
          radius: 6, color: run.color, fillColor: '#f85149', fillOpacity: 1, weight: 2,
        }).bindPopup(`<b>${escHtml(run.fileName)}</b><br>Arrivo`).addTo(lg);
      }
    }

    // Fit bounds
    if (allBounds.length > 0) {
      map.fitBounds(L.latLngBounds(allBounds), { padding: [30, 30] });
    }

    // Map legend
    renderMapLegend();

    setTimeout(() => map.invalidateSize(), 100);
  }

  function renderMapLegend() {
    const legendContainer = document.getElementById('compareMapLegend');
    if (legendContainer) legendContainer.remove();

    const visibleRuns = runs.filter(r => r.visible);
    if (visibleRuns.length === 0) return;

    const legend = document.createElement('div');
    legend.className = 'map-legend';
    legend.id = 'compareMapLegend';
    legend.innerHTML = visibleRuns.map(r =>
      `<div class="map-legend-item"><div class="map-legend-dot" style="background: ${r.color};"></div><span class="map-legend-name">${escHtml(r.fileName)}</span></div>`
    ).join('');

    mapContainer?.parentElement?.appendChild(legend);
  }

  // ===== Apply splits from one run to all =====
  function applySplitsToAll() {
    const sourceId = parseInt(splitSourceSelect?.value);
    if (!sourceId) { showToast('Seleziona una run sorgente', 'error'); return; }
    const sourceRun = runs.find(r => r.id === sourceId);
    if (!sourceRun) return;

    if (sourceRun.splits.start === null && sourceRun.splits.end === null) {
      showToast('La run selezionata non ha splits configurati', 'error');
      return;
    }

    // For each other run, we apply the same relative split positions
    // This makes sense only if the tracks are similar (same trail)
    // We use the relative time offsets from the source run
    const sourceStart = sourceRun.splits.start ?? sourceRun.columnMeta.timestamp?.min ?? 0;
    const relEnd = sourceRun.splits.end !== null ? sourceRun.splits.end - sourceStart : null;
    const relInts = (sourceRun.splits.intermediates || []).map(t => t - sourceStart);

    for (const run of runs) {
      if (run.id === sourceId) continue;
      const runStart = run.columnMeta.timestamp?.min ?? 0;
      run.splits = {
        start: runStart,
        end: relEnd !== null ? runStart + relEnd : null,
        intermediates: relInts.map(t => runStart + t),
      };
    }

    showToast(`Splits applicati a tutte le ${runs.length} runs`, 'success');
    renderAll();
  }

  // ===== Load run from DB =====
  async function addRunFromDB(runId) {
    try {
      showToast('Caricamento run dal database...', 'info');
      const [run, dataResp] = await Promise.all([
        ApiClient.getRun(runId),
        ApiClient.getRunData(runId),
      ]);

      const data = dataResp.data;
      const columns = dataResp.columns || run.columns || [];

      // Apply travel conversion if needed
      applyTravelConversion(data, columns);
      const columnMeta = computeColumnMeta(data, columns);

      // Parse splits
      let splits = { start: null, end: null, intermediates: [] };
      if (run.splits) {
        splits = {
          start: run.splits.start ?? null,
          end: run.splits.end ?? null,
          intermediates: run.splits.intermediates || [],
        };
      }

      const color = RUN_COLORS[(nextRunId - 1) % RUN_COLORS.length];
      const runObj = {
        id: nextRunId++,
        dbRunId: run.id,
        fileName: run.file_name || run.name || `Run #${run.id}`,
        color,
        data,
        columns,
        columnMeta,
        splits,
        visible: true,
        notes: {
          bike_id: run.bike_id,
          setup_id: run.setup_id,
          date: run.date,
          location: run.location,
          track_name: run.track_name,
          weather: run.weather,
          temperature_c: run.temperature_c,
          humidity_pct: run.humidity_pct,
          trail_condition: run.trail_condition,
          rider_name: run.rider_name,
          rider_weight_kg: run.rider_weight_kg,
          session_goal: run.session_goal,
          feeling_rating: run.feeling_rating,
          feeling_notes: run.feeling_notes,
          tags: run.tags,
        },
        bike: run.bike || null,
        setup: run.setup || null,
      };

      runs.push(runObj);
      showToast(`"${runObj.fileName}" caricata dal DB (${data.length} campioni)`, 'success');

      if (runs.length === 1) {
        createDefaultCharts(columns);
      }

      updateUI();
      renderAll();
    } catch (err) {
      showToast(`Errore caricamento dal DB: ${err.message}`, 'error');
      console.error(err);
    }
  }

  // ===== Run picker modal (select from DB) =====
  async function openRunPickerModal() {
    if (!isBackendOnline) {
      const online = await checkBackend();
      if (!online) {
        showToast('Database non disponibile', 'error');
        return;
      }
    }

    try {
      const dbRuns = await ApiClient.listRuns();
      if (dbRuns.length === 0) {
        showToast('Nessuna run nel database. Carica prima un file dalla pagina di analisi.', 'info');
        return;
      }

      // Filter out already loaded runs
      const loadedDbIds = new Set(runs.filter(r => r.dbRunId).map(r => r.dbRunId));

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-content" style="max-width: 700px; max-height: 80vh;">
          <div class="modal-header">
            <h3>📦 Seleziona Runs dal Database</h3>
            <button class="btn btn-ghost btn-sm modal-close">✕</button>
          </div>
          <div class="modal-body" style="overflow-y: auto; max-height: 55vh;">
            <p class="muted small" style="margin-bottom: 12px;">Seleziona le runs da caricare per il confronto. Puoi selezionarne più di una.</p>
            <div class="db-runs-list">
              ${dbRuns.map(r => {
                const isLoaded = loadedDbIds.has(r.id);
                const duration = r.duration_s ? r.duration_s.toFixed(1) + 's' : '—';
                return `
                  <label class="db-run-item ${isLoaded ? 'already-loaded' : ''}" data-run-id="${r.id}">
                    <input type="checkbox" class="db-run-checkbox" value="${r.id}" ${isLoaded ? 'disabled checked' : ''} />
                    <div class="db-run-info">
                      <div class="db-run-name">${escHtml(r.file_name || r.name)}</div>
                      <div class="db-run-meta">
                        ${r.sample_count} pt · ${duration}
                        ${r.bike_name ? ' · 🚲 ' + escHtml(r.bike_name) : ''}
                        ${r.setup_name ? ' · 🔧 ' + escHtml(r.setup_name) : ''}
                        ${r.location ? ' · 📍 ' + escHtml(r.location) : ''}
                        ${r.date ? ' · 📅 ' + escHtml(r.date) : ''}
                        ${r.weather ? ' · ' + weatherEmoji(r.weather) : ''}
                      </div>
                    </div>
                    ${isLoaded ? '<span class="db-run-loaded-badge">Già caricata</span>' : ''}
                  </label>
                `;
              }).join('')}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost modal-cancel">Annulla</button>
            <button class="btn btn-primary modal-load">📥 Carica Selezionate</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
      overlay.querySelector('.modal-cancel').addEventListener('click', () => overlay.remove());
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

      overlay.querySelector('.modal-load').addEventListener('click', async () => {
        const checkboxes = overlay.querySelectorAll('.db-run-checkbox:checked:not(:disabled)');
        const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        overlay.remove();

        if (selectedIds.length === 0) {
          showToast('Nessuna run selezionata', 'info');
          return;
        }

        for (const id of selectedIds) {
          await addRunFromDB(id);
        }
      });
    } catch (err) {
      showToast(`Errore: ${err.message}`, 'error');
    }
  }

  // ===== Import run bundle from file =====
  async function importRunBundle() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const bundle = JSON.parse(text);

        if (bundle.version && bundle.run && bundle.telemetry_data) {
          // It's a DB export bundle — import to DB first, then load
          if (isBackendOnline) {
            const imported = await ApiClient.importRun(bundle);
            showToast(`Run "${imported.file_name}" importata nel database`, 'success');
            await addRunFromDB(imported.id);
          } else {
            // Offline: load directly from bundle data
            const data = bundle.telemetry_data;
            const columns = bundle.telemetry_columns || [];
            applyTravelConversion(data, columns);
            const columnMeta = computeColumnMeta(data, columns);

            const color = RUN_COLORS[(nextRunId - 1) % RUN_COLORS.length];
            const run = bundle.run;
            const runObj = {
              id: nextRunId++,
              fileName: run.file_name || run.name || file.name,
              color,
              data,
              columns,
              columnMeta,
              splits: run.splits || { start: null, end: null, intermediates: [] },
              visible: true,
              notes: run,
              bike: bundle.bike || null,
              setup: bundle.setup || null,
            };
            runs.push(runObj);
            showToast(`"${runObj.fileName}" importata (${data.length} campioni)`, 'success');
            if (runs.length === 1) createDefaultCharts(columns);
            updateUI();
            renderAll();
          }
        } else {
          showToast('Formato file non riconosciuto', 'error');
        }
      } catch (err) {
        showToast(`Errore importazione: ${err.message}`, 'error');
      }
    });
    input.click();
  }

  // ===== Helpers =====
  function weatherEmoji(w) {
    const map = { 'soleggiato': '☀️', 'nuvoloso': '☁️', 'pioggia leggera': '🌦', 'pioggia forte': '🌧', 'fango': '💧', 'neve': '❄️', 'vento': '💨', 'nebbia': '🌫' };
    return map[w] || '🌤';
  }

  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ===== Start =====
  init();

  return { addRun, addRunFromDB, removeRun, clearAllRuns, runs: () => runs };
})();

// ===== Toast =====
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export default CompareView;
