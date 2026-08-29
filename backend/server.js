// server.js
// This is the file you run: node server.js
// It starts the API AND serves the frontend files, so you only need
// ONE thing running to use the whole system.

const express = require('express');
const path = require('path');
require('dotenv').config();

const productsRouter = require('./routes/products');
const purchasesRouter = require('./routes/purchases');
const suppliersRouter = require('./routes/suppliers');

const app = express();
app.use(express.json()); // lets Express read JSON request bodies

// --- API routes ---
app.use('/api/products', productsRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/suppliers', suppliersRouter);

// --- Serve the frontend (the plain HTML/CSS/JS folder) ---
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Shop system running: http://localhost:${PORT}`);
});
