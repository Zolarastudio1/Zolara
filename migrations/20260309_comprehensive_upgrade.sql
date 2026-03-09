-- ============================================================================
-- ZOLARA COMPREHENSIVE UPGRADE - Database Schema
-- Features: Waitlist, Add-ons, Birthday tracking, Advanced bookings, 
--          Client history, SMS automation, Promo codes, WhatsApp, 
--          Analytics, E-commerce, Multiple payments, Subscriptions
-- Date: 2026-03-09
-- ============================================================================

-- 1. CLIENT WAITLIST SYSTEM
-- ============================================================================
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    preferred_date DATE NOT NULL,
    preferred_time TIME NOT NULL,
    alternative_dates DATE[] DEFAULT '{}',
    priority INTEGER DEFAULT 1, -- 1=normal, 2=high, 3=vip
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

CREATE INDEX idx_waitlist_status ON waitlist(status);
CREATE INDEX idx_waitlist_date ON waitlist(preferred_date);
CREATE INDEX idx_waitlist_service ON waitlist(service_id);

-- 2. SERVICE ADD-ONS SYSTEM
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_addons (
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

-- Service compatibility - which add-ons work with which services
CREATE TABLE IF NOT EXISTS service_addon_compatibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES service_addons(id) ON DELETE CASCADE,
    UNIQUE(service_id, addon_id)
);

-- Booking add-ons junction table
CREATE TABLE IF NOT EXISTS booking_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES service_addons(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    price_paid DECIMAL(10,2), -- Track actual price paid (for discounts)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BIRTHDAY & ANNIVERSARY TRACKING
-- ============================================================================
-- Add birthday and anniversary columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS anniversary DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS prefers_birthday_sms BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS prefers_anniversary_sms BOOLEAN DEFAULT true;

-- Special occasions and reminders
CREATE TABLE IF NOT EXISTS client_special_dates (
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

-- 4. ADVANCED BOOKING FEATURES
-- ============================================================================
-- Add recurring booking support
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurring_type TEXT CHECK (recurring_type IN ('weekly', 'biweekly', 'monthly', 'custom'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurring_interval INTEGER; -- weeks/months
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurring_end_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS parent_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;

-- Package bookings
CREATE TABLE IF NOT EXISTS service_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    total_price DECIMAL(10,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    validity_months INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS package_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES service_packages(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    UNIQUE(package_id, service_id)
);

CREATE TABLE IF NOT EXISTS package_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    package_id UUID REFERENCES service_packages(id) ON DELETE CASCADE,
    purchase_date TIMESTAMPTZ DEFAULT NOW(),
    expiry_date DATE,
    total_paid DECIMAL(10,2),
    services_used INTEGER DEFAULT 0,
    services_total INTEGER,
    is_active BOOLEAN DEFAULT true
);

-- 5. CLIENT HISTORY & NOTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS client_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'medical', 'preference', 'behavior', 'allergy')),
    content TEXT NOT NULL,
    is_private BOOLEAN DEFAULT false, -- only staff who created can see
    is_important BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_notes_client ON client_notes(client_id);
CREATE INDEX idx_client_notes_type ON client_notes(note_type);

-- Service history summary
CREATE TABLE IF NOT EXISTS client_service_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    last_visit_date TIMESTAMPTZ,
    total_visits INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    preferred_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    average_rating DECIMAL(3,2),
    last_rating INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, service_id)
);

