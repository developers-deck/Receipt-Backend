-- SQL schema generated from schema.ts

-- Ensure the receipts table is created first
CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  company_name TEXT,
  po_box TEXT,
  mobile TEXT,
  tin TEXT,
  vrn TEXT,
  serial_no TEXT,
  uin TEXT,
  tax_office TEXT,
  customer_name TEXT,
  customer_id_type TEXT,
  customer_id TEXT,
  customer_mobile TEXT,
  receipt_no TEXT,
  z_number TEXT,
  receipt_date TEXT,
  receipt_time TEXT,
  total_excl_tax TEXT,
  total_tax TEXT,
  total_incl_tax TEXT,
  verification_code TEXT NOT NULL UNIQUE,
  verification_code_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchased_items (
  id SERIAL PRIMARY KEY,
  receipt_id SERIAL REFERENCES receipts(id),
  description TEXT,
  quantity TEXT,
  amount TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);