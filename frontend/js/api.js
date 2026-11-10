// js/api.js
const API_BASE = '/api';

async function request(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) throw new Error((data && data.error) || 'Request failed');
  return data;
}

const api = {
  getInventory: () => request('GET', '/products'),
  getPriceList: () => request('GET', '/products/prices'),
  getDetailedInventory: () => request('GET', '/products/detailed'),
  addProduct: (p) => request('POST', '/products', p),
  updateProduct: (id, p) => request('PUT', `/products/${id}`, p),
  deleteProduct: (id) => request('DELETE', `/products/${id}`),

  getSuppliers: () => request('GET', '/suppliers'),
  addSupplier: (s) => request('POST', '/suppliers', s),
  updateSupplier: (id, s) => request('PUT', `/suppliers/${id}`, s),
  deleteSupplier: (id) => request('DELETE', `/suppliers/${id}`),

  getPurchaseHistory: () => request('GET', '/purchases'),
  addPurchase: (p) => request('POST', '/purchases', p),
  updatePurchase: (id, p) => request('PUT', `/purchases/${id}`, p),
  deletePurchase: (id) => request('DELETE', `/purchases/${id}`)
};
