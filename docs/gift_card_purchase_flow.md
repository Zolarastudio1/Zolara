# Gift Card Purchase Flow

This document describes the minimal, non-invasive purchase flow implemented using a Supabase Edge Function.

Overview
- The `purchase-gift-card` edge function creates a `gift_cards` row (with a generated code) and initializes a Paystack payment.
- The function returns a Paystack authorization URL; the frontend redirects the purchaser to complete payment.
- The existing `verify-payment` function is used to verify payments (it updates `payments` rows by searching for the Paystack reference in `notes`). Configure your Paystack webhook to call `/functions/verify-payment` or invoke it after payment.

Endpoints
- `POST /functions/purchase-gift-card`
  - Body JSON:
    - `amount` (number, required) — gift card value in NGN
    - `purchaser_email` (string, optional)
    - `recipient_email` (string, optional)
    - `message` (string, optional)
    - `expire_at` (ISO timestamp, optional)
    - `allowed_service_ids` (string[], optional)
    - `allowed_service_categories` (string[], optional)
    - `idempotency_key` (string, optional)
  - Response JSON:
    - `success` boolean
    - `gift_card_id` uuid
    - `authorization_url` string (Paystack URL to redirect purchaser)
    - `reference` string (Paystack reference)

Notes and deployment
- The function requires these environment variables where it's deployed:
  - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (service role) — used to create the `gift_cards` row and to insert a pending `payments` record.
  - `PAYSTACK_SECRET_KEY` — used to initialize Paystack payments.
- For verification, point Paystack webhooks to your existing `/functions/verify-payment` endpoint; that function already updates `payments` rows and will mark the payment as completed.

Security considerations
- The edge function uses the Supabase service role key; keep it secret and do not expose it to the browser.
- Rate limit or protect the endpoint with captcha if you expect public purchases to avoid abuse.
- The gift card `final_code` is generated and stored on creation but should only be revealed to the purchaser/recipient after payment verification. The current flow returns `gift_card_id` and the authorization URL; implement email delivery or a post-payment UI to reveal the code after the `verify-payment` step confirms success.

Next steps
- Optionally implement an email delivery in the `verify-payment` webhook to send the `final_code` to `recipient_email`/`purchaser_email` after payment success.
- Optionally add an admin UI to list purchased-but-unpaid gift cards and reconcile manual payments.