-- 6. AUTOMATIC SMS REMINDERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS sms_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    message_template TEXT NOT NULL, -- Can use {{client_name}}, {{service}}, {{date}}, {{time}} placeholders
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('booking_reminder', 'birthday', 'anniversary', 'follow_up', 'promotional', 'waitlist')),
    send_hours_before INTEGER, -- For booking reminders
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    message TEXT NOT NULL,
    campaign_id UUID REFERENCES sms_campaigns(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_queue_scheduled ON sms_queue(scheduled_for, status);

-- 7. PROMOTIONAL CODES SYSTEM
-- ============================================================================
CREATE TABLE IF NOT EXISTS promotional_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10,2) NOT NULL,
    minimum_amount DECIMAL(10,2) DEFAULT 0,
    maximum_discount DECIMAL(10,2), -- Cap for percentage discounts
    usage_limit INTEGER, -- NULL = unlimited
    usage_count INTEGER DEFAULT 0,
    per_client_limit INTEGER DEFAULT 1,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    applicable_services UUID[] DEFAULT '{}', -- Array of service IDs, empty = all services
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_code_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID REFERENCES promotional_codes(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    discount_applied DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. WHATSAPP INTEGRATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    whatsapp_number TEXT NOT NULL,
    contact_name TEXT,
    is_verified BOOLEAN DEFAULT false,
    last_message_at TIMESTAMPTZ,
    opt_in_marketing BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id)
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    message_type TEXT CHECK (message_type IN ('text', 'template', 'image', 'document')),
    content TEXT NOT NULL,
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    whatsapp_message_id TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ADVANCED ANALYTICS
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    metric_type TEXT NOT NULL, -- 'daily_revenue', 'client_count', 'booking_count', etc.
    value DECIMAL(15,2) NOT NULL,
    additional_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, metric_type)
);

CREATE INDEX idx_business_metrics_date ON business_metrics(date);
CREATE INDEX idx_business_metrics_type ON business_metrics(metric_type);

-- Client behavior analytics
CREATE TABLE IF NOT EXISTS client_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    first_visit_date DATE,
    last_visit_date DATE,
    total_visits INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    average_booking_value DECIMAL(10,2) DEFAULT 0,
    favorite_service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    favorite_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    client_tier TEXT DEFAULT 'regular' CHECK (client_tier IN ('new', 'regular', 'vip', 'platinum')),
    last_calculated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id)
);

-- 10. E-COMMERCE SYSTEM
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE NOT NULL,
    parent_category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    sku TEXT UNIQUE,
    price DECIMAL(10,2) NOT NULL,
    sale_price DECIMAL(10,2),
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    brand TEXT,
    weight_grams INTEGER,
    dimensions TEXT, -- JSON string with width, height, depth
    stock_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    is_digital BOOLEAN DEFAULT false,
    requires_shipping BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    images TEXT[] DEFAULT '{}', -- Array of image URLs
    tags TEXT[] DEFAULT '{}',
    meta_title TEXT,
    meta_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_featured ON products(is_featured);

-- Product variants (sizes, colors, etc.)
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- "Medium", "Red", etc.
    attribute_type TEXT NOT NULL, -- "size", "color", etc.
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    sku_suffix TEXT,
    stock_quantity INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopping cart
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price_per_item DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, product_id, variant_id)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    shipping_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    promo_code_id UUID REFERENCES promotional_codes(id) ON DELETE SET NULL,
    payment_method TEXT,
    payment_reference TEXT,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partial')),
    shipping_address JSONB,
    billing_address JSONB,
    notes TEXT,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date ON orders(created_at);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL, -- Snapshot at time of order
    variant_name TEXT,
    quantity INTEGER NOT NULL,
    price_per_item DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. MULTIPLE PAYMENT METHODS
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- "Mobile Money", "Credit Card", "Bank Transfer", etc.
    provider TEXT NOT NULL, -- "mtn", "vodafone", "stripe", "paystack", "hubtel"
    type TEXT NOT NULL CHECK (type IN ('mobile_money', 'card', 'bank_transfer', 'cash', 'crypto')),
    is_active BOOLEAN DEFAULT true,
    supports_refunds BOOLEAN DEFAULT false,
    processing_fee_percentage DECIMAL(5,4) DEFAULT 0,
    processing_fee_fixed DECIMAL(10,2) DEFAULT 0,
    minimum_amount DECIMAL(10,2) DEFAULT 0,
    maximum_amount DECIMAL(10,2),
    configuration JSONB DEFAULT '{}', -- Provider-specific settings
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment transactions (for all types: bookings, products, gift cards)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT UNIQUE NOT NULL,
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('booking', 'product_order', 'gift_card', 'subscription')),
    related_id UUID, -- booking_id, order_id, gift_card_id, subscription_id
    client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    processing_fee DECIMAL(10,2) DEFAULT 0,
    net_amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'GHS',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
    provider_reference TEXT,
    provider_response JSONB,
    client_phone TEXT,
    client_email TEXT,
    notes TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_transactions_reference ON payment_transactions(reference);
