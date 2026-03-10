-- ============================================================================
-- ZOLARA BEAUTY STUDIO - COMPLETE DATABASE SCHEMA
-- Run this entire file in your new Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: ENUMS
-- ============================================================================

CREATE TYPE public.app_role AS ENUM ('owner', 'receptionist', 'staff', 'client');
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.payment_method AS ENUM ('cash', 'momo', 'card', 'bank_transfer');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'refunded');
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'declined', 'converted');

DO $$ BEGIN
  CREATE TYPE gift_card_status AS ENUM ('unused', 'redeemed', 'expired', 'void');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- STEP 2: CORE TABLES
-- ============================================================================

-- Profiles (auto-created on auth signup)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  birthday DATE,
  anniversary DATE,
  prefers_birthday_sms BOOLEAN DEFAULT true,
  prefers_anniversary_sms BOOLEAN DEFAULT true,
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

-- Clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Staff
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  role app_role DEFAULT 'staff',
  specialization TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Services
CREATE TABLE public.services (
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

-- Bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  final_price DECIMAL(10,2),
  is_recurring BOOLEAN DEFAULT false,
  recurring_type TEXT CHECK (recurring_type IN ('weekly', 'biweekly', 'monthly', 'custom')),
  recurring_interval INTEGER,
  recurring_end_date DATE,
  parent_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_bookings_not_sunday CHECK (EXTRACT(DOW FROM appointment_date) <> 0)
);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'completed',
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Booking requests (from public booking page)
CREATE TABLE public.booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  preferred_date DATE,
  preferred_time TIME,
  notes TEXT,
  status request_status DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_booking_requests_not_sunday CHECK (
    preferred_date IS NULL OR EXTRACT(DOW FROM preferred_date) <> 0
  )
);

-- Attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  check_in TIMESTAMPTZ DEFAULT NOW(),
  check_out TIMESTAMPTZ,
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings (salon configuration)
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_name TEXT DEFAULT 'Zolara Beauty Studio',
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  opening_time TIME DEFAULT '08:30',
  closing_time TIME DEFAULT '21:00',
  currency TEXT DEFAULT 'GHS',
  booking_buffer_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: GIFT CARDS
-- ============================================================================

CREATE TABLE public.gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  final_code TEXT UNIQUE NOT NULL,
  tier TEXT,
  year INT,
  batch TEXT,
  card_value NUMERIC DEFAULT 0,
  status gift_card_status DEFAULT 'unused',
  expires_at TIMESTAMPTZ,
  allowed_service_ids UUID[],
  allowed_service_categories TEXT[],
  created_by UUID REFERENCES auth.users(id),
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES auth.users(id),
  redeemed_booking_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.gift_card_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id UUID REFERENCES public.gift_cards(id) ON DELETE SET NULL,
  final_code TEXT NOT NULL,
  redeemed_by UUID REFERENCES auth.users(id),
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  booking_id UUID,
  client_id UUID,
  note TEXT
);

-- ============================================================================
-- STEP 4: ADVANCED FEATURES
-- ============================================================================

-- Waitlist
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  preferred_date DATE NOT NULL,
  preferred_time TIME NOT NULL,
  alternative_dates DATE[] DEFAULT '{}',
  priority INTEGER DEFAULT 1,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'expired', 'cancelled')),
  notification_sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  client_phone TEXT,
  client_name TEXT,
  client_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service add-ons
CREATE TABLE public.service_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration_minutes INTEGER DEFAULT 15,
  category TEXT DEFAULT 'general' CHECK (category IN ('nails', 'hair', 'beauty', 'general')),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.service_addon_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES public.service_addons(id) ON DELETE CASCADE,
  UNIQUE(service_id, addon_id)
);

CREATE TABLE public.booking_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES public.service_addons(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  price_paid DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client special dates
CREATE TABLE public.client_special_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  occasion_type TEXT NOT NULL CHECK (occasion_type IN ('birthday', 'anniversary', 'custom')),
  date_value DATE NOT NULL,
  description TEXT,
  send_reminder BOOLEAN DEFAULT true,
  reminder_days_before INTEGER DEFAULT 7,
  last_reminder_sent DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service packages
CREATE TABLE public.service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  total_price DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  validity_months INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.package_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES public.service_packages(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  UNIQUE(package_id, service_id)
);

CREATE TABLE public.package_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.service_packages(id) ON DELETE CASCADE,
  purchase_date TIMESTAMPTZ DEFAULT NOW(),
  expiry_date DATE,
  total_paid DECIMAL(10,2),
  services_used INTEGER DEFAULT 0,
  services_total INTEGER,
  is_active BOOLEAN DEFAULT true
);

