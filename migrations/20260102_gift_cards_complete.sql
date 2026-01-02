-- ============================================================
-- COMPLETE GIFT CARD SYSTEM MIGRATION
-- Run this in your SQL editor to set up the full gift card logic
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ENUM FOR GIFT CARD STATUS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.gift_card_status AS ENUM ('unused', 'redeemed', 'expired', 'void');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. GIFT CARDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  final_code text NOT NULL UNIQUE,
  tier text,
  year integer,
  batch text,
  card_value numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unused',
  date_generated timestamptz DEFAULT now(),
  expire_at timestamptz,
  
  -- Service restrictions (JSON arrays for flexibility)
  allowed_service_ids uuid[] DEFAULT '{}',
  allowed_service_categories text[] DEFAULT '{}',
  
  -- Redemption audit fields
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES auth.users(id),
  redeemed_booking_id uuid,
  redeemed_client_id uuid,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraint: status must be valid
  CONSTRAINT chk_gift_card_status CHECK (status IN ('unused', 'redeemed', 'expired', 'void'))
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON public.gift_cards(status);
CREATE INDEX IF NOT EXISTS idx_gift_cards_final_code ON public.gift_cards(final_code);

-- ============================================================
-- 3. GIFT CARD REDEMPTIONS AUDIT TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gift_card_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id uuid REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  redeemed_at timestamptz DEFAULT now(),
  redeemed_by uuid REFERENCES auth.users(id),
  booking_id uuid,
  client_id uuid,
  action text NOT NULL, -- 'redeemed' | 'void' | 'expired' | 'imported'
  notes text,
  
  CONSTRAINT chk_redemption_action CHECK (action IN ('redeemed', 'void', 'expired', 'imported'))
);

CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_gift_card_id ON public.gift_card_redemptions(gift_card_id);

-- ============================================================
-- 4. TRIGGER: AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.gift_cards_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gift_cards_updated_at ON public.gift_cards;
CREATE TRIGGER trg_gift_cards_updated_at
BEFORE UPDATE ON public.gift_cards
FOR EACH ROW
EXECUTE FUNCTION public.gift_cards_update_updated_at();

-- ============================================================
-- 5. TRIGGER: UPPERCASE AND TRIM final_code
-- ============================================================
CREATE OR REPLACE FUNCTION public.gift_cards_uppercase_final_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.final_code IS NOT NULL THEN
    NEW.final_code := upper(trim(NEW.final_code));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gift_cards_uppercase ON public.gift_cards;
CREATE TRIGGER trg_gift_cards_uppercase
BEFORE INSERT OR UPDATE ON public.gift_cards
FOR EACH ROW
EXECUTE FUNCTION public.gift_cards_uppercase_final_code();

-- ============================================================
-- 6. HELPER: GET CALLER ROLE
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_caller_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  caller_role text;
BEGIN
  -- Try to get user id from auth.uid()
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get role from user_roles table
  SELECT role::text INTO caller_role
  FROM public.user_roles
  WHERE user_id = caller_id
  LIMIT 1;
  
  RETURN caller_role;
END;
$$;

