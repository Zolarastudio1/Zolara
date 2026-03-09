# Gift Cards — UI ⇄ DB integration

This file maps frontend UI flows to the PostgreSQL/Supabase RPCs and describes expected request/response shapes.

## Summary
- Validation RPC: `rpc_validate_gift_card(p_code text)`
  - Purpose: Server-side validation. Checks expiry, status, allowed services/categories, balance, and ownership/usage rules.
  - Called by: `src/pages/Admin/Checkout.tsx` via `validateGiftCard(code)`.
  - Expected return: object `{ valid: boolean, message: string, gift_card: jsonb }` (some migrations return arrays; frontend handles either array or single object).

- Redemption RPC: `rpc_redeem_gift_card(p_code text, p_booking_id uuid, p_client_id uuid, p_staff_id uuid, p_service_ids uuid[])`
  - Purpose: Atomically apply a gift card to a booking, create a redemption record, adjust gift card balance and return details.
  - Called by: `src/lib/useGiftCards.ts` helper `redeemGiftCard(params)` and `src/pages/Admin/Checkout.tsx`.
  - Expected return: object `{ success: boolean, message: string, gift_card_id: uuid, card_value: numeric, ... }` (sometimes wrapped in array).

- Void / Expire / Delete RPCs: `rpc_void_gift_card`, `rpc_expire_gift_card`, `rpc_delete_gift_card`
  - Purpose: Admin operations. Use `src/lib/useGiftCards.ts` wrappers.

## Frontend helpers
Location: `src/lib/useGiftCards.ts`
- `validateGiftCard(code: string)` — calls `rpc_validate_gift_card` and returns `{ data, error }`.
- `redeemGiftCard(params)` — calls `rpc_redeem_gift_card` with named params object.
- All helpers return Supabase-style `{ data, error }` and the UI normalizes array vs object.

## Checkout flow (what we implemented)
1. Admin enters gift card code and clicks Redeem.
2. The UI calls `validateGiftCard(code)` to surface server validation messages early.
   - If invalid: show `toast.error(validation.message)` and abort.
3. If valid: call `redeemGiftCard({ code, booking_id, client_id, staff_id, service_ids })`.
   - If success: update local UI (`redeemedCard`, reduce `amount`), show `toast.success`.
   - If failure: show `toast.error` with server message.

## Developer notes / migration run
- Ensure the migration that creates `gift_cards`, `gift_card_redemptions` and RPCs (`rpc_validate_gift_card`, `rpc_redeem_gift_card`, etc.) is applied to your DB before using the UI. The SQL is available in `migrations/`.

- To apply migrations in a Supabase project, run your usual migration steps (e.g., `supabase db push` or run the migration SQL against your Postgres instance). This repository does not run migrations automatically.

## Error handling
- The frontend normalizes RPC responses which sometimes come back as arrays (e.g., `[ { valid: true, ... } ]`) or single objects.
- All helper calls return `{ data, error }`. Check `error` first, then `data`.

## Future improvements
- Surface preview details in a modal after validation with `gift_card.card_value`, `allowed_services`, and an explicit confirm button before redeeming.
- Add unit tests for `useGiftCards` helpers (mock Supabase client) — a follow-up task.

---

If you want, I can also add a small confirmation modal (preview card value / allowed services) before redeeming. Let me know.