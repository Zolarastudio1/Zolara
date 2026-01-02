This is my current 

DROP FUNCTION IF EXISTS public.rpc_delete_gift_card(uuid);
DROP FUNCTION IF EXISTS public.rpc_void_gift_card(uuid, text);
DROP FUNCTION IF EXISTS public.rpc_expire_gift_card(uuid, text);

DO $$ BEGIN
  CREATE TYPE gift_card_status AS ENUM ('unused', 'redeemed', 'expired', 'void');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ================================
-- 2. Gift cards table
-- ================================
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  final_code text UNIQUE NOT NULL,
  tier text,
  year int,
  batch text,
  card_value numeric DEFAULT 0,
  status gift_card_status DEFAULT 'unused',
  expires_at timestamptz,
  allowed_service_ids uuid[],
  allowed_service_categories text[],
  created_by uuid REFERENCES auth.users(id),
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES auth.users(id),
  redeemed_booking_id uuid,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ================================
-- 3. Redemption audit table
-- ================================
CREATE TABLE IF NOT EXISTS public.gift_card_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id uuid REFERENCES gift_cards(id) ON DELETE SET NULL,
  final_code text NOT NULL,
  redeemed_by uuid REFERENCES auth.users(id),
  redeemed_at timestamptz DEFAULT now(),
  booking_id uuid,
  client_id uuid,
  note text
);

-- ================================
-- 4. Enable RLS
-- ================================
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_redemptions ENABLE ROW LEVEL SECURITY;

-- ================================
-- 5. updated_at trigger
-- ================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gift_cards_updated ON public.gift_cards;
CREATE TRIGGER trg_gift_cards_updated
BEFORE UPDATE ON public.gift_cards
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ================================
-- 6. Normalize code
-- ================================
CREATE OR REPLACE FUNCTION public.normalize_gift_code()
RETURNS trigger AS $$
BEGIN
  NEW.final_code = UPPER(TRIM(NEW.final_code));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gift_code_normalize ON public.gift_cards;
CREATE TRIGGER trg_gift_code_normalize
BEFORE INSERT OR UPDATE ON public.gift_cards
FOR EACH ROW EXECUTE FUNCTION normalize_gift_code();

-- ================================
-- 7. Role helper
-- ================================
CREATE OR REPLACE FUNCTION public.get_caller_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- ================================
-- 8. RLS: gift_cards
-- ================================
DROP POLICY IF EXISTS gc_owner_all ON public.gift_cards;
CREATE POLICY gc_owner_all
ON public.gift_cards
FOR ALL
USING (get_caller_role() = 'owner')
WITH CHECK (get_caller_role() = 'owner');

DROP POLICY IF EXISTS gc_receptionist_read ON public.gift_cards;
CREATE POLICY gc_receptionist_read
ON public.gift_cards
FOR SELECT
USING (get_caller_role() IN ('owner','receptionist'));

-- ================================
-- 9. RLS: gift_card_redemptions
-- ================================
DROP POLICY IF EXISTS gcr_owner_all ON public.gift_card_redemptions;
CREATE POLICY gcr_owner_all
ON public.gift_card_redemptions
FOR ALL
USING (get_caller_role() = 'owner')
WITH CHECK (get_caller_role() = 'owner');

DROP POLICY IF EXISTS gcr_receptionist_insert ON public.gift_card_redemptions;
CREATE POLICY gcr_receptionist_insert
ON public.gift_card_redemptions
FOR INSERT
WITH CHECK (get_caller_role() IN ('owner','receptionist'));

DROP POLICY IF EXISTS gcr_receptionist_read ON public.gift_card_redemptions;
CREATE POLICY gcr_receptionist_read
ON public.gift_card_redemptions
FOR SELECT
USING (get_caller_role() IN ('owner','receptionist'));

-- ================================
-- 10. Validate gift card
-- ================================
CREATE OR REPLACE FUNCTION public.rpc_validate_gift_card(p_code text)
RETURNS TABLE(valid boolean, message text, gift_card jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_card gift_cards%ROWTYPE;
BEGIN
  SELECT * INTO v_card
  FROM gift_cards
  WHERE final_code = UPPER(TRIM(p_code));

  IF v_card.id IS NULL THEN
    RETURN QUERY SELECT false, 'Gift card not found', NULL;
    RETURN;
  END IF;

  IF v_card.status != 'unused' THEN
    RETURN QUERY SELECT false, 'Gift card is ' || v_card.status, to_jsonb(v_card);
    RETURN;
  END IF;

  IF v_card.expires_at IS NOT NULL AND v_card.expires_at < now() THEN
    RETURN QUERY SELECT false, 'Gift card expired', to_jsonb(v_card);
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'Valid', to_jsonb(v_card);
END;
$$;

-- ================================
-- 11. Redeem gift card
-- ================================
CREATE OR REPLACE FUNCTION public.rpc_redeem_gift_card(
  p_code text,
  p_booking_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, message text, gift_card jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_card gift_cards%ROWTYPE;
BEGIN
  SELECT get_caller_role() INTO v_role;
  IF v_role NOT IN ('owner','receptionist') THEN
    RETURN QUERY SELECT false, 'Access denied', NULL;
    RETURN;
  END IF;

  SELECT * INTO v_card FROM gift_cards WHERE final_code = UPPER(TRIM(p_code));

  IF v_card.id IS NULL THEN
    RETURN QUERY SELECT false, 'Gift card not found', NULL;
    RETURN;
  END IF;

  IF v_card.status != 'unused' THEN
    RETURN QUERY SELECT false, 'Already used', to_jsonb(v_card);
    RETURN;
  END IF;

  UPDATE gift_cards SET
    status = 'redeemed',
    redeemed_at = now(),
    redeemed_by = auth.uid(),
    redeemed_booking_id = p_booking_id
  WHERE id = v_card.id
  RETURNING * INTO v_card;

  INSERT INTO gift_card_redemptions (
    gift_card_id,
    final_code,
    redeemed_by,
    booking_id,
    client_id
  ) VALUES (
    v_card.id,
    v_card.final_code,
    auth.uid(),
    p_booking_id,
    p_client_id
  );

  RETURN QUERY SELECT true, 'Redeemed successfully', to_jsonb(v_card);
END;
$$;

-- ================================
-- 12. Owner-only admin RPCs
-- ================================
CREATE OR REPLACE FUNCTION public.rpc_void_gift_card(p_id uuid)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF get_caller_role() != 'owner' THEN
    RETURN QUERY SELECT false, 'Owner only';
    RETURN;
  END IF;

  UPDATE gift_cards SET status = 'void' WHERE id = p_id;
  RETURN QUERY SELECT true, 'Voided';
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_delete_gift_card(p_id uuid)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF get_caller_role() != 'owner' THEN
    RETURN QUERY SELECT false, 'Owner only';
    RETURN;
  END IF;

  DELETE FROM gift_cards WHERE id = p_id AND status = 'unused';
  RETURN QUERY SELECT true, 'Deleted';
END;
$$;

-- ================================
-- 13. Grants
-- ================================
GRANT EXECUTE ON FUNCTION public.get_caller_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_validate_gift_card(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_redeem_gift_card(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_void_gift_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_delete_gift_card(uuid) TO authenticated;


Match the respective UI functionalities with this to work and integrate perfectly