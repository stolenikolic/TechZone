-- Minimal guest order flow for COD/manual payments.
-- Idempotent so it can be applied safely after checking the real database state.

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'Pending',
  payment_method text NOT NULL DEFAULT 'Cash on Delivery',
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  shipping_company text,
  shipping_country text NOT NULL,
  shipping_zip text NOT NULL,
  shipping_address1 text NOT NULL,
  shipping_address2 text,
  billing_name text,
  billing_email text,
  billing_phone text,
  billing_country text,
  billing_zip text,
  billing_address1 text,
  billing_address2 text,
  delivery_notes text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  shipping_total numeric(12,2) NOT NULL DEFAULT 0,
  tax_total numeric(12,2) NOT NULL DEFAULT 0,
  discount_total numeric(12,2) NOT NULL DEFAULT 0,
  total_price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_status_check CHECK (status IN ('Pending', 'Processing', 'Delivered', 'Cancelled'))
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'Cash on Delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_company text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_country text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_zip text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address1 text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address2 text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_email text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_phone text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_country text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_zip text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address1 text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address2 text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_total numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_total numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_total numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_status_check' AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_status_check
      CHECK (status IN ('Pending', 'Processing', 'Delivered', 'Cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_slug text NOT NULL,
  product_image text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(12,2) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name text NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_slug text NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_image text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS line_total numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_quantity_check' AND conrelid = 'order_items'::regclass
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_quantity_check
      CHECK (quantity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_unit_price_check' AND conrelid = 'order_items'::regclass
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_unit_price_check
      CHECK (unit_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_line_total_check' AND conrelid = 'order_items'::regclass
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_line_total_check
      CHECK (line_total >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
