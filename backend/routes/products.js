// routes/products.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/products — Page 1: INVENTORY
// "AS "productID"" etc. renames Postgres's lowercase columns back to the
// camelCase names your frontend already expects — so app.js needs no changes.
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        productid AS "productID",
        productname AS "productName",
        quantity,
        sellingprice AS "sellingPrice",
        restockat AS "reStockAt"
      FROM product
      ORDER BY productname
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// GET /api/products/prices — Page 2: PRICE LIST
router.get('/prices', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT productname AS "productName", sellingprice AS "sellingPrice"
      FROM product
      ORDER BY productname
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load price list' });
  }
});

// GET /api/products/detailed — Page 3: DETAILED INVENTORY
// Finds each product's most recent costperproduct from purchaseitems.
router.get('/detailed', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.productname AS "productName",
        p.sellingprice AS "sellingPrice",
        latest.costperproduct AS "latestCost",
        p.quantity
      FROM product p
      LEFT JOIN LATERAL (
        SELECT pi.costperproduct
        FROM purchaseitems pi
        JOIN purchase pu ON pi.purchaseid = pu.purchaseid
        WHERE pi.productid = p.productid
        ORDER BY pu.purchasedate DESC, pi.itemid DESC
        LIMIT 1
      ) latest ON true
      ORDER BY p.productname
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load detailed inventory' });
  }
});

module.exports = router;
