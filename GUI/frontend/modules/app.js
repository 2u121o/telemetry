/**
 * APP MODULE — Main orchestrator
 * Wires all modules together and handles global UI events.
 */

import DataStore from './data-store.js';
import ChartManager from './chart-manager.js';
import FilterPanel from './filter-panel.js';
import MapView from './map-view.js';
import StatsPanel from './stats-panel.js';
import DataTable from './data-table.js';
import SplitsPanel from './splits-panel.js';
import SagPanel from './sag-panel.js';
import SettingsPanel from './settings-panel.js';
import SessionManager from './session-manager.js';
import DbManager from './db-manager.js';
import ApiClient from './api-client.js';

// ---- DOM References ----
const btnLoadFile = document.getElementById('btnLoadFile');
const btnLoadFileWelcome = document.getElementById('btnLoadFileWelcome');
const btnDebugBin = document.getElementById('btnDebugBin');
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');
const dataInfoEl = document.getElementById('dataInfo');
const welcomeScreen = document.getElementById('welcomeScreen');
const dashboard = document.getElementById('dashboard');

// Sidebar tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const panels = document.querySelectorAll('.sidebar-panel');

// Chart controls
const chartsArea = document.getElementById('chartsArea');
const chartConfigs = document.getElementById('chartConfigs');
const btnAddChart = document.getElementById('btnAddChart');

// Filter controls
const filterConfigs = document.getElementById('filterConfigs');
const btnAddFilter = document.getElementById('btnAddFilter');
const btnApplyFilters = document.getElementById('btnApplyFilters');
const btnClearFilters = document.getElementById('btnClearFilters');

// Stats
const statsContent = document.getElementById('statsContent');

// SAG
const sagArea = document.getElementById('sagArea');
const sagResults = document.getElementById('sagResults');

// Splits
const splitsContent = document.getElementById('splitsContent');

// Map
const mapContainer = document.getElementById('mapContainer');
const mapArea = document.getElementById('mapArea');
const mapColorBy = document.getElementById('mapColorBy');
const btnToggleMap = document.getElementById('btnToggleMap');

// Table
const dataTableHead = document.getElementById('dataTableHead');
const dataTableBody = document.getElementById('dataTableBody');
const tableCount = document.getElementById('tableCount');
const tablePagination = document.getElementById('tablePagination');
const tableArea = document.getElementById('tableArea');
const tablePageSize = document.getElementById('tablePageSize');
const btnExportCSV = document.getElementById('btnExportCSV');

// Cursor bar
const cursorBar = document.getElementById('cursorBar');
const cursorValues = document.getElementById('cursorValues');

// Settings
const settingsContent = document.getElementById('settingsContent');

// Map placement controls
const btnPlaceStart = document.getElementById('btnPlaceStart');
const btnPlaceEnd = document.getElementById('btnPlaceEnd');
const btnPlaceIntermediate = document.getElementById('btnPlaceIntermediate');
const btnCancelPlacement = document.getElementById('btnCancelPlacement');
const placementStatus = document.getElementById('placementStatus');

// ---- Initialize Modules ----
ChartManager.init(chartsArea, chartConfigs);
FilterPanel.init(filterConfigs);
MapView.init(mapContainer, mapArea, mapColorBy);
MapView.initPlacementControls(
  { start: btnPlaceStart, end: btnPlaceEnd, intermediate: btnPlaceIntermediate, cancel: btnCancelPlacement },
  placementStatus
);
StatsPanel.init(statsContent);
DataTable.init(dataTableHead, dataTableBody, tableCount, tablePagination, tableArea, tablePageSize, btnExportCSV);
SplitsPanel.init(splitsContent);
SagPanel.init(sagArea, sagResults);
SettingsPanel.init(settingsContent);

// Expose settings globally so DataStore and MapView can access them
window.__telemetrySettings = SettingsPanel;

// Expose DbManager globally for other modules
window.__dbManager = DbManager;

// Initialize DB connection (non-blocking — works offline too)
const dbStatusEl = document.getElementById('dbStatus');
DbManager.init().then(online => {
  if (dbStatusEl) {
    if (online) {
      dbStatusEl.textContent = '🟢';
      dbStatusEl.className = 'db-status online';
      dbStatusEl.title = 'Database connesso';
    } else {
      dbStatusEl.textContent = '⚫';
      dbStatusEl.className = 'db-status offline';
      dbStatusEl.title = 'Database offline — modalità locale';
    }
  }
});

// ---- Sidebar Tab Switching ----
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetPanel = btn.dataset.panel;

    tabBtns.forEach(b => b.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(targetPanel)?.classList.add('active');

    // Show/hide map and table based on active tab
    if (targetPanel === 'panel-map') {
      MapView.show();
    }
    if (targetPanel === 'panel-table') {
      DataTable.show();
    }
    if (targetPanel === 'panel-sag') {
      SagPanel.show();
      chartsArea?.classList.add('hidden');
      mapArea?.classList.add('hidden');
      tableArea?.classList.add('hidden');
    } else {
      SagPanel.hide();
      chartsArea?.classList.remove('hidden');
    }
  });
});

