// js/app.js
// Pages, tables, pop-up forms (edit / delete), and the add forms.

const pageTitleEl = document.getElementById('page-title');
const pageSubEl = document.getElementById('page-sub');
const pageContentEl = document.getElementById('page-content');
const alertBox = document.getElementById('alert-box');

let currentPage = 'inventory';
let inventoryCache = [];
let historyCache = [];
let supplierCache = [];
let alertTimer;
let inventorySort = { key: 'productName', dir: 1 };
let priceCache = [];

const PAGES = {
  inventory: ['Inventory', renderInventory, 'Everything in stock, at a glance'],
  prices: ['Price List', renderPriceList, 'What each product sells for'],
  detailed: ['Detailed Inventory', renderDetailedInventory, 'Selling price next to your latest cost'],
  history: ['Purchase History', renderPurchaseHistory, 'Everything you’ve bought from suppliers'],
  'add-purchase': ['Add Purchase', renderAddPurchase, 'Record new stock coming in'],
  'add-product': ['Add Product', renderAddProduct, 'Create a new product to sell'],
  suppliers: ['Suppliers', renderSuppliers, 'The people you buy from']
};

// ---------------- Navigation ----------------
document.querySelectorAll('.nav-link').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadPage(btn.dataset.page);
  });
});

function loadPage(page) {
  currentPage = page;
  pageTitleEl.textContent = PAGES[page][0];
  pageSubEl.textContent = PAGES[page][2] || '';
  hideAlert();
  PAGES[page][1]();
}

// ---------------- Helpers ----------------
const esc = (s) => {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
};
const attr = (s) => esc(s).replace(/"/g, '&quot;');

function money(v) {
  const n = Number(v);
  return isNaN(n) ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function showLoading() {
  pageContentEl.innerHTML = '<div class="card"><div class="loading-state">Loading…</div></div>';
}

function showError(msg) {
  pageContentEl.innerHTML = `<div class="card"><div class="empty-state">${esc(msg)}</div></div>`;
}

function showAlert(message, type = 'success') {
  clearTimeout(alertTimer);
  alertBox.textContent = message;
  alertBox.className = `alert-box ${type}`;
  alertTimer = setTimeout(hideAlert, 5000);
}

function hideAlert() {
  alertBox.className = 'alert-box hidden';
}

const card = (inner) => `<div class="card">${inner}</div>`;

// cols: strings; start with ">" for a right-aligned column
function table(cols, rows, empty, bodyId = '') {
  const head = cols.map(c => c.startsWith('>') ? `<th class="right">${c.slice(1)}</th>` : `<th>${c}</th>`).join('');
  const body = rows || `<tr><td colspan="${cols.length}" class="empty-state">${empty}</td></tr>`;
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody${bodyId ? ` id="${bodyId}"` : ''}>${body}</tbody></table></div>`;
}

const field = (label, id, value = '', type = 'text', extra = '') =>
  `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${attr(value)}" ${extra}></div>`;

const actions = (kind, id) =>
  `<td class="actions"><button class="btn-link" data-act="edit" data-kind="${kind}" data-id="${id}">Edit</button>` +
  `<button class="btn-link danger" data-act="delete" data-kind="${kind}" data-id="${id}">Delete</button></td>`;

// ---------------- Pop-up (modal) ----------------
function openModal({ title, body, saveLabel = 'Save', danger = false, onSave, success }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>${esc(title)}</h3>
      <div>${body}</div>
      <div class="modal-error hidden"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-close type="button">Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-save type="button">${saveLabel}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') overlay.querySelector('[data-save]').click();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.hasAttribute('data-close')) close();
  });
  overlay.querySelector('[data-save]').addEventListener('click', async () => {
    const errBox = overlay.querySelector('.modal-error');
    errBox.classList.add('hidden');
    try {
      await onSave(overlay);
      close();
      loadPage(currentPage);
      if (success) showAlert(success);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    }
  });
  const first = overlay.querySelector('input, select');
  (first || overlay.querySelector('[data-close]')).focus();
}

function confirmDelete(title, text, action, success) {
  openModal({
    title,
    body: `<p class="modal-text">${esc(text)}</p>`,
    saveLabel: 'Delete',
    danger: true,
    onSave: action,
    success
  });
}

// One click listener handles every Edit / Delete button on every page
pageContentEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const { act, kind, id } = b.dataset;
  const handlers = { product: productAction, supplier: supplierAction, purchase: purchaseAction };
  handlers[kind](act, Number(id));
});

