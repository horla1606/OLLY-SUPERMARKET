-- =============================================
-- OLLY SUPERMARKET - Row Level Security Policies
-- Run AFTER schema.sql in Supabase SQL Editor
-- =============================================

-- =============================================
-- USERS TABLE POLICIES
-- =============================================

-- Users can read their own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Admins can read all users
CREATE POLICY "users_select_admin" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role = 'admin'
    )
  );

-- Users can update their own profile (non-sensitive fields)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- Backend service role handles inserts (registration)
CREATE POLICY "users_insert_service" ON users
  FOR INSERT WITH CHECK (true);

-- =============================================
-- PRODUCTS TABLE POLICIES
-- =============================================

-- Anyone (including unauthenticated) can browse products
CREATE POLICY "products_select_public" ON products
  FOR SELECT USING (true);

-- Only admins and staff can add products
CREATE POLICY "products_insert_admin_staff" ON products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role IN ('admin', 'staff')
    )
  );

-- Only admins and staff can update products
CREATE POLICY "products_update_admin_staff" ON products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role IN ('admin', 'staff')
    )
  );

-- Only admins can delete products
CREATE POLICY "products_delete_admin" ON products
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role = 'admin'
    )
  );

-- =============================================
-- ORDERS TABLE POLICIES
-- =============================================

-- Customers can read their own orders
CREATE POLICY "orders_select_own" ON orders
  FOR SELECT USING (auth.uid()::text = customer_id::text);

-- Admins and staff can read all orders
CREATE POLICY "orders_select_admin_staff" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role IN ('admin', 'staff')
    )
  );

-- Customers can create their own orders
CREATE POLICY "orders_insert_customer" ON orders
  FOR INSERT WITH CHECK (auth.uid()::text = customer_id::text);

-- Admins and staff can update order status
CREATE POLICY "orders_update_admin_staff" ON orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role IN ('admin', 'staff')
    )
  );

-- Only admins can cancel/delete orders
CREATE POLICY "orders_delete_admin" ON orders
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role = 'admin'
    )
  );

-- =============================================
-- CARTS TABLE POLICIES
-- =============================================

CREATE POLICY "carts_select_own" ON carts
  FOR SELECT USING (auth.uid()::text = customer_id::text);

CREATE POLICY "carts_insert_own" ON carts
  FOR INSERT WITH CHECK (auth.uid()::text = customer_id::text);

CREATE POLICY "carts_update_own" ON carts
  FOR UPDATE USING (auth.uid()::text = customer_id::text);

CREATE POLICY "carts_delete_own" ON carts
  FOR DELETE USING (auth.uid()::text = customer_id::text);

-- =============================================
-- STAFF TABLE POLICIES
-- =============================================

-- Only admins can manage staff records
CREATE POLICY "staff_select_admin" ON staff
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role = 'admin'
    )
  );

CREATE POLICY "staff_insert_admin" ON staff
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role = 'admin'
    )
  );

CREATE POLICY "staff_update_admin" ON staff
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role = 'admin'
    )
  );

CREATE POLICY "staff_delete_admin" ON staff
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role = 'admin'
    )
  );

-- =============================================
-- MESSAGES TABLE POLICIES
-- =============================================

-- Customers can send and view their own messages
CREATE POLICY "messages_select_own" ON messages
  FOR SELECT USING (auth.uid()::text = customer_id::text);

CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT WITH CHECK (auth.uid()::text = customer_id::text);

-- Admins and staff can view and manage all messages
CREATE POLICY "messages_select_admin_staff" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "messages_update_admin_staff" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role IN ('admin', 'staff')
    )
  );

-- =============================================
-- ANALYTICS TABLE POLICIES
-- =============================================

-- Only admins and staff can view and manage analytics
CREATE POLICY "analytics_select_admin_staff" ON analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "analytics_insert_admin_staff" ON analytics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "analytics_update_admin_staff" ON analytics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text AND u.role IN ('admin', 'staff')
    )
  );