-- Client notes
CREATE TABLE public.client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'medical', 'preference', 'behavior', 'allergy')),
  content TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.client_service_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  last_visit_date TIMESTAMPTZ,
  total_visits INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  preferred_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  average_rating DECIMAL(3,2),
  last_rating INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, service_id)
);

-- SMS campaigns
CREATE TABLE public.sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('booking_reminder', 'birthday', 'anniversary', 'follow_up', 'promotional', 'waitlist')),
  send_hours_before INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.sms_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  campaign_id UUID REFERENCES public.sms_campaigns(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promotional codes
CREATE TABLE public.promotional_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value DECIMAL(10,2) NOT NULL,
  minimum_amount DECIMAL(10,2) DEFAULT 0,
  maximum_discount DECIMAL(10,2),
  max_uses INTEGER,
  max_uses_per_client INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  applicable_services UUID[] DEFAULT '{}',
  applicable_categories TEXT[] DEFAULT '{}',
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.promo_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID REFERENCES public.promotional_codes(id) ON DELETE CASCADE,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  discount_applied DECIMAL(10,2),
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp
CREATE TABLE public.whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  display_name TEXT,
  is_opted_in BOOLEAN DEFAULT false,
  opted_in_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(phone_number)
);

CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  message_type TEXT CHECK (message_type IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  wa_message_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics
CREATE TABLE public.business_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  metric_type TEXT NOT NULL,
  value DECIMAL(15,2) DEFAULT 0,
  additional_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, metric_type)
);

CREATE TABLE public.client_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_spent DECIMAL(10,2) DEFAULT 0,
  total_visits INTEGER DEFAULT 0,
  average_booking_value DECIMAL(10,2) DEFAULT 0,
  first_visit_date DATE,
  last_visit_date DATE,
  client_tier TEXT DEFAULT 'new' CHECK (client_tier IN ('new', 'regular', 'vip', 'platinum')),
  loyalty_points INTEGER DEFAULT 0,
  last_calculated TIMESTAMPTZ DEFAULT NOW()
);

-- E-commerce
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE,
  parent_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  sku TEXT UNIQUE,
  barcode TEXT,
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  weight DECIMAL(8,3),
  images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  requires_shipping BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  price DECIMAL(10,2),
  stock_quantity INTEGER DEFAULT 0,
  attributes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, product_id, variant_id)
);

CREATE SEQUENCE IF NOT EXISTS order_sequence START 1000;

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  subtotal DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_method TEXT,
  shipping_address JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  product_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment methods & transactions
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mobile_money', 'card', 'bank_transfer', 'cash')),
  is_active BOOLEAN DEFAULT true,
  supports_refunds BOOLEAN DEFAULT false,
  processing_fee_percentage DECIMAL(5,4) DEFAULT 0,
  minimum_amount DECIMAL(10,2) DEFAULT 0,
  maximum_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('booking', 'product', 'subscription', 'gift_card', 'refund')),
  related_id UUID,
  amount DECIMAL(10,2) NOT NULL,
  fee_amount DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2),
  currency TEXT DEFAULT 'GHS',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  provider_transaction_id TEXT,
  provider_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  price DECIMAL(10,2) NOT NULL,
  setup_fee DECIMAL(10,2) DEFAULT 0,
  trial_days INTEGER DEFAULT 0,
  max_services_per_cycle INTEGER,
  included_services UUID[] DEFAULT '{}',
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  features TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('trial', 'active', 'paused', 'cancelled', 'expired')),
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  services_used_this_cycle INTEGER DEFAULT 0,
  last_payment_date TIMESTAMPTZ,
  next_payment_date TIMESTAMPTZ,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  cycle_start_date TIMESTAMPTZ NOT NULL,
  cycle_end_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 5: INDEXES
-- ============================================================================

