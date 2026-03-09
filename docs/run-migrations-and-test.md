# Run migrations and test RPCs (Supabase / Postgres)

This document explains how to apply the migrations created in this repo, restart Supabase/PostgREST if needed, and run the provided SQL tests which simulate JWT claims.

Important: run these with a DB user that has permission to create functions and run migrations (service_role or DB admin). Keep sensitive credentials secure.

1) Apply migrations

If you use the Supabase dashboard or CLI migration workflow, apply these new migration files:

- `migrations/20260101_fix_rpc_import_gift_cards_wrapper.sql`
- `migrations/20260102_rpcs_use_get_caller_role.sql`

If you prefer `psql` (replace placeholders):

```powershell
# PowerShell example
$PG_CONN = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres"
psql $PG_CONN -f migrations/20260101_fix_rpc_import_gift_cards_wrapper.sql
psql $PG_CONN -f migrations/20260102_rpcs_use_get_caller_role.sql
```

If you use Supabase CLI (local dev), follow your normal migration flow. Example (may vary by CLI version):

```powershell
# If using supabase CLI migrations
supabase db reset --confirm
# or apply migrations
# supabase db push or other commands depending on your workflow
```

2) Restart PostgREST / Supabase to refresh schema cache

Local dev (supabase CLI):

```powershell
supabase stop
supabase start
```

Hosted Supabase: apply migrations via dashboard/CLI; wait a short while for the API to pick up new functions. If issues persist, re-deploy or contact the Supabase dashboard UI.

3) Run SQL tests

Run the test file which sets session-level fake JWT claims and calls the RPCs inside a transaction (the script uses ROLLBACK so it won't persist test data):

```powershell
psql $PG_CONN -f migrations/20260102_test_rpc_calls.sql
```

4) Manual quick checks (psql)

If you want to run quick single statements interactively:

```sql
-- simulate admin
SELECT set_config('jwt.claims.role','admin', true);
SELECT set_config('jwt.claims.sub','00000000-0000-0000-0000-000000000000', true);

SELECT * FROM public.rpc_import_gift_cards('[{"final_code":"ZLR-2099-SLV-B01-TEST99","card_value":5}]'::jsonb);

-- simulate receptionist
SELECT set_config('jwt.claims.role','reception', true);
SELECT set_config('jwt.claims.sub','11111111-1111-1111-1111-111111111111', true);
SELECT * FROM public.rpc_redeem_gift_card('ZLR-2099-SLV-B01-TEST99', NULL::uuid, NULL::uuid, '11111111-1111-1111-1111-111111111111'::uuid, NULL);
```

5) If you still see "unauthorized"

- Confirm the JWT claim your application sends is `role`. If your tokens use a different claim name (e.g., `user_role`), edit `migrations/20260102_rpcs_use_get_caller_role.sql` to also check that claim.
- Confirm `public.profiles` or `public.user_roles` tables contain roles for the given `sub` UUID if you rely on fallback.
- Check PostgREST logs for schema cache messages. Restarting the API forces it to re-introspect functions.


If you want, I can also add a small Node.js script that runs the test SQL via a PG client and reports the outputs in JSON. Say the word and I'll add it to `scripts/`.