CREATE INDEX idx_payment_transactions_type ON payment_transactions(transaction_type, related_id);

-- 12. SUBSCRIPTION SERVICES
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    price DECIMAL(10,2) NOT NULL,
    setup_fee DECIMAL(10,2) DEFAULT 0,
    trial_days INTEGER DEFAULT 0,
    max_services_per_cycle INTEGER, -- NULL = unlimited
    included_services UUID[] DEFAULT '{}', -- Array of service IDs
    discount_percentage DECIMAL(5,2) DEFAULT 0, -- Discount on regular service prices
    is_active BOOLEAN DEFAULT true,
    features TEXT[] DEFAULT '{}', -- Array of feature descriptions
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES subscription_plans(id) ON DELETE CASCADE,
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
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_client ON subscriptions(client_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_payment ON subscriptions(next_payment_date);

-- Subscription usage tracking
CREATE TABLE IF NOT EXISTS subscription_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    cycle_start_date TIMESTAMPTZ NOT NULL,
    cycle_end_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Default SMS campaigns
INSERT INTO sms_campaigns (name, message_template, trigger_type, send_hours_before) VALUES
('Appointment Reminder 24h', 'Hi {{client_name}}, this is a reminder that you have an appointment at Zolara Beauty Studio tomorrow at {{time}} for {{service}}. Call 0594 365 314 if you need to reschedule.', 'booking_reminder', 24),
('Appointment Reminder 2h', 'Hi {{client_name}}, your appointment at Zolara starts in 2 hours ({{time}}) for {{service}}. We''re excited to see you!', 'booking_reminder', 2),
('Birthday Wishes', 'Happy Birthday {{client_name}}! 🎉 Celebrate your special day with 20% off any service at Zolara Beauty Studio. Valid for 7 days. Book now: 0594 365 314', 'birthday', NULL),
('Anniversary Message', 'Happy Anniversary {{client_name}}! 💕 Treat yourself to something special at Zolara Beauty Studio. Book your favorite service today: 0594 365 314', 'anniversary', NULL);

-- Default service add-ons
INSERT INTO service_addons (name, description, price, duration_minutes, category) VALUES
('Hair Wash & Condition', 'Deep cleansing shampoo and conditioning treatment', 25.00, 15, 'hair'),
('Scalp Massage', 'Relaxing 10-minute scalp massage', 20.00, 10, 'hair'),
('Hair Gloss Treatment', 'Add shine and protect your hair color', 35.00, 15, 'hair'),
('Express Facial Cleanse', 'Quick cleansing and moisturizing', 30.00, 15, 'beauty'),
('Eyebrow Shaping', 'Professional eyebrow trimming and shaping', 15.00, 10, 'beauty'),
('Nail Art (Simple)', 'Basic nail art design on existing manicure', 25.00, 20, 'nails'),
('Nail Art (Complex)', 'Detailed nail art design', 45.00, 30, 'nails'),
('Cuticle Care', 'Professional cuticle treatment', 10.00, 10, 'nails'),
('Paraffin Wax Treatment', 'Moisturizing paraffin wax for hands or feet', 20.00, 15, 'nails');

-- Default payment methods
INSERT INTO payment_methods (name, provider, type, is_active, supports_refunds, processing_fee_percentage, minimum_amount, maximum_amount) VALUES
('MTN Mobile Money', 'mtn', 'mobile_money', true, false, 0.0075, 1.00, 5000.00),
('Vodafone Cash', 'vodafone', 'mobile_money', true, false, 0.0075, 1.00, 5000.00),
('AirtelTigo Money', 'airteltigo', 'mobile_money', true, false, 0.0075, 1.00, 5000.00),
('Hubtel Payment', 'hubtel', 'card', true, true, 0.025, 5.00, 50000.00),
('Bank Transfer', 'manual', 'bank_transfer', true, true, 0.0, 10.00, NULL),
('Cash Payment', 'cash', 'cash', true, false, 0.0, 0.0, NULL);

-- Default subscription plans
INSERT INTO subscription_plans (name, description, billing_cycle, price, max_services_per_cycle, discount_percentage) VALUES
('Beauty Basic', 'Perfect for monthly maintenance with 2 services', 'monthly', 150.00, 2, 15.0),
('Beauty Plus', 'Enhanced beauty care with 4 services per month', 'monthly', 280.00, 4, 20.0),
('Beauty Premium', 'Unlimited services with VIP treatment', 'monthly', 500.00, NULL, 25.0),
('Quarterly Glow', 'Seasonal beauty package with 8 services', 'quarterly', 400.00, 8, 18.0);

-- Default product categories
INSERT INTO product_categories (name, description, slug, display_order) VALUES
('Hair Care', 'Shampoos, conditioners, treatments and styling products', 'hair-care', 1),
('Skin Care', 'Cleansers, moisturizers, serums and treatments', 'skin-care', 2),
('Nail Care', 'Nail polish, treatments and tools', 'nail-care', 3),
('Beauty Tools', 'Brushes, applicators and styling tools', 'beauty-tools', 4),
('Gift Sets', 'Curated beauty collections and gift packages', 'gift-sets', 5);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_service_addons_updated_at BEFORE UPDATE ON service_addons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_notes_updated_at BEFORE UPDATE ON client_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_service_history_updated_at BEFORE UPDATE ON client_service_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number = 'ZOL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_sequence')::TEXT, 4, '0');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create order number sequence
CREATE SEQUENCE IF NOT EXISTS order_sequence START 1000;

