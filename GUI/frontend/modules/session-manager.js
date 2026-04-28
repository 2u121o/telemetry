/**
 * SESSION MANAGER MODULE
 * Save and load analysis sessions (splits, charts, filters, map settings).
 * 
 * Storage options:
 *  - Download/upload as .json file
 *  - Auto-save to localStorage (per data file)
 * 
 * Session format:
 * {
 *   version: 1,
 *   fileName: "data.txt",
 *   savedAt: "2026-03-07T...",
 *   sessionName: "My Session",
 *   splits: { start, end, intermediates },
 *   charts: [ { type, xColumn, yColumns, zColumn }, ... ],
 *   filters: [ { column, operator, value, value2 }, ... ],
 *   mapColorBy: "none",
 * }
 */

import DataStore from './data-store.js';
import ChartManager from './chart-manager.js';
import SplitsPanel from './splits-panel.js';

function getSettings() {
  return window.__telemetrySettings?.getAll?.() || {};
}

function applySettings(obj) {
  if (obj && window.__telemetrySettings) {
    window.__telemetrySettings.setMultiple(obj);
    window.__telemetrySettings.render();
  }
}

const SESSION_VERSION = 1;
const LS_PREFIX = 'bike-telemetry-session-';

const SessionManager = (() => {

  // ---- Build session object from current state ----
  function buildSession(sessionName = '') {
    const fileName = DataStore.getFileName();
    const settingsModule = window.__telemetrySettings;
    return {
      version: SESSION_VERSION,
      fileName,
      savedAt: new Date().toISOString(),
      sessionName: sessionName || `Sessione ${new Date().toLocaleString('it-IT')}`,
      splits: DataStore.getSplits(),
      charts: ChartManager.getConfigs(),
      filters: DataStore.getFilters(),
      mapColorBy: document.getElementById('mapColorBy')?.value || 'none',
      settings: getSettings(),
      runNotes: fileName && settingsModule ? settingsModule.getRunNotes(fileName) : null,
      bikes: settingsModule ? settingsModule.getBikes() : [],
      setups: settingsModule ? settingsModule.getSetups() : [],
      activeBikeId: settingsModule ? settingsModule.getActiveBikeId() : null,
      trackProfiles: SplitsPanel.getTrackProfiles(),
    };
  }

  // ---- Apply session to current state ----
  function applySession(session) {
    if (!session || session.version !== SESSION_VERSION) {
      showToast('Formato sessione non valido', 'error');
      return false;
    }

    // Check if the file matches
    const currentFile = DataStore.getFileName();
    if (session.fileName && currentFile && session.fileName !== currentFile) {
      const proceed = confirm(
        `Questa sessione è stata salvata per "${session.fileName}" ma il file corrente è "${currentFile}".\n\nVuoi applicarla comunque?`
      );
      if (!proceed) return false;
    }

    // Restore splits
    if (session.splits) {
      DataStore.setSplits(session.splits);
    }

    // Restore filters
    if (session.filters && session.filters.length > 0) {
      DataStore.setFilters(session.filters);
    }

    // Restore charts
    if (session.charts) {
      ChartManager.restoreConfigs(session.charts);
    }

    // Restore map color
    if (session.mapColorBy) {
      const sel = document.getElementById('mapColorBy');
      if (sel) sel.value = session.mapColorBy;
    }

    // Restore settings
    if (session.settings) {
      applySettings(session.settings);
    }

    // Restore run notes
    const settingsModule = window.__telemetrySettings;
    if (session.runNotes && session.fileName && settingsModule) {
      settingsModule.setRunNotesData(session.fileName, session.runNotes);
    }

    // Restore bikes (merge by name)
    if (session.bikes && session.bikes.length > 0 && settingsModule) {
      const existing = settingsModule.getBikes();
      const existingNames = new Set(existing.map(b => b.name));
      for (const b of session.bikes) {
        if (!existingNames.has(b.name)) {
          settingsModule.addBike(b);
        }
      }
    }

    // Restore setups (merge by name + bike)
    if (session.setups && session.setups.length > 0 && settingsModule) {
      const existing = settingsModule.getSetups();
      const existingKeys = new Set(existing.map(s => `${s.name}|${s.bike_id}`));
      for (const s of session.setups) {
        if (!existingKeys.has(`${s.name}|${s.bike_id}`)) {
          settingsModule.addSetup(s);
        }
      }
    }

    // Restore active bike
    if (session.activeBikeId && settingsModule) {
      settingsModule.setActiveBike(session.activeBikeId);
    }

    // Restore track profiles (merge by name)
    if (session.trackProfiles && session.trackProfiles.length > 0) {
      const existingProfiles = SplitsPanel.getTrackProfiles();
      const existingNames = new Set(existingProfiles.map(p => p.name));
      for (const p of session.trackProfiles) {
        if (!existingNames.has(p.name)) {
          SplitsPanel.addTrackProfile(p.name, p.splits);
        }
      }
    }

    // Re-render settings panel
    if (settingsModule?.render) settingsModule.render();

    return true;
  }

  // ---- Save to JSON file (download) ----
  function saveToFile(sessionName) {
    const session = buildSession(sessionName);
    const json = JSON.stringify(session, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const safeName = (session.sessionName || 'session').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `telemetry_session_${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Sessione "${session.sessionName}" salvata come file`, 'success');
  }

  // ---- Load from JSON file ----
  function loadFromFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) { resolve(false); return; }

        try {
          const text = await file.text();
          const session = JSON.parse(text);
          const ok = applySession(session);
          if (ok) {
            showToast(`Sessione "${session.sessionName || 'caricata'}" ripristinata`, 'success');
          }
          resolve(ok);
        } catch (err) {
          showToast(`Errore nel caricamento sessione: ${err.message}`, 'error');
          resolve(false);
        }
      });
      input.click();
    });
  }

  // ---- Auto-save to localStorage ----
  function autoSave() {
    const fileName = DataStore.getFileName();
    if (!fileName) return;

    const session = buildSession('Auto-save');
    try {
      localStorage.setItem(LS_PREFIX + fileName, JSON.stringify(session));
    } catch (e) {
      // localStorage full or unavailable — silently ignore
      console.warn('Auto-save failed:', e);
    }
  }

  // ---- Auto-load from localStorage ----
  function autoLoad() {
    const fileName = DataStore.getFileName();
    if (!fileName) return false;

    try {
      const json = localStorage.getItem(LS_PREFIX + fileName);
      if (!json) return false;

      const session = JSON.parse(json);
      if (session && session.version === SESSION_VERSION) {
        applySession(session);
        showToast('Sessione precedente ripristinata', 'info');
        return true;
      }
    } catch (e) {
      console.warn('Auto-load failed:', e);
    }
    return false;
  }

  // ---- Clear auto-save for current file ----
  function clearAutoSave() {
    const fileName = DataStore.getFileName();
    if (fileName) {
      localStorage.removeItem(LS_PREFIX + fileName);
    }
  }

  // ---- List saved sessions in localStorage ----
  function listSavedSessions() {
    const sessions = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(LS_PREFIX)) {
        try {
          const session = JSON.parse(localStorage.getItem(key));
          sessions.push({
            key,
            fileName: session.fileName,
            sessionName: session.sessionName,
            savedAt: session.savedAt,
          });
        } catch (e) { /* skip corrupt entries */ }
      }
    }
    return sessions.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  }

  // ---- Delete a saved session ----
  function deleteSavedSession(key) {
    localStorage.removeItem(key);
  }

  // ---- Setup auto-save on changes ----
  function initAutoSave() {
    // Auto-save when splits or filters change
    let autoSaveTimer = null;
    const debouncedAutoSave = () => {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        if (DataStore.getFileName()) autoSave();
      }, 2000); // 2s debounce
    };

    DataStore.on('splits-changed', debouncedAutoSave);
    DataStore.on('data-filtered', debouncedAutoSave);

    // Try auto-load after data is loaded
    DataStore.on('data-loaded', () => {
      // Small delay to let default charts render first
      setTimeout(() => autoLoad(), 300);
    });
  }

  return {
    buildSession,
    applySession,
    saveToFile,
    loadFromFile,
    autoSave,
    autoLoad,
    clearAutoSave,
    listSavedSessions,
    deleteSavedSession,
    initAutoSave,
  };
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

export default SessionManager;
