CREATE OR REPLACE FUNCTION public.next_reference_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
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