// ---------------- Product edit / delete ----------------
async function productAction(act, id) {
  let p;
  try {
    p = (await api.getInventory()).find(x => x.productID === id);
  } catch (err) {
    return showAlert(err.message, 'error');
  }
  if (!p) return showAlert('That product no longer exists.', 'error');

  if (act === 'delete') {
    return confirmDelete(
      `Delete "${p.productName}"?`,
      "This can't be undone. A product that already has purchase history can't be deleted.",
      () => api.deleteProduct(id),
      `"${p.productName}" deleted.`
    );
  }

  openModal({
    title: 'Edit Product',
    body:
      field('Product Name', 'm-name', p.productName) +
      field('Quantity in stock', 'm-qty', p.quantity, 'number', 'min="0"') +
      field('Selling Price', 'm-price', p.sellingPrice, 'number', 'min="0" step="0.01"') +
      field('Restock At', 'm-restock', p.reStockAt, 'number', 'min="0"'),
    onSave: async (m) => {
      const v = (i) => m.querySelector('#' + i).value.trim();
      const price = Number(v('m-price'));
      if (!v('m-name') || v('m-price') === '' || isNaN(price)) throw new Error('Name and selling price are required.');
      await api.updateProduct(id, {
        productName: v('m-name'),
        quantity: Number(v('m-qty')) || 0,
        sellingPrice: price,
        reStockAt: Number(v('m-restock')) || 0
      });
    },
    success: 'Product updated.'
  });
}

// ---------------- Supplier edit / delete ----------------
function supplierAction(act, id) {
  const s = supplierCache.find(x => x.supplierID === id);
  if (!s) return;

  if (act === 'delete') {
    return confirmDelete(
      `Delete "${s.supplierName}"?`,
      'Their past purchases stay in your history, but will show no supplier.',
      () => api.deleteSupplier(id),
      `"${s.supplierName}" deleted.`
    );
  }

  openModal({
    title: 'Edit Supplier',
    body: field('Supplier Name', 'm-sname', s.supplierName) + field('Phone Number (optional)', 'm-sphone', s.supplierPhone || ''),
    onSave: async (m) => {
      const name = m.querySelector('#m-sname').value.trim();
      if (!name) throw new Error('Supplier name is required.');
      await api.updateSupplier(id, { supplierName: name, supplierPhone: m.querySelector('#m-sphone').value.trim() });
    },
    success: 'Supplier updated.'
  });
}

// ---------------- Purchase edit / delete ----------------
async function purchaseAction(act, id) {
  const r = historyCache.find(x => x.purchaseID === id);
  if (!r) return;

  if (act === 'delete') {
    return confirmDelete(
      `Delete purchase #${id}?`,
      "All items in this purchase are removed, and the stock they added is taken back off your inventory. This can't be undone.",
      () => api.deletePurchase(id),
      `Purchase #${id} deleted.`
    );
  }

  let suppliers;
  try {
    suppliers = await api.getSuppliers();
  } catch (err) {
    return showAlert(err.message, 'error');
  }
  const opts = '<option value="">No supplier</option>' +
    suppliers.map(s => `<option value="${s.supplierID}"${s.supplierID === r.supplierID ? ' selected' : ''}>${esc(s.supplierName)}</option>`).join('');

  openModal({
    title: `Edit Purchase #${id}`,
    body: `<div class="field"><label for="m-supplier">Supplier (optional)</label><select id="m-supplier">${opts}</select></div>` +
          field('Purchase Date', 'm-date', r.purchaseDate, 'date'),
    onSave: async (m) => {
      const date = m.querySelector('#m-date').value;
      if (!date) throw new Error('Please pick a date.');
      const sup = m.querySelector('#m-supplier').value;
      await api.updatePurchase(id, { supplierID: sup ? Number(sup) : null, purchaseDate: date });
    },
    success: 'Purchase updated.'
  });
}

// ---------------- Page: Inventory ----------------
const statusBadge = (p) => p.quantity <= p.reStockAt
  ? '<span class="badge badge-restock">RESTOCK</span>'
  : '<span class="badge badge-ok">OK</span>';

