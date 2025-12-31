-- Migration: create stable rpc_import_gift_cards wrapper
-- Purpose: Ensure PostgREST / Supabase can find `public.rpc_import_gift_cards(jsonb)`
-- Idempotent: uses CREATE OR REPLACE and grants.

-- Adjust impl function name below if your implementation has a different name.
-- This assumes you have an implementation function named `rpc_import_gift_cards_impl(jsonb)`
-- which RETURNS TABLE(row_index integer, success boolean, message text, gift_card_id uuid)

BEGIN;

-- create wrapper that forwards to the implementation
CREATE OR REPLACE FUNCTION public.rpc_import_gift_cards(rows jsonb)
RETURNS TABLE(row_index integer, success boolean, message text, gift_card_id uuid)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.rpc_import_gift_cards_impl(rows);
$$;

-- Grant execute to authenticated role so callers using the normal JWT can call the RPC
GRANT EXECUTE ON FUNCTION public.rpc_import_gift_cards(jsonb) TO authenticated;

-- Optionally grant to anon if your frontend calls as anon (not recommended)
-- GRANT EXECUTE ON FUNCTION public.rpc_import_gift_cards(jsonb) TO anon;

COMMIT;