CREATE INDEX idx_bookings_date ON public.bookings(appointment_date);
CREATE INDEX idx_bookings_client ON public.bookings(client_id);
CREATE INDEX idx_bookings_staff ON public.bookings(staff_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_payments_booking ON public.payments(booking_id);
CREATE INDEX idx_payments_date ON public.payments(payment_date);
CREATE INDEX idx_attendance_staff_id ON public.attendance(staff_id);
CREATE INDEX idx_attendance_checkin ON public.attendance(check_in);
CREATE INDEX idx_waitlist_status ON public.waitlist(status);
CREATE INDEX idx_waitlist_date ON public.waitlist(preferred_date);
CREATE INDEX idx_client_notes_client ON public.client_notes(client_id);
CREATE INDEX idx_sms_queue_scheduled ON public.sms_queue(scheduled_for, status);
CREATE INDEX idx_client_analytics_tier ON public.client_analytics(client_tier);
CREATE INDEX idx_products_category ON public.products(category_id, is_active);
CREATE INDEX idx_orders_status ON public.orders(status, created_at);
CREATE INDEX idx_subscriptions_client ON public.subscriptions(client_id, status);
CREATE INDEX idx_business_metrics_date ON public.business_metrics(date, metric_type);

-- ============================================================================
-- STEP 6: FUNCTIONS
-- ============================================================================

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- Check role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Get caller role
CREATE OR REPLACE FUNCTION public.get_caller_role()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  user_count INTEGER;
  assigned_role app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), NEW.email);

  SELECT COUNT(*) INTO user_count FROM auth.users;

  IF user_count = 1 THEN
    assigned_role := 'owner'::app_role;
  ELSE
    assigned_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'client'::app_role);
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END; $$;

-- Gift card helper functions
CREATE OR REPLACE FUNCTION public.normalize_gift_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.final_code = UPPER(TRIM(NEW.final_code)); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Order number generator
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.order_number = 'ZOL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_sequence')::TEXT, 4, '0');
  RETURN NEW;
END; $$;

-- Auto-create client for booking requests
CREATE OR REPLACE FUNCTION public.ensure_client_exists()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE user_profile RECORD;
BEGIN
  SELECT full_name, email, phone INTO user_profile FROM public.profiles WHERE id = NEW.client_id;
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = NEW.client_id) THEN
    INSERT INTO public.clients (id, full_name, phone, email)
    VALUES (NEW.client_id, COALESCE(user_profile.full_name, 'Auto Created Client'), COALESCE(user_profile.phone, ''), COALESCE(user_profile.email, ''));
  END IF;
  RETURN NEW;
END; $$;

-- Client analytics updater
CREATE OR REPLACE FUNCTION update_client_analytics()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  client_uuid UUID;
  total_spent_calc DECIMAL(10,2);
  total_visits_calc INTEGER;
  avg_booking_calc DECIMAL(10,2);
  first_visit_calc DATE;
  last_visit_calc DATE;
BEGIN
  client_uuid := COALESCE(NEW.client_id, OLD.client_id);
  IF client_uuid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT COALESCE(SUM(final_price), 0), COUNT(*), COALESCE(AVG(final_price), 0), MIN(appointment_date)::DATE, MAX(appointment_date)::DATE
  INTO total_spent_calc, total_visits_calc, avg_booking_calc, first_visit_calc, last_visit_calc
  FROM bookings WHERE client_id = client_uuid AND status = 'completed';

  INSERT INTO client_analytics (client_id, total_spent, total_visits, average_booking_value, first_visit_date, last_visit_date, last_calculated)
  VALUES (client_uuid, total_spent_calc, total_visits_calc, avg_booking_calc, first_visit_calc, last_visit_calc, NOW())
  ON CONFLICT (client_id) DO UPDATE SET
    total_spent = EXCLUDED.total_spent, total_visits = EXCLUDED.total_visits,
    average_booking_value = EXCLUDED.average_booking_value, first_visit_date = EXCLUDED.first_visit_date,
    last_visit_date = EXCLUDED.last_visit_date, last_calculated = NOW();

  RETURN COALESCE(NEW, OLD);
END; $$;

-- Gift card validate
CREATE OR REPLACE FUNCTION public.rpc_validate_gift_card(p_code TEXT)
RETURNS TABLE(valid BOOLEAN, message TEXT, gift_card JSONB) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_card gift_cards%ROWTYPE;
BEGIN
  SELECT * INTO v_card FROM gift_cards WHERE final_code = UPPER(TRIM(p_code));
  IF v_card.id IS NULL THEN RETURN QUERY SELECT false, 'Gift card not found', NULL; RETURN; END IF;
  IF v_card.status != 'unused' THEN RETURN QUERY SELECT false, 'Gift card is ' || v_card.status::TEXT, to_jsonb(v_card); RETURN; END IF;
  IF v_card.expires_at IS NOT NULL AND v_card.expires_at < now() THEN RETURN QUERY SELECT false, 'Gift card expired', to_jsonb(v_card); RETURN; END IF;
  RETURN QUERY SELECT true, 'Valid', to_jsonb(v_card);
