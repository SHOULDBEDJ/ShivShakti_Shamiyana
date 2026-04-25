-- 1) Bookings: borrow flag + vendor borrow assignments
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS borrow_needed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vendor_borrows jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Gallery photos table
CREATE TABLE IF NOT EXISTS public.gallery_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text,
  image_url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read published gallery"
  ON public.gallery_photos FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

CREATE POLICY "auth read all gallery"
  ON public.gallery_photos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth insert gallery"
  ON public.gallery_photos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth update gallery"
  ON public.gallery_photos FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "admin delete gallery"
  ON public.gallery_photos FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE TRIGGER gallery_photos_touch
  BEFORE UPDATE ON public.gallery_photos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Public storage bucket for gallery
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Gallery images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');

CREATE POLICY "Auth upload gallery"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gallery');

CREATE POLICY "Auth update gallery"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'gallery');

CREATE POLICY "Auth delete gallery"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'gallery');