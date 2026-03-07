/**
 * FILTER PANEL MODULE
 * Dynamic filter creation and management.
 * Users can add multiple filters with different operators.
 */

import DataStore from './data-store.js';

const OPERATORS = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '==', label: '=' },
  { value: '!=', label: '≠' },
  { value: 'between', label: 'Tra (min-max)' },
  { value: 'not_between', label: 'Fuori da (min-max)' },
];

const FilterPanel = (() => {
  let filters = [];
  let nextId = 1;
  let containerEl = null;

  function init(container) {
    containerEl = container;
  }

  function getAvailableColumns() {
    return DataStore.getColumns();
  }

  function getColumnMeta() {
    return DataStore.getColumnMeta();
  }

  function createFilterCard(filter) {
    const cols = getAvailableColumns();
    const meta = getColumnMeta();

    const card = document.createElement('div');
    card.className = 'filter-card';
    card.dataset.filterId = filter.id;

    const colOptions = cols.map(c =>
      `<option value="${c}" ${c === filter.column ? 'selected' : ''}>${meta[c]?.label || c}</option>`
    ).join('');

    const opOptions = OPERATORS.map(o =>
      `<option value="${o.value}" ${o.value === filter.operator ? 'selected' : ''}>${o.label}</option>`
    ).join('');

    const isBetween = filter.operator === 'between' || filter.operator === 'not_between';
    const colMeta = meta[filter.column] || {};

    card.innerHTML = `
      <div class="filter-card-header">
        <span>Filtro #${filter.id}</span>
        <button class="btn btn-danger btn-sm btn-remove-filter" data-filter-id="${filter.id}">✕</button>
      </div>

      <div class="control-group">
        <label class="control-label">Colonna</label>
        <select class="select-input filter-col-select" data-filter-id="${filter.id}">
          ${colOptions}
        </select>
      </div>

      <div class="control-group">
        <label class="control-label">Operatore</label>
        <select class="select-input filter-op-select" data-filter-id="${filter.id}">
          ${opOptions}
        </select>
      </div>

      <div class="control-group filter-value-group">
        <label class="control-label">Valore</label>
        <input type="number" step="any" class="number-input filter-value-input" 
               data-filter-id="${filter.id}" 
               value="${filter.value ?? colMeta.min ?? 0}"
               placeholder="Valore" />
      </div>

      <div class="control-group filter-value2-group ${isBetween ? '' : 'hidden'}">
        <label class="control-label">Valore Max</label>
        <input type="number" step="any" class="number-input filter-value2-input" 
               data-filter-id="${filter.id}" 
               value="${filter.value2 ?? colMeta.max ?? 100}"
               placeholder="Valore max" />
      </div>

      <div class="range-group" style="margin-top: 4px;">
        <span class="range-values">
          <span>Min: ${colMeta.min?.toFixed(4) ?? '—'}</span>
          <span>Max: ${colMeta.max?.toFixed(4) ?? '—'}</span>
        </span>
      </div>
    `;

    // Event: operator change
    card.querySelector('.filter-op-select').addEventListener('change', (e) => {
      const op = e.target.value;
      const v2Group = card.querySelector('.filter-value2-group');
      if (op === 'between' || op === 'not_between') {
        v2Group.classList.remove('hidden');
      } else {
        v2Group.classList.add('hidden');
      }
    });

    // Event: column change → update range info
    card.querySelector('.filter-col-select').addEventListener('change', (e) => {
      const col = e.target.value;
      const m = getColumnMeta()[col] || {};
      const rangeEl = card.querySelector('.range-values');
      rangeEl.innerHTML = `
        <span>Min: ${m.min?.toFixed(4) ?? '—'}</span>
        <span>Max: ${m.max?.toFixed(4) ?? '—'}</span>
      `;
      // Update default values
      card.querySelector('.filter-value-input').value = m.min ?? 0;
      card.querySelector('.filter-value2-input').value = m.max ?? 100;
    });

    // Event: remove
    card.querySelector('.btn-remove-filter').addEventListener('click', () => {
      removeFilter(filter.id);
    });

    return card;
  }

  function addFilter() {
    const cols = getAvailableColumns();
    if (cols.length === 0) return;

    const meta = getColumnMeta();
    const col = cols[0];

    const filter = {
      id: nextId++,
      column: col,
      operator: '>=',
      value: meta[col]?.min ?? 0,
      value2: meta[col]?.max ?? 100,
    };

    filters.push(filter);
    const card = createFilterCard(filter);
    containerEl.appendChild(card);
  }

  function removeFilter(filterId) {
    filters = filters.filter(f => f.id !== filterId);
    const card = containerEl?.querySelector(`[data-filter-id="${filterId}"]`);
    if (card) card.remove();
  }

  function clearAllFilters() {
    filters = [];
    if (containerEl) containerEl.innerHTML = '';
    DataStore.setFilters([]);
  }

  function applyFilters() {
    // Read current values from DOM
    const activeFilters = [];

    containerEl?.querySelectorAll('.filter-card').forEach(card => {
      const id = parseInt(card.dataset.filterId);
      const column = card.querySelector('.filter-col-select').value;
      const operator = card.querySelector('.filter-op-select').value;
      const value = parseFloat(card.querySelector('.filter-value-input').value);
      const value2 = parseFloat(card.querySelector('.filter-value2-input').value);

      if (!isNaN(value)) {
        activeFilters.push({ id, column, operator, value, value2: isNaN(value2) ? value : value2 });
      }
    });

    DataStore.setFilters(activeFilters);

    const total = DataStore.getRowCount();
    const filtered = DataStore.getFilteredRowCount();
    showToast(`Filtri applicati: ${filtered}/${total} righe`, 'success');
  }

  return {
    init,
    addFilter,
    removeFilter,
    clearAllFilters,
    applyFilters,
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

export default FilterPanel;
