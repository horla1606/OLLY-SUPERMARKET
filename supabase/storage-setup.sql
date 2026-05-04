-- =============================================
-- OLLY SUPERMARKET — Supabase Storage Setup
-- Run in Supabase SQL Editor AFTER creating the
-- "product-images" bucket in Storage → Buckets
-- (set it to Public so images are readable without auth)
-- =============================================

-- Allow public READ on product-images bucket
CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

-- Allow authenticated managers/admin/staff to UPLOAD
CREATE POLICY "product_images_manager_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

-- Allow managers/admin/staff to REPLACE (update) images
CREATE POLICY "product_images_manager_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

-- Allow managers/admin/staff to DELETE images
CREATE POLICY "product_images_manager_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

-- ─── MANUAL STEPS (do these in Supabase Dashboard first) ────────────────────
-- 1. Go to Storage → New bucket
-- 2. Name: product-images
-- 3. Toggle "Public bucket" ON
-- 4. Then run this SQL above