END; $$;

-- Gift card redeem
CREATE OR REPLACE FUNCTION public.rpc_redeem_gift_card(p_code TEXT, p_booking_id UUID DEFAULT NULL, p_client_id UUID DEFAULT NULL)
RETURNS TABLE(success BOOLEAN, message TEXT, gift_card JSONB) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_role TEXT; v_card gift_cards%ROWTYPE;
BEGIN
  SELECT get_caller_role() INTO v_role;
  IF v_role NOT IN ('owner','receptionist') THEN RETURN QUERY SELECT false, 'Access denied', NULL; RETURN; END IF;
  SELECT * INTO v_card FROM gift_cards WHERE final_code = UPPER(TRIM(p_code));
  IF v_card.id IS NULL THEN RETURN QUERY SELECT false, 'Gift card not found', NULL; RETURN; END IF;
  IF v_card.status != 'unused' THEN RETURN QUERY SELECT false, 'Already used', to_jsonb(v_card); RETURN; END IF;
  UPDATE gift_cards SET status = 'redeemed', redeemed_at = now(), redeemed_by = auth.uid(), redeemed_booking_id = p_booking_id WHERE id = v_card.id RETURNING * INTO v_card;
  INSERT INTO gift_card_redemptions (gift_card_id, final_code, redeemed_by, booking_id, client_id) VALUES (v_card.id, v_card.final_code, auth.uid(), p_booking_id, p_client_id);
  RETURN QUERY SELECT true, 'Redeemed successfully', to_jsonb(v_card);
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_void_gift_card(p_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF get_caller_role() != 'owner' THEN RETURN QUERY SELECT false, 'Owner only'; RETURN; END IF;
  UPDATE gift_cards SET status = 'void' WHERE id = p_id;
  RETURN QUERY SELECT true, 'Voided';
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_delete_gift_card(p_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF get_caller_role() != 'owner' THEN RETURN QUERY SELECT false, 'Owner only'; RETURN; END IF;
  DELETE FROM gift_cards WHERE id = p_id AND status = 'unused';
  RETURN QUERY SELECT true, 'Deleted';
END; $$;

-- ============================================================================
-- STEP 7: TRIGGERS
-- ============================================================================

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER auto_create_client BEFORE INSERT ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.ensure_client_exists();
CREATE TRIGGER generate_order_number_trigger BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();
CREATE TRIGGER update_client_analytics_trigger AFTER INSERT OR UPDATE OR DELETE ON public.bookings FOR EACH ROW EXECUTE FUNCTION update_client_analytics();
CREATE TRIGGER trg_gift_cards_updated BEFORE UPDATE ON public.gift_cards FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_gift_code_normalize BEFORE INSERT OR UPDATE ON public.gift_cards FOR EACH ROW EXECUTE FUNCTION normalize_gift_code();

-- updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_requests_updated_at BEFORE UPDATE ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_service_addons_updated_at BEFORE UPDATE ON public.service_addons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_notes_updated_at BEFORE UPDATE ON public.client_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 8: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_addon_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_special_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_service_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotional_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: RLS POLICIES
-- ============================================================================

-- Profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Owners can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'owner'));

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- Clients
CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage clients" ON public.clients FOR ALL USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));
CREATE POLICY "Allow insert via trigger" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);

-- Staff
CREATE POLICY "Authenticated users can view staff" ON public.staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can manage staff" ON public.staff FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- Services
CREATE POLICY "Anyone can view active services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Owners can manage services" ON public.services FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- Bookings
CREATE POLICY "Authenticated users can view bookings" ON public.bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners and receptionists can manage bookings" ON public.bookings FOR ALL USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));

-- Payments
CREATE POLICY "Authenticated users can view payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners and receptionists can manage payments" ON public.payments FOR ALL USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));

-- Booking requests
CREATE POLICY "Clients can create booking requests" ON public.booking_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Clients can view own requests" ON public.booking_requests FOR SELECT TO authenticated USING (client_id = auth.uid());
CREATE POLICY "Admins can manage all booking requests" ON public.booking_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));