const inventoryRows = (list) => list.map(p => `
  <tr>
    <td>${esc(p.productName)}</td>
    <td class="right">${p.quantity}</td>
    <td class="right">${money(p.sellingPrice)}</td>
    <td class="right">${p.reStockAt}</td>
    <td>${statusBadge(p)}</td>
    ${actions('product', p.productID)}
  </tr>`).join('');

async function renderInventory() {
  showLoading();
  try {
    inventoryCache = await api.getInventory();
  } catch (err) {
    return showError("Couldn't load inventory. Is the backend running?");
  }
  const lowCount = inventoryCache.filter(p => p.quantity <= p.reStockAt).length;
  const stockValue = inventoryCache.reduce((sum, p) => sum + p.quantity * Number(p.sellingPrice), 0);
  const stat = (label, value, cls = '') =>
    `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value ${cls}">${value}</div></div>`;
  const statsHtml = '<div class="stats">' +
    stat('Products', inventoryCache.length) +
    stat('Needs restock', lowCount, lowCount ? 'warn' : '') +
    stat('Stock value (at selling price)', money(stockValue)) + '</div>';
  pageContentEl.innerHTML = statsHtml + card(
    '<div class="toolbar"><input type="text" id="inventory-search" class="search-input" placeholder="Search by product name…"><div class="tools"><button class="btn btn-secondary" data-tool="csv-inventory" type="button">Export CSV</button><button class="btn btn-secondary" data-tool="print" type="button">Print</button></div></div>' +
    table(['Product Name', '>Quantity', '>Selling Price', '>Restock At', 'Status', '>'],
      inventoryRows(inventoryCache), 'No products yet. Use "Add Product" to create your first one.', 'inventory-body')
  );
  const sortKeys = ['productName', 'quantity', 'sellingPrice', 'reStockAt', 'status'];
  const ths = [...document.querySelectorAll('#page-content thead th')];
  const refresh = () => {
    const term = document.getElementById('inventory-search').value.trim().toLowerCase();
    document.getElementById('inventory-body').innerHTML =
      inventoryRows(sortedInventory(term)) || '<tr><td colspan="6" class="empty-state">No matching products.</td></tr>';
    ths.forEach((th, i) => {
      th.classList.toggle('asc', sortKeys[i] === inventorySort.key && inventorySort.dir === 1);
      th.classList.toggle('desc', sortKeys[i] === inventorySort.key && inventorySort.dir === -1);
    });
  };
  ths.forEach((th, i) => {
    if (!sortKeys[i]) return;
    th.classList.add('sortable');
    th.addEventListener('click', () => {
      inventorySort = { key: sortKeys[i], dir: inventorySort.key === sortKeys[i] ? -inventorySort.dir : 1 };
      refresh();
    });
  });
  document.getElementById('inventory-search').addEventListener('input', refresh);
  refresh();
}

// ---------------- Page: Price List ----------------
async function renderPriceList() {
  showLoading();
  try {
    const rows = (priceCache = await api.getPriceList());
    pageContentEl.innerHTML = card('<div class="toolbar toolbar-tools"><div class="tools"><button class="btn btn-secondary" data-tool="csv-prices" type="button">Export CSV</button><button class="btn btn-secondary" data-tool="print" type="button">Print</button></div></div>' + table(['Product Name', '>Selling Price', '>'],
      rows.map(p => `<tr><td>${esc(p.productName)}</td><td class="right">${money(p.sellingPrice)}</td>${actions('product', p.productID)}</tr>`).join(''),
      'No products yet.'));
  } catch (err) {
    showError("Couldn't load the price list.");
  }
}

// ---------------- Page: Detailed Inventory ----------------
async function renderDetailedInventory() {
  showLoading();
  try {
    const rows = await api.getDetailedInventory();
    pageContentEl.innerHTML = card(table(['Product Name', '>Selling Price', '>Latest Cost Price', '>Quantity', '>'],
      rows.map(p => `
        <tr>
          <td>${esc(p.productName)}</td>
          <td class="right">${money(p.sellingPrice)}</td>
          <td class="right">${p.latestCost != null ? money(p.latestCost) : '—'}</td>
          <td class="right">${p.quantity}</td>
          ${actions('product', p.productID)}
        </tr>`).join(''),
      'No products yet.'));
  } catch (err) {
    showError("Couldn't load detailed inventory.");
  }
}

