-- Migration: Add staff scheduling, services assignment, statuses, and specializations
-- Generated: 2025-12-31

-- 1) Create staff_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_status') THEN
    CREATE TYPE public.staff_status AS ENUM ('active','inactive','on_leave','suspended');
  END IF;
END$$;

-- 2) Add status column to staff (idempotent) and backfill from is_active if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff'
  ) THEN
    -- Add status column if missing
    ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS status public.staff_status DEFAULT 'active';

    -- Backfill from is_active when present
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='staff' AND column_name='is_active'
    ) THEN
      UPDATE public.staff SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END WHERE status IS NULL;
      -- optionally drop is_active column
      ALTER TABLE public.staff DROP COLUMN IF EXISTS is_active;
    END IF;
  END IF;
END$$;

-- 3) Specializations table and migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='specializations'
  ) THEN
    CREATE TABLE public.specializations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;

  -- Add specialization_id to staff if missing
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff'
  ) THEN
    ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS specialization_id uuid REFERENCES public.specializations(id) ON DELETE SET NULL;

    -- Migrate existing specialization text into specializations table
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='staff' AND column_name='specialization'
    ) THEN
      -- Insert distinct non-null specialization names
      INSERT INTO public.specializations(name)
      SELECT DISTINCT specialization FROM public.staff WHERE specialization IS NOT NULL AND specialization <> ''
      ON CONFLICT (name) DO NOTHING;

      -- Update staff.specialization_id based on inserted rows
      UPDATE public.staff s
      SET specialization_id = sp.id
      FROM public.specializations sp
      WHERE s.specialization IS NOT NULL AND s.specialization <> '' AND sp.name = s.specialization;

      -- Drop the old specialization text column
      ALTER TABLE public.staff DROP COLUMN IF EXISTS specialization;
    END IF;
  END IF;
END$$;

-- 4) Staff <-> Services assignment table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff_services'
  ) THEN
    CREATE TABLE public.staff_services (
      staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
      service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
      PRIMARY KEY (staff_id, service_id),
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END$$;

-- 5) Working hours table (recurring weekly schedule)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff_working_hours'
  ) THEN
    CREATE TABLE public.staff_working_hours (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
      day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday .. 6=Saturday
      start_time time NOT NULL,
      end_time time NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END$$;

-- 6) Off days (single-date exceptions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff_off_days'
  ) THEN
    CREATE TABLE public.staff_off_days (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
      off_date date NOT NULL,
      reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (staff_id, off_date)
    );
  END IF;
END$$;

-- 7) Indexes to help common queries
CREATE INDEX IF NOT EXISTS idx_staff_status ON public.staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_services_service_id ON public.staff_services(service_id);
CREATE INDEX IF NOT EXISTS idx_staff_working_hours_staff_id ON public.staff_working_hours(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_off_days_staff_id ON public.staff_off_days(staff_id);

-- 8) Optional: grant basic privileges to authenticated (leave deployment owners to adjust)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.specializations TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_services TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_working_hours TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_off_days TO authenticated;

-- End migration