-- Order number trigger
CREATE TRIGGER generate_order_number_trigger BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Function to automatically update client analytics
CREATE OR REPLACE FUNCTION update_client_analytics()
RETURNS TRIGGER AS $$
DECLARE
    client_uuid UUID;
    total_spent_calc DECIMAL(10,2);
    total_visits_calc INTEGER;
    avg_booking_calc DECIMAL(10,2);
    first_visit_calc DATE;
    last_visit_calc DATE;
BEGIN
    -- Handle both INSERT and UPDATE
    client_uuid := COALESCE(NEW.client_id, OLD.client_id);
    
    -- Skip if no client_id
    IF client_uuid IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Calculate metrics
    SELECT 
        COALESCE(SUM(final_price), 0),
        COUNT(*),
        COALESCE(AVG(final_price), 0),
        MIN(appointment_date)::DATE,
        MAX(appointment_date)::DATE
    INTO 
        total_spent_calc,
        total_visits_calc,
        avg_booking_calc,
        first_visit_calc,
        last_visit_calc
    FROM bookings 
    WHERE client_id = client_uuid AND status = 'completed';
    
    -- Upsert client analytics
    INSERT INTO client_analytics (client_id, total_spent, total_visits, average_booking_value, first_visit_date, last_visit_date, last_calculated)
    VALUES (client_uuid, total_spent_calc, total_visits_calc, avg_booking_calc, first_visit_calc, last_visit_calc, NOW())
    ON CONFLICT (client_id) 
    DO UPDATE SET 
        total_spent = EXCLUDED.total_spent,
        total_visits = EXCLUDED.total_visits,
        average_booking_value = EXCLUDED.average_booking_value,
        first_visit_date = EXCLUDED.first_visit_date,
        last_visit_date = EXCLUDED.last_visit_date,
        last_calculated = NOW();
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger for client analytics updates
CREATE TRIGGER update_client_analytics_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON bookings 
    FOR EACH ROW EXECUTE FUNCTION update_client_analytics();