-- Attendance
CREATE POLICY "Admins manage attendance" ON public.attendance FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));
CREATE POLICY "Staff view own attendance" ON public.attendance FOR SELECT TO authenticated USING (staff_id = auth.uid() OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));
CREATE POLICY "Staff check themselves out" ON public.attendance FOR UPDATE TO authenticated USING (staff_id = auth.uid());
CREATE POLICY "Owners check in staff" ON public.attendance FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));

-- Settings
CREATE POLICY "Authenticated users can view settings" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can manage settings" ON public.settings FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- Reviews
CREATE POLICY "Anyone can view approved reviews" ON public.reviews FOR SELECT USING (is_approved = true);
CREATE POLICY "Owners manage reviews" ON public.reviews FOR ALL USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Clients can submit reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (true);

-- Gift cards
CREATE POLICY "gc_owner_all" ON public.gift_cards FOR ALL USING (get_caller_role() = 'owner') WITH CHECK (get_caller_role() = 'owner');
CREATE POLICY "gc_receptionist_read" ON public.gift_cards FOR SELECT USING (get_caller_role() IN ('owner','receptionist'));
CREATE POLICY "gcr_owner_all" ON public.gift_card_redemptions FOR ALL USING (get_caller_role() = 'owner') WITH CHECK (get_caller_role() = 'owner');
CREATE POLICY "gcr_receptionist_insert" ON public.gift_card_redemptions FOR INSERT WITH CHECK (get_caller_role() IN ('owner','receptionist'));
CREATE POLICY "gcr_receptionist_read" ON public.gift_card_redemptions FOR SELECT USING (get_caller_role() IN ('owner','receptionist'));

