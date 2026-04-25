
-- 1) Drop user_permissions table (Users module removed)
DROP TABLE IF EXISTS public.user_permissions;

-- 2) Gallery categories
CREATE TABLE IF NOT EXISTS public.gallery_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read gallery_categories"
  ON public.gallery_categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "admin insert gallery_categories"
  ON public.gallery_categories FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "admin update gallery_categories"
  ON public.gallery_categories FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "admin delete gallery_categories"
  ON public.gallery_categories FOR DELETE
  TO authenticated
  USING (is_admin());

-- 3) Add category_id to gallery_photos
ALTER TABLE public.gallery_photos
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.gallery_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gallery_photos_category ON public.gallery_photos(category_id);

-- 4) Rotate admin password to SQPLUADD
UPDATE auth.users
SET encrypted_password = crypt('SQPLUADD', gen_salt('bf')),
    updated_at = now()
WHERE email = 'admin@shamiyana.local';
