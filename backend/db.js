// db.js
// Sets up ONE shared connection pool to your Supabase (PostgreSQL) database.
// Every route file reuses this same pool instead of opening a new
// connection every time.

const { Pool } = require('pg');
require('dotenv').config();

// Supabase gives you one single "connection string" that contains the
// username, password, host, port, and database name all in one piece —
// much simpler than the separate DB_USER/DB_SERVER/DB_PORT fields we
// had to juggle with SQL Server.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for connecting to Supabase
});

pool.connect()
  .then(client => {
    console.log('Connected to Supabase (PostgreSQL)');
    client.release();
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
  });

module.exports = { pool };
