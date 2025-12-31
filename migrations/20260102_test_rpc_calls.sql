-- Test script for gift card RPCs
-- Safely run these as a DB admin/service role or inside a test database. The script wraps tests in a transaction and rolls back so it doesn't persist data.

BEGIN;

-- Simulate an admin caller and test import
SELECT set_config('jwt.claims.role', 'admin', true);
SELECT set_config('jwt.claims.sub', '00000000-0000-0000-0000-000000000000', true);

-- Call import RPC with a sample payload (should return inserted/duplicate results)
SELECT * FROM public.rpc_import_gift_cards(
  '[
    {"final_code":"ZLR-2099-SLV-B01-TEST01","card_value":10},
    {"final_code":"ZLR-2099-SLV-B01-TEST02","card_value":20}
  ]'::jsonb
);

-- Simulate receptionist calling redeem (should be allowed)
SELECT set_config('jwt.claims.role', 'reception', true);
SELECT set_config('jwt.claims.sub', '11111111-1111-1111-1111-111111111111', true);

-- Attempt to redeem a (possibly inserted) code. Use the exact code above or adjust.
-- The call may return not_found if import was rolled back or if the migration wasn't applied.
SELECT * FROM public.rpc_redeem_gift_card('ZLR-2099-SLV-B01-TEST01', NULL::uuid, NULL::uuid, '11111111-1111-1111-1111-111111111111'::uuid, NULL);

-- Negative test: simulate an unauthenticated/no-role caller (should be unauthorized)
SELECT set_config('jwt.claims.role', NULL, true);
SELECT set_config('jwt.claims.sub', NULL, true);

-- This should raise an exception or return an unauthorized result depending on the RPC implementation
-- We'll call import and expect error
BEGIN
  PERFORM public.rpc_import_gift_cards('[{"final_code":"ZLR-0000-SLV-B00-XXXXXX","card_value":5}]'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Expected exception for unauthorized import: %', SQLERRM;
END;

ROLLBACK;

-- End of tests

