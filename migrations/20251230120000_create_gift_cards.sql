-- Migration: create gift_cards tables and RPCs for import + redemption
-- Generated: 2025-12-30

-- Ensure extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Gift card status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gift_card_status') THEN
        CREATE TYPE public.gift_card_status AS ENUM ('unused','redeemed','expired','void');
    END IF;
END$$;

-- gift_cards table
CREATE TABLE IF NOT EXISTS public.gift_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    final_code text NOT NULL,
    tier text,
    year integer,
    batch text,
    card_value numeric(12,2) NOT NULL DEFAULT 0,
    status public.gift_card_status NOT NULL DEFAULT 'unused',
    date_generated timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    allowed_service_ids uuid[] DEFAULT NULL,
    allowed_service_categories text[] DEFAULT NULL,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    redeemed_at timestamptz,
    redeemed_by uuid,
    redeemed_booking_id uuid,
    note text
);

-- case-insensitive uniqueness for final_code and index on status
CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_final_code_unique ON public.gift_cards (lower(final_code));
CREATE INDEX IF NOT EXISTS gift_cards_status_idx ON public.gift_cards (status);

-- gift_card_redemptions table
CREATE TABLE IF NOT EXISTS public.gift_card_redemptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gift_card_id uuid NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
    redeemed_at timestamptz NOT NULL DEFAULT now(),
    redeemed_by uuid,
    booking_id uuid,
    client_id uuid,
    note text
);

CREATE INDEX IF NOT EXISTS gift_card_redemptions_gift_card_id_idx ON public.gift_card_redemptions (gift_card_id);

