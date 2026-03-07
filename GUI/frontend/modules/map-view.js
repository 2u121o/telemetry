/**
 * MAP VIEW MODULE
 * GPS track visualization using Leaflet.
 * 
 * Features:
 *  - Satellite imagery (Esri World Imagery) with high zoom
 *  - Full track always visible (dimmed outside splits range)
 *  - Color-coded active track by any channel
 *  - Cursor marker synced with charts
 *  - Split markers as perpendicular lines across the track
 *  - Toggleable split labels
 *  - PLACEMENT MODE: click on track to place splits directly on the map
 *  - Draggable split markers: drag to reposition along track
 */

import DataStore from './data-store.js';

function getSetting(key, fallback) {
  return window.__telemetrySettings?.get?.(key) ?? fallback;
}

const SPLIT_COLORS = {
  start: '#3fb950',
  end: '#f85149',
  intermediate: '#d29922',
};

const MapView = (() => {
  let map = null;
  let fullTrackLayer = null;
  let activeTrackLayer = null;
  let cursorMarker = null;
  let splitMarkersLayer = null;
  let splitLabelsLayer = null;   // Separate layer for labels (toggleable)
  let mapContainerEl = null;
  let mapAreaEl = null;
  let colorBySelect = null;
  let isVisible = false;
  let showLabels = true;

  // Cache ALL GPS points (from rawData) for snapping and full track display
  let allGpsPoints = [];
  // Cache active GPS points (from filteredData) for highlighted section
  let activeGpsPoints = [];

  // ---- Placement mode state ----
  let placementMode = 'none';
  let placementPreviewMarker = null;

  // References to sidebar placement UI
  let placementBtns = {};
  let placementStatusEl = null;

  function init(mapContainer, mapArea, colorSelect) {
    mapContainerEl = mapContainer;
    mapAreaEl = mapArea;
    colorBySelect = colorSelect;
    showLabels = getSetting('map_showLabels', true);

    DataStore.on('data-filtered', () => {
      if (isVisible) updateMap();
    });

    DataStore.on('data-loaded', () => {
      rebuildFullTrackCache();
    });

    DataStore.on('columns-ready', ({ columns, columnMeta }) => {
      if (colorBySelect) {
        colorBySelect.innerHTML = '<option value="none">Colore unico</option>' +
          columns.map(c => `<option value="${c}">${columnMeta[c]?.label || c}</option>`).join('');
      }
    });

    DataStore.on('cursor-changed', ({ row }) => {
      if (isVisible && row) updateCursorMarker(row);
    });

    DataStore.on('splits-changed', () => {
      if (isVisible) {
        updateActiveTrack();
        updateSplitMarkers();
      }
    });

    // React to settings changes (line length, track weight, etc.)
    DataStore.on('settings-changed', ({ key, settings }) => {
      if (key === 'map_showLabels' || (key === null)) {
        const show = settings?.map_showLabels ?? true;
        showLabels = show;
        if (splitLabelsLayer && map) {
          if (show) map.addLayer(splitLabelsLayer);
          else map.removeLayer(splitLabelsLayer);
        }
      }
      // Redraw map for visual settings
      if (isVisible && (!key || key?.startsWith('map_'))) {
        updateMap();
      }
    });

    if (colorBySelect) {
      colorBySelect.addEventListener('change', () => {
        if (isVisible) updateMap();
      });
    }
  }

  function initPlacementControls(btns, statusEl) {
    placementBtns = btns;
    placementStatusEl = statusEl;

    placementBtns.start?.addEventListener('click', () => setPlacementMode('start'));
    placementBtns.end?.addEventListener('click', () => setPlacementMode('end'));
    placementBtns.intermediate?.addEventListener('click', () => setPlacementMode('intermediate'));
    placementBtns.cancel?.addEventListener('click', () => setPlacementMode('none'));
  }

  function setPlacementMode(mode) {
    placementMode = mode;

    Object.values(placementBtns).forEach(b => b?.classList.remove('active-placement'));
    if (mode !== 'none' && placementBtns[mode]) {
      placementBtns[mode].classList.add('active-placement');
    }

    if (placementStatusEl) {
      const labels = {
        none: '',
        start: '🟢 Clicca sul tracciato per posizionare la PARTENZA',
        end: '🔴 Clicca sul tracciato per posizionare l\'ARRIVO',
        intermediate: '🟡 Clicca sul tracciato per aggiungere un INTERMEDIO',
      };
      placementStatusEl.textContent = labels[mode] || '';
      placementStatusEl.style.display = mode === 'none' ? 'none' : 'block';
    }

    if (mapContainerEl) {
      mapContainerEl.style.cursor = mode !== 'none' ? 'crosshair' : '';
    }

    if (placementPreviewMarker) {
      placementPreviewMarker.remove();
      placementPreviewMarker = null;
    }

    if (placementBtns.cancel) {
      placementBtns.cancel.style.display = mode === 'none' ? 'none' : 'inline-flex';
    }
  }

  function show() {
    if (!mapAreaEl) return;
    mapAreaEl.classList.remove('hidden');
    isVisible = true;

    if (!map) {
      map = L.map(mapContainerEl, {
        zoomControl: true,
        attributionControl: true,
        maxZoom: 22,
      }).setView([41.9, 12.5], 13);

      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 22,
        maxNativeZoom: 19,
      });

      const labelsOverlay = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 22,
        maxNativeZoom: 19,
        opacity: 0.6,
      });

      const dark = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 22,
        maxNativeZoom: 19,
      });

      satellite.addTo(map);
      labelsOverlay.addTo(map);

      L.control.layers({
        'Satellite': satellite,
        'Dark': dark,
      }, {
        'Etichette strade': labelsOverlay,
      }, { position: 'topright', collapsed: true }).addTo(map);

      fullTrackLayer = L.layerGroup().addTo(map);
      activeTrackLayer = L.layerGroup().addTo(map);
      splitMarkersLayer = L.layerGroup().addTo(map);
      splitLabelsLayer = L.layerGroup();
      if (showLabels) splitLabelsLayer.addTo(map);

      map.on('click', onMapClick);
      map.on('mousemove', onMapMouseMove);
    }

    setTimeout(() => {
      map.invalidateSize();
      updateMap();
    }, 100);
  }

  function hide() {
    if (!mapAreaEl) return;
    mapAreaEl.classList.add('hidden');
    isVisible = false;
  }

  function toggle() {
    if (isVisible) hide(); else show();
  }

  function rebuildFullTrackCache() {
    const raw = DataStore.getRawData();
    const cols = DataStore.getColumns();
    if (!cols.includes('lat') || !cols.includes('lon')) {
      allGpsPoints = [];
      return;
    }
    allGpsPoints = raw.filter(r =>
      r.lat && r.lon &&
      Math.abs(r.lat) > 0.001 &&
      Math.abs(r.lon) > 0.001
    );
  }

  // ---- Map click: place a split ----
  function onMapClick(e) {
    if (placementMode === 'none') return;
    if (allGpsPoints.length === 0) return;

    const row = DataStore.findNearestGPSRow(e.latlng.lat, e.latlng.lng);
    if (!row || !row.timestamp) return;

    const timestamp = row.timestamp;
    const splits = DataStore.getSplits();

    if (placementMode === 'start') {
      DataStore.setSplits({ start: timestamp });
      showToast(`Partenza impostata (0.000s)`, 'success');
      setPlacementMode('none');
    } else if (placementMode === 'end') {
      DataStore.setSplits({ end: timestamp });
      const relTime = DataStore.toRelativeTime(timestamp);
      showToast(`Arrivo impostato a ${relTime.toFixed(3)}s`, 'success');
      setPlacementMode('none');
    } else if (placementMode === 'intermediate') {
      const newInts = [...(splits.intermediates || []), timestamp];
      DataStore.setSplits({ intermediates: newInts });
      const relTime = DataStore.toRelativeTime(timestamp);
      showToast(`Intermedio aggiunto a ${relTime.toFixed(3)}s`, 'success');
    }
  }

  // ---- Map mousemove: preview marker in placement mode ----
  function onMapMouseMove(e) {
    if (placementMode === 'none' || allGpsPoints.length === 0) {
      if (placementPreviewMarker) {
        placementPreviewMarker.remove();
        placementPreviewMarker = null;
      }
      return;
    }

    const row = DataStore.findNearestGPSRow(e.latlng.lat, e.latlng.lng);
    if (!row || !row.lat || Math.abs(row.lat) < 0.001) return;

    const color = SPLIT_COLORS[placementMode] || '#d29922';

    if (placementPreviewMarker) {
      placementPreviewMarker.setLatLng([row.lat, row.lon]);
    } else {
      placementPreviewMarker = L.circleMarker([row.lat, row.lon], {
        radius: 9,
        color: color,
        fillColor: color,
        fillOpacity: 0.4,
        weight: 2,
        dashArray: '4 4',
      }).addTo(map);
    }

    placementPreviewMarker.setStyle({ color, fillColor: color });
  }

  // ---- Full map update ----
  function updateMap() {
    if (!map || !fullTrackLayer) return;

    fullTrackLayer.clearLayers();
    activeTrackLayer.clearLayers();

    const cols = DataStore.getColumns();
    if (!cols.includes('lat') || !cols.includes('lon')) return;

    const filteredData = DataStore.getFilteredData();
    activeGpsPoints = filteredData.filter(r =>
      r.lat && r.lon &&
      Math.abs(r.lat) > 0.001 &&
      Math.abs(r.lon) > 0.001
    );

    if (allGpsPoints.length === 0) return;

    // 1. Draw FULL track (dimmed but visible on satellite)
    const fullLatLngs = allGpsPoints.map(p => [p.lat, p.lon]);
    L.polyline(fullLatLngs, {
      color: '#00ffcc',
      weight: 2.5,
      opacity: getSetting('map_inactiveOpacity', 0.45),
      dashArray: '6 4',
    }).addTo(fullTrackLayer);

    // 2. Draw ACTIVE track (bright)
    const colorBy = colorBySelect?.value || 'none';

    const trackWeight = getSetting('map_trackWeight', 3.5);

    if (activeGpsPoints.length > 0) {
      if (colorBy === 'none') {
        const activeLatlngs = activeGpsPoints.map(p => [p.lat, p.lon]);
        L.polyline(activeLatlngs, {
          color: '#58a6ff',
          weight: trackWeight,
          opacity: 0.95,
        }).addTo(activeTrackLayer);
      } else {
        const meta = DataStore.getColumnMeta();
        const colMeta = meta[colorBy];
        if (colMeta) {
          const { min, max } = colMeta;
          const range = max - min || 1;
          for (let i = 0; i < activeGpsPoints.length - 1; i++) {
            const t = (activeGpsPoints[i][colorBy] - min) / range;
            const color = valueToColor(t);
            L.polyline(
              [[activeGpsPoints[i].lat, activeGpsPoints[i].lon], [activeGpsPoints[i + 1].lat, activeGpsPoints[i + 1].lon]],
              { color, weight: trackWeight, opacity: 0.95 }
            ).addTo(activeTrackLayer);
          }
        }
      }
    }

    // Fit bounds to FULL track
    const bounds = L.latLngBounds(fullLatLngs);
    map.fitBounds(bounds, { padding: [30, 30] });

    updateSplitMarkers();
  }

  // ---- Update only the active track ----
  function updateActiveTrack() {
    if (!map || !activeTrackLayer) return;
    activeTrackLayer.clearLayers();

    const filteredData = DataStore.getFilteredData();
    activeGpsPoints = filteredData.filter(r =>
      r.lat && r.lon &&
      Math.abs(r.lat) > 0.001 &&
      Math.abs(r.lon) > 0.001
    );

    if (activeGpsPoints.length === 0) return;

    const colorBy = colorBySelect?.value || 'none';
    const trackWeight = getSetting('map_trackWeight', 3.5);

    if (colorBy === 'none') {
      const activeLatlngs = activeGpsPoints.map(p => [p.lat, p.lon]);
      L.polyline(activeLatlngs, {
        color: '#58a6ff',
        weight: trackWeight,
        opacity: 0.95,
      }).addTo(activeTrackLayer);
    } else {
      const meta = DataStore.getColumnMeta();
      const colMeta = meta[colorBy];
      if (colMeta) {
        const { min, max } = colMeta;
        const range = max - min || 1;
        for (let i = 0; i < activeGpsPoints.length - 1; i++) {
          const t = (activeGpsPoints[i][colorBy] - min) / range;
          const color = valueToColor(t);
          L.polyline(
            [[activeGpsPoints[i].lat, activeGpsPoints[i].lon], [activeGpsPoints[i + 1].lat, activeGpsPoints[i + 1].lon]],
            { color, weight: trackWeight, opacity: 0.95 }
          ).addTo(activeTrackLayer);
        }
      }
    }
  }

  function updateCursorMarker(row) {
    if (!map) return;
    if (!row || !row.lat || !row.lon || Math.abs(row.lat) < 0.001) return;

    if (cursorMarker) {
      cursorMarker.setLatLng([row.lat, row.lon]);
    } else {
      cursorMarker = L.circleMarker([row.lat, row.lon], {
        radius: 7,
        color: '#ffffff',
        fillColor: '#58a6ff',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);
    }

    const meta = DataStore.getColumnMeta();
    const cols = DataStore.getColumns();
    const relTime = DataStore.toRelativeTime(row.timestamp);
    let popupHtml = '<div style="font-size:11px; font-family: monospace; line-height: 1.5;">';
    popupHtml += `<b>t = ${relTime?.toFixed(3)}s</b><br>`;
    for (const col of cols) {
      if (col === 'timestamp') continue;
      const label = meta[col]?.label || col;
      const unit = meta[col]?.unit || '';
      const val = row[col];
      popupHtml += `${label}: <b>${val !== null && val !== undefined ? val.toFixed(4) : '—'}</b> ${unit}<br>`;
    }
    popupHtml += '</div>';
    cursorMarker.bindPopup(popupHtml);
  }

  // ---- Compute a perpendicular line across the track at a given point ----
  function computePerpendicularLine(point, lengthMeters) {
    // Find the index of this point in allGpsPoints
    let idx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < allGpsPoints.length; i++) {
      const d = Math.abs(allGpsPoints[i].timestamp - point.timestamp);
      if (d < bestDist) {
        bestDist = d;
        idx = i;
      }
    }
    if (idx < 0) return null;

    // Get track direction from neighboring points
    const prev = allGpsPoints[Math.max(0, idx - 3)];
    const next = allGpsPoints[Math.min(allGpsPoints.length - 1, idx + 3)];

    const dLat = next.lat - prev.lat;
    const dLon = next.lon - prev.lon;

    // Perpendicular direction (rotate 90°)
    const perpLat = -dLon;
    const perpLon = dLat;

    // Normalize and scale to desired length in degrees (rough approximation)
    const mag = Math.sqrt(perpLat * perpLat + perpLon * perpLon);
    if (mag < 1e-10) return null;

    // Convert meters to approximate degrees (1° lat ≈ 111320m, 1° lon ≈ 111320*cos(lat))
    const latDeg = lengthMeters / 111320;
    const lonDeg = lengthMeters / (111320 * Math.cos(point.lat * Math.PI / 180));

    const scale = 1 / mag;
    const offLat = perpLat * scale * latDeg;
    const offLon = perpLon * scale * lonDeg;

    return [
      [point.lat - offLat, point.lon - offLon],
      [point.lat + offLat, point.lon + offLon],
    ];
  }

  function updateSplitMarkers() {
    if (!map || !splitMarkersLayer) return;
    splitMarkersLayer.clearLayers();
    splitLabelsLayer.clearLayers();

    const allSplits = DataStore.getAllSplitTimestamps();
    if (allSplits.length === 0 && allGpsPoints.length > 0) {
      addSplitMarkerAtPoint(allGpsPoints[0], 'start', 'Partenza', null);
      addSplitMarkerAtPoint(allGpsPoints[allGpsPoints.length - 1], 'end', 'Arrivo', null);
      return;
    }

    for (const s of allSplits) {
      const row = DataStore.findNearestRow(s.time);
      if (row && row.lat && row.lon && Math.abs(row.lat) > 0.001) {
        addSplitMarkerAtPoint(row, s.type, s.label, s);
      }
    }
  }

  function addSplitMarkerAtPoint(point, type, label, splitInfo) {
    const color = SPLIT_COLORS[type] || '#d29922';
    const isDraggable = splitInfo !== null;
    const baseLine = getSetting('map_splitLineLength', 6);
    const lineLength = type === 'intermediate' ? baseLine * 0.7 : baseLine;

    // Draw perpendicular line across the track
    const perpLine = computePerpendicularLine(point, lineLength);
    if (perpLine) {
      const lineWeight = type === 'intermediate' ? 3 : 4;
      L.polyline(perpLine, {
        color: color,
        weight: lineWeight,
        opacity: 0.95,
        lineCap: 'round',
      }).addTo(splitMarkersLayer);
    }

    // Invisible draggable marker on top (for interaction)
    if (isDraggable) {
      const hitSize = 20;
      const hitIcon = L.divIcon({
        className: 'split-hit-area',
        html: `<div style="
          width: ${hitSize}px;
          height: ${hitSize}px;
          border-radius: 50%;
          background: ${color};
          opacity: 0.25;
          border: 2px solid ${color};
          cursor: grab;
        "></div>`,
        iconSize: [hitSize, hitSize],
        iconAnchor: [hitSize / 2, hitSize / 2],
      });

      const marker = L.marker([point.lat, point.lon], {
        icon: hitIcon,
        draggable: true,
      });

      const relTime = DataStore.toRelativeTime(point.timestamp);
      marker.bindPopup(`<b>${label}</b><br>t = ${relTime?.toFixed(3)}s<br><i style="font-size:10px;color:#8b949e;">Trascina per spostare</i>`);

      marker.on('drag', (e) => {
        const latlng = e.target.getLatLng();
        const nearestRow = DataStore.findNearestGPSRow(latlng.lat, latlng.lng);
        if (nearestRow && nearestRow.lat && Math.abs(nearestRow.lat) > 0.001) {
          e.target.setLatLng([nearestRow.lat, nearestRow.lon]);
        }
      });

      marker.on('dragend', (e) => {
        const latlng = e.target.getLatLng();
        const nearestRow = DataStore.findNearestGPSRow(latlng.lat, latlng.lng);
        if (!nearestRow) return;

        const newTimestamp = nearestRow.timestamp;
        const newRelTime = DataStore.toRelativeTime(newTimestamp);
        const splits = DataStore.getSplits();

        if (splitInfo.type === 'start') {
          DataStore.setSplits({ start: newTimestamp });
          showToast(`Partenza spostata a ${newRelTime.toFixed(3)}s`, 'success');
        } else if (splitInfo.type === 'end') {
          DataStore.setSplits({ end: newTimestamp });
          showToast(`Arrivo spostato a ${newRelTime.toFixed(3)}s`, 'success');
        } else if (splitInfo.type === 'intermediate') {
          const ints = [...(splits.intermediates || [])];
          const idx = ints.indexOf(splitInfo.time);
          if (idx !== -1) {
            ints[idx] = newTimestamp;
            DataStore.setSplits({ intermediates: ints });
            showToast(`Intermedio spostato a ${newRelTime.toFixed(3)}s`, 'success');
          }
        }

        marker.setPopupContent(`<b>${label}</b><br>t = ${newRelTime.toFixed(3)}s<br><i style="font-size:10px;color:#8b949e;">Trascina per spostare</i>`);
      });

      splitMarkersLayer.addLayer(marker);
    }

    // Label (on separate toggleable layer)
    const labelIcon = L.divIcon({
      className: 'split-label',
      html: `<span style="
        background: ${color};
        color: #fff;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 700;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
      ">${label}</span>`,
      iconSize: [0, 0],
      iconAnchor: [-12, 12],
    });

    const labelMarker = L.marker([point.lat, point.lon], { icon: labelIcon, interactive: false });
    splitLabelsLayer.addLayer(labelMarker);
  }

  function valueToColor(t) {
    t = Math.max(0, Math.min(1, t));
    const hue = (1 - t) * 240;
    return `hsl(${hue}, 80%, 55%)`;
  }

  return { init, initPlacementControls, show, hide, toggle, updateMap, setPlacementMode };
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

export default MapView;
