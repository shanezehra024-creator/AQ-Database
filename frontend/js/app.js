// js/app.js
// Handles: switching between the 5 pages, rendering each page's table,
// the inventory search box, and the Add Purchase form.

const pageTitleEl = document.getElementById('page-title');
const pageContentEl = document.getElementById('page-content');
const alertBox = document.getElementById('alert-box');

const PAGE_TITLES = {
  inventory: 'Inventory',
  prices: 'Price List',
  detailed: 'Detailed Inventory',
  history: 'Purchase History',
  'add-purchase': 'Add Purchase'
};

let inventoryCache = []; // used by the search box so we don't re-fetch on every keystroke

// ---------------- Navigation ----------------
document.querySelectorAll('.nav-link').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadPage(btn.dataset.page);
  });
});

function loadPage(page) {
  pageTitleEl.textContent = PAGE_TITLES[page];
  hideAlert();

  switch (page) {
    case 'inventory': return renderInventory();
    case 'prices': return renderPriceList();
    case 'detailed': return renderDetailedInventory();
    case 'history': return renderPurchaseHistory();
    case 'add-purchase': return renderAddPurchase();
  }
}

// ---------------- Helpers ----------------
function money(value) {
  const num = Number(value);
  return isNaN(num) ? '—' : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function showLoading() {
  pageContentEl.innerHTML = `<div class="card"><div class="loading-state">Loading…</div></div>`;
}

function showAlert(message, type = 'success') {
  alertBox.textContent = message;
  alertBox.className = `alert-box ${type}`;
}

function hideAlert() {
  alertBox.className = 'alert-box hidden';
}

// ---------------- Page 1: Inventory ----------------
async function renderInventory() {
  showLoading();
  try {
    inventoryCache = await api.getInventory();
    drawInventoryTable(inventoryCache);
  } catch (err) {
    pageContentEl.innerHTML = `<div class="card"><div class="empty-state">Couldn't load inventory. Is the backend running?</div></div>`;
  }
}

function drawInventoryTable(rows) {
  const tableRows = rows.map(p => {
    const isLow = p.quantity <= p.reStockAt;
    const badge = isLow
      ? `<span class="badge badge-restock">RESTOCK</span>`
      : `<span class="badge badge-ok">OK</span>`;
    return `
      <tr>
        <td>${escapeHtml(p.productName)}</td>
        <td class="right">${p.quantity}</td>
        <td class="right">${money(p.sellingPrice)}</td>
        <td class="right">${p.reStockAt}</td>
        <td>${badge}</td>
      </tr>`;
  }).join('');

  pageContentEl.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <input type="text" id="inventory-search" class="search-input" placeholder="Search by product name…">
      </div>
      <table>
        <thead>
          <tr>
            <th>Product Name</th>
            <th class="right">Quantity</th>
            <th class="right">Selling Price</th>
            <th class="right">Restock At</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="inventory-body">
          ${tableRows || `<tr><td colspan="5" class="empty-state">No products yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('inventory-search').addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    const filtered = inventoryCache.filter(p => p.productName.toLowerCase().includes(term));
    document.getElementById('inventory-body').innerHTML = filtered.map(p => {
      const isLow = p.quantity <= p.reStockAt;
      const badge = isLow
        ? `<span class="badge badge-restock">RESTOCK</span>`
        : `<span class="badge badge-ok">OK</span>`;
      return `
        <tr>
          <td>${escapeHtml(p.productName)}</td>
          <td class="right">${p.quantity}</td>
          <td class="right">${money(p.sellingPrice)}</td>
          <td class="right">${p.reStockAt}</td>
          <td>${badge}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="5" class="empty-state">No matching products.</td></tr>`;
  });
}

// ---------------- Page 2: Price List ----------------
async function renderPriceList() {
  showLoading();
  try {
    const rows = await api.getPriceList();
    pageContentEl.innerHTML = `
      <div class="card">
        <table>
          <thead>
            <tr><th>Product Name</th><th class="right">Selling Price</th></tr>
          </thead>
          <tbody>
            ${rows.map(p => `
              <tr>
                <td>${escapeHtml(p.productName)}</td>
                <td class="right">${money(p.sellingPrice)}</td>
              </tr>`).join('') || `<tr><td colspan="2" class="empty-state">No products yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    pageContentEl.innerHTML = `<div class="card"><div class="empty-state">Couldn't load the price list.</div></div>`;
  }
}

// ---------------- Page 3: Detailed Inventory ----------------
async function renderDetailedInventory() {
  showLoading();
  try {
    const rows = await api.getDetailedInventory();
    pageContentEl.innerHTML = `
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>Product Name</th>
              <th class="right">Selling Price</th>
              <th class="right">Latest Cost Price</th>
              <th class="right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(p => `
              <tr>
                <td>${escapeHtml(p.productName)}</td>
                <td class="right">${money(p.sellingPrice)}</td>
                <td class="right">${p.latestCost != null ? money(p.latestCost) : '—'}</td>
                <td class="right">${p.quantity}</td>
              </tr>`).join('') || `<tr><td colspan="4" class="empty-state">No products yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    pageContentEl.innerHTML = `<div class="card"><div class="empty-state">Couldn't load detailed inventory.</div></div>`;
  }
}

// ---------------- Page 4: Purchase History ----------------
async function renderPurchaseHistory() {
  showLoading();
  try {
    const rows = await api.getPurchaseHistory();
    pageContentEl.innerHTML = `
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Supplier</th>
              <th>Product</th>
              <th class="right">Quantity</th>
              <th class="right">Cost Per Product</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${formatDate(r.purchaseDate)}</td>
                <td>${escapeHtml(r.supplierName)}</td>
                <td>${escapeHtml(r.productName)}</td>
                <td class="right">${r.quantity}</td>
                <td class="right">${money(r.costPerProduct)}</td>
                <td class="right">${money(r.totalCost)}</td>
              </tr>`).join('') || `<tr><td colspan="6" class="empty-state">No purchases recorded yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    pageContentEl.innerHTML = `<div class="card"><div class="empty-state">Couldn't load purchase history.</div></div>`;
  }
}

// ---------------- Page 5: Add Purchase ----------------
let itemRowCount = 0;
let productOptionsHtml = '';

async function renderAddPurchase() {
  showLoading();
  try {
    const [suppliers, products] = await Promise.all([api.getSuppliers(), api.getInventory()]);

    productOptionsHtml = products.map(p => `<option value="${p.productID}">${escapeHtml(p.productName)}</option>`).join('');
    const supplierOptionsHtml = suppliers.map(s => `<option value="${s.supplierID}">${escapeHtml(s.supplierName)}</option>`).join('');

    pageContentEl.innerHTML = `
      <div class="card">
        <div class="form-row">
          <div>
            <label for="purchase-supplier">Supplier</label>
            <select id="purchase-supplier">
              <option value="">Select a supplier…</option>
              ${supplierOptionsHtml}
            </select>
          </div>
          <div>
            <label for="purchase-date">Purchase Date</label>
            <input type="date" id="purchase-date" value="${new Date().toISOString().slice(0, 10)}">
          </div>
        </div>

        <label>Items Purchased</label>
        <div id="item-rows"></div>
        <button class="btn btn-secondary" id="add-item-row" type="button">+ Add Product</button>

        <div class="total-line">
          <span>Total:</span>
          <span id="purchase-total">0.00</span>
        </div>

        <button class="btn btn-primary" id="save-purchase" type="button">Save Purchase</button>
      </div>
    `;

    itemRowCount = 0;
    document.getElementById('item-rows').innerHTML = '';
    addItemRow(); // start with one row

    document.getElementById('add-item-row').addEventListener('click', addItemRow);
    document.getElementById('save-purchase').addEventListener('click', savePurchase);
  } catch (err) {
    pageContentEl.innerHTML = `<div class="card"><div class="empty-state">Couldn't load the form. Is the backend running?</div></div>`;
  }
}

function addItemRow() {
  itemRowCount++;
  const rowId = `item-${itemRowCount}`;
  const row = document.createElement('div');
  row.className = 'item-row';
  row.id = rowId;
  row.innerHTML = `
    <div>
      <label>Product</label>
      <select class="item-product">${productOptionsHtml}</select>
    </div>
    <div>
      <label>Quantity</label>
      <input type="number" class="item-quantity" min="1" value="1">
    </div>
    <div>
      <label>Cost Per Product</label>
      <input type="number" class="item-cost" min="0" step="0.01" value="0">
    </div>
    <div>
      <button class="btn btn-remove" type="button" onclick="document.getElementById('${rowId}').remove(); updateTotal();">Remove</button>
    </div>
  `;
  document.getElementById('item-rows').appendChild(row);
  row.querySelectorAll('.item-quantity, .item-cost').forEach(input => {
    input.addEventListener('input', updateTotal);
  });
  updateTotal();
}

function updateTotal() {
  let total = 0;
  document.querySelectorAll('.item-row').forEach(row => {
    const qty = Number(row.querySelector('.item-quantity').value) || 0;
    const cost = Number(row.querySelector('.item-cost').value) || 0;
    total += qty * cost;
  });
  document.getElementById('purchase-total').textContent = money(total);
}

async function savePurchase() {
  const supplierID = document.getElementById('purchase-supplier').value;
  const purchaseDate = document.getElementById('purchase-date').value;

  if (!supplierID || !purchaseDate) {
    showAlert('Please select a supplier and a date.', 'error');
    return;
  }

  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    items.push({
      productID: Number(row.querySelector('.item-product').value),
      quantity: Number(row.querySelector('.item-quantity').value),
      costPerProduct: Number(row.querySelector('.item-cost').value)
    });
  });

  if (items.length === 0 || items.some(i => !i.productID || i.quantity <= 0)) {
    showAlert('Every item needs a product and a quantity greater than 0.', 'error');
    return;
  }

  try {
    await api.addPurchase({ supplierID: Number(supplierID), purchaseDate, items });
    showAlert('Purchase saved. Stock quantities have been updated.', 'success');
    renderAddPurchase(); // reset the form
  } catch (err) {
    showAlert("Couldn't save the purchase. Check the backend logs.", 'error');
  }
}

// ---------------- Small utility ----------------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------------- Start on page load ----------------
loadPage('inventory');
