// js/api.js
const API_BASE = '/api';

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  return res.json();
}

const api = {
  getInventory: () => apiGet('/products'),
  getPriceList: () => apiGet('/products/prices'),
  getDetailedInventory: () => apiGet('/products/detailed'),
  getPurchaseHistory: () => apiGet('/purchases'),
  getSuppliers: () => apiGet('/suppliers'),
  addPurchase: (purchase) => apiPost('/purchases', purchase),
  addProduct: (product) => apiPost('/products', product),
  addSupplier: (supplier) => apiPost('/suppliers', supplier)
};