// ---------------- Page: Purchase History ----------------
async function renderPurchaseHistory() {
  showLoading();
  try {
    historyCache = await api.getPurchaseHistory();
    pageContentEl.innerHTML = card(
      table(['Purchase', 'Date', 'Supplier', 'Product', '>Quantity', '>Cost Per Product', '>Total', '>'],
        historyCache.map(r => `
          <tr>
            <td>#${r.purchaseID}</td>
            <td>${formatDate(r.purchaseDate)}</td>
            <td>${esc(r.supplierName || '—')}</td>
            <td>${esc(r.productName)}</td>
            <td class="right">${r.quantity}</td>
            <td class="right">${money(r.costPerProduct)}</td>
            <td class="right">${money(r.totalCost)}</td>
            ${actions('purchase', r.purchaseID)}
          </tr>`).join(''),
        'No purchases recorded yet.') +
      '<p class="hint">Edit changes a purchase\'s date and supplier. Delete removes the whole purchase and takes its stock back off your inventory.</p>'
    );
  } catch (err) {
    showError("Couldn't load purchase history.");
  }
}

// ---------------- Page: Add Purchase ----------------
let itemRowCount = 0;
let productOptionsHtml = '';

async function renderAddPurchase() {
  showLoading();
  try {
    const [suppliers, products] = await Promise.all([api.getSuppliers(), api.getInventory()]);
    if (products.length === 0) {
      return showError('You need at least one product before adding a purchase. Use "Add Product" first.');
    }
    productOptionsHtml = products.map(p => `<option value="${p.productID}">${esc(p.productName)}</option>`).join('');
    const supplierOptions = suppliers.map(s => `<option value="${s.supplierID}">${esc(s.supplierName)}</option>`).join('');

    pageContentEl.innerHTML = card(`
      <div class="form-row">
        <div>
          <label for="purchase-supplier">Supplier (optional)</label>
          <select id="purchase-supplier"><option value="">No supplier</option>${supplierOptions}</select>
        </div>
        ${field('Purchase Date', 'purchase-date', new Date().toISOString().slice(0, 10), 'date')}
      </div>
      <label>Items Purchased</label>
      <div id="item-rows"></div>
      <button class="btn btn-secondary" id="add-item-row" type="button">+ Add Product</button>
      <div class="total-line"><span>Total:</span><span id="purchase-total">0.00</span></div>
      <button class="btn btn-primary" id="save-purchase" type="button">Save Purchase</button>`);

    itemRowCount = 0;
    addItemRow();
    document.getElementById('add-item-row').addEventListener('click', addItemRow);
    document.getElementById('save-purchase').addEventListener('click', savePurchase);
  } catch (err) {
    showError("Couldn't load the form. Is the backend running?");
  }
}

