-- ============================================================
-- OLLY SUPERMARKET — Complete Production Schema
-- Run this ONCE in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- This file supersedes SETUP_RUN_THIS.sql and all migrations.
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  role          VARCHAR(20)  NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer', 'manager', 'admin', 'staff')),
  password_hash TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id          UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255)   NOT NULL,
  category    VARCHAR(100)   NOT NULL,
  price       DECIMAL(10,2)  NOT NULL CHECK (price >= 0),
  stock       INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
  expiry_date DATE,
  image_url   TEXT,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  phone      VARCHAR(20),
  hire_date  DATE         NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_duties (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id   UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date       DATE        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, date)
);

CREATE TABLE IF NOT EXISTS orders (
  id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id        UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_staff_id  UUID          REFERENCES staff(id) ON DELETE SET NULL,
  items              JSONB         NOT NULL DEFAULT '[]',
  total_amount       DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  pickup_time        TIMESTAMPTZ   NOT NULL,
  status             VARCHAR(20)   NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','ready','completed','cancelled')),
  pickup_code        VARCHAR(8)    UNIQUE,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carts (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  items       JSONB       NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  type        VARCHAR(20) NOT NULL DEFAULT 'inquiry'
              CHECK (type IN ('inquiry','complaint','feedback','support')),
  status      VARCHAR(20) NOT NULL DEFAULT 'unread'
              CHECK (status IN ('unread','read','replied','closed')),
  reply       TEXT,
  replied_at  TIMESTAMPTZ,
  replied_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID          REFERENCES products(id) ON DELETE SET NULL,
  date        DATE          NOT NULL DEFAULT CURRENT_DATE,
  sales_count INTEGER       NOT NULL DEFAULT 0,
  revenue     DECIMAL(10,2) NOT NULL DEFAULT 0,
  staff_id    UUID          REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (product_id, date, staff_id)
);

CREATE TABLE IF NOT EXISTS social_posts (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform       VARCHAR(20) NOT NULL CHECK (platform IN ('facebook','instagram','twitter')),
  content        TEXT        NOT NULL,
  image_url      TEXT,
  scheduled_date TIMESTAMPTZ,
  status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','scheduled','posted','failed')),
  product_id     UUID        REFERENCES products(id) ON DELETE SET NULL,
  created_by     UUID        REFERENCES users(id)    ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        VARCHAR(30) NOT NULL DEFAULT 'product',
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  product_id  UUID        REFERENCES products(id) ON DELETE SET NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_count  INTEGER     NOT NULL DEFAULT 0,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_customer_id      ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status           ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_code      ON orders(pickup_code);
CREATE INDEX IF NOT EXISTS idx_products_category       ON products(category);
CREATE INDEX IF NOT EXISTS idx_messages_customer_id    ON messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_status         ON messages(status);
CREATE INDEX IF NOT EXISTS idx_analytics_product_date  ON analytics(product_id, date);
CREATE INDEX IF NOT EXISTS idx_analytics_date          ON analytics(date);
CREATE INDEX IF NOT EXISTS idx_staff_duties_date       ON staff_duties(date);
CREATE INDEX IF NOT EXISTS idx_staff_duties_staff_id   ON staff_duties(staff_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled  ON social_posts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_social_posts_status     ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at   ON notifications(sent_at);

-- ─── Enable RLS ──────────────────────────────────────────────────────────────
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff         ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_duties  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ─── Helper: is the current JWT user a manager/admin/staff? ──────────────────
-- Used by all manager-restricted policies.
-- NOTE: The backend uses the service_role key which bypasses RLS entirely,
-- so these policies protect direct Supabase client access only.

-- ─── RLS: users ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_own"     ON users;
DROP POLICY IF EXISTS "users_select_manager" ON users;
DROP POLICY IF EXISTS "users_update_own"     ON users;
DROP POLICY IF EXISTS "users_insert_service" ON users;

CREATE POLICY "users_select_own"     ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "users_select_manager" ON users FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role IN ('manager','admin','staff'))
);
CREATE POLICY "users_update_own"     ON users FOR UPDATE
  USING (auth.uid()::text = id::text) WITH CHECK (auth.uid()::text = id::text);
CREATE POLICY "users_insert_service" ON users FOR INSERT WITH CHECK (true);

-- ─── RLS: products ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "products_select_public" ON products;
CREATE POLICY "products_select_public" ON products FOR SELECT USING (true);

-- ─── RLS: staff ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_manager_all" ON staff;
CREATE POLICY "staff_manager_all" ON staff FOR ALL USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role IN ('manager','admin','staff'))
);

-- ─── RLS: staff_duties ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_duties_manager_all" ON staff_duties;
CREATE POLICY "staff_duties_manager_all" ON staff_duties FOR ALL USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role IN ('manager','admin','staff'))
);

-- ─── RLS: orders ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "orders_select_own"     ON orders;
DROP POLICY IF EXISTS "orders_select_manager" ON orders;
DROP POLICY IF EXISTS "orders_insert_customer"ON orders;
DROP POLICY IF EXISTS "orders_update_manager" ON orders;

CREATE POLICY "orders_select_own"      ON orders FOR SELECT USING (auth.uid()::text = customer_id::text);
CREATE POLICY "orders_select_manager"  ON orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role IN ('manager','admin','staff'))
);
CREATE POLICY "orders_insert_customer" ON orders FOR INSERT WITH CHECK (auth.uid()::text = customer_id::text);
CREATE POLICY "orders_update_manager"  ON orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role IN ('manager','admin','staff'))
);

-- ─── RLS: carts ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "carts_own" ON carts;
CREATE POLICY "carts_own" ON carts FOR ALL USING (auth.uid()::text = customer_id::text)
  WITH CHECK (auth.uid()::text = customer_id::text);

-- ─── RLS: messages ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_select_own"         ON messages;
DROP POLICY IF EXISTS "messages_insert_own"         ON messages;
DROP POLICY IF EXISTS "messages_select_admin_staff" ON messages;
DROP POLICY IF EXISTS "messages_update_admin_staff" ON messages;

CREATE POLICY "messages_select_own"         ON messages FOR SELECT USING (auth.uid()::text = customer_id::text);
CREATE POLICY "messages_insert_own"         ON messages FOR INSERT WITH CHECK (auth.uid()::text = customer_id::text);
CREATE POLICY "messages_select_admin_staff" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role IN ('manager','admin','staff'))
);
CREATE POLICY "messages_update_admin_staff" ON messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role IN ('manager','admin','staff'))
);

-- ─── RLS: analytics ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "analytics_manager_all" ON analytics;
CREATE POLICY "analytics_manager_all" ON analytics FOR ALL USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role IN ('manager','admin','staff'))
);

-- ─── RLS: social_posts ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "social_posts_staff_all" ON social_posts;
CREATE POLICY "social_posts_staff_all" ON social_posts FOR ALL USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role IN ('manager','admin','staff'))
);

-- ─── RLS: notifications ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notifications_staff_all" ON notifications;
CREATE POLICY "notifications_staff_all" ON notifications FOR ALL USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role IN ('manager','admin','staff'))
);

-- ─── Seed: first admin user ──────────────────────────────────────────────────
-- OPTIONAL: Insert your admin account manually.
-- Replace the email and name below, then uncomment and run.
--
-- INSERT INTO users (email, name, role) VALUES
--   ('admin@olly.com', 'OLLY Admin', 'manager')
-- ON CONFLICT (email) DO NOTHING;

-- ─── Done ────────────────────────────────────────────────────────────────────
-- All 10 tables created with indexes and RLS policies.
-- Next step: create the Storage bucket (see README.md § Supabase Storage).