// ---- File Loading ----
function triggerFileLoad() {
  fileInput.click();
}

btnLoadFile?.addEventListener('click', triggerFileLoad);
btnLoadFileWelcome?.addEventListener('click', triggerFileLoad);
btnDebugBin?.addEventListener('click', async () => {
  try {
    const result = await ApiClient.debugBinFile();
    DataStore.loadParsedData({ columns: result.columns, data: result.data }, result.file_name);
    showToast(`Debug BIN backend: ${result.data.length.toLocaleString()} campioni`, 'success');
  } catch (err) {
    showToast(`Errore Debug BIN: ${err.message}`, 'error');
    alert(`Errore Debug BIN: ${err.message}`);
    console.error(err);
  }
});

// Store raw CSV text for DB upload
let lastCsvText = null;
let isFirstLoad = true; // Track if this is the first file load

async function handleFileLoad(content, fileName) {
  // Check if there are existing splits from a previous run
  const prevSplits = DataStore.getSplits();
  const hasPrevSplits = prevSplits.start !== null || prevSplits.end !== null ||
                        (prevSplits.intermediates && prevSplits.intermediates.length > 0);

  // If not first load and there are existing splits, prompt user
  if (!isFirstLoad && hasPrevSplits) {
    await SplitsPanel.promptSplitsReuse();
  }

  if (content instanceof ArrayBuffer) {
    lastCsvText = null;
    DataStore.loadFromArrayBuffer(content, fileName);
    showToast(`BIN letto: ${DataStore.getRowCount().toLocaleString()} campioni`, 'success');
    setTimeout(() => {
      try {
        lastCsvText = DataStore.binaryToCsvText(content);
        DbManager.uploadCurrentRun(lastCsvText, fileName);
      } catch (err) {
        console.warn('Upload DB saltato per file binario:', err);
      }
    }, 0);
  } else {
    lastCsvText = content;
    DataStore.loadFromText(content, fileName);
    DbManager.uploadCurrentRun(lastCsvText, fileName);
  }
  isFirstLoad = false;
  showToast(`File "${fileName}" caricato con successo!`, 'success');
}

fileInput?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();
    if (DataStore.hasBinaryMagic(buffer)) {
      await handleFileLoad(buffer, file.name);
    } else {
      await handleFileLoad(new TextDecoder().decode(buffer), file.name);
    }
  } catch (err) {
    showToast(`Errore nel caricamento: ${err.message}`, 'error');
    alert(`Errore nel caricamento: ${err.message}`);
    console.error(err);
  }

  // Reset input so same file can be reloaded
  fileInput.value = '';
});

// ---- Data Events ----
DataStore.on('data-loaded', ({ data, columns, columnMeta, fileName }) => {
  // Update UI
  fileNameEl.textContent = fileName;
  dataInfoEl.textContent = `${data.length.toLocaleString()} campioni · ${columns.length} canali`;

  // Switch from welcome to dashboard
  welcomeScreen?.classList.add('hidden');
  dashboard?.classList.remove('hidden');

  // Auto-create some default charts
  ChartManager.removeAllCharts();

  // Chart 1: Accelerometer (all axes vs time)
  const accCols = ['ax', 'ay', 'az'].filter(c => columns.includes(c));
  if (accCols.length > 0) {
    ChartManager.addChart({
      type: 'line',
      xColumn: 'timestamp',
      yColumns: accCols,
      zColumn: columns[2] || columns[0],
    });
  }

  // Chart 2: Gyroscope
  const gyroCols = ['wx', 'wy', 'wz'].filter(c => columns.includes(c));
  if (gyroCols.length > 0) {
    ChartManager.addChart({
      type: 'line',
      xColumn: 'timestamp',
      yColumns: gyroCols,
      zColumn: columns[2] || columns[0],
    });
  }

  // Chart 3: Travel (% by default, fallback to mm, then raw voltage)
  if (columns.includes('travel_r_pct')) {
    ChartManager.addChart({
      type: 'line',
      xColumn: 'timestamp',
      yColumns: ['travel_r_pct'],
      zColumn: columns[2] || columns[0],
    });
  } else if (columns.includes('travel_r_mm')) {
    ChartManager.addChart({
      type: 'line',
      xColumn: 'timestamp',
      yColumns: ['travel_r_mm'],
      zColumn: columns[2] || columns[0],
    });
  } else if (columns.includes('travel_r_v')) {
    ChartManager.addChart({
      type: 'line',
      xColumn: 'timestamp',
      yColumns: ['travel_r_v'],
      zColumn: columns[2] || columns[0],
    });
  }

  if (ChartManager.getCharts().length === 0) {
    const fallback = columns.find(c => c !== 'timestamp' && data.some(r => Number.isFinite(r[c])));
    if (fallback) {
      ChartManager.addChart({
        type: 'line',
        xColumn: columns.includes('timestamp') ? 'timestamp' : columns[0],
        yColumns: [fallback],
        zColumn: fallback,
      });
    } else {
      showToast('Dati caricati, ma nessuna colonna numerica disponibile per i grafici', 'error');
    }
  }

  // Show map if GPS data is valid
  const hasGPS = data.length <= 10000 && data.some(r => r.lat && r.lon && Math.abs(r.lat) > 0.001 && Math.abs(r.lon) > 0.001);
  if (hasGPS) {
    MapView.show();
  }

  // Table is hidden by default — user can show it via the Table tab

  // Re-render settings panel so recording notes form shows the new file name
  SettingsPanel.render();
});