-- ============================================================================
-- ENABLE RLS (Row Level Security) FOR NEW TABLES
-- ============================================================================

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_addon_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_special_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_service_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotional_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (clients can see their own data, staff can see all)
-- Note: More specific policies should be added based on business requirements

-- Clients can see their own waitlist entries
CREATE POLICY "Users can view own waitlist entries" ON waitlist
    FOR ALL USING (auth.uid() = client_id OR auth.role() = 'service_role');

-- Service add-ons are public
CREATE POLICY "Service add-ons are viewable by all" ON service_addons
    FOR SELECT USING (is_active = true OR auth.role() = 'service_role');

-- Client notes - staff can see all, clients can see non-private notes about themselves
CREATE POLICY "Client notes policy" ON client_notes
    FOR ALL USING (
        auth.role() = 'service_role' OR
        (auth.uid() = client_id AND is_private = false)
    );

-- Shopping cart - clients can only see their own
CREATE POLICY "Users can manage own cart" ON cart_items
    FOR ALL USING (auth.uid() = client_id OR auth.role() = 'service_role');

-- Orders - clients can see their own orders
CREATE POLICY "Users can view own orders" ON orders
    FOR ALL USING (auth.uid() = client_id OR auth.role() = 'service_role');

-- Products are public for viewing
CREATE POLICY "Products are viewable by all" ON products
    FOR SELECT USING (is_active = true OR auth.role() = 'service_role');

-- Product categories are public
CREATE POLICY "Product categories are viewable by all" ON product_categories
    FOR SELECT USING (is_active = true OR auth.role() = 'service_role');

-- Subscriptions - clients can see their own
CREATE POLICY "Users can view own subscriptions" ON subscriptions
    FOR ALL USING (auth.uid() = client_id OR auth.role() = 'service_role');

-- Payment transactions - clients can see their own
CREATE POLICY "Users can view own payment transactions" ON payment_transactions
    FOR ALL USING (auth.uid() = client_id OR auth.role() = 'service_role');

-- Payment methods are public for viewing
CREATE POLICY "Payment methods are viewable by all" ON payment_methods
    FOR SELECT USING (is_active = true OR auth.role() = 'service_role');

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Analytics and reporting indexes
CREATE INDEX idx_business_metrics_date_type ON business_metrics(date, metric_type);
CREATE INDEX idx_payment_transactions_date ON payment_transactions(created_at);
CREATE INDEX idx_payment_transactions_client_date ON payment_transactions(client_id, created_at);
CREATE INDEX idx_orders_status_date ON orders(status, created_at);
CREATE INDEX idx_subscriptions_client_status ON subscriptions(client_id, status);
CREATE INDEX idx_client_analytics_tier ON client_analytics(client_tier);
CREATE INDEX idx_products_category_active ON products(category_id, is_active);
CREATE INDEX idx_products_featured_active ON products(is_featured, is_active);

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

-- Insert a completion record
INSERT INTO business_metrics (date, metric_type, value, additional_data) 
VALUES (
    CURRENT_DATE, 
    'schema_upgrade', 
    1, 
    '{"version": "comprehensive_upgrade", "features": ["waitlist", "addons", "birthday_tracking", "advanced_bookings", "client_history", "sms_automation", "promo_codes", "whatsapp", "analytics", "ecommerce", "multiple_payments", "subscriptions"], "installed_at": "' || NOW()::TEXT || '"}'
);
