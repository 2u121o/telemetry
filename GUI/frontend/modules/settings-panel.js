/**
 * SETTINGS PANEL MODULE
 * 
 * 3-tier architecture:
 *  1. BICI (Bike) — static, stays same for a season
 *     Frame, wheels, brakes, drivetrain, fork/shock brand & model & travel
 *  2. SETUP (Tuning) — changes often, even during same day
 *     Suspension clicks (HSC/LSC/HSR/LSR), pressures, tokens, tyre pressures
 *     Each setup references a bike. You can have many setups per bike.
 *  3. RUN NOTES — per recording file
 *     Links to a bike + setup, weather, trail conditions, feeling, notes
 *
 * Plus: sensor settings, map/chart display settings.
 */

import DataStore from './data-store.js';

const LS_KEY = 'bike-telemetry-settings';
const LS_BIKES_KEY = 'bike-telemetry-bikes';
const LS_SETUPS_KEY = 'bike-telemetry-setups';
const LS_RUN_NOTES_KEY = 'bike-telemetry-run-notes';

// ===== Default sensor/display settings =====
const DEFAULTS = {
  travel_vMax: 3.3,
  travel_vMin: 0.0,
  travel_strokeMm: 200,
  travel_inverted: false,
  travel_r_vMax: 3.3,
  travel_r_vMin: 0.0,
  travel_r_strokeMm: 200,
  travel_r_factor: 1.0,
  travel_r_inverted: true,
  travel_f_vMax: 3.3,
  travel_f_vMin: 0.0,
  travel_f_strokeMm: 170,
  travel_f_factor: 1.0,
  travel_f_inverted: false,
  map_splitLineLength: 1600,
  map_trackWeight: 3.5,
  map_inactiveOpacity: 0.45,
  map_showLabels: true,
  chart_height: 300,
  chart_showGrid: true,
  chart_lineWidth: 1.5,
  decimals: 3,
  timestampUnit: 'ms_to_s',
};

// ===== Bike template (static — season-level) =====
const DEFAULT_BIKE = {
  name: '',
  frame_brand: '', frame_model: '', frame_size: '', frame_year: '', weight_kg: '',
  fork_brand: '', fork_model: '', fork_travel_mm: '',
  shock_brand: '', shock_model: '', shock_travel_mm: '',
  tyre_front_brand: '', tyre_front_model: '', tyre_front_size: '',
  tyre_rear_brand: '', tyre_rear_model: '', tyre_rear_size: '',
  drivetrain_type: '', chainring: '', cassette: '',
  brake_front: '', brake_rear: '',
  brake_rotor_front_mm: '', brake_rotor_rear_mm: '', brake_pad_type: '',
  wheel_front: '', wheel_rear: '',
  notes: '',
};

// ===== Setup template (tunable — changes often) =====
const DEFAULT_SETUP = {
  name: '',
  bike_id: null,  // references a bike
  // Fork tuning
  fork_pressure_psi: '', fork_hsc: '', fork_lsc: '', fork_hsr: '', fork_lsr: '', fork_tokens: '',
  // Shock tuning
  shock_pressure_psi: '', shock_hsc: '', shock_lsc: '', shock_hsr: '', shock_lsr: '', shock_tokens: '',
  // Tyre pressures
  tyre_front_pressure_bar: '', tyre_front_insert: '',
  tyre_rear_pressure_bar: '', tyre_rear_insert: '',
  // Notes
  notes: '',
};

// ===== Run notes template (per recording) =====
const DEFAULT_RUN_NOTES = {
  bike_id: null,
  setup_id: null,
  date: '', location: '', track_name: '',
  weather: 'soleggiato',
  temperature_c: '', humidity_pct: '',
  trail_condition: 'asciutto',
  rider_name: '', rider_weight_kg: '',
  session_goal: '', setup_changes: '',
  feeling_rating: 3, feeling_notes: '',
  tags: '',
};

const WEATHER_OPTIONS = ['soleggiato','nuvoloso','pioggia leggera','pioggia forte','fango','neve','vento','nebbia'];
const TRAIL_OPTIONS = ['asciutto','umido','bagnato','fangoso','ghiacciato','polveroso','sassoso'];

