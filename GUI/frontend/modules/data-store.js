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
  const KNOWN_UNITS = {
    timestamp: 's',
    ax: 'g', ay: 'g', az: 'g',
    wx: 'rad/s', wy: 'rad/s', wz: 'rad/s',
    lat: '°', lon: '°',
    alt_m: 'm',
    travel_r_v: 'V',        // Raw voltage from sensor
    travel_r_mm: 'mm',       // Converted travel in mm
    travel_r_pct: '%',       // Converted travel in percentage
  };

  const KNOWN_LABELS = {
    timestamp: 'Tempo',
    ax: 'Accel X', ay: 'Accel Y', az: 'Accel Z',
    wx: 'Gyro X', wy: 'Gyro Y', wz: 'Gyro Z',
    lat: 'Latitudine', lon: 'Longitudine',
    alt_m: 'Altitudine',
    travel_r_v: 'Travel Rear (V)',
    travel_r_mm: 'Travel Rear (mm)',
    travel_r_pct: 'Travel Rear (%)',
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

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().replace(/\s+/g, '_'));
    const data = [];
    const hasTimestamp = header.includes('timestamp');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length !== header.length) continue;

      const row = {};
      for (let j = 0; j < header.length; j++) {
        const val = parts[j].trim();
        let num = val === '' ? null : Number(val);
        // Convert timestamp from ms to seconds (based on settings)
        if (header[j] === 'timestamp' && num !== null) {
          const tsUnit = window.__telemetrySettings?.get?.('timestampUnit') || 'ms_to_s';
          if (tsUnit === 'ms_to_s') {
            num = num / 1000;
          }
        }
        row[header[j]] = num;
      }
      data.push(row);
    }

    return { columns: header, data };
  }

  // ---- Travel conversion (voltage → mm and %) ----
  // Called after parsing and when settings change
  function applyTravelConversion() {
    if (!columns.includes('travel_r_v')) return;

    // Lazy import: get settings from global if available
    const settingsModule = window.__telemetrySettings;
    if (!settingsModule) return;

    // Add derived columns if not present
    if (!columns.includes('travel_r_mm')) {
      columns.push('travel_r_mm');
    }
    if (!columns.includes('travel_r_pct')) {
      columns.push('travel_r_pct');
    }

    for (const row of rawData) {
      const voltage = row.travel_r_v;
      if (voltage !== null && voltage !== undefined && !isNaN(voltage)) {
        row.travel_r_mm = settingsModule.voltageToTravel(voltage);
        row.travel_r_pct = settingsModule.voltageToTravelPct(voltage);
      } else {
        row.travel_r_mm = null;
        row.travel_r_pct = null;
      }
    }
  }

  // ---- Public API ----
  function loadFromText(text, name = 'unknown') {
    const result = parseCSV(text);
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
    loadFromText,
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
