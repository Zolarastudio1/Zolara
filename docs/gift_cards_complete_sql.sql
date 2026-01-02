-- =====================================================
-- COMPLETE GIFT CARDS SQL - Run this in your SQL Editor
-- =====================================================
-- This creates ALL tables, functions, and policies needed
-- for the gift card system.
-- =====================================================

-- 1. Create the gift card status enum
DO $$ BEGIN
  CREATE TYPE gift_card_status AS ENUM ('unused', 'redeemed', 'expired', 'void');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create gift_cards table
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  final_code text UNIQUE NOT NULL,
  tier text,
  year int,
  batch text,
  card_value numeric DEFAULT 0,
  status gift_card_status DEFAULT 'unused',
  date_generated timestamptz DEFAULT now(),
  expires_at timestamptz,
  allowed_service_ids uuid[],
  allowed_service_categories text[],
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES auth.users(id),
  booking_id uuid,
  client_id uuid,
  note text
);

-- 3. Create redemption audit table
CREATE TABLE IF NOT EXISTS public.gift_card_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id uuid REFERENCES gift_cards(id) ON DELETE SET NULL,
  final_code text NOT NULL,
  redeemed_by uuid REFERENCES auth.users(id),
  redeemed_at timestamptz DEFAULT now(),
  booking_id uuid,
  client_id uuid,
  service_ids uuid[],
  note text
);

-- 4. Enable RLS
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_redemptions ENABLE ROW LEVEL SECURITY;

-- 5. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.gift_cards_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gift_cards_updated_at ON public.gift_cards;
CREATE TRIGGER gift_cards_updated_at
  BEFORE UPDATE ON public.gift_cards
  FOR EACH ROW EXECUTE FUNCTION gift_cards_update_timestamp();

-- 6. Normalize code to uppercase
CREATE OR REPLACE FUNCTION public.gift_cards_normalize_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.final_code = UPPER(TRIM(NEW.final_code));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gift_cards_normalize ON public.gift_cards;
CREATE TRIGGER gift_cards_normalize
  BEFORE INSERT OR UPDATE ON public.gift_cards
  FOR EACH ROW EXECUTE FUNCTION gift_cards_normalize_code();

-- 7. Helper function to get caller role
CREATE OR REPLACE FUNCTION public.get_caller_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 8. RLS Policies for gift_cards
DROP POLICY IF EXISTS "gc_owner_all" ON public.gift_cards;
CREATE POLICY "gc_owner_all" ON public.gift_cards
  FOR ALL USING (get_caller_role() = 'owner')
  WITH CHECK (get_caller_role() = 'owner');

DROP POLICY IF EXISTS "gc_receptionist_select" ON public.gift_cards;
CREATE POLICY "gc_receptionist_select" ON public.gift_cards
  FOR SELECT USING (get_caller_role() IN ('owner', 'receptionist'));

-- 9. RLS Policies for gift_card_redemptions
DROP POLICY IF EXISTS "gcr_owner_all" ON public.gift_card_redemptions;
CREATE POLICY "gcr_owner_all" ON public.gift_card_redemptions
  FOR ALL USING (get_caller_role() = 'owner')
  WITH CHECK (get_caller_role() = 'owner');

DROP POLICY IF EXISTS "gcr_receptionist_select" ON public.gift_card_redemptions;
CREATE POLICY "gcr_receptionist_select" ON public.gift_card_redemptions
  FOR SELECT USING (get_caller_role() IN ('owner', 'receptionist'));

DROP POLICY IF EXISTS "gcr_receptionist_insert" ON public.gift_card_redemptions;
CREATE POLICY "gcr_receptionist_insert" ON public.gift_card_redemptions
  FOR INSERT WITH CHECK (get_caller_role() IN ('owner', 'receptionist'));

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

