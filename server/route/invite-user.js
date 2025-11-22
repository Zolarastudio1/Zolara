// server/routes/invite.js
import express from "express";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();
const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in env");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

router.post("/", async (req, res) => {
  try {
    const { email, full_name, role } = req.body;

    if (!email) return res.status(400).json({ error: "Email is required" });
    if (!full_name)
      return res.status(400).json({ error: "Full name is required" });
    if (!role) return res.status(400).json({ error: "Role is required" });

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL}/auth`,
      });

    if (inviteError) {
      console.error("Invite error:", inviteError);
      return res.status(400).json({ error: inviteError.message });
    }

    const userId = inviteData?.user?.id;
    if (userId) {
      const { error: roleError } = await supabaseAdmin
        .from("users")
        .insert([{ user_id: userId, role }]);
      if (roleError) {
        console.error("Role insert error:", roleError);
        return res
          .status(500)
          .json({ error: "Invite sent but failed to assign role" });
      }

      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { full_name, role },
      });
    }

    return res.json({ success: true, message: "Invite sent successfully" });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

export default router;
