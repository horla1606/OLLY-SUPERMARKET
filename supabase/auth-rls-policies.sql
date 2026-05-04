-- =============================================
-- OLLY SUPERMARKET — Auth-specific RLS Policies
-- Replaces the generic user policies in rls-policies.sql.
-- Run AFTER schema.sql and migrations/001_passwordless_auth.sql
-- =============================================

-- ─── Clean up any old user policies ─────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_own"     ON users;
DROP POLICY IF EXISTS "users_select_admin"   ON users;
DROP POLICY IF EXISTS "users_select_manager" ON users;
DROP POLICY IF EXISTS "users_update_own"     ON users;
DROP POLICY IF EXISTS "users_insert_service" ON users;

-- ─── USERS TABLE ─────────────────────────────────────────────────────────────

-- Rule 1: Users can only read their own data
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Rule 2: Managers (role = 'manager' | 'admin' | 'staff') can read ALL customer data
CREATE POLICY "users_select_manager" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

-- Users can update their own profile fields (name, phone)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- Backend service-role key handles inserts (signup endpoint)
CREATE POLICY "users_insert_service" ON users
  FOR INSERT WITH CHECK (true);

-- ─── PRODUCTS TABLE ──────────────────────────────────────────────────────────

-- Public access to products (read-only) — no authentication required
DROP POLICY IF EXISTS "products_select_public" ON products;

CREATE POLICY "products_select_public" ON products
  FOR SELECT USING (true);

-- ─── ORDERS TABLE ────────────────────────────────────────────────────────────
-- (These extend the base policies from rls-policies.sql)

DROP POLICY IF EXISTS "orders_select_own"           ON orders;
DROP POLICY IF EXISTS "orders_select_admin_staff"    ON orders;
DROP POLICY IF EXISTS "orders_insert_customer"       ON orders;
DROP POLICY IF EXISTS "orders_update_admin_staff"    ON orders;

-- Customers see their own orders
CREATE POLICY "orders_select_own" ON orders
  FOR SELECT USING (auth.uid()::text = customer_id::text);

-- Managers/staff see all orders
CREATE POLICY "orders_select_manager" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );

-- Customers can place orders
CREATE POLICY "orders_insert_customer" ON orders
  FOR INSERT WITH CHECK (auth.uid()::text = customer_id::text);

-- Managers/staff can update order status
CREATE POLICY "orders_update_manager" ON orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager', 'admin', 'staff')
    )
  );
