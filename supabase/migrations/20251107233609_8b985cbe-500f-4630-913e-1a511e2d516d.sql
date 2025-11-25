-- ======================================
-- ENUMS
-- ======================================

CREATE TYPE public.app_role AS ENUM ('owner', 'receptionist', 'staff');
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.payment_method AS ENUM ('cash', 'momo', 'card', 'bank_transfer');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'refunded');
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'declined', 'converted');

-- ======================================
-- USERS & ROLES
-- ====================================== 

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,  -- yes exists
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- ======================================
-- CLIENTS & STAFF
-- ======================================

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  specialization TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ======================================
-- SERVICES
-- ======================================

CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ======================================
-- BOOKINGS
-- ======================================

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ======================================
-- PAYMENTS
-- ======================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'completed',
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ======================================
-- BOOKING REQUESTS
-- ======================================

CREATE TABLE IF NOT EXISTS public.booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  preferred_date DATE,
  preferred_time TIME,
  notes TEXT,
  status request_status DEFAULT 'pending', -- pending | approved | declined | converted
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ======================================
-- ATTENDANCE
-- ======================================

CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  check_in TIMESTAMPTZ DEFAULT NOW(),
  check_out TIMESTAMPTZ,
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);



-- ======================================
-- TRIGGERS FOR updated_at
-- ======================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to all relevant tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_clients_updated_at') THEN
    CREATE TRIGGER update_clients_updated_at
      BEFORE UPDATE ON public.clients
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_staff_updated_at') THEN
    CREATE TRIGGER update_staff_updated_at
      BEFORE UPDATE ON public.staff
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_services_updated_at') THEN
    CREATE TRIGGER update_services_updated_at
      BEFORE UPDATE ON public.services
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bookings_updated_at') THEN
    CREATE TRIGGER update_bookings_updated_at
      BEFORE UPDATE ON public.bookings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_booking_requests_updated_at') THEN
    CREATE TRIGGER update_booking_requests_updated_at
      BEFORE UPDATE ON public.booking_requests
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

-- ======================================
-- FUNCTIONS
-- ======================================

-- Check if user has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Auto-create profile on new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING; -- prevent duplicates
  RETURN NEW;
END;
$$;

-- Auto-assign role for staff
CREATE OR REPLACE FUNCTION public.create_role_for_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, NEW.role::app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Auto-assign role for client
CREATE OR REPLACE FUNCTION public.create_role_for_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client'::app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Verify staff/receptionist exists before signup
CREATE OR REPLACE FUNCTION public.verify_staff_email(email_to_check TEXT, role_to_check app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF role_to_check IN ('staff', 'receptionist') THEN
    RETURN EXISTS (SELECT 1 FROM public.staff WHERE email = email_to_check);
  END IF;
  RETURN TRUE; -- Owners bypass check
END;
$$;

-- Auto-create client if not exists on booking request
CREATE OR REPLACE FUNCTION public.ensure_client_exists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  SELECT full_name, email, phone
  INTO user_profile
  FROM public.profiles
  WHERE id = NEW.client_id;

  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = NEW.client_id) THEN
    INSERT INTO public.clients (id, full_name, phone, email)
    VALUES (
      NEW.client_id,
      COALESCE(user_profile.full_name, 'Auto Created Client'),
      COALESCE(user_profile.phone, ''),
      COALESCE(user_profile.email, '')
    );
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.ensure_client_exists() OWNER TO postgres;

-- ======================================
-- TRIGGERS
-- ======================================

-- Assign roles
CREATE TRIGGER staff_role_trigger AFTER INSERT ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.create_role_for_staff();

CREATE TRIGGER client_role_trigger AFTER INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.create_role_for_client();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-create client for booking requests
CREATE TRIGGER auto_create_client BEFORE INSERT ON public.booking_requests
FOR EACH ROW EXECUTE FUNCTION public.ensure_client_exists();

-- ======================================
-- ENABLE RLS
-- ======================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ======================================
-- POLICIES
-- ======================================

-- Profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- Clients
CREATE POLICY "Authenticated users can view clients" ON public.clients
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert via trigger" ON public.clients
FOR INSERT TO authenticated WITH CHECK (true);

-- Staff
CREATE POLICY "Authenticated users can view staff" ON public.staff
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage staff" ON public.staff
FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- Services
CREATE POLICY "Authenticated users can view services" ON public.services
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage services" ON public.services
FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- Bookings
CREATE POLICY "Authenticated users can view own bookings" ON public.bookings
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners & receptionists can manage bookings" ON public.bookings
FOR ALL USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));

-- Payments
CREATE POLICY "Authenticated users can view own payments" ON public.payments
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners & receptionists can manage payments" ON public.payments
FOR ALL USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));

-- Booking requests
CREATE POLICY "Clients can create booking requests" ON public.booking_requests
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Clients can view own requests" ON public.booking_requests
FOR SELECT TO authenticated USING (client_id = auth.uid());

CREATE POLICY "Admins can manage all booking requests" ON public.booking_requests
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));

-- Attendance
CREATE POLICY "Admins can manage all attendance" ON public.attendance
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));

CREATE POLICY "Clients can view their own booking requests" ON public.attendance
FOR SELECT TO authenticated USING (staff_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));

CREATE POLICY "Staff can check themselves out" ON public.attendance
FOR UPDATE TO authenticated USING (staff_id = auth.uid())
WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Owners and receptionists can check in staff" ON public.attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'owner')
    OR public.has_role((SELECT auth.uid()), 'receptionist')
  );

-- ======================================
-- INDEXES
-- ======================================

CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(appointment_date);
CREATE INDEX IF NOT EXISTS idx_bookings_client ON public.bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_staff ON public.bookings(staff_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_id ON public.attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_checkin ON public.attendance(check_in);