-- RPC: import gift cards from JSON array
-- Input: jsonb array of objects, each may contain keys: final_code, tier, year, batch, card_value, expires_at, allowed_service_ids (array), allowed_service_categories (array), note
-- Returns: setof (row_index int, success boolean, message text, gift_card_id uuid)
CREATE OR REPLACE FUNCTION public.rpc_import_gift_cards(rows jsonb)
RETURNS TABLE(row_index integer, success boolean, message text, gift_card_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    i integer := 0;
    r jsonb;
    v_final_code text;
    v_tier text;
    v_year integer;
    v_batch text;
    v_value numeric(12,2) := 0;
    v_expires timestamptz;
    v_allowed_ids uuid[];
    v_allowed_cats text[];
    v_note text;
    v_id uuid;
BEGIN
    -- Restrict to admin/owner roles in JWT
    IF (current_setting('jwt.claims.role', true) IS NULL) OR (current_setting('jwt.claims.role', true) NOT IN ('admin','owner')) THEN
        RAISE EXCEPTION 'rpc_import_gift_cards: unauthorized';
    END IF;

    IF rows IS NULL THEN
        RETURN;
    END IF;

    FOR i IN 0 .. jsonb_array_length(rows) - 1 LOOP
        r := rows -> i;
        row_index := i + 1;
        v_final_code := (r ->> 'final_code')::text;
        v_tier := (r ->> 'tier')::text;
        v_year := NULLIF(r ->> 'year','')::integer;
        v_batch := (r ->> 'batch')::text;
        v_value := COALESCE(NULLIF(r ->> 'card_value','')::numeric, 0);
        v_expires := NULLIF(r ->> 'expires_at','')::timestamptz;
        v_note := (r ->> 'note')::text;

        -- allowed_service_ids expected as array of uuids or null
        IF r ? 'allowed_service_ids' THEN
            BEGIN
                v_allowed_ids := ARRAY(SELECT jsonb_array_elements_text(r -> 'allowed_service_ids')::uuid);
            EXCEPTION WHEN others THEN
                v_allowed_ids := NULL;
            END;
        ELSE
            v_allowed_ids := NULL;
        END IF;

        IF r ? 'allowed_service_categories' THEN
            BEGIN
                v_allowed_cats := ARRAY(SELECT jsonb_array_elements_text(r -> 'allowed_service_categories'));
            EXCEPTION WHEN others THEN
                v_allowed_cats := NULL;
            END;
        ELSE
            v_allowed_cats := NULL;
        END IF;

        -- Validate format: ^ZLR-(\d{4})-(SLV|GLD|PLT|DMD)-B(\d{2})-([A-Z0-9]{6})$
        IF v_final_code IS NULL OR NOT (v_final_code ~ '^ZLR-(\d{4})-(SLV|GLD|PLT|DMD)-B(\d{2})-([A-Z0-9]{6})$') THEN
            success := false;
            message := 'invalid_code_format';
            gift_card_id := NULL;
            RETURN NEXT;
            CONTINUE;
        END IF;

        BEGIN
            INSERT INTO public.gift_cards(final_code, tier, year, batch, card_value, expires_at, allowed_service_ids, allowed_service_categories, note, created_by)
            VALUES (v_final_code, v_tier, v_year, v_batch, v_value, v_expires, v_allowed_ids, v_allowed_cats, v_note, current_setting('request.jwt.claims.sub', true)::uuid)
            RETURNING id INTO v_id;

            success := true;
            message := 'inserted';
            gift_card_id := v_id;
            RETURN NEXT;
        EXCEPTION WHEN unique_violation THEN
            -- already exists
            SELECT id INTO v_id FROM public.gift_cards WHERE lower(final_code) = lower(v_final_code) LIMIT 1;
            success := false;
            message := 'duplicate';
            gift_card_id := v_id;
            RETURN NEXT;
        WHEN OTHERS THEN
            success := false;
            message := SQLERRM;
            gift_card_id := NULL;
            RETURN NEXT;
        END;
    END LOOP;
END;
$$;

-- RPC: redeem gift card atomically
-- Input: code text, booking_id uuid, client_id uuid, staff_id uuid, service_ids uuid[] (optional)
-- Returns: success boolean, message text, gift_card_id uuid, card_value numeric
CREATE OR REPLACE FUNCTION public.rpc_redeem_gift_card(p_code text, p_booking_id uuid, p_client_id uuid, p_staff_id uuid, p_service_ids uuid[] DEFAULT NULL)
RETURNS TABLE(success boolean, message text, gift_card_id uuid, card_value numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_card record;
    v_allowed boolean := true;
    v_service_uuid uuid;
    v_cat text;
    v_intersect_count int := 0;
BEGIN
    -- Restrict to receptionist/admin/owner via JWT role claim (reception allowed)
    IF (current_setting('jwt.claims.role', true) IS NULL) OR (current_setting('jwt.claims.role', true) NOT IN ('admin','owner','reception')) THEN
        success := false;
        message := 'unauthorized';
        gift_card_id := NULL;
        card_value := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    IF p_code IS NULL THEN
        success := false; message := 'no_code_provided'; gift_card_id := NULL; card_value := 0; RETURN NEXT; RETURN;
    END IF;

    -- Lock the card row for update to avoid races
    SELECT * INTO v_card FROM public.gift_cards
    WHERE lower(final_code) = lower(p_code)
    FOR UPDATE;

    IF NOT FOUND THEN
        success := false; message := 'not_found'; gift_card_id := NULL; card_value := 0; RETURN NEXT; RETURN;
    END IF;

    IF v_card.status <> 'unused' THEN
        success := false; message := 'not_unused'; gift_card_id := v_card.id; card_value := v_card.card_value; RETURN NEXT; RETURN;
    END IF;

    IF v_card.expires_at IS NOT NULL AND v_card.expires_at < now() THEN
        success := false; message := 'expired'; gift_card_id := v_card.id; card_value := v_card.card_value; RETURN NEXT; RETURN;
    END IF;

    -- If allowed_service_ids is set, require overlap with provided service ids
    IF v_card.allowed_service_ids IS NOT NULL AND array_length(v_card.allowed_service_ids,1) > 0 THEN
        IF p_service_ids IS NULL OR array_length(p_service_ids,1) = 0 THEN
            success := false; message := 'service_required'; gift_card_id := v_card.id; card_value := v_card.card_value; RETURN NEXT; RETURN;
        END IF;

        -- check intersection
        SELECT COUNT(*) INTO v_intersect_count
        FROM unnest(v_card.allowed_service_ids) AS a(id)
        JOIN unnest(p_service_ids) AS b(id2) ON a.id = b.id2;

        IF v_intersect_count = 0 THEN
            success := false; message := 'service_not_allowed'; gift_card_id := v_card.id; card_value := v_card.card_value; RETURN NEXT; RETURN;
        END IF;
    END IF;

    -- If allowed_service_categories is set, and service_ids provided, check via services table if any service's category overlaps
    IF v_card.allowed_service_categories IS NOT NULL AND array_length(v_card.allowed_service_categories,1) > 0 AND p_service_ids IS NOT NULL THEN
        -- This assumes a table public.services with id uuid and category text; adjust if your services schema differs
        SELECT COUNT(*) INTO v_intersect_count
        FROM public.services s
        WHERE s.id = ANY(p_service_ids) AND s.category = ANY(v_card.allowed_service_categories);

        IF v_intersect_count = 0 THEN
            success := false; message := 'service_category_not_allowed'; gift_card_id := v_card.id; card_value := v_card.card_value; RETURN NEXT; RETURN;
        END IF;
    END IF;

    -- Insert redemption record and update card status
    BEGIN
        INSERT INTO public.gift_card_redemptions(gift_card_id, redeemed_by, booking_id, client_id, note)
        VALUES (v_card.id, p_staff_id, p_booking_id, p_client_id, NULL);

        UPDATE public.gift_cards
        SET status = 'redeemed', redeemed_at = now(), redeemed_by = p_staff_id, redeemed_booking_id = p_booking_id
        WHERE id = v_card.id;

        success := true; message := 'redeemed'; gift_card_id := v_card.id; card_value := v_card.card_value; RETURN NEXT; RETURN;
    EXCEPTION WHEN OTHERS THEN
        success := false; message := SQLERRM; gift_card_id := v_card.id; card_value := v_card.card_value; RETURN NEXT; RETURN;
    END;
END;
$$;

-- Grant execute to authenticated role for RPCs (Supabase uses "authenticated" role)
GRANT EXECUTE ON FUNCTION public.rpc_import_gift_cards(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_redeem_gift_card(text, uuid, uuid, uuid, uuid[]) TO authenticated;
