/**
 * DATA STORE MODULE
 * Central data management: parse, store, filter, split, and notify subscribers.
 * 
 * Architecture:
 *  - Singleton event-driven store
 *  - Subscribers get notified on data load, filter change, cursor, splits, etc.
 *  - All modules read from this store
 * 
 * Events:
 *  - 'data-loaded'    : raw data parsed and available
 *  - 'data-filtered'  : filtered data updated
 *  - 'columns-ready'  : column metadata available
 *  - 'cursor-changed' : user hovered/clicked a point → {index, row, timestamp}
 *  - 'splits-changed' : splits (partenza/arrivo/intermedi) changed
 */

const DataStore = (() => {
  // ---- State ----
  let rawData = [];          // Array of objects [{timestamp: 0.613, ax: -0.049, ...}, ...]
  let filteredData = [];     // After filters + splits applied
  let columns = [];          // Column names: ['timestamp', 'ax', 'ay', ...]
  let columnMeta = {};       // {name: {min, max, mean, unit, type}}
  let filters = [];          // Active filters
  let fileName = '';

  // ---- Splits state ----
  // splits = { start: timestampSec|null, end: timestampSec|null, intermediates: [timestampSec, ...] }
  let splits = { start: null, end: null, intermediates: [] };
  let splitsEnabled = false; // when true, data is trimmed to start..end

  // ---- Cursor state ----
  let cursorIndex = -1;

  // ---- Event system ----
  const listeners = {};

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }

  function off(event, fn) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(f => f !== fn);
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(fn => {
      try { fn(data); } catch (e) { console.error(`DataStore event error [${event}]:`, e); }
    });
  }

  // ---- Column metadata detection ----
  // Maps raw CSV column names → canonical names used throughout the GUI.
  const COLUMN_ALIASES = {
    timestamp_ns: 'timestamp',
    timestamp_ms: 'timestamp',
    gps_lat_deg: 'lat',
    gps_lon_deg: 'lon',
    gps_alt_m: 'alt_m',
    gps_speed_kn: 'speed_kn',
    gps_course_deg: 'course_deg',
    gps_sats: 'sats',
    gps_hdop: 'hdop',
    gps_fix: 'fix',
    gps_fix_quality: 'fix_quality',
    ax_g: 'ax', ay_g: 'ay', az_g: 'az',
    wx_dps: 'wx', wy_dps: 'wy', wz_dps: 'wz',
    travel1_v: 'travel_r_v',
    travel2_v: 'travel_f_v',
  };

  // Divisor to convert timestamp column to seconds (keyed by original column name).
  const TIMESTAMP_SCALES = {
    timestamp_ns: 1_000_000_000,
    timestamp_ms: 1_000,
  };

  const BINARY_MAGIC = 'TLM2BIN1';
  const BINARY_HEADER_SIZE = 512;
  const BINARY_RECORD_SIZE = 72;
  const BINARY_RAW_COLUMNS = [
    'timestamp_ns',
    'gps_lat_deg',
    'gps_lon_deg',
    'gps_alt_m',
    'gps_speed_kn',
    'gps_course_deg',
    'gps_hdop',
    'ax_g',
    'ay_g',
    'az_g',
    'wx_dps',
    'wy_dps',
    'wz_dps',
    'travel1_v',
    'travel2_v',
    'gps_fix_quality',
    'gps_sats',
    'imu_ok',
    'travel_ok',
  ];

  const BINARY_COLUMNS = BINARY_RAW_COLUMNS.map(col => COLUMN_ALIASES[col] || col);

  const KNOWN_UNITS = {
    timestamp: 's',
    ax: 'g', ay: 'g', az: 'g',
    wx: 'dps', wy: 'dps', wz: 'dps',
    lat: '°', lon: '°',
    alt_m: 'm',
    speed_kn: 'kn',
    course_deg: '°',
    sats: '',
    hdop: '',
    fix: '',
    fix_quality: '',
    travel_r_v: 'V',
    travel_r_mm: 'mm',
    travel_r_pct: '%',
    travel_f_v: 'V',
    travel_f_mm: 'mm',
    travel_f_pct: '%',
    imu_ok: '',
    travel_ok: '',
  };

  const KNOWN_LABELS = {
    timestamp: 'Tempo',
    ax: 'Accel X', ay: 'Accel Y', az: 'Accel Z',
    wx: 'Gyro X', wy: 'Gyro Y', wz: 'Gyro Z',
    lat: 'Latitudine', lon: 'Longitudine',
    alt_m: 'Altitudine',
    speed_kn: 'Velocità GPS',
    course_deg: 'Rotta',
    sats: 'Satelliti',
    hdop: 'HDOP',
    fix: 'GPS Fix',
    fix_quality: 'Qualità GPS',
    travel_r_v: 'Travel Posteriore (V)',
    travel_r_mm: 'Travel Posteriore (mm)',
    travel_r_pct: 'Travel Posteriore (%)',
    travel_f_v: 'Travel Anteriore (V)',
    travel_f_mm: 'Travel Anteriore (mm)',
    travel_f_pct: 'Travel Anteriore (%)',
    imu_ok: 'IMU OK',
    travel_ok: 'Travel OK',
  };

  function computeColumnMeta(data, cols) {
    const meta = {};
    for (const col of cols) {
      const values = data.map(r => r[col]).filter(v => v !== null && v !== undefined && !isNaN(v));
      const n = values.length;
      if (n === 0) {
        meta[col] = { min: 0, max: 0, mean: 0, std: 0, unit: KNOWN_UNITS[col] || '', label: KNOWN_LABELS[col] || col, type: 'numeric' };
        continue;
      }
      const min = Math.min(...values);
      const max = Math.max(...values);
      const sum = values.reduce((a, b) => a + b, 0);
      const mean = sum / n;
      const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
      const std = Math.sqrt(variance);
      meta[col] = {
        min, max, mean, std,
        unit: KNOWN_UNITS[col] || '',
        label: KNOWN_LABELS[col] || col,
        type: 'numeric',
        count: n,
      };
    }
    return meta;
  }

  // ---- Parser ----
  function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) throw new Error('File vuoto o formato non valido');

    const rawHeader = lines[0].split(',').map(h => h.trim().replace(/\s+/g, '_'));

    // Determine timestamp scale from original column name; fall back to settings.
    let tsScale = null;
    for (const rawCol of rawHeader) {
      if (TIMESTAMP_SCALES[rawCol] !== undefined) {
        tsScale = TIMESTAMP_SCALES[rawCol];
        break;
      }
    }
    if (tsScale === null) {
      const tsUnit = window.__telemetrySettings?.get?.('timestampUnit') || 'ms_to_s';
      if (tsUnit === 'ms_to_s') tsScale = 1000;
    }

    // Build canonical header applying aliases (avoid duplicates).
    const seen = new Set();
    const header = rawHeader.map(raw => {
      let canonical = COLUMN_ALIASES[raw] || raw;
      if (seen.has(canonical)) canonical = raw;
      seen.add(canonical);
      return canonical;
    });

    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length !== rawHeader.length) continue;

      const row = {};
      for (let j = 0; j < header.length; j++) {
        const val = parts[j].trim();
        let num = val === '' ? null : Number(val);
        if (header[j] === 'timestamp' && num !== null && tsScale) {
          num = num / tsScale;
        }
        row[header[j]] = num;
      }
      data.push(row);
    }

    return { columns: header, data };
  }

  function hasBinaryMagic(buffer) {
    if (!buffer || buffer.byteLength < BINARY_MAGIC.length) return false;
    const bytes = new Uint8Array(buffer, 0, BINARY_MAGIC.length);
    return BINARY_MAGIC.split('').every((ch, i) => bytes[i] === ch.charCodeAt(0));
  }

  function parseBinary(buffer) {
    if (!hasBinaryMagic(buffer)) {
      throw new Error('Formato binario non riconosciuto');
    }
    if (buffer.byteLength <= BINARY_HEADER_SIZE) {
      throw new Error('File binario vuoto o incompleto');
    }

    const view = new DataView(buffer);
    const data = [];
    const rowCount = Math.floor((buffer.byteLength - BINARY_HEADER_SIZE) / BINARY_RECORD_SIZE);

    for (let i = 0; i < rowCount; i++) {
      const base = BINARY_HEADER_SIZE + i * BINARY_RECORD_SIZE;
      const timestampNs = view.getUint32(base, true) + view.getUint32(base + 4, true) * 4_294_967_296;
      const row = {
        timestamp: timestampNs / 1_000_000_000,
        lat: view.getFloat32(base + 8, true),
        lon: view.getFloat32(base + 12, true),
        alt_m: view.getFloat32(base + 16, true),
        speed_kn: view.getFloat32(base + 20, true),
        course_deg: view.getFloat32(base + 24, true),
        hdop: view.getFloat32(base + 28, true),
        ax: view.getFloat32(base + 32, true),
        ay: view.getFloat32(base + 36, true),
        az: view.getFloat32(base + 40, true),
        wx: view.getFloat32(base + 44, true),
        wy: view.getFloat32(base + 48, true),
        wz: view.getFloat32(base + 52, true),
        travel_r_v: view.getFloat32(base + 56, true),
        travel_f_v: view.getFloat32(base + 60, true),
        fix_quality: view.getUint8(base + 64),
        sats: view.getUint8(base + 65),
        imu_ok: view.getUint8(base + 66),
        travel_ok: view.getUint8(base + 67),
      };
      row.fix = row.fix_quality > 0 ? 1 : 0;
      data.push(row);
    }

    if (data.length === 0) {
      throw new Error('Nessun campione binario valido trovato');
    }

    return { columns: [...BINARY_COLUMNS, 'fix'], data };
  }

  function binaryToCsvText(buffer) {
    const parsed = parseBinary(buffer);
    const lines = [BINARY_RAW_COLUMNS.join(',')];
    for (const row of parsed.data) {
      lines.push([
        Math.round((row.timestamp || 0) * 1_000_000_000),
        row.lat,
        row.lon,
        row.alt_m,
        row.speed_kn,
        row.course_deg,
        row.hdop,
        row.ax,
        row.ay,
        row.az,
        row.wx,
        row.wy,
        row.wz,
        row.travel_r_v,
        row.travel_f_v,
        row.fix_quality,
        row.sats,
        row.imu_ok,
        row.travel_ok,
      ].join(','));
    }
    return lines.join('\n');
  }

  // ---- Travel conversion (voltage → mm and %) ----
  function applyTravelConversion() {
    const settingsModule = window.__telemetrySettings;
    if (!settingsModule) return;

    const targets = [
      { v: 'travel_r_v', mm: 'travel_r_mm', pct: 'travel_r_pct' },
      { v: 'travel_f_v', mm: 'travel_f_mm', pct: 'travel_f_pct' },
    ];

    for (const { v, mm, pct } of targets) {
      if (!columns.includes(v)) continue;
      if (!columns.includes(mm)) columns.push(mm);
      if (!columns.includes(pct)) columns.push(pct);

      for (const row of rawData) {
        const voltage = row[v];
        if (voltage !== null && voltage !== undefined && !isNaN(voltage)) {
          row[mm] = settingsModule.voltageToTravel(voltage);
          row[pct] = settingsModule.voltageToTravelPct(voltage);
        } else {
          row[mm] = null;
          row[pct] = null;
        }
      }
    }
  }

  // ---- Public API ----
  function loadFromText(text, name = 'unknown') {
    const result = parseCSV(text);
    loadParsed(result, name);
  }

  function loadFromArrayBuffer(buffer, name = 'unknown') {
    const result = parseBinary(buffer);
    loadParsed(result, name);
  }

  function loadParsedData(parsed, name = 'unknown') {
    loadParsed(parsed, name);
  }

  function loadParsed(result, name) {
    rawData = result.data;
    columns = result.columns;
    fileName = name;

    // Reset splits
    splits = { start: null, end: null, intermediates: [] };
    splitsEnabled = false;
    filters = [];
    cursorIndex = -1;

    // Apply travel conversion
    applyTravelConversion();

    recomputeFiltered();

    emit('columns-ready', { columns, columnMeta });
    emit('data-loaded', { data: rawData, columns, columnMeta, fileName });
    emit('data-filtered', { data: filteredData, columns, columnMeta });
  }

  // Re-apply travel conversion when settings change (called externally)
  function reapplyTravelConversion() {
    applyTravelConversion();
    recomputeFiltered();
    emit('columns-ready', { columns, columnMeta });
    emit('data-filtered', { data: filteredData, columns, columnMeta });
  }

  function getColumns() { return [...columns]; }
  function getColumnMeta() { return { ...columnMeta }; }
  function getRawData() { return rawData; }
  function getFilteredData() { return filteredData; }
  function getFileName() { return fileName; }
  function getRowCount() { return rawData.length; }
  function getFilteredRowCount() { return filteredData.length; }

  function getColumnValues(col) {
    return filteredData.map(r => r[col]);
  }

  // ---- Filtering ----
  function getFilters() { return [...filters]; }

  function setFilters(newFilters) {
    filters = newFilters;
    recomputeFiltered();
    emit('data-filtered', { data: filteredData, columns, columnMeta });
  }

  function recomputeFiltered() {
    let data = rawData;

    // Always trim data to start..end when splits are set (regardless of splitsEnabled toggle)
    // splitsEnabled controls whether the "Taglia dati" filter is active,
    // but we always trim to start..end for charts and display when splits exist
    const s = splits.start;
    const e = splits.end;
    if (s !== null || e !== null) {
      data = data.filter(row => {
        const t = row.timestamp;
        if (t === null || t === undefined) return true;
        if (s !== null && t < s) return false;
        if (e !== null && t > e) return false;
        return true;
      });
    }

    // Apply user filters
    if (filters.length > 0) {
      data = data.filter(row => {
        return filters.every(f => {
          const val = row[f.column];
          if (val === null || val === undefined) return false;
          switch (f.operator) {
            case '>':  return val > f.value;
            case '<':  return val < f.value;
            case '>=': return val >= f.value;
            case '<=': return val <= f.value;
            case '==': return val === f.value;
            case '!=': return val !== f.value;
            case 'between': return val >= f.value && val <= f.value2;
            case 'not_between': return val < f.value || val > f.value2;
            default: return true;
          }
        });
      });
    }

    filteredData = data;
    columnMeta = computeColumnMeta(filteredData, columns);
  }

  // Get the start offset for relative timestamps.
  // If a start split is set, returns that. Otherwise returns the min timestamp of rawData.
  function getStartOffset() {
    if (splits.start !== null) return splits.start;
    if (rawData.length === 0) return 0;
    const ts = rawData.map(r => r.timestamp).filter(v => v !== null && v !== undefined);
    return ts.length > 0 ? Math.min(...ts) : 0;
  }

  // Get a relative timestamp (relative to start split)
  function toRelativeTime(absoluteTimestamp) {
    return absoluteTimestamp - getStartOffset();
  }

  // Get an absolute timestamp from a relative one
  function fromRelativeTime(relativeTimestamp) {
    return relativeTimestamp + getStartOffset();
  }

  // ---- Cursor (crosshair sync) ----
  function setCursor(timestamp) {
    // Find nearest row by timestamp in filtered data
    if (filteredData.length === 0) return;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < filteredData.length; i++) {
      const dist = Math.abs(filteredData[i].timestamp - timestamp);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (cursorIndex === bestIdx) return; // no change
    cursorIndex = bestIdx;
    emit('cursor-changed', {
      index: cursorIndex,
      row: filteredData[cursorIndex],
      timestamp: filteredData[cursorIndex].timestamp,
    });
  }

  function getCursorRow() {
    if (cursorIndex < 0 || cursorIndex >= filteredData.length) return null;
    return filteredData[cursorIndex];
  }

  function getCursorIndex() { return cursorIndex; }

  // ---- Splits ----
  function setSplits(newSplits) {
    splits = { ...splits, ...newSplits };
    // Clean intermediates: sort and remove nulls
    if (splits.intermediates) {
      splits.intermediates = splits.intermediates.filter(v => v !== null && !isNaN(v)).sort((a, b) => a - b);
    }
    // Always recompute: data is trimmed to start..end when splits are set
    recomputeFiltered();
    emit('splits-changed', { splits, enabled: splitsEnabled });
    emit('data-filtered', { data: filteredData, columns, columnMeta });
  }

  function setSplitsEnabled(enabled) {
    splitsEnabled = enabled;
    recomputeFiltered();
    emit('splits-changed', { splits, enabled: splitsEnabled });
    emit('data-filtered', { data: filteredData, columns, columnMeta });
  }

  function getSplits() { return { ...splits }; }
  function isSplitsEnabled() { return splitsEnabled; }

  // Get all split timestamps (start + intermediates + end) in order
  // Each entry has: { type, time (absolute), relTime (relative to start), label }
  function getAllSplitTimestamps() {
    const offset = getStartOffset();
    const all = [];
    if (splits.start !== null) all.push({ type: 'start', time: splits.start, relTime: splits.start - offset, label: 'Partenza' });
    if (splits.intermediates) {
      splits.intermediates.forEach((t, i) => {
        all.push({ type: 'intermediate', time: t, relTime: t - offset, label: `Intermedio ${i + 1}` });
      });
    }
    if (splits.end !== null) all.push({ type: 'end', time: splits.end, relTime: splits.end - offset, label: 'Arrivo' });
    return all.sort((a, b) => a.time - b.time);
  }

  // Get timestamp range of raw data
  function getTimeRange() {
    if (rawData.length === 0) return { min: 0, max: 0 };
    const ts = rawData.map(r => r.timestamp).filter(v => v !== null && v !== undefined);
    return { min: Math.min(...ts), max: Math.max(...ts) };
  }

  // Find the row nearest to a timestamp in raw data
  function findNearestRow(timestamp) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < rawData.length; i++) {
      const dist = Math.abs(rawData[i].timestamp - timestamp);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return rawData[bestIdx];
  }

  // Find the row nearest to a lat/lon in raw data (for map click → split)
  function findNearestGPSRow(lat, lon) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < rawData.length; i++) {
      const r = rawData[i];
      if (!r.lat || !r.lon || Math.abs(r.lat) < 0.001) continue;
      const dlat = r.lat - lat;
      const dlon = r.lon - lon;
      const dist = dlat * dlat + dlon * dlon;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return rawData[bestIdx] || null;
  }

  // ---- Derived data helpers ----
  function getTimeSeries(col) {
    const ts = columns.includes('timestamp') ? 'timestamp' : columns[0];
    return {
      x: filteredData.map(r => r[ts]),
      y: filteredData.map(r => r[col]),
      xLabel: columnMeta[ts]?.label || ts,
      yLabel: columnMeta[col]?.label || col,
    };
  }

  return {
    on, off, emit,
    loadFromText, loadFromArrayBuffer, loadParsedData,
    parseBinary, binaryToCsvText, hasBinaryMagic,
    getColumns, getColumnMeta, getRawData, getFilteredData,
    getFileName, getRowCount, getFilteredRowCount,
    getColumnValues, getTimeSeries,
    getFilters, setFilters,
    // Cursor
    setCursor, getCursorRow, getCursorIndex,
    // Splits
    setSplits, setSplitsEnabled, getSplits, isSplitsEnabled,
    getAllSplitTimestamps, getTimeRange, findNearestRow, findNearestGPSRow,
    getStartOffset, toRelativeTime, fromRelativeTime,
    // Travel
    reapplyTravelConversion,
    // Extensibility
    registerColumnInfo(col, info) {
      if (info.unit) KNOWN_UNITS[col] = info.unit;
      if (info.label) KNOWN_LABELS[col] = info.label;
    }
  };
})();

export default DataStore;
