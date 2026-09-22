// routes/suppliers.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/suppliers — used to fill the supplier dropdown on Add Purchase
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        supplierid AS "supplierID",
        suppliername AS "supplierName",
        supplierphone AS "supplierPhone"
      FROM supplier
      ORDER BY suppliername
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load suppliers' });
  }
});

// POST /api/suppliers
// Adds a brand new supplier, typed in directly through the UI.
router.post('/', async (req, res) => {
  const { supplierName, supplierPhone } = req.body;

  if (!supplierName) {
    return res.status(400).json({ error: 'supplierName is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO supplier (suppliername, supplierphone)
       VALUES ($1, $2)
       RETURNING supplierid AS "supplierID"`,
      [supplierName, supplierPhone || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add supplier' });
  }
});

module.exports = router;
