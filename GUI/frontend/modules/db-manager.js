/**
 * DB MANAGER MODULE
 * Bridge between the frontend modules and the SQLite backend.
 *
 * Strategy: The frontend keeps working with its existing modules (DataStore,
 * SettingsPanel, etc.) but this module syncs data to/from the backend DB.
 * This means:
 *  - When a file is loaded → also upload to DB, store the run_id
 *  - When bikes/setups change → sync to DB
 *  - Export/import goes through DB (full bundle)
 *  - Compare view loads runs from DB
 */

import ApiClient from './api-client.js';
import DataStore from './data-store.js';

const DbManager = (() => {
  let currentRunId = null;   // DB run id for the currently loaded file
  let isOnline = false;      // Is the backend reachable?
  let syncQueue = [];        // Queued operations when offline

  // ===== Init: check if backend is available =====
  async function init() {
    try {
      await ApiClient.health();
      isOnline = true;
      console.log('[DbManager] Backend online ✓');
      // Sync existing localStorage data to DB on first connection
      await syncLocalStorageToDB();
    } catch (err) {
      isOnline = false;
      console.warn('[DbManager] Backend offline — working in local-only mode');
    }
    return isOnline;
  }

  // ===== Upload current file to DB =====
  async function uploadCurrentRun(csvText, fileName, opts = {}) {
    if (!isOnline) {
      console.warn('[DbManager] Offline — skipping DB upload');
      return null;
    }

    try {
      // Get current settings for sensor config
      const settings = window.__telemetrySettings?.getAll?.() || {};
      const sensorSettings = {
        timestampUnit: settings.timestampUnit || 'ms_to_s',
        travel_vMax: settings.travel_vMax ?? 3.3,
        travel_vMin: settings.travel_vMin ?? 0,
        travel_strokeMm: settings.travel_strokeMm ?? 200,
        travel_inverted: settings.travel_inverted ?? false,
      };

      // Check if run with same filename already exists
      const existingRuns = await ApiClient.listRuns();
      const existing = existingRuns.find(r => r.file_name === fileName);

      if (existing) {
        // Run already in DB — just set the current run ID
        currentRunId = existing.id;
        console.log(`[DbManager] Run "${fileName}" already in DB (id=${existing.id})`);
        return existing;
      }

      // Upload new run
      const runMeta = {
        name: opts.name || fileName,
        file_name: fileName,
        bike_id: opts.bike_id || null,
        setup_id: opts.setup_id || null,
        sensor_settings: sensorSettings,
        notes_data: opts.notes_data || {},
      };

      const run = await ApiClient.createRun(csvText, runMeta);
      currentRunId = run.id;
      console.log(`[DbManager] Run "${fileName}" uploaded to DB (id=${run.id})`);
      toast(`Run salvata nel database (${run.sample_count} campioni)`, 'success');
      return run;
    } catch (err) {
      console.error('[DbManager] Upload failed:', err);
      toast(`Errore salvataggio DB: ${err.message}`, 'error');
      return null;
    }
  }

  // ===== Update run metadata (splits, notes, bike/setup links) =====
  async function updateCurrentRun(updates) {
    if (!isOnline || !currentRunId) return null;
    try {
      const result = await ApiClient.updateRun(currentRunId, updates);
      return result;
    } catch (err) {
      console.error('[DbManager] Update failed:', err);
      return null;
    }
  }

  // ===== Save splits to DB =====
  async function saveSplits(splits) {
    return updateCurrentRun({ splits });
  }

  // ===== Save run notes to DB =====
  async function saveRunNotes(notesData) {
    return updateCurrentRun({ notes_data: notesData });
  }

  // ===== Link bike/setup to current run =====
  async function linkBikeSetup(bikeId, setupId) {
    return updateCurrentRun({ bike_id: bikeId, setup_id: setupId });
  }

  // ===== Save chart/filter configs =====
  async function saveConfigs(chartConfigs, filterConfigs) {
    return updateCurrentRun({ chart_configs: chartConfigs, filter_configs: filterConfigs });
  }

  // ===== Bikes CRUD (sync to DB) =====
  async function syncBike(localBike) {
    if (!isOnline) return null;
    try {
      // Strip local-only fields
      const data = { ...localBike };
      delete data.id;
      delete data.createdAt;
      const dbBike = await ApiClient.createBike(data);
      return dbBike;
    } catch (err) {
      console.error('[DbManager] Bike sync failed:', err);
      return null;
    }
  }

  async function syncSetup(localSetup, dbBikeId) {
    if (!isOnline) return null;
    try {
      const data = { ...localSetup, bike_id: dbBikeId || localSetup.bike_id };
      delete data.id;
      delete data.createdAt;
      const dbSetup = await ApiClient.createSetup(data);
      return dbSetup;
    } catch (err) {
      console.error('[DbManager] Setup sync failed:', err);
      return null;
    }
  }

  // ===== Sync localStorage bikes/setups to DB (first time) =====
  async function syncLocalStorageToDB() {
    if (!isOnline) return;
    try {
      const settingsModule = window.__telemetrySettings;
      if (!settingsModule) return;

      // Sync bikes
      const localBikes = settingsModule.getBikes();
      const dbBikes = await ApiClient.listBikes();
      const dbBikeNames = new Set(dbBikes.map(b => b.name));

      for (const lb of localBikes) {
        if (!dbBikeNames.has(lb.name)) {
          const data = { ...lb };
          delete data.id;
          delete data.createdAt;
          await ApiClient.createBike(data);
        }
      }

      // Sync setups
      const localSetups = settingsModule.getSetups();
      const dbSetups = await ApiClient.listSetups();
      const dbSetupKeys = new Set(dbSetups.map(s => `${s.name}|${s.bike_id}`));

      for (const ls of localSetups) {
        const key = `${ls.name}|${ls.bike_id}`;
        if (!dbSetupKeys.has(key)) {
          const data = { ...ls };
          delete data.id;
          delete data.createdAt;
          // Map local bike_id to DB bike_id
          if (ls.bike_id) {
            const localBike = settingsModule.getBikeById(ls.bike_id);
            if (localBike) {
              const dbBike = dbBikes.find(b => b.name === localBike.name) ||
                             (await ApiClient.listBikes()).find(b => b.name === localBike.name);
              if (dbBike) data.bike_id = dbBike.id;
            }
          }
          await ApiClient.createSetup(data);
        }
      }

      console.log('[DbManager] localStorage → DB sync complete');
    } catch (err) {
      console.error('[DbManager] Initial sync failed:', err);
    }
  }

  // ===== Export a run (full bundle: bike + setup + telemetry + notes) =====
  async function exportRun(runId) {
    const id = runId || currentRunId;
    if (!id) {
      toast('Nessuna run da esportare', 'error');
      return null;
    }
    try {
      const run = await ApiClient.getRun(id);
      const safeName = (run.file_name || `run-${id}`)
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      await ApiClient.downloadExport(id, `${safeName}_export.json`);
      toast('Run esportata con successo!', 'success');
    } catch (err) {
      toast(`Errore esportazione: ${err.message}`, 'error');
    }
  }

  // ===== Import a run bundle =====
  async function importRun() {
    if (!isOnline) {
      toast('Backend non disponibile', 'error');
      return null;
    }
    try {
      const result = await ApiClient.importFromFile();
      toast(`Run "${result.file_name}" importata con successo!`, 'success');
      return result;
    } catch (err) {
      toast(`Errore importazione: ${err.message}`, 'error');
      return null;
    }
  }

  // ===== List all runs from DB =====
  async function listRuns() {
    if (!isOnline) return [];
    try {
      return await ApiClient.listRuns();
    } catch (err) {
      console.error('[DbManager] listRuns failed:', err);
      return [];
    }
  }

  // ===== Get a specific run with full data =====
  async function getRunWithData(runId) {
    if (!isOnline) return null;
    try {
      const [run, dataResp] = await Promise.all([
        ApiClient.getRun(runId),
        ApiClient.getRunData(runId),
      ]);
      return { ...run, telemetry: dataResp.data };
    } catch (err) {
      console.error('[DbManager] getRunWithData failed:', err);
      return null;
    }
  }

  // ===== Delete a run =====
  async function deleteRun(runId) {
    if (!isOnline) return false;
    try {
      await ApiClient.deleteRun(runId);
      if (runId === currentRunId) currentRunId = null;
      return true;
    } catch (err) {
      console.error('[DbManager] deleteRun failed:', err);
      return false;
    }
  }

  // ===== Getters =====
  function getCurrentRunId() { return currentRunId; }
  function getIsOnline() { return isOnline; }

  // ===== Helper =====
  function toast(msg, type) {
    if (window.__telemetryToast) window.__telemetryToast(msg, type);
  }

  return {
    init,
    uploadCurrentRun,
    updateCurrentRun,
    saveSplits,
    saveRunNotes,
    linkBikeSetup,
    saveConfigs,
    syncBike,
    syncSetup,
    exportRun,
    importRun,
    listRuns,
    getRunWithData,
    deleteRun,
    getCurrentRunId,
    getIsOnline,
  };
})();

export default DbManager;
