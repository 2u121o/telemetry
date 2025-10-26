// Funzioni di utilità per il DOM
export function $(selector, root = document) {
  if (!root || !root.querySelector) {
    console.error('Invalid root element:', root);
    return null;
  }
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  if (!root || !root.querySelectorAll) {
    console.error('Invalid root element:', root);
    return [];
  }
  return Array.from(root.querySelectorAll(selector));
}

export function setRows(tbody, rows) {
  if (!tbody) {
    console.error('Invalid tbody element');
    return;
  }
  tbody.innerHTML = rows.join('');
}
