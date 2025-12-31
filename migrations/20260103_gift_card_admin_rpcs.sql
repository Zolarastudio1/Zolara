-- Migration: add admin RPCs for voiding, expiring and deleting gift cards
-- Idempotent: uses CREATE OR REPLACE

BEGIN;

-- rpc_void_gift_card(p_id uuid, p_note text DEFAULT NULL)
CREATE OR REPLACE FUNCTION public.rpc_void_gift_card(p_id uuid, p_note text DEFAULT NULL)
RETURNS TABLE(success boolean, message text, gift_card_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role text := public.get_caller_role();
BEGIN
  IF caller_role IS NULL OR caller_role NOT IN ('admin','owner','reception') THEN
    success := false; message := 'unauthorized'; gift_card_id := p_id; RETURN NEXT; RETURN;
  END IF;

  UPDATE public.gift_cards SET status = 'void' WHERE id = p_id RETURNING id INTO gift_card_id;
  IF NOT FOUND THEN
    success := false; message := 'not_found'; gift_card_id := p_id; RETURN NEXT; RETURN;
  END IF;

  BEGIN
    INSERT INTO public.gift_card_redemptions(gift_card_id, note, redeemed_by)
    VALUES (p_id, COALESCE(p_note, 'Voided via rpc_void_gift_card'), NULL);
  EXCEPTION WHEN OTHERS THEN
    -- ignore insertion errors but return success for update
    NULL;
  END;

  success := true; message := 'voided'; RETURN NEXT; RETURN;
END;
$$;

-- rpc_expire_gift_card(p_id uuid, p_note text DEFAULT NULL)
CREATE OR REPLACE FUNCTION public.rpc_expire_gift_card(p_id uuid, p_note text DEFAULT NULL)
RETURNS TABLE(success boolean, message text, gift_card_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role text := public.get_caller_role();
BEGIN
  IF caller_role IS NULL OR caller_role NOT IN ('admin','owner','reception') THEN
    success := false; message := 'unauthorized'; gift_card_id := p_id; RETURN NEXT; RETURN;
  END IF;

  UPDATE public.gift_cards SET status = 'expired' WHERE id = p_id RETURNING id INTO gift_card_id;
  IF NOT FOUND THEN
    success := false; message := 'not_found'; gift_card_id := p_id; RETURN NEXT; RETURN;
  END IF;

  BEGIN
    INSERT INTO public.gift_card_redemptions(gift_card_id, note, redeemed_by)
    VALUES (p_id, COALESCE(p_note, 'Expired via rpc_expire_gift_card'), NULL);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  success := true; message := 'expired'; RETURN NEXT; RETURN;
END;
$$;

-- rpc_delete_gift_card(p_id uuid)
CREATE OR REPLACE FUNCTION public.rpc_delete_gift_card(p_id uuid)
RETURNS TABLE(success boolean, message text, gift_card_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role text := public.get_caller_role();
BEGIN
  IF caller_role IS NULL OR caller_role NOT IN ('admin','owner') THEN
    success := false; message := 'unauthorized'; gift_card_id := p_id; RETURN NEXT; RETURN;
  END IF;

  DELETE FROM public.gift_cards WHERE id = p_id RETURNING id INTO gift_card_id;
  IF NOT FOUND THEN
    success := false; message := 'not_found'; gift_card_id := p_id; RETURN NEXT; RETURN;
  END IF;

  success := true; message := 'deleted'; RETURN NEXT; RETURN;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.rpc_void_gift_card(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_expire_gift_card(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_delete_gift_card(uuid) TO authenticated;

COMMIT;