DataStore.on('data-filtered', ({ data }) => {
  dataInfoEl.textContent = `${data.length.toLocaleString()} campioni${data.length !== DataStore.getRowCount() ? ` (filtrati da ${DataStore.getRowCount().toLocaleString()})` : ''} · ${DataStore.getColumns().length} canali`;
});

// ---- Cursor Bar: show values at hovered point ----
DataStore.on('cursor-changed', ({ row, timestamp }) => {
  if (!cursorBar || !cursorValues || !row) return;

  cursorBar.classList.remove('hidden');

  const meta = DataStore.getColumnMeta();
  const cols = DataStore.getColumns();

  const decimals = SettingsPanel.get('decimals') ?? 3;
  const relTime = DataStore.toRelativeTime(timestamp);
  let html = `<span class="cursor-time">t = ${relTime.toFixed(decimals)}s</span>`;
  for (const col of cols) {
    if (col === 'timestamp') continue;
    const label = meta[col]?.label || col;
    const unit = meta[col]?.unit || '';
    const val = row[col];
    const formatted = val !== null && val !== undefined ? val.toFixed(decimals + 1) : '—';
    html += `<span class="cursor-item"><span class="cursor-label">${label}:</span> <span class="cursor-val">${formatted}</span><span class="cursor-unit">${unit}</span></span>`;
  }

  cursorValues.innerHTML = html;
});

// ---- Chart Controls ----
btnAddChart?.addEventListener('click', () => {
  ChartManager.addChart();
});

// ---- Filter Controls ----
btnAddFilter?.addEventListener('click', () => {
  FilterPanel.addFilter();
});

btnApplyFilters?.addEventListener('click', () => {
  FilterPanel.applyFilters();
});

btnClearFilters?.addEventListener('click', () => {
  FilterPanel.clearAllFilters();
  showToast('Tutti i filtri rimossi', 'info');
});

// ---- Map Controls ----
btnToggleMap?.addEventListener('click', () => {
  MapView.toggle();
  btnToggleMap.textContent = mapArea?.classList.contains('hidden') ? 'Mostra' : 'Nascondi';
});

// ---- Toast System ----
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---- Keyboard Shortcuts ----
document.addEventListener('keydown', (e) => {
  // Ctrl+O: Open file
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    e.preventDefault();
    triggerFileLoad();
  }
});

// ---- Drag & Drop ----
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.style.outline = '2px dashed var(--accent)';
  document.body.style.outlineOffset = '-4px';
});

document.addEventListener('dragleave', () => {
  document.body.style.outline = 'none';
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  document.body.style.outline = 'none';

  const file = e.dataTransfer?.files[0];
  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();
    if (DataStore.hasBinaryMagic(buffer)) {
      await handleFileLoad(buffer, file.name);
    } else {
      await handleFileLoad(new TextDecoder().decode(buffer), file.name);
    }
  } catch (err) {
    showToast(`Errore: ${err.message}`, 'error');
  }
});

// ---- Settings: react to travel sensor changes ----
DataStore.on('settings-changed', ({ key }) => {
  if (key === null || key?.startsWith('travel_')) {
    // Re-apply voltage → mm conversion
    if (DataStore.getRawData().length > 0) {
      DataStore.reapplyTravelConversion();
    }
  }
});

// ---- Sync splits to DB ----
DataStore.on('splits-changed', () => {
  const splits = DataStore.getSplits();
  DbManager.saveSplits(splits);
});

// ---- Session Management ----
const btnSaveSession = document.getElementById('btnSaveSession');
const btnLoadSession = document.getElementById('btnLoadSession');
const btnExportRun = document.getElementById('btnExportRun');
const btnImportRun = document.getElementById('btnImportRun');

btnSaveSession?.addEventListener('click', () => {
  const name = prompt('Nome della sessione:', `Sessione ${new Date().toLocaleString('it-IT')}`);
  if (name !== null) {
    SessionManager.saveToFile(name);
  }
});

btnLoadSession?.addEventListener('click', () => {
  SessionManager.loadFromFile();
});

// DB Export: full run bundle (bike + setup + telemetry + notes)
btnExportRun?.addEventListener('click', () => {
  DbManager.exportRun();
});

// DB Import: load a full run bundle
btnImportRun?.addEventListener('click', async () => {
  const result = await DbManager.importRun();
  if (result) {
    // Optionally load the imported run's telemetry into the current view
    showToast(`Run "${result.file_name}" importata nel database`, 'success');
  }
});

// Ctrl+S: Save session
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    SessionManager.saveToFile();
  }
});

// Initialize auto-save (saves to localStorage on changes, auto-loads on file open)
SessionManager.initAutoSave();

// ---- Export global toast for modules ----
window.__telemetryToast = showToast;

console.log('Bike Telemetry Analysis GUI initialized');
