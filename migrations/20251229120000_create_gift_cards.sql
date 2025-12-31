-- Migration: Create gift cards and related tables
-- Run this against your Supabase/Postgres database

-- Enable pgcrypto for gen_random_uuid if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Gift cards table (one-time use vouchers)
CREATE TABLE IF NOT EXISTS gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  final_code text NOT NULL UNIQUE,
  tier text,
  year integer,
  batch text,
  card_value numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unused', -- unused | redeemed | expired | void
  date_generated timestamptz,

  -- redemption audit fields (optional, main audit in gift_card_redemptions)
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES auth.users(id),
  redeemed_booking_id uuid REFERENCES bookings(id),
  redeemed_client_id uuid REFERENCES clients(id),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Allowed services mapping: which services a gift card can be applied to
CREATE TABLE IF NOT EXISTS gift_card_allowed_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id uuid REFERENCES gift_cards(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE
);

-- Redemption audit log (keeps a record each time a card is redeemed/voided)
CREATE TABLE IF NOT EXISTS gift_card_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id uuid REFERENCES gift_cards(id) ON DELETE CASCADE,
  redeemed_at timestamptz DEFAULT now(),
  redeemed_by uuid REFERENCES auth.users(id),
  booking_id uuid REFERENCES bookings(id),
  client_id uuid REFERENCES clients(id),
  action text NOT NULL, -- 'redeemed' | 'void' | 'expired' | 'imported'
  notes text
);

-- Simple trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_gift_cards_updated_at
BEFORE UPDATE ON gift_cards
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Index on status for reporting
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);
