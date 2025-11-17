import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyPaymentRequest {
  reference: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      throw new Error("Paystack secret key not configured");
    }

    const { reference }: VerifyPaymentRequest = await req.json();

    console.log("Verifying payment for reference:", reference);

    if (!reference) {
      return new Response(
        JSON.stringify({ error: "Payment reference is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify payment with Paystack
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok) {
      console.error("Paystack verification error:", paystackData);
      throw new Error(paystackData.message || "Payment verification failed");
    }

    const paymentData = paystackData.data;
    console.log("Payment verified:", paymentData);

    // Update payment record in database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find payment by reference in notes
    const { data: existingPayments, error: fetchError } = await supabase
      .from("payments")
      .select("*")
      .ilike("notes", `%${reference}%`)
      .limit(1);

    if (fetchError) {
      console.error("Error fetching payment:", fetchError);
    }

    if (existingPayments && existingPayments.length > 0) {
      // Update existing payment record
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          payment_status: paymentData.status === "success" ? "completed" : "pending",
          notes: `Paystack Reference: ${reference} | Status: ${paymentData.status}`,
        })
        .eq("id", existingPayments[0].id);

      if (updateError) {
        console.error("Error updating payment:", updateError);
      }
    } else {
      // Create new payment record if not found (fallback)
      const bookingId = paymentData.metadata?.booking_id;
      if (bookingId) {
        const { error: insertError } = await supabase.from("payments").insert({
          booking_id: bookingId,
          amount: paymentData.amount / 100, // Convert from kobo to naira
          payment_method: "card",
          payment_status: paymentData.status === "success" ? "completed" : "pending",
          notes: `Paystack Reference: ${reference} | Status: ${paymentData.status}`,
        });

        if (insertError) {
          console.error("Error inserting payment:", insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: paymentData.status === "success",
        status: paymentData.status,
        amount: paymentData.amount / 100,
        currency: paymentData.currency,
        customer: paymentData.customer,
        paid_at: paymentData.paid_at,
        reference: paymentData.reference,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-payment function:", error);
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
