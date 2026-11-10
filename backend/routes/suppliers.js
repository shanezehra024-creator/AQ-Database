// routes/suppliers.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const fail = (res, err, msg, code = 500) => {
  console.error(err);
  res.status(code).json({ error: msg });
};

// GET /api/suppliers
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT supplierid AS "supplierID", suppliername AS "supplierName", supplierphone AS "supplierPhone"
      FROM supplier ORDER BY suppliername`);
    res.json(r.rows);
  } catch (e) { fail(res, e, 'Failed to load suppliers'); }
});

// POST /api/suppliers
router.post('/', async (req, res) => {
  const { supplierName, supplierPhone } = req.body;
  if (!supplierName) return res.status(400).json({ error: 'Supplier name is required' });
  try {
    const r = await pool.query(
      `INSERT INTO supplier (suppliername, supplierphone) VALUES ($1, $2)
       RETURNING supplierid AS "supplierID"`,
      [supplierName, supplierPhone || null]);
    res.status(201).json(r.rows[0]);
  } catch (e) { fail(res, e, 'Failed to add supplier'); }
});

// PUT /api/suppliers/:id
router.put('/:id', async (req, res) => {
  const { supplierName, supplierPhone } = req.body;
  if (!supplierName) return res.status(400).json({ error: 'Supplier name is required' });
  try {
    const r = await pool.query(
      'UPDATE supplier SET suppliername = $1, supplierphone = $2 WHERE supplierid = $3',
      [supplierName, supplierPhone || null, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ ok: true });
  } catch (e) { fail(res, e, 'Failed to update supplier'); }
});

// DELETE /api/suppliers/:id
// Past purchases are kept; they just lose their supplier.
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE purchase SET supplierid = NULL WHERE supplierid = $1', [req.params.id]);
    await client.query('DELETE FROM supplier WHERE supplierid = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    fail(res, e, 'Failed to delete supplier');
  } finally {
    client.release();
  }
});

module.exports = router;
