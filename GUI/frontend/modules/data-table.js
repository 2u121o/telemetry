/**
 * DATA TABLE MODULE
 * Paginated, sortable data table view.
 */

import DataStore from './data-store.js';

const DataTable = (() => {
  let tableHeadEl = null;
  let tableBodyEl = null;
  let tableCountEl = null;
  let paginationEl = null;
  let tableAreaEl = null;
  let pageSizeSelect = null;
  let exportBtn = null;

  let currentPage = 0;
  let pageSize = 100;
  let sortColumn = null;
  let sortDirection = 'asc';
  let isVisible = false;

  function init(tableHead, tableBody, tableCount, pagination, tableArea, pageSizeSel, exportCSVBtn) {
    tableHeadEl = tableHead;
    tableBodyEl = tableBody;
    tableCountEl = tableCount;
    paginationEl = pagination;
    tableAreaEl = tableArea;
    pageSizeSelect = pageSizeSel;
    exportBtn = exportCSVBtn;

    DataStore.on('data-filtered', () => {
      if (isVisible) render();
    });

    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        pageSize = e.target.value === 'all' ? Infinity : parseInt(e.target.value);
        currentPage = 0;
        if (isVisible) render();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', exportCSV);
    }
  }

  function show() {
    if (!tableAreaEl) return;
    tableAreaEl.classList.remove('hidden');
    isVisible = true;
    render();
  }

  function hide() {
    if (!tableAreaEl) return;
    tableAreaEl.classList.add('hidden');
    isVisible = false;
  }

  function toggle() {
    if (isVisible) hide(); else show();
  }

  function render() {
    if (!tableHeadEl || !tableBodyEl) return;

    const cols = DataStore.getColumns();
    const meta = DataStore.getColumnMeta();
    let data = [...DataStore.getFilteredData()];

    if (data.length === 0) {
      tableHeadEl.innerHTML = '';
      tableBodyEl.innerHTML = '<tr><td colspan="100" style="text-align:center; padding: 20px; color: var(--text-muted);">Nessun dato</td></tr>';
      if (tableCountEl) tableCountEl.textContent = '0';
      return;
    }

    // Sort
    if (sortColumn && cols.includes(sortColumn)) {
      data.sort((a, b) => {
        const va = a[sortColumn] ?? 0;
        const vb = b[sortColumn] ?? 0;
        return sortDirection === 'asc' ? va - vb : vb - va;
      });
    }

    // Header
    tableHeadEl.innerHTML = '<tr>' + cols.map(c => {
      let cls = '';
      if (c === sortColumn) cls = sortDirection === 'asc' ? 'sort-asc' : 'sort-desc';
      return `<th class="${cls}" data-col="${c}">${meta[c]?.label || c}${meta[c]?.unit ? ` (${meta[c].unit})` : ''}</th>`;
    }).join('') + '</tr>';

    // Click to sort
    tableHeadEl.querySelectorAll('th').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (sortColumn === col) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = col;
          sortDirection = 'asc';
        }
        render();
      });
    });

    // Pagination
    const totalRows = data.length;
    const totalPages = pageSize === Infinity ? 1 : Math.ceil(totalRows / pageSize);
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    if (currentPage < 0) currentPage = 0;

    const start = pageSize === Infinity ? 0 : currentPage * pageSize;
    const end = pageSize === Infinity ? totalRows : Math.min(start + pageSize, totalRows);
    const pageData = data.slice(start, end);

    // Body
    tableBodyEl.innerHTML = pageData.map(row =>
      '<tr>' + cols.map(c => `<td>${formatCell(row[c])}</td>`).join('') + '</tr>'
    ).join('');

    // Count
    if (tableCountEl) tableCountEl.textContent = totalRows.toLocaleString();

    // Pagination controls
    if (paginationEl && totalPages > 1) {
      paginationEl.innerHTML = `
        <button class="btn btn-ghost btn-sm" id="btnPrevPage" ${currentPage === 0 ? 'disabled' : ''}>◀</button>
        <span>${currentPage + 1} / ${totalPages}</span>
        <button class="btn btn-ghost btn-sm" id="btnNextPage" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>▶</button>
      `;
      paginationEl.querySelector('#btnPrevPage')?.addEventListener('click', () => { currentPage--; render(); });
      paginationEl.querySelector('#btnNextPage')?.addEventListener('click', () => { currentPage++; render(); });
    } else if (paginationEl) {
      paginationEl.innerHTML = '';
    }
  }

  function formatCell(v) {
    if (v === null || v === undefined) return '<span style="color:var(--text-muted)">—</span>';
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return v.toString();
      return v.toFixed(6);
    }
    return v;
  }

  function exportCSV() {
    const cols = DataStore.getColumns();
    const data = DataStore.getFilteredData();
    const meta = DataStore.getColumnMeta();

    let csv = cols.map(c => meta[c]?.label || c).join(',') + '\n';
    for (const row of data) {
      csv += cols.map(c => row[c] ?? '').join(',') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { init, show, hide, toggle, render };
})();

export default DataTable;
