import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const ALLOWED_ROLES = [
  "client",
  "staff",
  "receptionist",
  "admin"
];
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true"
};
Deno.serve(async (req)=>{
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders
      });
    }
    const body = await req.json();
    const { email, full_name, phone, role, ...rest } = body;
    // Validate required fields
    if (!email?.trim() || !full_name?.trim() || !role?.trim()) {
      throw new Error("Missing required fields: email, full_name, role");
    }
    if (!ALLOWED_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone: phone || "",
        role,
        address: rest.address || "",
        notes: rest.notes || "",
        image: rest.image || "",
        specialization: rest.specialization || "",
        emergency_contact: rest.emergency_contact || "",
        is_active: rest.is_active ?? true
      }
    });
    if (error) throw error;
    // Generate password recovery link
    try {
      await supabase.auth.admin.generateLink({
        type: "recovery",
        email
      });
    } catch (recoveryError) {
      console.warn("Recovery email failed:", recoveryError);
    }
    // Respond with success
    return new Response(JSON.stringify({
      success: true,
      userId: data.user.id
    }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err: unknown) {
    console.error("User creation error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 400,
      headers: corsHeaders
    });
  }
});
