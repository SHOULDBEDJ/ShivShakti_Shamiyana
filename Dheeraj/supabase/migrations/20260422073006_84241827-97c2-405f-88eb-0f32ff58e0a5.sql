-- Add rating columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_rating text,
  ADD COLUMN IF NOT EXISTS rating_evaluated_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating_reason text;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS latest_rating text,
  ADD COLUMN IF NOT EXISTS green_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orange_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS red_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_override text;

-- Evaluation function
CREATE OR REPLACE FUNCTION public.evaluate_booking_rating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total numeric := 0;
  v_paid numeric := 0;
  v_pending numeric := 0;
  v_event_end date;
  v_last_payment_date date;
  v_payment_count int := 0;
  v_days_late int := 0;
  v_rating text;
  v_reason text;
  v_payments jsonb;
  v_old_rating text;
BEGIN
  -- Only evaluate when status transitions to Completed (or Returned/Delivered as completion-equivalent)
  IF NEW.status IS DISTINCT FROM 'Completed' THEN
    RETURN NEW;
  END IF;

  -- If already evaluated and unchanged, skip
  IF OLD.status = 'Completed' AND OLD.payment_rating IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_total := COALESCE((NEW.pricing->>'totalAmount')::numeric, 0);
  v_paid := COALESCE(NEW.total_paid, 0);
  v_pending := GREATEST(0, v_total - v_paid);
  v_event_end := NEW.end_date;
  v_payments := COALESCE(NEW.payments, '[]'::jsonb);
  v_payment_count := jsonb_array_length(v_payments);

  -- Last payment date from payments array
  IF v_payment_count > 0 THEN
    SELECT MAX((p->>'date')::date)
    INTO v_last_payment_date
    FROM jsonb_array_elements(v_payments) AS p
    WHERE p->>'date' IS NOT NULL;
  END IF;

  -- Days late (last payment after event end)
  IF v_last_payment_date IS NOT NULL AND v_event_end IS NOT NULL THEN
    v_days_late := GREATEST(0, v_last_payment_date - v_event_end);
  END IF;

  -- Decision logic
  IF v_pending > 0 OR v_days_late > 14 THEN
    v_rating := 'red';
    v_reason := CASE
      WHEN v_pending > 0 THEN 'Outstanding balance after completion'
      ELSE 'Significant payment delay (>14 days)'
    END;
  ELSIF v_payment_count > 1 OR v_days_late > 0 THEN
    v_rating := 'orange';
    v_reason := CASE
      WHEN v_days_late > 0 THEN 'Minor delay in final payment'
      ELSE 'Multiple partial payments'
    END;
  ELSE
    v_rating := 'green';
    v_reason := 'Paid in full on time';
  END IF;

  NEW.payment_rating := v_rating;
  NEW.rating_evaluated_at := now();
  NEW.rating_reason := v_reason;

  -- Update customer aggregates
  IF NEW.customer_id IS NOT NULL THEN
    v_old_rating := OLD.payment_rating;

    UPDATE public.customers
    SET
      latest_rating = v_rating,
      green_count = green_count + CASE WHEN v_rating = 'green' THEN 1 ELSE 0 END
                                 - CASE WHEN v_old_rating = 'green' THEN 1 ELSE 0 END,
      orange_count = orange_count + CASE WHEN v_rating = 'orange' THEN 1 ELSE 0 END
                                  - CASE WHEN v_old_rating = 'orange' THEN 1 ELSE 0 END,
      red_count = red_count + CASE WHEN v_rating = 'red' THEN 1 ELSE 0 END
                            - CASE WHEN v_old_rating = 'red' THEN 1 ELSE 0 END,
      updated_at = now()
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evaluate_booking_rating ON public.bookings;
CREATE TRIGGER trg_evaluate_booking_rating
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.evaluate_booking_rating();