-- New features - open to authenticated staff/owners
CREATE POLICY "Staff view waitlist" ON public.waitlist FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners manage waitlist" ON public.waitlist FOR ALL USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));
CREATE POLICY "Service addons viewable" ON public.service_addons FOR SELECT USING (true);
CREATE POLICY "Owners manage addons" ON public.service_addons FOR ALL USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Client notes staff access" ON public.client_notes FOR ALL USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "SMS campaigns owner access" ON public.sms_campaigns FOR ALL USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "SMS campaigns staff view" ON public.sms_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Promo codes owner manage" ON public.promotional_codes FOR ALL USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Promo codes staff view" ON public.promotional_codes FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Products viewable" ON public.products FOR SELECT USING (true);
CREATE POLICY "Owners manage products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Product categories viewable" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Owners manage categories" ON public.product_categories FOR ALL USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Users manage own cart" ON public.cart_items FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT USING (auth.uid() = client_id OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'receptionist'));
CREATE POLICY "Users create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Payment methods viewable" ON public.payment_methods FOR SELECT USING (is_active = true);
CREATE POLICY "Users view own transactions" ON public.payment_transactions FOR SELECT USING (auth.uid() = client_id OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Subscription plans viewable" ON public.subscription_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Owners manage plans" ON public.subscription_plans FOR ALL USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Users view own subscriptions" ON public.subscriptions FOR ALL USING (auth.uid() = client_id OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Business metrics owner only" ON public.business_metrics FOR ALL USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Client analytics owner" ON public.client_analytics FOR ALL USING (public.has_role(auth.uid(), 'owner') OR auth.uid() = client_id);

-- ============================================================================
-- STEP 10: GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_caller_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_validate_gift_card(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_redeem_gift_card(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_void_gift_card(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_delete_gift_card(UUID) TO authenticated;

-- ============================================================================
-- STEP 11: SEED DATA
-- ============================================================================

-- Default settings
INSERT INTO public.settings (salon_name, phone, email, address)
VALUES ('Zolara Beauty Studio', '0594365314', 'info@zolarasalon.com', 'Sakasaka, Opposite CalBank, Tamale, Ghana');

-- Default services
INSERT INTO public.services (name, category, price, duration_minutes, description) VALUES
('Hair Wash', 'Hair', 50.00, 30, 'Professional hair wash and blow dry'),
('Cornrows', 'Braids', 40.00, 60, 'Classic cornrow braiding'),
('Box Braids (Short)', 'Braids', 160.00, 120, 'Box braids - short length'),
('Box Braids (Medium)', 'Braids', 250.00, 180, 'Box braids - medium length'),
('Box Braids (Long)', 'Braids', 350.00, 240, 'Box braids - long length'),
('Pedicure (Classic)', 'Nails', 100.00, 45, 'Classic pedicure treatment'),
('Pedicure (Signature)', 'Nails', 180.00, 60, 'Signature Zolara pedicure'),
('Manicure (Classic)', 'Nails', 60.00, 30, 'Classic manicure'),
('Manicure (Gel)', 'Nails', 100.00, 45, 'Gel manicure'),
('Acrylic Nails (Basic)', 'Nails', 120.00, 60, 'Basic acrylic nail set'),
('Classic Lashes', 'Lashes', 100.00, 60, 'Classic eyelash extensions'),
('Volume Lashes', 'Lashes', 180.00, 90, 'Volume eyelash extensions'),
('Cluster Lashes', 'Lashes', 50.00, 30, 'Cluster lash application');

-- Default SMS campaigns
INSERT INTO public.sms_campaigns (name, message_template, trigger_type, send_hours_before) VALUES
('Appointment Reminder 24h', 'Hi {{client_name}}, reminder: appointment at Zolara tomorrow at {{time}} for {{service}}. Call 0594 365 314 to reschedule.', 'booking_reminder', 24),
('Appointment Reminder 2h', 'Hi {{client_name}}, your Zolara appointment starts in 2 hours ({{time}}) for {{service}}. See you soon!', 'booking_reminder', 2),
('Birthday Wishes', 'Happy Birthday {{client_name}}! 🎉 Enjoy 20% off any service at Zolara this week. Book: 0594 365 314', 'birthday', NULL),
('Anniversary Message', 'Happy Anniversary {{client_name}}! 💕 Treat yourself at Zolara Beauty Studio. Book: 0594 365 314', 'anniversary', NULL);

-- Default add-ons
INSERT INTO public.service_addons (name, description, price, duration_minutes, category) VALUES
('Hair Wash & Condition', 'Deep cleansing shampoo and conditioning', 25.00, 15, 'hair'),
('Scalp Massage', 'Relaxing scalp massage', 20.00, 10, 'hair'),
('Eyebrow Shaping', 'Professional eyebrow shaping', 15.00, 10, 'beauty'),
('Nail Art (Simple)', 'Basic nail art design', 25.00, 20, 'nails'),
('Nail Art (Complex)', 'Detailed nail art', 45.00, 30, 'nails'),
('Cuticle Care', 'Professional cuticle treatment', 10.00, 10, 'nails'),
('Paraffin Wax', 'Moisturizing paraffin wax treatment', 20.00, 15, 'nails');

-- Default payment methods
INSERT INTO public.payment_methods (name, provider, type, is_active, supports_refunds, processing_fee_percentage) VALUES
('MTN Mobile Money', 'mtn', 'mobile_money', true, false, 0.0075),
('Vodafone Cash', 'vodafone', 'mobile_money', true, false, 0.0075),
('AirtelTigo Money', 'airteltigo', 'mobile_money', true, false, 0.0075),
('Hubtel Payment', 'hubtel', 'card', true, true, 0.025),
('Bank Transfer', 'manual', 'bank_transfer', true, true, 0.0),
('Cash', 'cash', 'cash', true, false, 0.0);

-- Default subscription plans
INSERT INTO public.subscription_plans (name, description, billing_cycle, price, max_services_per_cycle, discount_percentage, features) VALUES
('Beauty Basic', '2 services per month with 15% discount', 'monthly', 150.00, 2, 15.0, ARRAY['2 services/month', '15% discount', 'Priority booking']),
('Beauty Plus', '4 services per month with 20% discount', 'monthly', 280.00, 4, 20.0, ARRAY['4 services/month', '20% discount', 'Priority booking', 'Free add-on monthly']),
('Beauty Premium', 'Unlimited services with VIP treatment', 'monthly', 500.00, NULL, 25.0, ARRAY['Unlimited services', '25% discount', 'VIP priority', 'Complimentary add-ons', 'Free birthday treatment']);

-- Default product categories
INSERT INTO public.product_categories (name, description, slug, display_order) VALUES
('Hair Care', 'Shampoos, conditioners and treatments', 'hair-care', 1),
('Skin Care', 'Cleansers, moisturizers and serums', 'skin-care', 2),
('Nail Care', 'Nail polish and treatments', 'nail-care', 3),
('Beauty Tools', 'Brushes and styling tools', 'beauty-tools', 4),
('Gift Sets', 'Curated beauty collections', 'gift-sets', 5);

