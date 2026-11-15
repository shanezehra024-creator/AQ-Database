# AQ-Database-x

# AQ Spare Parts – Inventory Manager

A small inventory system for a spare-parts shop run by one person. It keeps track of what's in stock, what needs reordering, and what was bought from which supplier.

I started this as a database exercise. I wanted to practice designing a proper relational schema, so I sketched out four tables (products, suppliers, purchases, purchase items) and a trigger that adds to stock whenever a purchase is saved. Then I kept going until it turned into a full app with a front end, a backend, and a live deployment. I designed the database and decided what the shop needed. I built the app around it with AI assistance.

![Inventory page](screenshots/inventory.png)

## What it does

- **Inventory** with a search box, sortable columns, and a status for each product. A product shows RESTOCK once its quantity falls to its restock level or below. That status is worked out in the interface, not stored in the database.
- **Price list**, which is just product names and selling prices, with CSV export and a print view.
- **Detailed inventory**, which puts each product's selling price next to the cost from its most recent purchase.
- **Purchase history**, built by joining purchases, purchase items, suppliers and products. Nothing extra is stored for it.
- **Add purchase**, where you pick a supplier (optional), a date, and one or more products with a quantity and cost for each. Saving it creates the purchase and its items in a single transaction, and a database trigger raises the stock levels.
- **Edit and delete** on every list. Deleting a purchase takes its stock back off. A product that already has purchase history can't be deleted, and the app says why.

![Add purchase page](screenshots/add-purchase.png)

## Built with

- Node.js and Express for the backend API
- PostgreSQL, hosted on Supabase
- Plain HTML, CSS and JavaScript for the front end, served by the same Express app
- Deployed on Render

I chose plain JavaScript on the front end because the shop only needs a few screens, and I wanted one thing to run and one thing to deploy.

## Project layout

```
backend/
  server.js        starts the app and serves the front end
  db.js            database connection
  routes/          products, suppliers, purchases
frontend/
  index.html
  css/style.css
  js/api.js        talks to the backend
  js/app.js        pages, forms, tables
schema-postgres.sql
```

## Running it yourself

You need Node.js and a PostgreSQL database. A free Supabase project works fine.

1. Run `schema-postgres.sql` in your database's SQL editor. This creates the tables and the stock trigger.
2. Inside `backend/`, copy `.env.example` to `.env` and put your connection string in `DATABASE_URL`.
3. From the `backend` folder:

```
npm install
npm start
```

4. Open `http://localhost:3000`.

## How a purchase becomes stock

When you save a purchase, the backend inserts a row into `purchase`, then one row into `purchaseitems` for each product. A trigger on `purchaseitems` adds the purchased quantity to that product's stock. The backend never updates stock directly, so the database stays the single source of truth.

## What isn't done

- **There's no login.** Anyone with the link can edit or delete data. It's meant for one trusted person on one device, so I haven't published the live link.
- **There's no sales tracking.** Stock goes up through purchases, but going down currently means editing a product's quantity by hand. Recording sales is the obvious next piece.
- **Editing a purchase only changes its date and supplier.** To correct the items, delete the purchase and enter it again.
- Money is shown as plain numbers, with no currency symbol.

## What I learned

Most of my time went on getting the pieces to talk to each other, not on writing features. The first version used SQL Server on my own machine, and getting a Node app to connect to it turned into days of networking settings. Moving to a hosted Postgres database fixed that and also meant the shop could open the app from a different place with nothing installed.
