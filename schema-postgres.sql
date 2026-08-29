-- PostgreSQL / Supabase version of your schema.
-- Same 4 tables and same trigger logic as your original SQL Server version.
-- Note: column names are lowercase here (productid, not productID) because
-- that's the standard convention in Postgres. The backend converts these
-- back to the original camelCase names (productID, sellingPrice, etc.)
-- before sending data to the frontend, so nothing else needs to change.

create table product (
  productid serial primary key,
  productname varchar(200) not null,
  quantity int,
  sellingprice decimal(10,2) not null,
  restockat int
);

create table supplier (
  supplierid serial primary key,
  suppliername varchar(200),
  supplierphone varchar(16)
);

create table purchase (
  purchaseid serial primary key,
  purchasedate date,
  supplierid int references supplier(supplierid),
  totalprice decimal(10,2) not null
);

create table purchaseitems (
  itemid serial primary key,
  quantity int not null,
  costperproduct decimal(10,2) not null,
  purchaseid int not null references purchase(purchaseid),
  productid int not null references product(productid)
);

-- Trigger: same job as your original "stockIncrease" trigger.
-- Postgres splits this into two pieces: a function that does the work,
-- and a trigger that says "run this function after every insert".
create or replace function stock_increase()
returns trigger as $$
begin
  update product
  set quantity = quantity + NEW.quantity
  where productid = NEW.productid;
  return NEW;
end;
$$ language plpgsql;

create trigger stockincrease
after insert on purchaseitems
for each row
execute function stock_increase();
