-- Migration: Prevent bookings and booking requests from being scheduled on Sundays
DO $$
BEGIN
  -- bookings.appointment_date should not be a Sunday (Postgres DOW: Sunday = 0)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bookings_not_sunday'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT chk_bookings_not_sunday CHECK (EXTRACT(DOW FROM appointment_date) <> 0);
  END IF;

  -- booking_requests.preferred_date (or appointment_date in some flows) should not be Sunday
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_booking_requests_not_sunday'
  ) THEN
    -- Use preferred_date if present, otherwise fall back to appointment_date
    ALTER TABLE public.booking_requests
      ADD CONSTRAINT chk_booking_requests_not_sunday CHECK (
        COALESCE(preferred_date, appointment_date) IS NULL OR EXTRACT(DOW FROM COALESCE(preferred_date, appointment_date)) <> 0
      );
  END IF;
END$$;
