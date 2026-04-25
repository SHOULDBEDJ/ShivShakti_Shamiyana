-- Inventory: bilingual + dual pricing + low stock threshold
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS name_kn text,
  ADD COLUMN IF NOT EXISTS price_takeaway numeric,
  ADD COLUMN IF NOT EXISTS price_delivery numeric,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 0;

-- Backfill new price columns from existing single price
UPDATE public.inventory_items
SET price_takeaway = COALESCE(price_takeaway, price),
    price_delivery = COALESCE(price_delivery, price)
WHERE price_takeaway IS NULL OR price_delivery IS NULL;

-- Categories: bilingual + subcategory support
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS name_kn text,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);

-- Function types: bilingual
ALTER TABLE public.function_types
  ADD COLUMN IF NOT EXISTS title_kn text;

-- Bookings: delivery mode + event time + public reference id
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'Delivery',
  ADD COLUMN IF NOT EXISTS event_time text,
  ADD COLUMN IF NOT EXISTS reference_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_reference ON public.bookings(reference_id) WHERE reference_id IS NOT NULL;

-- Expense types table
CREATE TABLE IF NOT EXISTS public.expense_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_kn text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.expense_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read expense_types" ON public.expense_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert expense_types" ON public.expense_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update expense_types" ON public.expense_types FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete expense_types" ON public.expense_types FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER trg_expense_types_updated
  BEFORE UPDATE ON public.expense_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Business profile (single row)
CREATE TABLE IF NOT EXISTS public.business_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text,
  owner_name text,
  phone text,
  address text,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read business_profile" ON public.business_profile FOR SELECT USING (true);
CREATE POLICY "auth insert business_profile" ON public.business_profile FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update business_profile" ON public.business_profile FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete business_profile" ON public.business_profile FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER trg_business_profile_updated
  BEFORE UPDATE ON public.business_profile
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket for profile photos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read profile photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

CREATE POLICY "auth upload profile photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-photos');

CREATE POLICY "auth update profile photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-photos');

CREATE POLICY "auth delete profile photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-photos');

-- Helper: generate REF-XXXXXX reference IDs for public bookings
CREATE OR REPLACE FUNCTION public.next_reference_id()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  ref text;
  exists_count int;
BEGIN
  LOOP
    ref := 'REF-' || lpad((floor(random() * 1000000))::int::text, 6, '0');
    SELECT count(*) INTO exists_count FROM public.bookings WHERE reference_id = ref;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN ref;
END;
$$;