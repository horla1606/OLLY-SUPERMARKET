-- =============================================
-- OLLY SUPERMARKET — Complete Database Setup
-- Paste this entire file into Supabase SQL Editor
-- and click "Run" once.
-- =============================================

-- ─── 1. Extensions ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 2. Tables ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  role          VARCHAR(20) NOT NULL DEFAULT 'customer'
                  CHECK (role IN ('customer', 'manager', 'admin', 'staff')),
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  category    VARCHAR(100) NOT NULL,
  price       DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  expiry_date DATE,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  items        JSONB NOT NULL DEFAULT '[]',
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  pickup_time  TIMESTAMPTZ NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'confirmed', 'ready', 'completed', 'cancelled')),
  pickup_code  VARCHAR(8) UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  items       JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  phone      VARCHAR(20),
  hire_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  type        VARCHAR(20) NOT NULL DEFAULT 'inquiry'
                CHECK (type IN ('inquiry', 'complaint', 'feedback', 'support')),
  status      VARCHAR(20) NOT NULL DEFAULT 'unread'
                CHECK (status IN ('unread', 'read', 'replied', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  sales_count INTEGER NOT NULL DEFAULT 0,
  revenue     DECIMAL(10, 2) NOT NULL DEFAULT 0,
  staff_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (product_id, date, staff_id)
);

-- ─── 3. Enable RLS ───────────────────────────────────────────────────────────
ALTER TABLE users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- ─── 4. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_customer_id    ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status          ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_code     ON orders(pickup_code);
CREATE INDEX IF NOT EXISTS idx_products_category      ON products(category);
CREATE INDEX IF NOT EXISTS idx_messages_customer_id   ON messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_status        ON messages(status);
CREATE INDEX IF NOT EXISTS idx_analytics_product_date ON analytics(product_id, date);
CREATE INDEX IF NOT EXISTS idx_analytics_date         ON analytics(date);

-- ─── 5. RLS Policies — Users ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_own"     ON users;
DROP POLICY IF EXISTS "users_select_admin"   ON users;
DROP POLICY IF EXISTS "users_select_manager" ON users;
DROP POLICY IF EXISTS "users_update_own"     ON users;
DROP POLICY IF EXISTS "users_insert_service" ON users;

CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "users_select_manager" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "users_insert_service" ON users
  FOR INSERT WITH CHECK (true);

-- ─── 6. RLS Policies — Products ──────────────────────────────────────────────
DROP POLICY IF EXISTS "products_select_public"    ON products;
DROP POLICY IF EXISTS "products_insert_admin_staff" ON products;
DROP POLICY IF EXISTS "products_update_admin_staff" ON products;
DROP POLICY IF EXISTS "products_delete_admin"     ON products;

CREATE POLICY "products_select_public" ON products
  FOR SELECT USING (true);

-- ─── 7. RLS Policies — Orders ────────────────────────────────────────────────
DROP POLICY IF EXISTS "orders_select_own"         ON orders;
DROP POLICY IF EXISTS "orders_select_admin_staff"  ON orders;
DROP POLICY IF EXISTS "orders_select_manager"      ON orders;
DROP POLICY IF EXISTS "orders_insert_customer"     ON orders;
DROP POLICY IF EXISTS "orders_update_admin_staff"  ON orders;
DROP POLICY IF EXISTS "orders_update_manager"      ON orders;
DROP POLICY IF EXISTS "orders_delete_admin"        ON orders;

CREATE POLICY "orders_select_own" ON orders
  FOR SELECT USING (auth.uid()::text = customer_id::text);

CREATE POLICY "orders_select_manager" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

CREATE POLICY "orders_insert_customer" ON orders
  FOR INSERT WITH CHECK (auth.uid()::text = customer_id::text);

CREATE POLICY "orders_update_manager" ON orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

-- ─── 8. RLS Policies — Carts ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "carts_select_own" ON carts;
DROP POLICY IF EXISTS "carts_insert_own" ON carts;
DROP POLICY IF EXISTS "carts_update_own" ON carts;
DROP POLICY IF EXISTS "carts_delete_own" ON carts;

CREATE POLICY "carts_select_own" ON carts
  FOR SELECT USING (auth.uid()::text = customer_id::text);

CREATE POLICY "carts_insert_own" ON carts
  FOR INSERT WITH CHECK (auth.uid()::text = customer_id::text);

CREATE POLICY "carts_update_own" ON carts
  FOR UPDATE USING (auth.uid()::text = customer_id::text);

CREATE POLICY "carts_delete_own" ON carts
  FOR DELETE USING (auth.uid()::text = customer_id::text);

-- ─── 9. RLS Policies — Staff ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_select_admin" ON staff;
DROP POLICY IF EXISTS "staff_insert_admin" ON staff;
DROP POLICY IF EXISTS "staff_update_admin" ON staff;
DROP POLICY IF EXISTS "staff_delete_admin" ON staff;

CREATE POLICY "staff_select_admin" ON staff
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

CREATE POLICY "staff_insert_admin" ON staff
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

CREATE POLICY "staff_update_admin" ON staff
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

CREATE POLICY "staff_delete_admin" ON staff
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

-- ─── 10. RLS Policies — Messages ─────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_select_own"        ON messages;
DROP POLICY IF EXISTS "messages_insert_own"        ON messages;
DROP POLICY IF EXISTS "messages_select_admin_staff" ON messages;
DROP POLICY IF EXISTS "messages_update_admin_staff" ON messages;

CREATE POLICY "messages_select_own" ON messages
  FOR SELECT USING (auth.uid()::text = customer_id::text);

CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT WITH CHECK (auth.uid()::text = customer_id::text);

CREATE POLICY "messages_select_admin_staff" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

CREATE POLICY "messages_update_admin_staff" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

-- ─── 11. RLS Policies — Analytics ────────────────────────────────────────────
DROP POLICY IF EXISTS "analytics_select_admin_staff" ON analytics;
DROP POLICY IF EXISTS "analytics_insert_admin_staff" ON analytics;
DROP POLICY IF EXISTS "analytics_update_admin_staff" ON analytics;

CREATE POLICY "analytics_select_admin_staff" ON analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

CREATE POLICY "analytics_insert_admin_staff" ON analytics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

CREATE POLICY "analytics_update_admin_staff" ON analytics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

-- ─── DONE ────────────────────────────────────────────────────────────────────
-- All 7 tables, indexes, and RLS policies are ready.
-- Next: create the product-images storage bucket (see instructions below),
-- then run the storage policies SQL separately.
