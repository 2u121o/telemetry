/**
 * API CLIENT MODULE
 * Communicates with the FastAPI backend for all CRUD operations.
 * All methods return Promises.
 */

const BASE = '/api';

async function request(method, path, body = null, isFormData = false) {
  const opts = { method, headers: {} };
  if (body && !isFormData) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body && isFormData) {
    opts.body = body; // FormData — browser sets Content-Type
  }
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail || JSON.stringify(err);
    } catch {}
    throw new Error(`API ${method} ${path}: ${res.status} ${detail}`);
  }
  return res.json();
}

const ApiClient = {

  // ===== BIKES =====
  listBikes:    ()           => request('GET', '/bikes'),
  getBike:      (id)         => request('GET', `/bikes/${id}`),
  createBike:   (data)       => request('POST', '/bikes', data),
  updateBike:   (id, data)   => request('PUT', `/bikes/${id}`, data),
  deleteBike:   (id)         => request('DELETE', `/bikes/${id}`),

  // ===== SETUPS =====
  listSetups:   (bikeId)     => request('GET', bikeId ? `/setups?bike_id=${bikeId}` : '/setups'),
  getSetup:     (id)         => request('GET', `/setups/${id}`),
  createSetup:  (data)       => request('POST', '/setups', data),
  updateSetup:  (id, data)   => request('PUT', `/setups/${id}`, data),
  deleteSetup:  (id)         => request('DELETE', `/setups/${id}`),

  // ===== RUNS =====
  listRuns:     ()           => request('GET', '/runs'),
  getRun:       (id)         => request('GET', `/runs/${id}`),
  createRun:    (csvText, runMeta = {}) => request('POST', '/runs', { csv_text: csvText, run: runMeta }),
  updateRun:    (id, data)   => request('PUT', `/runs/${id}`, data),
  deleteRun:    (id)         => request('DELETE', `/runs/${id}`),

  /**
   * Upload a CSV file via multipart form.
   * @param {File} file - The file to upload
   * @param {Object} opts - { bike_id, setup_id, name, sensor_settings }
   */
  uploadRunFile: (file, opts = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    if (opts.bike_id != null) fd.append('bike_id', String(opts.bike_id));
    if (opts.setup_id != null) fd.append('setup_id', String(opts.setup_id));
    if (opts.name) fd.append('name', opts.name);
    if (opts.sensor_settings) fd.append('sensor_settings', JSON.stringify(opts.sensor_settings));
    return request('POST', '/runs/upload', fd, true);
  },

  // ===== TELEMETRY DATA =====
  getRunData:   (runId, offset = 0, limit = 0) =>
    request('GET', `/runs/${runId}/data?offset=${offset}&limit=${limit}`),

  // ===== EXPORT / IMPORT =====
  exportRun:    (runId) => request('GET', `/runs/${runId}/export`),
  importRun:    (bundle) => request('POST', '/import', bundle),

  /**
   * Download a run export as a JSON file.
   * @param {number} runId
   * @param {string} fileName - optional file name
   */
  async downloadExport(runId, fileName) {
    const bundle = await this.exportRun(runId);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || `run-${runId}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
    return bundle;
  },

  /**
   * Import a run from a JSON file (user picks file).
   * Returns the created RunOut.
   */
  importFromFile() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return reject(new Error('No file selected'));
        try {
          const text = await file.text();
          const bundle = JSON.parse(text);
          const result = await this.importRun(bundle);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      input.click();
    });
  },

  // ===== SETTINGS =====
  getSettings:  ()           => request('GET', '/settings'),
  updateSettings: (settings) => request('PUT', '/settings', { settings }),

  // ===== HEALTH =====
  health:       ()           => request('GET', '/health'),
};

export default ApiClient;