-- ============================================================
-- 7. RPC: IMPORT GIFT CARDS (Owner/Admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_import_gift_cards(rows jsonb)
RETURNS TABLE(row_index integer, success boolean, message text, gift_card_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := public.get_caller_role();
  r jsonb;
  i integer := 0;
  new_id uuid;
  v_final_code text;
  v_card_value numeric;
  v_tier text;
  v_year integer;
  v_batch text;
  v_expire_at timestamptz;
  v_allowed_service_ids uuid[];
  v_allowed_service_categories text[];
BEGIN
  -- Authorization check: only owner or admin
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    row_index := 0;
    success := false;
    message := 'unauthorized';
    gift_card_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Process each row in the JSON array
  FOR r IN SELECT * FROM jsonb_array_elements(rows)
  LOOP
    i := i + 1;
    row_index := i;
    
    -- Extract fields
    v_final_code := upper(trim(r->>'final_code'));
    v_card_value := COALESCE((r->>'card_value')::numeric, 0);
    v_tier := r->>'tier';
    v_year := (r->>'year')::integer;
    v_batch := r->>'batch';
    v_expire_at := (r->>'expire_at')::timestamptz;
    
    -- Handle allowed_service_ids (JSON array to uuid[])
    IF r->'allowed_service_ids' IS NOT NULL AND jsonb_typeof(r->'allowed_service_ids') = 'array' THEN
      SELECT array_agg(elem::text::uuid)
      INTO v_allowed_service_ids
      FROM jsonb_array_elements_text(r->'allowed_service_ids') AS elem;
    ELSE
      v_allowed_service_ids := '{}';
    END IF;
    
    -- Handle allowed_service_categories (JSON array to text[])
    IF r->'allowed_service_categories' IS NOT NULL AND jsonb_typeof(r->'allowed_service_categories') = 'array' THEN
      SELECT array_agg(elem::text)
      INTO v_allowed_service_categories
      FROM jsonb_array_elements_text(r->'allowed_service_categories') AS elem;
    ELSE
      v_allowed_service_categories := '{}';
    END IF;
    
    -- Validate required fields
    IF v_final_code IS NULL OR v_final_code = '' THEN
      success := false;
      message := 'missing_final_code';
      gift_card_id := NULL;
      RETURN NEXT;
      CONTINUE;
    END IF;
    
    -- Insert the gift card
    BEGIN
      INSERT INTO public.gift_cards (
        final_code, card_value, tier, year, batch, expire_at,
        allowed_service_ids, allowed_service_categories,
        status, date_generated
      ) VALUES (
        v_final_code, v_card_value, v_tier, v_year, v_batch, v_expire_at,
        v_allowed_service_ids, v_allowed_service_categories,
        'unused', now()
      )
      RETURNING id INTO new_id;
      
      -- Log the import
      INSERT INTO public.gift_card_redemptions (gift_card_id, action, notes, redeemed_by)
      VALUES (new_id, 'imported', 'Imported via rpc_import_gift_cards', auth.uid());
      
      success := true;
      message := 'imported';
      gift_card_id := new_id;
      RETURN NEXT;
      
    EXCEPTION WHEN unique_violation THEN
      success := false;
      message := 'duplicate_code';
      gift_card_id := NULL;
      RETURN NEXT;
    END;
  END LOOP;
  
  RETURN;
END;
$$;

-- ============================================================
-- 8. RPC: REDEEM GIFT CARD (Owner/Admin/Reception only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_redeem_gift_card(
  p_code text,
  p_booking_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_redeemed_by uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, message text, gift_card_id uuid, card_value numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := public.get_caller_role();
  v_card record;
  v_service_category text;
BEGIN
  -- Authorization check: owner, admin (mapped from 'owner'), or receptionist
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin', 'receptionist') THEN
    success := false;
    message := 'unauthorized';
    gift_card_id := NULL;
    card_value := NULL;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Normalize code
  p_code := upper(trim(p_code));
  
  -- Find the gift card
  SELECT * INTO v_card
  FROM public.gift_cards
  WHERE final_code = p_code
  FOR UPDATE; -- Lock the row
  
  IF NOT FOUND THEN
    success := false;
    message := 'not_found';
    gift_card_id := NULL;
    card_value := NULL;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Check status
  IF v_card.status != 'unused' THEN
    success := false;
    message := 'already_' || v_card.status;
    gift_card_id := v_card.id;
    card_value := v_card.card_value;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Check expiration
  IF v_card.expire_at IS NOT NULL AND v_card.expire_at < now() THEN
    -- Mark as expired
    UPDATE public.gift_cards SET status = 'expired' WHERE id = v_card.id;
    
    success := false;
    message := 'expired';
    gift_card_id := v_card.id;
    card_value := v_card.card_value;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Validate service restrictions if service_id is provided
  IF p_service_id IS NOT NULL THEN
    -- Check if service is in allowed list
    IF array_length(v_card.allowed_service_ids, 1) > 0 THEN
      IF NOT (p_service_id = ANY(v_card.allowed_service_ids)) THEN
        success := false;
        message := 'service_not_allowed';
        gift_card_id := v_card.id;
        card_value := v_card.card_value;
        RETURN NEXT;
        RETURN;
      END IF;
    END IF;
    
    -- Check if service category is in allowed list
    IF array_length(v_card.allowed_service_categories, 1) > 0 THEN
      SELECT category INTO v_service_category
      FROM public.services
      WHERE id = p_service_id;
      
      IF v_service_category IS NULL OR NOT (v_service_category = ANY(v_card.allowed_service_categories)) THEN
        success := false;
        message := 'category_not_allowed';
        gift_card_id := v_card.id;
        card_value := v_card.card_value;
        RETURN NEXT;
        RETURN;
      END IF;
    END IF;
  END IF;
  
  -- Redeem the card
  UPDATE public.gift_cards
  SET 
    status = 'redeemed',
    redeemed_at = now(),
    redeemed_by = COALESCE(p_redeemed_by, auth.uid()),
    redeemed_booking_id = p_booking_id,
    redeemed_client_id = p_client_id
  WHERE id = v_card.id;
  
  -- Log the redemption
  INSERT INTO public.gift_card_redemptions (
    gift_card_id, action, booking_id, client_id, redeemed_by, notes
  ) VALUES (
    v_card.id, 'redeemed', p_booking_id, p_client_id, 
    COALESCE(p_redeemed_by, auth.uid()), 'Redeemed via rpc_redeem_gift_card'
  );
  
  success := true;
  message := 'redeemed';
  gift_card_id := v_card.id;
  card_value := v_card.card_value;
  RETURN NEXT;
  RETURN;
END;
$$;

-- ============================================================
-- 9. RPC: VOID GIFT CARD (Owner/Admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_void_gift_card(p_id uuid, p_note text DEFAULT NULL)
RETURNS TABLE(success boolean, message text, gift_card_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := public.get_caller_role();
BEGIN
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    success := false;
    message := 'unauthorized';
    gift_card_id := p_id;
    RETURN NEXT;
    RETURN;
  END IF;
  
  UPDATE public.gift_cards SET status = 'void' WHERE id = p_id;
  
  IF NOT FOUND THEN
    success := false;
    message := 'not_found';
    gift_card_id := p_id;
    RETURN NEXT;
    RETURN;
  END IF;
  
  INSERT INTO public.gift_card_redemptions (gift_card_id, action, notes, redeemed_by)
  VALUES (p_id, 'void', COALESCE(p_note, 'Voided via rpc_void_gift_card'), auth.uid());
  
  success := true;
  message := 'voided';
  gift_card_id := p_id;
  RETURN NEXT;
  RETURN;
END;
$$;

-- ============================================================
-- 10. RPC: EXPIRE GIFT CARD (Owner/Admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_expire_gift_card(p_id uuid, p_note text DEFAULT NULL)
RETURNS TABLE(success boolean, message text, gift_card_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := public.get_caller_role();
BEGIN
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    success := false;
    message := 'unauthorized';
    gift_card_id := p_id;
    RETURN NEXT;
    RETURN;
  END IF;
  
  UPDATE public.gift_cards SET status = 'expired' WHERE id = p_id;
  
  IF NOT FOUND THEN
    success := false;
    message := 'not_found';
    gift_card_id := p_id;
    RETURN NEXT;
    RETURN;
  END IF;
  
  INSERT INTO public.gift_card_redemptions (gift_card_id, action, notes, redeemed_by)
  VALUES (p_id, 'expired', COALESCE(p_note, 'Expired via rpc_expire_gift_card'), auth.uid());
  
  success := true;
  message := 'expired';
  gift_card_id := p_id;
  RETURN NEXT;
  RETURN;
END;
$$;

-- ============================================================
-- 11. RPC: DELETE GIFT CARD (Owner/Admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_delete_gift_card(p_id uuid)
RETURNS TABLE(success boolean, message text, gift_card_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := public.get_caller_role();
BEGIN
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    success := false;
    message := 'unauthorized';
    gift_card_id := p_id;
    RETURN NEXT;
    RETURN;
  END IF;
  
  DELETE FROM public.gift_cards WHERE id = p_id;
  
  IF NOT FOUND THEN
    success := false;
    message := 'not_found';
    gift_card_id := p_id;
    RETURN NEXT;
    RETURN;
  END IF;
  
  success := true;
  message := 'deleted';
  gift_card_id := p_id;
  RETURN NEXT;
  RETURN;
END;
$$;

-- ============================================================
-- 12. RPC: VALIDATE GIFT CARD (Check if valid for redemption)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_validate_gift_card(
  p_code text,
  p_service_id uuid DEFAULT NULL
)
RETURNS TABLE(
  valid boolean,
  message text,
  gift_card_id uuid,
  card_value numeric,
  status text,
  allowed_services uuid[],
  allowed_categories text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := public.get_caller_role();
  v_card record;
  v_service_category text;
BEGIN
  -- Authorization check
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin', 'receptionist') THEN
    valid := false;
    message := 'unauthorized';
    RETURN NEXT;
    RETURN;
  END IF;
  
  p_code := upper(trim(p_code));
  
  SELECT * INTO v_card FROM public.gift_cards WHERE final_code = p_code;
  
  IF NOT FOUND THEN
    valid := false;
    message := 'not_found';
    RETURN NEXT;
    RETURN;
  END IF;
  
  gift_card_id := v_card.id;
  card_value := v_card.card_value;
  status := v_card.status;
  allowed_services := v_card.allowed_service_ids;
  allowed_categories := v_card.allowed_service_categories;
  
  -- Check status
  IF v_card.status != 'unused' THEN
    valid := false;
    message := 'already_' || v_card.status;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Check expiration
  IF v_card.expire_at IS NOT NULL AND v_card.expire_at < now() THEN
    valid := false;
    message := 'expired';
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Validate service if provided
  IF p_service_id IS NOT NULL THEN
    IF array_length(v_card.allowed_service_ids, 1) > 0 THEN
      IF NOT (p_service_id = ANY(v_card.allowed_service_ids)) THEN
        valid := false;
        message := 'service_not_allowed';
        RETURN NEXT;
        RETURN;
      END IF;
    END IF;
    
    IF array_length(v_card.allowed_service_categories, 1) > 0 THEN
      SELECT category INTO v_service_category FROM public.services WHERE id = p_service_id;
      IF v_service_category IS NULL OR NOT (v_service_category = ANY(v_card.allowed_service_categories)) THEN
        valid := false;
        message := 'category_not_allowed';
        RETURN NEXT;
        RETURN;
      END IF;
    END IF;
  END IF;
  
  valid := true;
  message := 'valid';
  RETURN NEXT;
  RETURN;
END;
$$;

-- ============================================================
-- 13. ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on gift_cards
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Owner and admin can do everything on gift_cards" ON public.gift_cards;
DROP POLICY IF EXISTS "Receptionist can view gift_cards" ON public.gift_cards;

-- Owner/Admin: full access
CREATE POLICY "Owner and admin can do everything on gift_cards"
ON public.gift_cards
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- Receptionist: view only (redemption via RPC)
CREATE POLICY "Receptionist can view gift_cards"
ON public.gift_cards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'receptionist'
  )
);

-- Enable RLS on gift_card_redemptions
ALTER TABLE public.gift_card_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner and admin can do everything on redemptions" ON public.gift_card_redemptions;
DROP POLICY IF EXISTS "Receptionist can view redemptions" ON public.gift_card_redemptions;

-- Owner/Admin: full access to redemption logs
CREATE POLICY "Owner and admin can do everything on redemptions"
ON public.gift_card_redemptions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- Receptionist: view only
CREATE POLICY "Receptionist can view redemptions"
ON public.gift_card_redemptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'receptionist'
  )
);

-- ============================================================
-- 14. GRANT EXECUTE ON RPCs TO AUTHENTICATED
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_caller_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_import_gift_cards(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_redeem_gift_card(text, uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_void_gift_card(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_expire_gift_card(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_delete_gift_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_validate_gift_card(text, uuid) TO authenticated;

COMMIT;

-- ============================================================
-- SUMMARY OF WHAT THIS MIGRATION CREATES:
-- ============================================================
-- Tables:
--   - gift_cards (main table with service restrictions)
--   - gift_card_redemptions (audit log)
--
-- Functions:
--   - get_caller_role() - Helper to get user's role
--   - rpc_import_gift_cards(jsonb) - Import cards (owner/admin)
--   - rpc_redeem_gift_card(...) - Redeem card (owner/admin/receptionist)
--   - rpc_void_gift_card(uuid, text) - Void card (owner/admin)
--   - rpc_expire_gift_card(uuid, text) - Expire card (owner/admin)
--   - rpc_delete_gift_card(uuid) - Delete card (owner/admin)
--   - rpc_validate_gift_card(text, uuid) - Check if card is valid
--
-- RLS Policies:
--   - Owner/Admin: full access to gift_cards and redemptions
--   - Receptionist: view only (actions via RPCs)
--   - Other roles: no access
-- ============================================================
