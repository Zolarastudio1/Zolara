import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PurchaseRequest {
  purchaser_email?: string;
  recipient_email?: string;
  amount: number;
  message?: string;
  expire_at?: string | null;
  allowed_service_ids?: string[]; // uuid strings
  allowed_service_categories?: string[];
  idempotency_key?: string;
}

// Small helper to generate a short code
function generateCode() {
  // Use a short random hex string
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return `GC-${Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      throw new Error("Paystack secret key not configured");
    }

    const body: PurchaseRequest = await req.json();

    // Basic validation
    if (!body || typeof body.amount !== "number" || body.amount <= 0) {
      return new Response(
        JSON.stringify({ error: "amount is required and must be > 0" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role key to insert gift card row
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Generate a code and create a gift card row (we won't return the code until payment is verified)
    const finalCode = generateCode();

    const insertPayload: any = {
      final_code: finalCode,
      card_value: body.amount,
      status: "unused",
    };

    if (body.expire_at) insertPayload.expire_at = body.expire_at;
    if (body.allowed_service_ids && body.allowed_service_ids.length > 0)
      insertPayload.allowed_service_ids = body.allowed_service_ids;
    if (body.allowed_service_categories && body.allowed_service_categories.length > 0)
      insertPayload.allowed_service_categories = body.allowed_service_categories;

    const { data: giftRows, error: giftError } = await supabase
      .from("gift_cards")
      .insert(insertPayload)
      .select("id, final_code")
      .limit(1);

    if (giftError) {
      console.error("Error inserting gift card:", giftError);
      throw new Error("failed to create gift card");
    }

    const giftCard = (giftRows && giftRows[0]) || null;
    if (!giftCard) throw new Error("failed to create gift card row");

    // Initialize payment with Paystack (reuse same flow as initialize-payment)
    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: body.purchaser_email || body.recipient_email || "no-reply@local",
          amount: Math.round(body.amount * 100),
          currency: "NGN",
          metadata: {
            gift_card_id: giftCard.id,
            purchaser_email: body.purchaser_email,
            recipient_email: body.recipient_email,
            message: body.message,
            idempotency_key: body.idempotency_key,
          },
        }),
      }
    );

    const paystackData = await paystackResponse.json();
    if (!paystackResponse.ok) {
      console.error("Paystack init error:", paystackData);
      throw new Error(paystackData.message || "Payment initialization failed");
    }

    // Insert a pending payment record referencing the gift_card via notes
    const { error: dbError } = await supabase.from("payments").insert({
      booking_id: null,
      amount: body.amount,
      payment_method: "card",
      payment_status: "pending",
      notes: `Paystack Reference: ${paystackData.data.reference} | gift_card_id: ${giftCard.id}`,
    });

    if (dbError) {
      console.error("Error creating pending payment:", dbError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        gift_card_id: giftCard.id,
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in purchase-gift-card function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
