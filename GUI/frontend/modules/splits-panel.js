/**
 * SPLITS PANEL MODULE
 * Configure partenza (start), arrivo (end), and intermedi (intermediates).
 * 
 * How it works:
 *  - User sets start/end timestamps (in seconds)
 *  - User can add arbitrary number of intermediate splits
 *  - When splits are enabled, data is trimmed to start..end range
 *  - Vertical lines appear on all charts
 *  - Markers appear on the map
 *  - If no splits are set, all data is shown
 * 
 * Track Profiles:
 *  - Users can save split configurations as named profiles (e.g. "Crossbox")
 *  - Profiles can be loaded to quickly apply splits to a new run
 *  - Stored in localStorage (key: bike-telemetry-track-profiles)
 */

import DataStore from './data-store.js';

const LS_PROFILES_KEY = 'bike-telemetry-track-profiles';

const SplitsPanel = (() => {
  let containerEl = null;
  let nextIntId = 1;
  let trackProfiles = []; // [{id, name, splits: {start, end, intermediates}}]

  function init(container) {
    containerEl = container;
    loadProfiles();

    DataStore.on('data-loaded', () => {
      render();
    });

    // Re-render when splits change (e.g. from map placement or drag)
    DataStore.on('splits-changed', () => {
      render();
    });
  }

  // ---- Track Profiles persistence ----
  function loadProfiles() {
    try {
      const j = localStorage.getItem(LS_PROFILES_KEY);
      if (j) trackProfiles = JSON.parse(j);
    } catch (e) { trackProfiles = []; }
  }

  function saveProfiles() {
    try { localStorage.setItem(LS_PROFILES_KEY, JSON.stringify(trackProfiles)); } catch (e) {}
  }

  function getTrackProfiles() { return [...trackProfiles]; }

  function addTrackProfile(name, splits) {
    const profile = {
      id: Date.now(),
      name,
      splits: { ...splits },
      createdAt: new Date().toISOString(),
    };
    trackProfiles.push(profile);
    saveProfiles();
    return profile;
  }

  function updateTrackProfile(id, splits) {
    const p = trackProfiles.find(p => p.id === id);
    if (p) {
      p.splits = { ...splits };
      p.updatedAt = new Date().toISOString();
      saveProfiles();
    }
  }

  function deleteTrackProfile(id) {
    trackProfiles = trackProfiles.filter(p => p.id !== id);
    saveProfiles();
  }

  function applyTrackProfile(id) {
    const p = trackProfiles.find(p => p.id === id);
    if (p && p.splits) {
      DataStore.setSplits(p.splits);
      showToast(`Profilo "${p.name}" applicato`, 'success');
    }
  }

  // ---- Prompt on new run load ----
  function promptSplitsReuse() {
    const splits = DataStore.getSplits();
    const hasSplits = splits.start !== null || splits.end !== null ||
                      (splits.intermediates && splits.intermediates.length > 0);

    if (!hasSplits) return; // No existing splits, nothing to prompt

    // Build a modal-like prompt
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-content" style="max-width: 480px;">
          <div class="modal-header">
            <h3>✂️ Splits esistenti</h3>
          </div>
          <div class="modal-body" style="padding: 20px;">
            <p style="color: var(--text-secondary); margin-bottom: 16px; line-height: 1.5;">
              Hai degli splits configurati dalla run precedente. Cosa vuoi fare?
            </p>
            <div style="background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; margin-bottom: 16px; font-size: 0.82rem;">
              ${splits.start !== null ? `<div style="color: #3fb950;">🟢 Partenza: ${splits.start.toFixed(3)}s</div>` : ''}
              ${splits.end !== null ? `<div style="color: #f85149;">🔴 Arrivo: ${splits.end.toFixed(3)}s</div>` : ''}
              ${splits.intermediates?.length > 0 ? `<div style="color: #d29922;">🟡 ${splits.intermediates.length} intermedi</div>` : ''}
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button class="btn btn-primary btn-block splits-prompt-btn" data-action="reuse">
                ♻️ Riusa splits correnti
              </button>
              <button class="btn btn-outline btn-block splits-prompt-btn" data-action="reset">
                🗑️ Azzera tutti gli splits
              </button>
              ${trackProfiles.length > 0 ? `
                <div style="border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px;">
                  <label class="control-label" style="margin-bottom: 6px;">📋 Carica profilo tracciato:</label>
                  ${trackProfiles.map(p => `
                    <button class="btn btn-ghost btn-block btn-sm splits-prompt-btn" data-action="profile" data-profile-id="${p.id}" style="justify-content: flex-start; text-align: left;">
                      📌 ${escHtml(p.name)}
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.querySelectorAll('.splits-prompt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          overlay.remove();
          if (action === 'reuse') {
            // Keep current splits — do nothing
            resolve('reuse');
          } else if (action === 'reset') {
            DataStore.setSplits({ start: null, end: null, intermediates: [] });
            resolve('reset');
          } else if (action === 'profile') {
            const profileId = parseInt(btn.dataset.profileId);
            applyTrackProfile(profileId);
            resolve('profile');
          }
        });
      });

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve('reuse'); // Default: keep current
        }
      });
    });
  }

  function render() {
    if (!containerEl) return;

    const range = DataStore.getTimeRange();
    const splits = DataStore.getSplits();

    containerEl.innerHTML = `
      <div class="splits-info" style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted);">
          <span>Dati: ${range.min.toFixed(3)}s</span>
          <span>→ ${range.max.toFixed(3)}s</span>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
          Durata totale dati: ${(range.max - range.min).toFixed(2)}s
        </div>
      </div>

      <div style="margin-bottom: 10px; padding: 6px 8px; background: rgba(88,166,255,0.08); border: 1px solid rgba(88,166,255,0.15); border-radius: var(--radius-sm); font-size: 0.75rem; color: var(--text-muted);">
        ℹ Imposta partenza e arrivo: i grafici mostreranno solo i dati in quel range, con il tempo che parte da 0s alla partenza.
      </div>

      <div class="control-group" style="margin-bottom: 10px;">
        <label class="control-label" style="color: #3fb950;">🟢 Partenza (s) — tempo assoluto</label>
        <div style="display: flex; gap: 4px;">
          <input type="number" step="0.001" class="number-input" id="splitStart"
                 value="${splits.start !== null ? splits.start : ''}"
                 placeholder="${range.min.toFixed(3)}" min="${range.min}" max="${range.max}" />
          <button class="btn btn-ghost btn-sm" id="btnClearStart" title="Rimuovi">✕</button>
        </div>
      </div>

      <div class="control-group" style="margin-bottom: 10px;">
        <label class="control-label" style="color: #f85149;">🔴 Arrivo (s) — tempo assoluto</label>
        <div style="display: flex; gap: 4px;">
          <input type="number" step="0.001" class="number-input" id="splitEnd"
                 value="${splits.end !== null ? splits.end : ''}"
                 placeholder="${range.max.toFixed(3)}" min="${range.min}" max="${range.max}" />
          <button class="btn btn-ghost btn-sm" id="btnClearEnd" title="Rimuovi">✕</button>
        </div>
      </div>

      <div style="border-top: 1px solid var(--border); padding-top: 10px; margin-top: 6px;">
        <label class="control-label" style="color: #d29922;">🟡 Intermedi</label>
        <div id="intermediatesContainer"></div>
        <button class="btn btn-outline btn-sm btn-block" id="btnAddIntermediate" style="margin-top: 8px;">
          + Aggiungi Intermedio
        </button>
      </div>

      <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 6px;">
        <button class="btn btn-primary btn-block" id="btnApplySplits">Applica Splits</button>
        <button class="btn btn-ghost btn-block btn-sm" id="btnClearAllSplits">Rimuovi Tutti</button>
      </div>

      <div id="splitsSummary" style="margin-top: 12px;"></div>

      <!-- Track Profiles Section -->
      <div style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 16px;">
        <label class="control-label" style="margin-bottom: 8px; display: block;">📋 Profili Tracciato</label>
        <p style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 8px; line-height: 1.4;">
          Salva la configurazione splits corrente come profilo per riutilizzarla su altre run.
        </p>
        <button class="btn btn-outline btn-sm btn-block" id="btnSaveTrackProfile" style="margin-bottom: 8px;">
          💾 Salva Profilo Tracciato
        </button>
        <div id="trackProfilesList">${renderTrackProfilesList()}</div>
      </div>
    `;

    // Render existing intermediates
    const intContainer = containerEl.querySelector('#intermediatesContainer');
    if (splits.intermediates && splits.intermediates.length > 0) {
      splits.intermediates.forEach((t, i) => {
        addIntermediateRow(intContainer, t, i);
      });
    }

    // ---- Event Listeners ----
    containerEl.querySelector('#btnAddIntermediate').addEventListener('click', () => {
      addIntermediateRow(intContainer, null);
    });

    containerEl.querySelector('#btnApplySplits').addEventListener('click', () => {
      applySplitsFromUI();
    });

    containerEl.querySelector('#btnClearAllSplits').addEventListener('click', () => {
      DataStore.setSplits({ start: null, end: null, intermediates: [] });
      // render() is called automatically via splits-changed event
      showToast('Splits rimossi — tutti i dati visibili', 'info');
    });

    containerEl.querySelector('#btnClearStart').addEventListener('click', () => {
      containerEl.querySelector('#splitStart').value = '';
    });

    containerEl.querySelector('#btnClearEnd').addEventListener('click', () => {
      containerEl.querySelector('#splitEnd').value = '';
    });

    // Track Profile events
    containerEl.querySelector('#btnSaveTrackProfile')?.addEventListener('click', () => {
      const splits = DataStore.getSplits();
      const hasSplits = splits.start !== null || splits.end !== null ||
                        (splits.intermediates && splits.intermediates.length > 0);
      if (!hasSplits) {
        showToast('Configura prima degli splits da salvare', 'error');
        return;
      }
      const name = prompt('Nome del profilo tracciato:', `Tracciato ${new Date().toLocaleDateString('it-IT')}`);
      if (name !== null && name.trim()) {
        addTrackProfile(name.trim(), splits);
        showToast(`Profilo "${name.trim()}" salvato!`, 'success');
        render();
      }
    });

    bindProfileEvents();
    updateSummary();
  }

  function renderTrackProfilesList() {
    if (trackProfiles.length === 0) {
      return '<p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">Nessun profilo salvato</p>';
    }

    return trackProfiles.map(p => {
      const info = [];
      if (p.splits?.start !== null && p.splits?.start !== undefined) info.push('🟢 Partenza');
      if (p.splits?.end !== null && p.splits?.end !== undefined) info.push('🔴 Arrivo');
      if (p.splits?.intermediates?.length > 0) info.push(`🟡 ${p.splits.intermediates.length} intermedi`);

      return `
        <div class="track-profile-item" data-profile-id="${p.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 4px;">
          <div style="min-width: 0; flex: 1;">
            <div style="font-size: 0.82rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escHtml(p.name)}</div>
            <div style="font-size: 0.68rem; color: var(--text-muted);">${info.join(' · ')}</div>
          </div>
          <div style="display: flex; gap: 2px; flex-shrink: 0;">
            <button class="btn btn-ghost btn-sm btn-apply-profile" data-id="${p.id}" title="Applica">📌</button>
            <button class="btn btn-ghost btn-sm btn-update-profile" data-id="${p.id}" title="Aggiorna con splits correnti">🔄</button>
            <button class="btn btn-danger btn-sm btn-delete-profile" data-id="${p.id}" title="Elimina">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function bindProfileEvents() {
    containerEl?.querySelectorAll('.btn-apply-profile').forEach(btn => {
      btn.addEventListener('click', () => {
        applyTrackProfile(parseInt(btn.dataset.id));
      });
    });
    containerEl?.querySelectorAll('.btn-update-profile').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const splits = DataStore.getSplits();
        updateTrackProfile(id, splits);
        showToast('Profilo aggiornato', 'success');
        render();
      });
    });
    containerEl?.querySelectorAll('.btn-delete-profile').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        if (confirm('Eliminare questo profilo?')) {
          deleteTrackProfile(id);
          showToast('Profilo eliminato', 'info');
          render();
        }
      });
    });
  }

  function addIntermediateRow(container, value, index) {
    const id = nextIntId++;
    const row = document.createElement('div');
    row.className = 'intermediate-row';
    row.style.cssText = 'display: flex; gap: 4px; margin-top: 4px; align-items: center;';
    row.dataset.intId = id;

    row.innerHTML = `
      <span style="font-size: 0.75rem; color: var(--text-muted); min-width: 18px;">#${index !== undefined ? index + 1 : container.children.length + 1}</span>
      <input type="number" step="0.001" class="number-input int-time-input"
             value="${value !== null && value !== undefined ? value : ''}"
             placeholder="tempo (s)" />
      <button class="btn btn-danger btn-sm btn-remove-int" title="Rimuovi">✕</button>
    `;

    row.querySelector('.btn-remove-int').addEventListener('click', () => {
      row.remove();
    });

    container.appendChild(row);
  }

  function applySplitsFromUI() {
    const startVal = containerEl.querySelector('#splitStart').value.trim();
    const endVal = containerEl.querySelector('#splitEnd').value.trim();
    const intInputs = containerEl.querySelectorAll('.int-time-input');

    const start = startVal !== '' ? parseFloat(startVal) : null;
    const end = endVal !== '' ? parseFloat(endVal) : null;
    const intermediates = [];

    intInputs.forEach(input => {
      const v = input.value.trim();
      if (v !== '') {
        const num = parseFloat(v);
        if (!isNaN(num)) intermediates.push(num);
      }
    });

    // Validate
    if (start !== null && end !== null && start >= end) {
      showToast('La partenza deve essere prima dell\'arrivo!', 'error');
      return;
    }

    DataStore.setSplits({ start, end, intermediates });
    showToast('Splits aggiornati', 'success');
    updateSummary();
  }

  function updateSummary() {
    const summaryEl = containerEl?.querySelector('#splitsSummary');
    if (!summaryEl) return;

    const splits = DataStore.getSplits();
    const allSplits = DataStore.getAllSplitTimestamps();

    if (allSplits.length === 0) {
      summaryEl.innerHTML = '<div style="font-size: 0.78rem; color: var(--text-muted);">Nessun split configurato. Tutti i dati sono visualizzati.</div>';
      return;
    }

    let html = '<div style="font-size: 0.78rem;">';
    html += `<div style="color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">Riepilogo splits (tempo relativo):</div>`;

    // Show relative times: partenza = 0s, everything else relative to partenza
    for (let i = 0; i < allSplits.length; i++) {
      const s = allSplits[i];
      const color = s.type === 'start' ? '#3fb950' : s.type === 'end' ? '#f85149' : '#d29922';
      const relTimeStr = s.relTime.toFixed(3);

      html += `<div style="display: flex; justify-content: space-between; padding: 2px 0;">
        <span style="color: ${color};">${s.label}</span>
        <span style="color: var(--text); font-variant-numeric: tabular-nums;">${relTimeStr}s</span>
      </div>`;

      if (i < allSplits.length - 1) {
        const dt = allSplits[i + 1].relTime - s.relTime;
        html += `<div style="text-align: center; color: var(--text-muted); font-size: 0.72rem; padding: 1px 0;">↓ ${dt.toFixed(3)}s</div>`;
      }
    }

    // Show total time from start to end
    const startSplit = allSplits.find(s => s.type === 'start');
    const endSplit = allSplits.find(s => s.type === 'end');
    if (startSplit && endSplit) {
      const totalTime = endSplit.relTime - startSplit.relTime;
      html += `<div style="margin-top: 8px; padding: 6px 8px; background: rgba(88,166,255,0.1); border: 1px solid rgba(88,166,255,0.2); border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: var(--accent); font-weight: 600;">⏱ Tempo totale</span>
          <span style="color: var(--text); font-weight: 700; font-size: 1rem; font-variant-numeric: tabular-nums;">${totalTime.toFixed(3)}s</span>
        </div>
      </div>`;
    }

    html += '</div>';
    summaryEl.innerHTML = html;
  }

  return {
    init,
    render,
    promptSplitsReuse,
    getTrackProfiles,
    addTrackProfile,
    updateTrackProfile,
    deleteTrackProfile,
    applyTrackProfile,
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

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

export default SplitsPanel;