// ===== Module =====
const SettingsPanel = (() => {
  let settings = { ...DEFAULTS };
  let containerEl = null;
  let bikes = [];    // [{...DEFAULT_BIKE, id, createdAt}]
  let setups = [];   // [{...DEFAULT_SETUP, id, createdAt}]
  let runNotes = {}; // { fileName: {...DEFAULT_RUN_NOTES} }

  // Currently selected bike for quick-apply (persisted)
  let activeBikeId = null;

  function init(container) {
    containerEl = container;
    load();
    render();
  }

  // ---- Settings ----
  function get(key) { return settings[key] ?? DEFAULTS[key]; }
  function getAll() { return { ...settings }; }
  function set(key, value) {
    settings[key] = value;
    saveSettings();
    DataStore.emit('settings-changed', { key, value, settings: { ...settings } });
  }
  function setMultiple(obj) {
    Object.assign(settings, obj);
    saveSettings();
    DataStore.emit('settings-changed', { key: null, value: null, settings: { ...settings } });
  }
  function reset() {
    settings = { ...DEFAULTS };
    saveSettings();
    DataStore.emit('settings-changed', { key: null, value: null, settings: { ...settings } });
    render();
    toast('Impostazioni ripristinate', 'info');
  }

  // ---- Persistence ----
  function load() {
    try { const j = localStorage.getItem(LS_KEY); if (j) settings = { ...DEFAULTS, ...JSON.parse(j) }; } catch(e){}
    try { const j = localStorage.getItem(LS_BIKES_KEY); if (j) bikes = JSON.parse(j); } catch(e){ bikes = []; }
    try { const j = localStorage.getItem(LS_SETUPS_KEY); if (j) setups = JSON.parse(j); } catch(e){ setups = []; }
    try { const j = localStorage.getItem(LS_RUN_NOTES_KEY); if (j) runNotes = JSON.parse(j); } catch(e){ runNotes = {}; }
    try { activeBikeId = JSON.parse(localStorage.getItem('bike-telemetry-active-bike')); } catch(e){}
  }
  function saveSettings() { try { localStorage.setItem(LS_KEY, JSON.stringify(settings)); } catch(e){} }
  function saveBikes() { try { localStorage.setItem(LS_BIKES_KEY, JSON.stringify(bikes)); } catch(e){} }
  function saveSetups() { try { localStorage.setItem(LS_SETUPS_KEY, JSON.stringify(setups)); } catch(e){} }
  function saveRunNotes() { try { localStorage.setItem(LS_RUN_NOTES_KEY, JSON.stringify(runNotes)); } catch(e){} }
  function saveActiveBike() { try { localStorage.setItem('bike-telemetry-active-bike', JSON.stringify(activeBikeId)); } catch(e){} }

  // ---- Bikes CRUD ----
  function getBikes() { return [...bikes]; }
  function getBikeById(id) { return bikes.find(b => b.id === id) || null; }
  function addBike(data) {
    const b = { ...DEFAULT_BIKE, ...data, id: Date.now(), createdAt: new Date().toISOString() };
    bikes.push(b);
    saveBikes();
    if (!activeBikeId) { activeBikeId = b.id; saveActiveBike(); }
    return b;
  }
  function updateBike(id, data) {
    const i = bikes.findIndex(b => b.id === id);
    if (i >= 0) { bikes[i] = { ...bikes[i], ...data }; saveBikes(); }
  }
  function deleteBike(id) {
    bikes = bikes.filter(b => b.id !== id);
    saveBikes();
    // Also clean up setups referencing this bike
    setups.forEach(s => { if (s.bike_id === id) s.bike_id = null; });
    saveSetups();
    if (activeBikeId === id) { activeBikeId = bikes.length > 0 ? bikes[0].id : null; saveActiveBike(); }
  }
  function getActiveBikeId() { return activeBikeId; }
  function setActiveBike(id) { activeBikeId = id; saveActiveBike(); }

  // ---- Setups CRUD ----
  function getSetups() { return [...setups]; }
  function getSetupById(id) { return setups.find(s => s.id === id) || null; }
  function getSetupsForBike(bikeId) { return setups.filter(s => s.bike_id === bikeId); }
  function addSetup(data) {
    const s = { ...DEFAULT_SETUP, ...data, id: Date.now(), createdAt: new Date().toISOString() };
    setups.push(s);
    saveSetups();
    return s;
  }
  function updateSetup(id, data) {
    const i = setups.findIndex(s => s.id === id);
    if (i >= 0) { setups[i] = { ...setups[i], ...data }; saveSetups(); }
  }
  function deleteSetup(id) {
    setups = setups.filter(s => s.id !== id);
    saveSetups();
  }

  // ---- Run Notes ----
  function getRunNotes(fileName) { return runNotes[fileName] || { ...DEFAULT_RUN_NOTES }; }
  function setRunNotesData(fileName, data) { runNotes[fileName] = { ...DEFAULT_RUN_NOTES, ...data }; saveRunNotes(); }
  function getAllRunNotes() { return { ...runNotes }; }

  // ---- Export / Import ----
  function exportBike(id) {
    const bike = getBikeById(id);
    if (!bike) return;
    const bikeSetups = getSetupsForBike(id);
    const payload = { type: 'bike-telemetry-bike', bike, setups: bikeSetups };
    downloadJSON(payload, `bici_${(bike.name || 'bike').replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
    toast(`Bici "${bike.name}" esportata con ${bikeSetups.length} setup`, 'success');
  }

  function importBike() {
    filePickJSON(data => {
      if (data.type === 'bike-telemetry-bike' && data.bike) {
        const b = addBike({ ...data.bike, name: data.bike.name || 'Importata' });
        if (data.setups) {
          data.setups.forEach(s => addSetup({ ...s, bike_id: b.id }));
        }
        toast(`Bici "${b.name}" importata`, 'success');
        render();
      } else {
        toast('File non valido', 'error');
      }
    });
  }

  function exportSetup(id) {
    const setup = getSetupById(id);
    if (!setup) return;
    const payload = { type: 'bike-telemetry-setup', setup };
    downloadJSON(payload, `setup_${(setup.name || 'setup').replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
    toast(`Setup "${setup.name}" esportato`, 'success');
  }

  function importSetup(bikeId) {
    filePickJSON(data => {
      if (data.type === 'bike-telemetry-setup' && data.setup) {
        const s = addSetup({ ...data.setup, bike_id: bikeId || data.setup.bike_id });
        toast(`Setup "${s.name}" importato`, 'success');
        render();
      } else {
        toast('File non valido', 'error');
      }
    });
  }

  // ---- Travel conversion ----
  function getTravelConfig(side = 'r') {
    const prefix = side === 'f' ? 'travel_f' : 'travel_r';
    return {
      vMax: settings[`${prefix}_vMax`] ?? settings.travel_vMax ?? DEFAULTS[`${prefix}_vMax`],
      vMin: settings[`${prefix}_vMin`] ?? settings.travel_vMin ?? DEFAULTS[`${prefix}_vMin`],
      stroke: settings[`${prefix}_strokeMm`] ?? settings.travel_strokeMm ?? DEFAULTS[`${prefix}_strokeMm`],
      factor: settings[`${prefix}_factor`] ?? DEFAULTS[`${prefix}_factor`],
      inverted: settings[`${prefix}_inverted`] ?? (side === 'r' ? true : (settings.travel_inverted ?? false)),
    };
  }

  function voltageToTravel(voltage, side = 'r') {
    const { vMax, vMin, stroke, factor, inverted: inv } = getTravelConfig(side);
    if (vMax === vMin) return 0;
    let r = inv ? (voltage - vMin) / (vMax - vMin) : 1 - (voltage - vMin) / (vMax - vMin);
    return Math.max(0, Math.min(1, r)) * stroke * factor;
  }
  function voltageToTravelPct(voltage, side = 'r') {
    const { vMax, vMin, factor, inverted: inv } = getTravelConfig(side);
    if (vMax === vMin) return 0;
    let r = inv ? (voltage - vMin) / (vMax - vMin) : 1 - (voltage - vMin) / (vMax - vMin);
    return Math.max(0, Math.min(100, Math.max(0, Math.min(1, r)) * 100 * factor));
  }

  // ---- For session manager ----
  function getBikeProfiles() { return getBikes(); }
  function addBikeProfile(data) { return addBike(data); }
  function getRecordingNotes(fileName) { return getRunNotes(fileName); }
  function setRecordingNotes(fileName, data) { setRunNotesData(fileName, data); }
  function getAllRecordingNotes() { return getAllRunNotes(); }

  // ========== RENDER ==========
  function render() {
    if (!containerEl) return;
    const fileName = DataStore.getFileName();
    const notes = fileName ? getRunNotes(fileName) : null;
    const activeBike = getBikeById(activeBikeId);

    containerEl.innerHTML = `
      <!-- ===== BICI (season-level) ===== -->
      <div class="settings-section">
        <h4 class="settings-section-title">🚲 La Mia Bici</h4>
        <p class="settings-hint">La bici rimane la stessa per tutta la stagione. Seleziona o crea la tua bici.</p>

        ${bikes.length > 0 ? `
          <div class="settings-row">
            <label class="settings-label">Bici attiva</label>
            <select class="select-input settings-input" id="selActiveBike" style="width:140px !important;">
              ${bikes.map(b => `<option value="${b.id}" ${b.id === activeBikeId ? 'selected' : ''}>${b.name || 'Senza nome'}</option>`).join('')}
            </select>
          </div>
          ${activeBike ? renderBikeSummary(activeBike) : ''}
        ` : '<p class="settings-hint" style="margin:4px 0;">Nessuna bici configurata</p>'}

        <div style="display:flex; gap:4px; margin-top:8px;">
          <button id="btnNewBike" class="btn btn-outline btn-sm" style="flex:1;">+ Nuova Bici</button>
          ${activeBike ? `<button id="btnEditBike" class="btn btn-ghost btn-sm">✏️</button>
          <button id="btnExportBike" class="btn btn-ghost btn-sm" title="Esporta bici + setup">💾</button>` : ''}
          <button id="btnImportBike" class="btn btn-ghost btn-sm" title="Importa bici da file">📂</button>
        </div>
      </div>

      <!-- ===== SETUP TUNABILI ===== -->
      <div class="settings-section">
        <h4 class="settings-section-title">🔧 Setup Tunabili</h4>
        <p class="settings-hint">Sospensioni, pressioni, tokens — cambia spesso, anche nella stessa giornata.</p>

        ${activeBike ? `
          <div id="setupsList">${renderSetupsList(activeBikeId)}</div>
          <div style="display:flex; gap:4px; margin-top:8px;">
            <button id="btnNewSetup" class="btn btn-outline btn-sm" style="flex:1;">+ Nuovo Setup</button>
            <button id="btnImportSetup" class="btn btn-ghost btn-sm" title="Importa setup">📂</button>
          </div>
        ` : '<p class="settings-hint">Seleziona una bici per gestire i setup</p>'}
      </div>

      <!-- ===== RUN NOTES (per recording) ===== -->
      <div class="settings-section">
        <h4 class="settings-section-title">📝 Note Run</h4>
        ${fileName ? `
          <p class="settings-hint">Associa bici, setup e condizioni a "<b>${escHtml(fileName)}</b>"</p>
          ${renderRunNotesForm(notes, fileName)}
        ` : '<p class="settings-hint">Carica un file per associare note alla run.</p>'}
      </div>

      <!-- ===== SENSORE TRAVEL ===== -->
      <div class="settings-section">
        <h4 class="settings-section-title">📡 Sensori Travel</h4>
        <p class="settings-hint">Calibrazione separata per posteriore e anteriore.</p>
        <label class="control-label" style="margin-top:6px;">Posteriore</label>
        <div class="settings-row"><label class="settings-label">V max</label><input type="number" step="0.01" min="0" max="5" class="number-input settings-input" id="set_travel_r_vMax" value="${settings.travel_r_vMax}" /><span class="settings-unit">V</span></div>
        <div class="settings-row"><label class="settings-label">V min</label><input type="number" step="0.01" min="0" max="5" class="number-input settings-input" id="set_travel_r_vMin" value="${settings.travel_r_vMin}" /><span class="settings-unit">V</span></div>
        <div class="settings-row"><label class="settings-label">Corsa</label><input type="number" step="1" min="1" max="500" class="number-input settings-input" id="set_travel_r_strokeMm" value="${settings.travel_r_strokeMm}" /><span class="settings-unit">mm</span></div>
        <div class="settings-row"><label class="settings-label">Fattore</label><input type="number" step="0.001" min="0.001" max="10" class="number-input settings-input" id="set_travel_r_factor" value="${settings.travel_r_factor}" /><span class="settings-unit">x</span></div>
        <div class="settings-row"><label class="settings-label">Invertito</label><input type="checkbox" id="set_travel_r_inverted" ${settings.travel_r_inverted ? 'checked' : ''} style="accent-color:var(--accent);" /></div>
        <label class="control-label" style="margin-top:10px;">Anteriore</label>
        <div class="settings-row"><label class="settings-label">V max</label><input type="number" step="0.01" min="0" max="5" class="number-input settings-input" id="set_travel_f_vMax" value="${settings.travel_f_vMax}" /><span class="settings-unit">V</span></div>
        <div class="settings-row"><label class="settings-label">V min</label><input type="number" step="0.01" min="0" max="5" class="number-input settings-input" id="set_travel_f_vMin" value="${settings.travel_f_vMin}" /><span class="settings-unit">V</span></div>
        <div class="settings-row"><label class="settings-label">Corsa</label><input type="number" step="1" min="1" max="500" class="number-input settings-input" id="set_travel_f_strokeMm" value="${settings.travel_f_strokeMm}" /><span class="settings-unit">mm</span></div>
        <div class="settings-row"><label class="settings-label">Fattore</label><input type="number" step="0.001" min="0.001" max="10" class="number-input settings-input" id="set_travel_f_factor" value="${settings.travel_f_factor}" /><span class="settings-unit">x</span></div>
        <div class="settings-row"><label class="settings-label">Invertito</label><input type="checkbox" id="set_travel_f_inverted" ${settings.travel_f_inverted ? 'checked' : ''} style="accent-color:var(--accent);" /></div>
      </div>

      <!-- ===== MAPPA ===== -->
      <div class="settings-section">
        <h4 class="settings-section-title">🗺️ Mappa</h4>
        <div class="settings-row"><label class="settings-label">Lunghezza righe split</label><input type="number" step="0.5" min="0.5" max="100" class="number-input settings-input" id="set_map_splitLineLength" value="${settings.map_splitLineLength}" /><span class="settings-unit">m</span></div>
        <div class="settings-row"><label class="settings-label">Spessore tracciato</label><input type="number" step="0.5" min="1" max="10" class="number-input settings-input" id="set_map_trackWeight" value="${settings.map_trackWeight}" /><span class="settings-unit">px</span></div>
        <div class="settings-row"><label class="settings-label">Opacità inattivo</label><input type="range" min="0.1" max="1" step="0.05" id="set_map_inactiveOpacity" value="${settings.map_inactiveOpacity}" /><span class="settings-value" id="val_map_inactiveOpacity">${settings.map_inactiveOpacity}</span></div>
        <div class="settings-row"><label class="settings-label">Mostra etichette</label><input type="checkbox" id="set_map_showLabels" ${settings.map_showLabels ? 'checked' : ''} style="accent-color:var(--accent);" /></div>
      </div>

      <!-- ===== GRAFICI ===== -->
      <div class="settings-section">
        <h4 class="settings-section-title">📊 Grafici</h4>
        <div class="settings-row"><label class="settings-label">Altezza</label><input type="number" step="50" min="150" max="800" class="number-input settings-input" id="set_chart_height" value="${settings.chart_height}" /><span class="settings-unit">px</span></div>
        <div class="settings-row"><label class="settings-label">Spessore linea</label><input type="number" step="0.5" min="0.5" max="5" class="number-input settings-input" id="set_chart_lineWidth" value="${settings.chart_lineWidth}" /><span class="settings-unit">px</span></div>
        <div class="settings-row"><label class="settings-label">Griglia</label><input type="checkbox" id="set_chart_showGrid" ${settings.chart_showGrid ? 'checked' : ''} style="accent-color:var(--accent);" /></div>
      </div>

      <!-- ===== GENERALI ===== -->
      <div class="settings-section">
        <h4 class="settings-section-title">⚙️ Generali</h4>
        <div class="settings-row"><label class="settings-label">Decimali</label><input type="number" step="1" min="0" max="8" class="number-input settings-input" id="set_decimals" value="${settings.decimals}" /></div>
        <div class="settings-row"><label class="settings-label">Timestamp</label><select class="select-input settings-input" id="set_timestampUnit"><option value="ms_to_s" ${settings.timestampUnit==='ms_to_s'?'selected':''}>ms→s (÷1000)</option><option value="raw" ${settings.timestampUnit==='raw'?'selected':''}>Già in secondi</option></select></div>
      </div>

      <div class="settings-actions">
        <button id="btnResetSettings" class="btn btn-ghost btn-block">🔄 Ripristina predefiniti</button>
      </div>
    `;

    bindEvents();
  }

  // ---- Bike summary card ----
  function renderBikeSummary(bike) {
    const parts = [bike.frame_brand, bike.frame_model, bike.frame_size, bike.frame_year ? `(${bike.frame_year})` : ''].filter(Boolean).join(' ');
    const fork = [bike.fork_brand, bike.fork_model, bike.fork_travel_mm ? bike.fork_travel_mm + 'mm' : ''].filter(Boolean).join(' ');
    const shock = [bike.shock_brand, bike.shock_model, bike.shock_travel_mm ? bike.shock_travel_mm + 'mm' : ''].filter(Boolean).join(' ');
    return `
      <div class="bike-summary-card">
        ${parts ? `<div class="bike-summary-line"><span class="bike-summary-label">Telaio</span><span>${escHtml(parts)}</span></div>` : ''}
        ${fork ? `<div class="bike-summary-line"><span class="bike-summary-label">Forcella</span><span>${escHtml(fork)}</span></div>` : ''}
        ${shock ? `<div class="bike-summary-line"><span class="bike-summary-label">Ammort.</span><span>${escHtml(shock)}</span></div>` : ''}
        ${bike.weight_kg ? `<div class="bike-summary-line"><span class="bike-summary-label">Peso</span><span>${bike.weight_kg} kg</span></div>` : ''}
      </div>
    `;
  }

  // ---- Setups list ----
  function renderSetupsList(bikeId) {
    const bikeSetups = getSetupsForBike(bikeId);
    if (bikeSetups.length === 0) return '<p class="settings-hint" style="margin:0;">Nessun setup salvato per questa bici</p>';

    return bikeSetups.map(s => {
      const forkInfo = [s.fork_pressure_psi ? s.fork_pressure_psi + 'psi' : '', s.fork_lsc ? 'LSC:' + s.fork_lsc : '', s.fork_hsc ? 'HSC:' + s.fork_hsc : ''].filter(Boolean).join(' · ');
      const shockInfo = [s.shock_pressure_psi ? s.shock_pressure_psi + 'psi' : '', s.shock_lsc ? 'LSC:' + s.shock_lsc : '', s.shock_hsc ? 'HSC:' + s.shock_hsc : ''].filter(Boolean).join(' · ');
      const tyreInfo = [s.tyre_front_pressure_bar ? 'F:' + s.tyre_front_pressure_bar + 'bar' : '', s.tyre_rear_pressure_bar ? 'R:' + s.tyre_rear_pressure_bar + 'bar' : ''].filter(Boolean).join(' · ');

      return `
        <div class="setup-item" data-setup-id="${s.id}">
          <div class="setup-info">
            <span class="setup-name">${escHtml(s.name || 'Setup senza nome')}</span>
            <span class="setup-sub">${escHtml([forkInfo ? '🔽 ' + forkInfo : '', shockInfo ? '🔽 ' + shockInfo : '', tyreInfo ? '🛞 ' + tyreInfo : ''].filter(Boolean).join('  '))}</span>
          </div>
          <div class="setup-actions">
            <button class="btn btn-ghost btn-sm btn-apply-setup" data-id="${s.id}" title="Applica alla run corrente">📌</button>
            <button class="btn btn-ghost btn-sm btn-edit-setup" data-id="${s.id}" title="Modifica">✏️</button>
            <button class="btn btn-ghost btn-sm btn-export-setup" data-id="${s.id}" title="Esporta">💾</button>
            <button class="btn btn-danger btn-sm btn-delete-setup" data-id="${s.id}" title="Elimina">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ---- Run notes form ----
  function renderRunNotesForm(notes, fileName) {
    const n = notes || { ...DEFAULT_RUN_NOTES };
    const bikeOpts = bikes.map(b => `<option value="${b.id}" ${n.bike_id == b.id ? 'selected' : ''}>${escHtml(b.name || 'Senza nome')}</option>`).join('');
    const selectedBikeSetups = n.bike_id ? getSetupsForBike(n.bike_id) : (activeBikeId ? getSetupsForBike(activeBikeId) : []);
    const setupOpts = selectedBikeSetups.map(s => `<option value="${s.id}" ${n.setup_id == s.id ? 'selected' : ''}>${escHtml(s.name || 'Setup senza nome')}</option>`).join('');

    // Get setup summary if one is selected
    const linkedSetup = n.setup_id ? getSetupById(n.setup_id) : null;

    return `
      <div class="rec-notes-form" data-filename="${escHtml(fileName)}">
        <!-- Quick association -->
        <div class="run-link-section">
          <div class="settings-row">
            <label class="settings-label">🚲 Bici</label>
            <select class="select-input settings-input" id="rn_bike_id" style="width:140px !important;">
              <option value="">— Nessuna —</option>
              ${bikeOpts}
            </select>
          </div>
          <div class="settings-row">
            <label class="settings-label">🔧 Setup</label>
            <select class="select-input settings-input" id="rn_setup_id" style="width:140px !important;">
              <option value="">— Nessuno —</option>
              ${setupOpts}
            </select>
          </div>
          ${linkedSetup ? renderSetupSummary(linkedSetup) : ''}
        </div>

        <!-- Conditions -->
        <div class="rec-notes-group">
          <label class="control-label" style="margin-top:6px;">🌤️ Condizioni</label>
          <div class="settings-row"><label class="settings-label">Data</label><input type="date" class="text-input settings-input" id="rn_date" value="${n.date}" style="width:120px !important;" /></div>
          <div class="settings-row"><label class="settings-label">Luogo</label><input type="text" class="text-input settings-input" id="rn_location" value="${escHtml(n.location)}" placeholder="Finale Ligure" style="width:120px !important;" /></div>
          <div class="settings-row"><label class="settings-label">Tracciato</label><input type="text" class="text-input settings-input" id="rn_track_name" value="${escHtml(n.track_name)}" placeholder="Rollercoaster" style="width:120px !important;" /></div>
          <div class="settings-row"><label class="settings-label">Meteo</label><select class="select-input settings-input" id="rn_weather" style="width:120px !important;">${WEATHER_OPTIONS.map(w => `<option value="${w}" ${n.weather===w?'selected':''}>${w.charAt(0).toUpperCase()+w.slice(1)}</option>`).join('')}</select></div>
          <div class="settings-row"><label class="settings-label">Temperatura</label><input type="number" step="1" class="number-input settings-input" id="rn_temperature_c" value="${n.temperature_c}" /><span class="settings-unit">°C</span></div>
          <div class="settings-row"><label class="settings-label">Umidità</label><input type="number" step="1" min="0" max="100" class="number-input settings-input" id="rn_humidity_pct" value="${n.humidity_pct}" /><span class="settings-unit">%</span></div>
          <div class="settings-row"><label class="settings-label">Terreno</label><select class="select-input settings-input" id="rn_trail_condition" style="width:120px !important;">${TRAIL_OPTIONS.map(c => `<option value="${c}" ${n.trail_condition===c?'selected':''}>${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('')}</select></div>
        </div>

        <!-- Rider -->
        <div class="rec-notes-group">
          <label class="control-label" style="margin-top:6px;">🏃 Rider</label>
          <div class="settings-row"><label class="settings-label">Nome</label><input type="text" class="text-input settings-input" id="rn_rider_name" value="${escHtml(n.rider_name)}" style="width:120px !important;" /></div>
          <div class="settings-row"><label class="settings-label">Peso</label><input type="number" step="0.5" class="number-input settings-input" id="rn_rider_weight_kg" value="${n.rider_weight_kg}" /><span class="settings-unit">kg</span></div>
        </div>

        <!-- Feedback -->
        <div class="rec-notes-group">
          <label class="control-label" style="margin-top:6px;">💬 Feedback</label>
          <div class="settings-row"><label class="settings-label">Obiettivo</label><input type="text" class="text-input settings-input" id="rn_session_goal" value="${escHtml(n.session_goal)}" placeholder="Test rebound" style="width:120px !important;" /></div>
          <div class="settings-row" style="flex-direction:column; align-items:stretch;">
            <label class="settings-label" style="margin-bottom:4px;">Modifiche setup</label>
            <textarea class="text-input" id="rn_setup_changes" rows="2" style="width:100%;resize:vertical;font-size:0.8rem;">${escHtml(n.setup_changes || '')}</textarea>
          </div>
          <div class="settings-row">
            <label class="settings-label">Feeling</label>
            <input type="range" min="1" max="5" step="1" id="rn_feeling_rating" value="${n.feeling_rating||3}" style="width:80px;" />
            <span class="settings-value" id="val_rn_feeling">${['😫','😕','😐','🙂','🤩'][(n.feeling_rating||3)-1]} ${n.feeling_rating||3}/5</span>
          </div>
          <div class="settings-row" style="flex-direction:column; align-items:stretch;">
            <label class="settings-label" style="margin-bottom:4px;">Note / Sensazioni</label>
            <textarea class="text-input" id="rn_feeling_notes" rows="2" style="width:100%;resize:vertical;font-size:0.8rem;">${escHtml(n.feeling_notes || '')}</textarea>
          </div>
          <div class="settings-row"><label class="settings-label">Tags</label><input type="text" class="text-input settings-input" id="rn_tags" value="${escHtml(n.tags || '')}" placeholder="test, gara" style="width:120px !important;" /></div>
        </div>

        <button id="btnSaveRunNotes" class="btn btn-primary btn-sm btn-block" style="margin-top:8px;">💾 Salva Note Run</button>
      </div>
    `;
  }

  // ---- Setup summary (inline, for run notes) ----
  function renderSetupSummary(s) {
    const lines = [];
    if (s.fork_pressure_psi) lines.push(`Fork: ${s.fork_pressure_psi}psi${s.fork_lsc ? ' LSC:'+s.fork_lsc : ''}${s.fork_hsc ? ' HSC:'+s.fork_hsc : ''}${s.fork_lsr ? ' LSR:'+s.fork_lsr : ''}${s.fork_hsr ? ' HSR:'+s.fork_hsr : ''}${s.fork_tokens ? ' Tok:'+s.fork_tokens : ''}`);
    if (s.shock_pressure_psi) lines.push(`Shock: ${s.shock_pressure_psi}psi${s.shock_lsc ? ' LSC:'+s.shock_lsc : ''}${s.shock_hsc ? ' HSC:'+s.shock_hsc : ''}${s.shock_lsr ? ' LSR:'+s.shock_lsr : ''}${s.shock_hsr ? ' HSR:'+s.shock_hsr : ''}${s.shock_tokens ? ' Tok:'+s.shock_tokens : ''}`);
    if (s.tyre_front_pressure_bar || s.tyre_rear_pressure_bar) lines.push(`Gomme: ${s.tyre_front_pressure_bar ? 'F:'+s.tyre_front_pressure_bar+'bar' : ''}${s.tyre_rear_pressure_bar ? ' R:'+s.tyre_rear_pressure_bar+'bar' : ''}`);
    if (lines.length === 0) return '';
    return `<div class="setup-summary-inline">${lines.map(l => `<div>${escHtml(l)}</div>`).join('')}</div>`;
  }

  // ---- Bike editor modal ----
  function openBikeEditor(bikeId) {
    const isNew = !bikeId;
    const bike = isNew ? { ...DEFAULT_BIKE } : (getBikeById(bikeId) || { ...DEFAULT_BIKE });
    const fields = [
      { section: '🏗️ Telaio', rows: [
        ['Marca','frame_brand','text'], ['Modello','frame_model','text'], ['Taglia','frame_size','text'],
        ['Anno','frame_year','text'], ['Peso bici (kg)','weight_kg','number'],
      ]},
      { section: '🔽 Forcella', rows: [
        ['Marca','fork_brand','text'], ['Modello','fork_model','text'], ['Corsa (mm)','fork_travel_mm','number'],
      ]},
      { section: '🔽 Ammortizzatore', rows: [
        ['Marca','shock_brand','text'], ['Modello','shock_model','text'], ['Corsa (mm)','shock_travel_mm','number'],
      ]},
      { section: '🛞 Gomme', rows: [
        ['Ant. Marca','tyre_front_brand','text'], ['Ant. Modello','tyre_front_model','text'], ['Ant. Misura','tyre_front_size','text'],
        ['Post. Marca','tyre_rear_brand','text'], ['Post. Modello','tyre_rear_model','text'], ['Post. Misura','tyre_rear_size','text'],
      ]},
      { section: '⚙️ Trasmissione & Freni', rows: [
        ['Trasmissione','drivetrain_type','text'], ['Corona','chainring','text'], ['Cassetta','cassette','text'],
        ['Freno ant.','brake_front','text'], ['Freno post.','brake_rear','text'],
        ['Disco ant. (mm)','brake_rotor_front_mm','number'], ['Disco post. (mm)','brake_rotor_rear_mm','number'],
        ['Pastiglie','brake_pad_type','text'],
      ]},
      { section: '🎡 Ruote', rows: [
        ['Anteriore','wheel_front','text'], ['Posteriore','wheel_rear','text'],
      ]},
    ];

    showModal(isNew ? '🚲 Nuova Bici' : '✏️ Modifica Bici', `
      <div class="profile-form-grid">
        <div class="pf-section"><h5>Nome</h5><input type="text" class="text-input" id="pf_name" value="${escHtml(bike.name)}" placeholder="Es: Specialized Enduro 2025" /></div>
        ${fields.map(sec => `
          <div class="pf-section"><h5>${sec.section}</h5>
            ${sec.rows.map(([label, key, type]) => `
              <div class="pf-row"><label>${label}</label><input type="${type}" class="${type==='number'?'number-input':'text-input'}" id="pf_${key}" value="${escHtml(String(bike[key]||''))}" ${type==='number'?'step="0.1"':''}/></div>
            `).join('')}
          </div>
        `).join('')}
        <div class="pf-section"><h5>📝 Note</h5><textarea class="text-input" id="pf_notes" rows="3" style="width:100%;resize:vertical;">${escHtml(bike.notes||'')}</textarea></div>
      </div>
    `, () => {
      const data = {};
      for (const key of Object.keys(DEFAULT_BIKE)) {
        const el = document.getElementById(`pf_${key}`);
        if (el) data[key] = el.type === 'number' ? (el.value ? parseFloat(el.value) : '') : el.value;
      }
      if (isNew) {
        const b = addBike(data);
        activeBikeId = b.id; saveActiveBike();
        toast(`Bici "${data.name}" creata`, 'success');
      } else {
        updateBike(bikeId, data);
        toast(`Bici "${data.name}" aggiornata`, 'success');
      }
      render();
    });
  }

  // ---- Setup editor modal ----
  function openSetupEditor(setupId, bikeId) {
    const isNew = !setupId;
    const setup = isNew ? { ...DEFAULT_SETUP, bike_id: bikeId || activeBikeId } : (getSetupById(setupId) || { ...DEFAULT_SETUP });

    const sections = [
      { section: '🔽 Forcella', rows: [
        ['Pressione (PSI)','fork_pressure_psi','number'], ['HSC (click)','fork_hsc','text'], ['LSC (click)','fork_lsc','text'],
        ['HSR (click)','fork_hsr','text'], ['LSR (click)','fork_lsr','text'], ['Tokens/Spacers','fork_tokens','text'],
      ]},
      { section: '🔽 Ammortizzatore', rows: [
        ['Pressione (PSI)','shock_pressure_psi','number'], ['HSC (click)','shock_hsc','text'], ['LSC (click)','shock_lsc','text'],
        ['HSR (click)','shock_hsr','text'], ['LSR (click)','shock_lsr','text'], ['Tokens/Spacers','shock_tokens','text'],
      ]},
      { section: '🛞 Gomme', rows: [
        ['Ant. Pressione (bar)','tyre_front_pressure_bar','number'], ['Ant. Inserto','tyre_front_insert','text'],
        ['Post. Pressione (bar)','tyre_rear_pressure_bar','number'], ['Post. Inserto','tyre_rear_insert','text'],
      ]},
    ];

    showModal(isNew ? '🔧 Nuovo Setup' : '✏️ Modifica Setup', `
      <div class="profile-form-grid">
        <div class="pf-section"><h5>Nome Setup</h5><input type="text" class="text-input" id="sf_name" value="${escHtml(setup.name)}" placeholder="Es: Race Day - Asciutto" /></div>
        ${sections.map(sec => `
          <div class="pf-section"><h5>${sec.section}</h5>
            ${sec.rows.map(([label, key, type]) => `
              <div class="pf-row"><label>${label}</label><input type="${type}" class="${type==='number'?'number-input':'text-input'}" id="sf_${key}" value="${escHtml(String(setup[key]||''))}" ${type==='number'?'step="0.5"':''}/></div>
            `).join('')}
          </div>
        `).join('')}
        <div class="pf-section"><h5>📝 Note</h5><textarea class="text-input" id="sf_notes" rows="2" style="width:100%;resize:vertical;">${escHtml(setup.notes||'')}</textarea></div>
      </div>
    `, () => {
      const data = { bike_id: bikeId || setup.bike_id || activeBikeId };
      for (const key of Object.keys(DEFAULT_SETUP)) {
        if (key === 'bike_id') continue;
        const el = document.getElementById(`sf_${key}`);
        if (el) data[key] = el.type === 'number' ? (el.value ? parseFloat(el.value) : '') : el.value;
      }
      if (isNew) {
        addSetup(data);
        toast(`Setup "${data.name}" creato`, 'success');
      } else {
        updateSetup(setupId, data);
        toast(`Setup "${data.name}" aggiornato`, 'success');
      }
      render();
    });
  }

  // ---- Bind events ----
  function bindEvents() {
    // Settings number fields
    for (const field of ['travel_r_vMax','travel_r_vMin','travel_r_strokeMm','travel_r_factor','travel_f_vMax','travel_f_vMin','travel_f_strokeMm','travel_f_factor','map_splitLineLength','map_trackWeight','chart_height','chart_lineWidth','decimals']) {
      const el = document.getElementById(`set_${field}`);
      if (el) el.addEventListener('change', () => set(field, parseFloat(el.value)));
    }
    // Settings checkboxes
    for (const field of ['travel_r_inverted','travel_f_inverted','map_showLabels','chart_showGrid']) {
      const el = document.getElementById(`set_${field}`);
      if (el) el.addEventListener('change', () => set(field, el.checked));
    }
    // Opacity range
    const opSlider = document.getElementById('set_map_inactiveOpacity');
    const opVal = document.getElementById('val_map_inactiveOpacity');
    if (opSlider) {
      opSlider.addEventListener('input', () => { opVal.textContent = opSlider.value; });
      opSlider.addEventListener('change', () => set('map_inactiveOpacity', parseFloat(opSlider.value)));
    }
    // Timestamp select
    const tsUnit = document.getElementById('set_timestampUnit');
    if (tsUnit) tsUnit.addEventListener('change', () => { set('timestampUnit', tsUnit.value); toast('Ricarica il file per applicare', 'info'); });
    // Reset
    document.getElementById('btnResetSettings')?.addEventListener('click', reset);

    // ---- Bike ----
    document.getElementById('selActiveBike')?.addEventListener('change', (e) => {
      activeBikeId = parseInt(e.target.value); saveActiveBike(); render();
    });
    document.getElementById('btnNewBike')?.addEventListener('click', () => openBikeEditor(null));
    document.getElementById('btnEditBike')?.addEventListener('click', () => openBikeEditor(activeBikeId));
    document.getElementById('btnExportBike')?.addEventListener('click', () => exportBike(activeBikeId));
    document.getElementById('btnImportBike')?.addEventListener('click', () => importBike());

    // ---- Setups ----
    document.getElementById('btnNewSetup')?.addEventListener('click', () => openSetupEditor(null, activeBikeId));
    document.getElementById('btnImportSetup')?.addEventListener('click', () => importSetup(activeBikeId));

    document.querySelectorAll('.btn-edit-setup').forEach(btn => {
      btn.addEventListener('click', () => openSetupEditor(parseInt(btn.dataset.id), activeBikeId));
    });
    document.querySelectorAll('.btn-export-setup').forEach(btn => {
      btn.addEventListener('click', () => exportSetup(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll('.btn-delete-setup').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Eliminare questo setup?')) { deleteSetup(parseInt(btn.dataset.id)); render(); toast('Setup eliminato', 'info'); }
      });
    });
    // Apply setup to current run
    document.querySelectorAll('.btn-apply-setup').forEach(btn => {
      btn.addEventListener('click', () => {
        const setupId = parseInt(btn.dataset.id);
        const fileName = DataStore.getFileName();
        if (!fileName) { toast('Carica un file prima di associare un setup', 'error'); return; }
        const notes = getRunNotes(fileName);
        notes.setup_id = setupId;
        notes.bike_id = activeBikeId;
        setRunNotesData(fileName, notes);
        render();
        toast('Setup associato alla run corrente!', 'success');
      });
    });

    // ---- Run notes ----
    // Bike select in run notes → update setup options
    const rnBikeSelect = document.getElementById('rn_bike_id');
    if (rnBikeSelect) {
      rnBikeSelect.addEventListener('change', () => {
        const bikeId = rnBikeSelect.value ? parseInt(rnBikeSelect.value) : null;
        const setupSelect = document.getElementById('rn_setup_id');
        if (setupSelect) {
          const bikeSetups = bikeId ? getSetupsForBike(bikeId) : [];
          setupSelect.innerHTML = '<option value="">— Nessuno —</option>' +
            bikeSetups.map(s => `<option value="${s.id}">${escHtml(s.name || 'Setup senza nome')}</option>`).join('');
        }
      });
    }

    // Feeling slider
    const feelSlider = document.getElementById('rn_feeling_rating');
    const feelVal = document.getElementById('val_rn_feeling');
    if (feelSlider && feelVal) {
      feelSlider.addEventListener('input', () => {
        const v = parseInt(feelSlider.value);
        feelVal.textContent = ['😫','😕','😐','🙂','🤩'][v-1] + ` ${v}/5`;
      });
    }

    // Save run notes
    document.getElementById('btnSaveRunNotes')?.addEventListener('click', () => {
      const fileName = DataStore.getFileName();
      if (!fileName) return;
      const data = {};
      for (const key of Object.keys(DEFAULT_RUN_NOTES)) {
        const el = document.getElementById(`rn_${key}`);
        if (!el) continue;
        if (el.type === 'number' || el.type === 'range') {
          data[key] = el.value ? parseFloat(el.value) : '';
        } else if (el.tagName === 'SELECT') {
          data[key] = el.value ? (isNaN(el.value) ? el.value : parseInt(el.value)) : '';
        } else {
          data[key] = el.value;
        }
      }
      setRunNotesData(fileName, data);
      toast('Note run salvate!', 'success');
    });
  }

  // ========== Helpers ==========
  function showModal(title, bodyHtml, onSave) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header"><h3>${title}</h3><button class="btn btn-ghost btn-sm modal-close">✕</button></div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer"><button class="btn btn-ghost modal-cancel">Annulla</button><button class="btn btn-primary modal-save">💾 Salva</button></div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.modal-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('.modal-save').addEventListener('click', () => { onSave(); overlay.remove(); });
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function filePickJSON(callback) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        callback(data);
      } catch (err) { toast(`Errore: ${err.message}`, 'error'); }
    });
    input.click();
  }

  function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function toast(msg, type) { if (window.__telemetryToast) window.__telemetryToast(msg, type); }

  return {
    init, get, getAll, set, setMultiple, reset, render,
    voltageToTravel, voltageToTravelPct,
    // Bikes
    getBikes, getBikeById, addBike, updateBike, deleteBike,
    getActiveBikeId, setActiveBike, exportBike, importBike,
    // Setups
    getSetups, getSetupById, getSetupsForBike, addSetup, updateSetup, deleteSetup,
    exportSetup, importSetup,
    // Run notes
    getRunNotes, setRunNotesData, getAllRunNotes,
    // Backward compat for session-manager
    getBikeProfiles, addBikeProfile,
    getRecordingNotes, setRecordingNotes, getAllRecordingNotes,
  };
})();

export default SettingsPanel;