function addItemRow() {
  itemRowCount++;
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <div><label>Product</label><select class="item-product">${productOptionsHtml}</select></div>
    <div><label>Quantity</label><input type="number" class="item-quantity" min="1" value="1"></div>
    <div><label>Cost Per Product</label><input type="number" class="item-cost" min="0" step="0.01" value="0"></div>
    <div><button class="btn btn-remove" type="button">Remove</button></div>`;
  document.getElementById('item-rows').appendChild(row);
  row.querySelectorAll('.item-quantity, .item-cost').forEach(i => i.addEventListener('input', updateTotal));
  row.querySelector('.btn-remove').addEventListener('click', () => { row.remove(); updateTotal(); });
  updateTotal();
}

function updateTotal() {
  let total = 0;
  document.querySelectorAll('.item-row').forEach(row => {
    total += (Number(row.querySelector('.item-quantity').value) || 0) * (Number(row.querySelector('.item-cost').value) || 0);
  });
  document.getElementById('purchase-total').textContent = money(total);
}

async function savePurchase() {
  const supplierID = document.getElementById('purchase-supplier').value;
  const purchaseDate = document.getElementById('purchase-date').value;
  if (!purchaseDate) return showAlert('Please pick a date.', 'error');

  const items = [...document.querySelectorAll('.item-row')].map(row => ({
    productID: Number(row.querySelector('.item-product').value),
    quantity: Number(row.querySelector('.item-quantity').value),
    costPerProduct: Number(row.querySelector('.item-cost').value)
  }));
  if (items.length === 0 || items.some(i => !i.productID || i.quantity <= 0)) {
    return showAlert('Every item needs a product and a quantity greater than 0.', 'error');
  }

  try {
    await api.addPurchase({ supplierID: supplierID ? Number(supplierID) : null, purchaseDate, items });
    renderAddPurchase();
    showAlert('Purchase saved. Stock quantities have been updated.');
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

// ---------------- Page: Add Product ----------------
function renderAddProduct() {
  pageContentEl.innerHTML = card(`
    <div class="form-row">
      ${field('Product Name', 'new-product-name', '', 'text', 'placeholder="e.g. Brake Pad"')}
      ${field('Starting Quantity', 'new-product-quantity', 0, 'number', 'min="0"')}
    </div>
    <div class="form-row">
      ${field('Selling Price', 'new-product-price', '', 'number', 'min="0" step="0.01" placeholder="0.00"')}
      ${field('Restock At', 'new-product-restock', '', 'number', 'min="0" placeholder="e.g. 5"')}
    </div>
    <button class="btn btn-primary" id="save-product" type="button">Save Product</button>`);

  document.getElementById('save-product').addEventListener('click', async () => {
    const v = (id) => document.getElementById(id).value.trim();
    const productName = v('new-product-name');
    const price = Number(v('new-product-price'));
    if (!productName || v('new-product-price') === '' || isNaN(price)) {
      return showAlert('Product name and selling price are required.', 'error');
    }
    try {
      await api.addProduct({
        productName,
        quantity: Number(v('new-product-quantity')) || 0,
        sellingPrice: price,
        reStockAt: Number(v('new-product-restock')) || 0
      });
      renderAddProduct();
      showAlert(`"${productName}" added.`);
    } catch (err) {
      showAlert(err.message, 'error');
    }
  });
}

// ---------------- Page: Suppliers (add + list) ----------------
async function renderSuppliers() {
  showLoading();
  try {
    supplierCache = await api.getSuppliers();
  } catch (err) {
    return showError("Couldn't load suppliers. Is the backend running?");
  }
  pageContentEl.innerHTML =
    card(`
      <div class="form-row">
        ${field('Supplier Name', 'new-supplier-name', '', 'text', 'placeholder="e.g. Auto Parts Lahore"')}
        ${field('Phone Number (optional)', 'new-supplier-phone', '', 'text', 'placeholder="e.g. 0300-1234567"')}
      </div>
      <button class="btn btn-primary" id="save-supplier" type="button">Add Supplier</button>`) +
    card(table(['Supplier', 'Phone', '>'],
      supplierCache.map(s => `<tr><td>${esc(s.supplierName)}</td><td>${esc(s.supplierPhone || '—')}</td>${actions('supplier', s.supplierID)}</tr>`).join(''),
      'No suppliers yet.'));

  document.getElementById('save-supplier').addEventListener('click', async () => {
    const name = document.getElementById('new-supplier-name').value.trim();
    if (!name) return showAlert('Supplier name is required.', 'error');
    try {
      await api.addSupplier({ supplierName: name, supplierPhone: document.getElementById('new-supplier-phone').value.trim() });
      renderSuppliers();
      showAlert(`"${name}" added.`);
    } catch (err) {
      showAlert(err.message, 'error');
    }
  });
}

// ---------------- Sorting, export, print ----------------
function sortedInventory(term) {
  const { key, dir } = inventorySort;
  const val = (p) => key === 'status' ? (p.quantity <= p.reStockAt ? 0 : 1)
    : key === 'productName' ? p.productName.toLowerCase() : Number(p[key]);
  return inventoryCache
    .filter(p => p.productName.toLowerCase().includes(term))
    .sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir);
}

function downloadCsv(filename, rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '\uFEFF' + rows.map(r => r.map(q).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

pageContentEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tool]');
  if (!b) return;
  const t = b.dataset.tool;
  if (t === 'print') window.print();
  if (t === 'csv-inventory') {
    downloadCsv('inventory.csv', [['Product', 'Quantity', 'Selling price', 'Restock at', 'Status'],
      ...inventoryCache.map(p => [p.productName, p.quantity, p.sellingPrice, p.reStockAt, p.quantity <= p.reStockAt ? 'RESTOCK' : 'OK'])]);
  }
  if (t === 'csv-prices') {
    downloadCsv('price-list.csv', [['Product', 'Selling price'], ...priceCache.map(p => [p.productName, p.sellingPrice])]);
  }
});

// ---------------- Start ----------------
loadPage('inventory');