-- 10. Validate gift card (check if valid and service matches)
CREATE OR REPLACE FUNCTION public.rpc_validate_gift_card(
  p_code text,
  p_service_id uuid DEFAULT NULL
)
RETURNS TABLE(valid boolean, message text, gift_card jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card gift_cards%ROWTYPE;
  v_service services%ROWTYPE;
BEGIN
  -- Find the card
  SELECT * INTO v_card FROM gift_cards WHERE UPPER(TRIM(final_code)) = UPPER(TRIM(p_code));
  
  IF v_card.id IS NULL THEN
    RETURN QUERY SELECT false, 'Gift card not found'::text, NULL::jsonb;
    RETURN;
  END IF;
  
  IF v_card.status != 'unused' THEN
    RETURN QUERY SELECT false, ('Gift card is ' || v_card.status::text)::text, to_jsonb(v_card);
    RETURN;
  END IF;
  
  IF v_card.expires_at IS NOT NULL AND v_card.expires_at < now() THEN
    RETURN QUERY SELECT false, 'Gift card has expired'::text, to_jsonb(v_card);
    RETURN;
  END IF;
  
  -- Check service restriction if provided
  IF p_service_id IS NOT NULL THEN
    SELECT * INTO v_service FROM services WHERE id = p_service_id;
    
    IF v_service.id IS NULL THEN
      RETURN QUERY SELECT false, 'Service not found'::text, to_jsonb(v_card);
      RETURN;
    END IF;
    
    -- Check allowed_service_ids
    IF v_card.allowed_service_ids IS NOT NULL AND array_length(v_card.allowed_service_ids, 1) > 0 THEN
      IF NOT (p_service_id = ANY(v_card.allowed_service_ids)) THEN
        RETURN QUERY SELECT false, 'Service not covered by this gift card'::text, to_jsonb(v_card);
        RETURN;
      END IF;
    END IF;
    
    -- Check allowed_service_categories
    IF v_card.allowed_service_categories IS NOT NULL AND array_length(v_card.allowed_service_categories, 1) > 0 THEN
      IF NOT (v_service.category = ANY(v_card.allowed_service_categories)) THEN
        RETURN QUERY SELECT false, 'Service category not covered by this gift card'::text, to_jsonb(v_card);
        RETURN;
      END IF;
    END IF;
  END IF;
  
  RETURN QUERY SELECT true, 'Valid'::text, to_jsonb(v_card);
END;
$$;

-- 11. Redeem gift card
CREATE OR REPLACE FUNCTION public.rpc_redeem_gift_card(
  p_code text,
  p_booking_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL,
  p_service_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(success boolean, message text, gift_card jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_card gift_cards%ROWTYPE;
  v_service services%ROWTYPE;
  v_sid uuid;
BEGIN
  -- Check role
  SELECT get_caller_role() INTO v_role;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'receptionist') THEN
    RETURN QUERY SELECT false, 'Access denied'::text, NULL::jsonb;
    RETURN;
  END IF;
  
  -- Find card
  SELECT * INTO v_card FROM gift_cards WHERE UPPER(TRIM(final_code)) = UPPER(TRIM(p_code));
  
  IF v_card.id IS NULL THEN
    RETURN QUERY SELECT false, 'Gift card not found'::text, NULL::jsonb;
    RETURN;
  END IF;
  
  IF v_card.status != 'unused' THEN
    RETURN QUERY SELECT false, ('Gift card is already ' || v_card.status::text)::text, to_jsonb(v_card);
    RETURN;
  END IF;
  
  IF v_card.expires_at IS NOT NULL AND v_card.expires_at < now() THEN
    UPDATE gift_cards SET status = 'expired' WHERE id = v_card.id;
    RETURN QUERY SELECT false, 'Gift card has expired'::text, to_jsonb(v_card);
    RETURN;
  END IF;
  
  -- Validate services if provided
  IF p_service_ids IS NOT NULL AND array_length(p_service_ids, 1) > 0 THEN
    FOREACH v_sid IN ARRAY p_service_ids LOOP
      SELECT * INTO v_service FROM services WHERE id = v_sid;
      
      IF v_service.id IS NULL THEN
        RETURN QUERY SELECT false, ('Service ' || v_sid || ' not found')::text, to_jsonb(v_card);
        RETURN;
      END IF;
      
      -- Check allowed_service_ids
      IF v_card.allowed_service_ids IS NOT NULL AND array_length(v_card.allowed_service_ids, 1) > 0 THEN
        IF NOT (v_sid = ANY(v_card.allowed_service_ids)) THEN
          RETURN QUERY SELECT false, ('Service ' || v_service.name || ' not covered by this gift card')::text, to_jsonb(v_card);
          RETURN;
        END IF;
      END IF;
      
      -- Check allowed_service_categories
      IF v_card.allowed_service_categories IS NOT NULL AND array_length(v_card.allowed_service_categories, 1) > 0 THEN
        IF NOT (v_service.category = ANY(v_card.allowed_service_categories)) THEN
          RETURN QUERY SELECT false, ('Service category ' || v_service.category || ' not covered')::text, to_jsonb(v_card);
          RETURN;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  -- Mark as redeemed
  UPDATE gift_cards SET
    status = 'redeemed',
    redeemed_at = now(),
    redeemed_by = auth.uid(),
    booking_id = p_booking_id,
    client_id = p_client_id
  WHERE id = v_card.id
  RETURNING * INTO v_card;
  
  -- Audit log
  INSERT INTO gift_card_redemptions (gift_card_id, final_code, redeemed_by, booking_id, client_id, service_ids)
  VALUES (v_card.id, v_card.final_code, auth.uid(), p_booking_id, p_client_id, p_service_ids);
  
  RETURN QUERY SELECT true, 'Gift card redeemed successfully'::text, to_jsonb(v_card);
END;
$$;

-- 12. Void gift card (Owner only)
CREATE OR REPLACE FUNCTION public.rpc_void_gift_card(
  p_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_card gift_cards%ROWTYPE;
BEGIN
  SELECT get_caller_role() INTO v_role;
  IF v_role IS NULL OR v_role != 'owner' THEN
    RETURN QUERY SELECT false, 'Access denied: only owners can void cards'::text;
    RETURN;
  END IF;
  
  SELECT * INTO v_card FROM gift_cards WHERE id = p_id;
  IF v_card.id IS NULL THEN
    RETURN QUERY SELECT false, 'Gift card not found'::text;
    RETURN;
  END IF;
  
  IF v_card.status = 'redeemed' THEN
    RETURN QUERY SELECT false, 'Cannot void a redeemed card'::text;
    RETURN;
  END IF;
  
  UPDATE gift_cards SET status = 'void', note = COALESCE(p_reason, note) WHERE id = p_id;
  RETURN QUERY SELECT true, 'Card voided'::text;
END;
$$;

-- 13. Expire gift card (Owner only)
CREATE OR REPLACE FUNCTION public.rpc_expire_gift_card(
  p_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_card gift_cards%ROWTYPE;
BEGIN
  SELECT get_caller_role() INTO v_role;
  IF v_role IS NULL OR v_role != 'owner' THEN
    RETURN QUERY SELECT false, 'Access denied: only owners can expire cards'::text;
    RETURN;
  END IF;
  
  SELECT * INTO v_card FROM gift_cards WHERE id = p_id;
  IF v_card.id IS NULL THEN
    RETURN QUERY SELECT false, 'Gift card not found'::text;
    RETURN;
  END IF;
  
  IF v_card.status = 'redeemed' THEN
    RETURN QUERY SELECT false, 'Cannot expire a redeemed card'::text;
    RETURN;
  END IF;
  
  UPDATE gift_cards SET status = 'expired', note = COALESCE(p_reason, note) WHERE id = p_id;
  RETURN QUERY SELECT true, 'Card expired'::text;
END;
$$;

-- 14. Delete gift card (Owner only, unused only)
CREATE OR REPLACE FUNCTION public.rpc_delete_gift_card(p_id uuid)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_card gift_cards%ROWTYPE;
BEGIN
  SELECT get_caller_role() INTO v_role;
  IF v_role IS NULL OR v_role != 'owner' THEN
    RETURN QUERY SELECT false, 'Access denied: only owners can delete cards'::text;
    RETURN;
  END IF;
  
  SELECT * INTO v_card FROM gift_cards WHERE id = p_id;
  IF v_card.id IS NULL THEN
    RETURN QUERY SELECT false, 'Gift card not found'::text;
    RETURN;
  END IF;
  
  IF v_card.status = 'redeemed' THEN
    RETURN QUERY SELECT false, 'Cannot delete a redeemed card'::text;
    RETURN;
  END IF;
  
  DELETE FROM gift_cards WHERE id = p_id;
  RETURN QUERY SELECT true, 'Card deleted'::text;
END;
$$;

-- 15. UPDATE gift card (Owner only) - for editing service restrictions, value, etc.
CREATE OR REPLACE FUNCTION public.rpc_update_gift_card(
  p_id uuid,
  p_card_value numeric DEFAULT NULL,
  p_tier text DEFAULT NULL,
  p_allowed_service_ids uuid[] DEFAULT NULL,
  p_allowed_service_categories text[] DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS TABLE(success boolean, message text, gift_card jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_card gift_cards%ROWTYPE;
BEGIN
  SELECT get_caller_role() INTO v_role;
  IF v_role IS NULL OR v_role != 'owner' THEN
    RETURN QUERY SELECT false, 'Access denied: only owners can update gift cards'::text, NULL::jsonb;
    RETURN;
  END IF;
  
  SELECT * INTO v_card FROM gift_cards WHERE id = p_id;
  IF v_card.id IS NULL THEN
    RETURN QUERY SELECT false, 'Gift card not found'::text, NULL::jsonb;
    RETURN;
  END IF;
  
  IF v_card.status = 'redeemed' THEN
    RETURN QUERY SELECT false, 'Cannot update a redeemed gift card'::text, NULL::jsonb;
    RETURN;
  END IF;
  
  UPDATE gift_cards SET
    card_value = COALESCE(p_card_value, card_value),
    tier = COALESCE(p_tier, tier),
    allowed_service_ids = COALESCE(p_allowed_service_ids, allowed_service_ids),
    allowed_service_categories = COALESCE(p_allowed_service_categories, allowed_service_categories),
    expires_at = COALESCE(p_expires_at, expires_at),
    note = COALESCE(p_note, note),
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_card;
  
  RETURN QUERY SELECT true, 'Gift card updated successfully'::text, to_jsonb(v_card);
END;
$$;

-- 16. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_caller_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_validate_gift_card(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_redeem_gift_card(text, uuid, uuid, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_void_gift_card(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_expire_gift_card(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_delete_gift_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_gift_card(uuid, numeric, text, uuid[], text[], timestamptz, text) TO authenticated;
