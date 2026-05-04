-- Migration 003: Messaging enhancements + social_posts + notifications

-- Add reply fields to existing messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply        TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS replied_at   TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS replied_by   UUID REFERENCES users(id) ON DELETE SET NULL;

-- Social media scheduled posts
CREATE TABLE IF NOT EXISTS social_posts (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform       VARCHAR(20)  NOT NULL CHECK (platform IN ('facebook','instagram','twitter')),
  content        TEXT         NOT NULL,
  image_url      TEXT,
  scheduled_date TIMESTAMPTZ,
  status         VARCHAR(20)  NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','scheduled','posted','failed')),
  product_id     UUID         REFERENCES products(id) ON DELETE SET NULL,
  created_by     UUID         REFERENCES users(id)    ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Product / promotional notification log
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        VARCHAR(30)  NOT NULL DEFAULT 'product',
  title       TEXT         NOT NULL,
  content     TEXT         NOT NULL,
  product_id  UUID         REFERENCES products(id) ON DELETE SET NULL,
  sent_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  sent_count  INTEGER      NOT NULL DEFAULT 0,
  created_by  UUID         REFERENCES users(id) ON DELETE SET NULL
);

-- RLS
ALTER TABLE social_posts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;

-- Managers / admins / staff can do everything on social_posts
CREATE POLICY "social_posts_staff_all" ON social_posts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager','admin','staff')
    )
  );

-- Managers / admins / staff can do everything on notifications
CREATE POLICY "notifications_staff_all" ON notifications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('manager','admin','staff')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_social_posts_status    ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at  ON notifications(sent_at);
