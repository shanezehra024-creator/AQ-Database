// routes/purchases.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/purchases — Page 4: PURCHASE HISTORY
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        pu.purchasedate AS "purchaseDate",
        s.suppliername AS "supplierName",
        pr.productname AS "productName",
        pi.quantity,
        pi.costperproduct AS "costPerProduct",
        (pi.quantity * pi.costperproduct) AS "totalCost"
      FROM purchase pu
      LEFT JOIN supplier s ON pu.supplierid = s.supplierid
      JOIN purchaseitems pi ON pu.purchaseid = pi.purchaseid
      JOIN product pr ON pi.productid = pr.productid
      ORDER BY pu.purchasedate DESC, pu.purchaseid DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load purchase history' });
  }
});

// POST /api/purchases — Page 5: ADD PURCHASE
router.post('/', async (req, res) => {
  const { supplierID, purchaseDate, items } = req.body;

  if (!purchaseDate || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'purchaseDate and at least one item are required' });
  }

  const totalPrice = items.reduce((sum, item) => sum + item.quantity * item.costPerProduct, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const purchaseResult = await client.query(
      `INSERT INTO purchase (purchasedate, supplierid, totalprice)
       VALUES ($1, $2, $3)
       RETURNING purchaseid`,
      [purchaseDate, supplierID || null, totalPrice]
    );
    const purchaseID = purchaseResult.rows[0].purchaseid;

    for (const item of items) {
      await client.query(
        `INSERT INTO purchaseitems (quantity, costperproduct, purchaseid, productid)
         VALUES ($1, $2, $3, $4)`,
        [item.quantity, item.costPerProduct, purchaseID, item.productID]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ purchaseID, totalPrice });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to save purchase' });
  } finally {
    client.release();
  }
});

module.exports = router;
