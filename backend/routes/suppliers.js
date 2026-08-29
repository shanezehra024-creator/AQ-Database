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

module.exports = router;
