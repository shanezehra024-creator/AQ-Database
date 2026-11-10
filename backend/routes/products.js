// routes/products.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const fail = (res, err, msg, code = 500) => {
  console.error(err);
  res.status(code).json({ error: msg });
};

// GET /api/products  (Inventory)
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT productid AS "productID", productname AS "productName", quantity,
             sellingprice AS "sellingPrice", restockat AS "reStockAt"
      FROM product ORDER BY productname`);
    res.json(r.rows);
  } catch (e) { fail(res, e, 'Failed to load products'); }
});

// GET /api/products/prices  (Price List)
router.get('/prices', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT productid AS "productID", productname AS "productName", sellingprice AS "sellingPrice"
      FROM product ORDER BY productname`);
    res.json(r.rows);
  } catch (e) { fail(res, e, 'Failed to load price list'); }
});

// GET /api/products/detailed  (Detailed Inventory, latest cost)
router.get('/detailed', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.productid AS "productID", p.productname AS "productName",
             p.sellingprice AS "sellingPrice", latest.costperproduct AS "latestCost", p.quantity
      FROM product p
      LEFT JOIN LATERAL (
        SELECT pi.costperproduct
        FROM purchaseitems pi
        JOIN purchase pu ON pi.purchaseid = pu.purchaseid
        WHERE pi.productid = p.productid
        ORDER BY pu.purchasedate DESC, pi.itemid DESC
        LIMIT 1
      ) latest ON true
      ORDER BY p.productname`);
    res.json(r.rows);
  } catch (e) { fail(res, e, 'Failed to load detailed inventory'); }
});

// POST /api/products  (add)
router.post('/', async (req, res) => {
  const { productName, quantity, sellingPrice, reStockAt } = req.body;
  if (!productName || sellingPrice == null) {
    return res.status(400).json({ error: 'Product name and selling price are required' });
  }
  try {
    const r = await pool.query(
      `INSERT INTO product (productname, quantity, sellingprice, restockat)
       VALUES ($1, $2, $3, $4) RETURNING productid AS "productID"`,
      [productName, quantity || 0, sellingPrice, reStockAt || 0]);
    res.status(201).json(r.rows[0]);
  } catch (e) { fail(res, e, 'Failed to add product'); }
});

// PUT /api/products/:id  (edit)
router.put('/:id', async (req, res) => {
  const { productName, quantity, sellingPrice, reStockAt } = req.body;
  if (!productName || sellingPrice == null) {
    return res.status(400).json({ error: 'Product name and selling price are required' });
  }
  try {
    const r = await pool.query(
      `UPDATE product SET productname = $1, quantity = $2, sellingprice = $3, restockat = $4
       WHERE productid = $5`,
      [productName, quantity || 0, sellingPrice, reStockAt || 0, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ ok: true });
  } catch (e) { fail(res, e, 'Failed to update product'); }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM product WHERE productid = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23503') {
      return fail(res, e, "This product has purchase history, so it can't be deleted.", 409);
    }
    fail(res, e, 'Failed to delete product');
  }
});

module.exports = router;
