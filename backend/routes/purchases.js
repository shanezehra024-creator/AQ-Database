// routes/purchases.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const fail = (res, err, msg, code = 500) => {
  console.error(err);
  res.status(code).json({ error: msg });
};

// GET /api/purchases  (Purchase History, one row per item)
// to_char() returns the date as plain text (YYYY-MM-DD) so time zones can't shift it.
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT pu.purchaseid AS "purchaseID",
             to_char(pu.purchasedate, 'YYYY-MM-DD') AS "purchaseDate",
             pu.supplierid AS "supplierID",
             s.suppliername AS "supplierName",
             pr.productname AS "productName",
             pi.quantity,
             pi.costperproduct AS "costPerProduct",
             (pi.quantity * pi.costperproduct) AS "totalCost"
      FROM purchase pu
      LEFT JOIN supplier s ON pu.supplierid = s.supplierid
      JOIN purchaseitems pi ON pu.purchaseid = pi.purchaseid
      JOIN product pr ON pi.productid = pr.productid
      ORDER BY pu.purchasedate DESC, pu.purchaseid DESC, pi.itemid`);
    res.json(r.rows);
  } catch (e) { fail(res, e, 'Failed to load purchase history'); }
});

// POST /api/purchases  (add; your stock trigger raises quantities)
router.post('/', async (req, res) => {
  const { supplierID, purchaseDate, items } = req.body;
  if (!purchaseDate || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'A date and at least one item are required' });
  }
  const totalPrice = items.reduce((sum, i) => sum + i.quantity * i.costPerProduct, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = await client.query(
      `INSERT INTO purchase (purchasedate, supplierid, totalprice)
       VALUES ($1, $2, $3) RETURNING purchaseid`,
      [purchaseDate, supplierID || null, totalPrice]);
    const purchaseID = p.rows[0].purchaseid;
    for (const item of items) {
      await client.query(
        `INSERT INTO purchaseitems (quantity, costperproduct, purchaseid, productid)
         VALUES ($1, $2, $3, $4)`,
        [item.quantity, item.costPerProduct, purchaseID, item.productID]);
    }
    await client.query('COMMIT');
    res.status(201).json({ purchaseID, totalPrice });
  } catch (e) {
    await client.query('ROLLBACK');
    fail(res, e, 'Failed to save purchase');
  } finally {
    client.release();
  }
});

// PUT /api/purchases/:id  (edit date and supplier only)
router.put('/:id', async (req, res) => {
  const { supplierID, purchaseDate } = req.body;
  if (!purchaseDate) return res.status(400).json({ error: 'A date is required' });
  try {
    const r = await pool.query(
      'UPDATE purchase SET purchasedate = $1, supplierid = $2 WHERE purchaseid = $3',
      [purchaseDate, supplierID || null, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Purchase not found' });
    res.json({ ok: true });
  } catch (e) { fail(res, e, 'Failed to update purchase'); }
});

// DELETE /api/purchases/:id
// Takes the purchased stock back off each product, then removes the purchase.
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE product p SET quantity = p.quantity - t.qty
       FROM (SELECT productid, SUM(quantity) AS qty FROM purchaseitems
             WHERE purchaseid = $1 GROUP BY productid) t
       WHERE p.productid = t.productid`, [req.params.id]);
    await client.query('DELETE FROM purchaseitems WHERE purchaseid = $1', [req.params.id]);
    await client.query('DELETE FROM purchase WHERE purchaseid = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    fail(res, e, 'Failed to delete purchase');
  } finally {
    client.release();
  }
});

module.exports = router;
