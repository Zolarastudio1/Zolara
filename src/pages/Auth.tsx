import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { z } from "zod";
import RoleSelect from "@/components/ui/role-select";
import { useSettings } from "@/context/SettingsContext";

// Validation schemas
const loginSchema = z.object({
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name too long"),
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  phone: z.string().max(15, "Phone number too long"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(12, "Password too long"),
  role: z.enum(["client", "staff", "receptionist"]).optional(),
});

const Auth = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();

  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState<
    "client" | "staff" | "receptionist"
  >("client");

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /** Check if user is in password recovery mode */
  useState(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get("type") === "recovery") {
      setIsResettingPassword(true);
    }
  });

  /** Handle Password Reset Request */
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedEmail = z.string().email().parse(resetEmail);

      const { error } = await supabase.auth.resetPasswordForEmail(
        validatedEmail,
        {
          redirectTo: `${window.location.origin}/app/auth`,
        }
      );

      if (error) throw error;

      toast.success("Password reset email sent! Check your inbox.");
      setShowResetDialog(false);
      setResetEmail("");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to send reset email");
      }
    } finally {
      setLoading(false);
    }
  };

  /** Handle New Password Update */
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (newPassword !== confirmPassword)
        throw new Error("Passwords do not match");
      if (newPassword.length < 6)
        throw new Error("Password must be at least 6 characters");

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      toast.success("Password updated successfully!");
      setIsResettingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
      navigate("/app/auth");
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  /** Handle Login */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = loginSchema.parse({
        email: loginEmail,
        password: loginPassword,
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      const metaDataRole = data.user?.user_metadata?.role;

      if (error) throw error;
      if (!data.user) throw new Error("User not found");

      // Fetch or create role in one safe block
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .single();

      // If role does not exist, create it
      const role = roleData?.role || metaDataRole;
      console.log("User role:", role);

      // Save minimal user info
      const userData = { id: data.user.id, email: data.user.email, role };
      localStorage.setItem("user", JSON.stringify(userData));

      toast.success("Login successful!");
      redirectToDashboard(role);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error.message?.includes("user_metadata")) {
        // Friendly fallback for null user_metadata
        toast.error(
          "Please confirm your email before logging in. Check your inbox."
        );
      } else {
        toast.error(error.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  /** Handle Signup */
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data
      const validated = signupSchema.parse({
        fullName: signupFullName.trim(),
        email: signupEmail.trim().toLowerCase(),
        phone: signupPhone.trim(),
        password: signupPassword,
        role: signupRole,
      });

      const roleToAssign = validated.role;

      // Staff/receptionist must exist before signup
      if (roleToAssign !== "client") {
        const { data: isVerified, error: verifyError } = await supabase.rpc(
          "verify_staff_email",
          {
            email_to_check: validated.email,
            role_to_check: roleToAssign,
          }
        );

        if (verifyError) throw verifyError;
        if (!isVerified) {
          toast.error(
            "Your email must be registered by an administrator with the correct role before signing up."
          );
          return;
        }
      }

      // Clients: check if they already exist
      if (roleToAssign === "client") {
        const { data: existingClient, error: clientError } = await supabase
          .from("clients")
          .select("id")
          .eq("email", validated.email)
          .maybeSingle();

        // Ignore "no rows" error
        if (clientError && clientError.code !== "PGRST116") throw clientError;

        if (existingClient) {
          // Update existing client info instead of creating new
          const { error: updateError } = await supabase
            .from("clients")
            .update({
              full_name: validated.fullName,
              phone: validated.phone,
            } as any)
            .eq("email", validated.email);

          if (updateError) throw updateError;

          toast.success(
            "Your account exists. Updated info successfully. Please login."
          );
          return; // Stop further execution
        }
      }

      // Create Supabase auth user
      const clientData = {
        role: "client",
        full_name: validated.fullName,
        email: validated.email,
        phone: validated.phone,
        password: validated.password,
        auth: true,
      };

      console.log("Client data", clientData);

      const { data, error } = await supabase.functions.invoke("invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(clientData),
      });

      // Explicitly stop if signup fails
      if (error) {
        console.error("Signup error:", error);
        toast.error(error.message || "Signup failed");
        return;
      }

      if (!data?.user) {
        toast.error("Signup failed: user was not created");
        return;
      }

      // Success: save user data locally
      const userData = {
        id: data.user.id,
        email: data.user.email,
        phone: validated.phone,
        role: roleToAssign,
      };
      localStorage.setItem("user", JSON.stringify(userData));

      toast.success(
        "Account created successfully! Please check your email to verify your account."
      );

      redirectToDashboard(roleToAssign);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (
        error?.code === "user_already_exists" ||
        error?.message?.toLowerCase().includes("user already registered")
      ) {
        toast.error(
          "An account with this email already exists. Please log in or reset your password."
        );
      } else {
        toast.error(error.message || "Signup failed");
      }
    } finally {
      setLoading(false);
    }
  };

  /** Redirect user based on role */
  const redirectToDashboard = (role: string) => {
    switch (role) {
      case "owner":
        navigate("/app/admin/dashboard");
        break;
      case "receptionist":
        navigate("/app/receptionist/dashboard");
        break;
      case "staff":
        navigate("/app/staff/dashboard");
        break;
      case "client":
        navigate("/app/client/dashboard");
        break;
      default:
        navigate("/app/client/dashboard");
        break;
    }
  };

  // If in password reset mode, show reset form
  if (isResettingPassword) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage:
            "url('https://ekvjnydomfresnkealpb.supabase.co/storage/v1/object/public/avatars/logo_1764609621458.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Blur overlay */}
        <div className="absolute inset-0 backdrop-blur-md bg-black/40" />

        <Card className="w-full max-w-md shadow-2xl relative z-10 bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mb-2 overflow-hidden border-2 border-champagne">
              <img
                src={settings.logo_url ?? "/assets/zolara-logo.jpg"}
                className="w-full h-full object-cover"
                alt="Zolara Logo"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Set New Password
            </CardTitle>
            <CardDescription className="text-white/70">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-white/90">
                  New Password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-white/90">
                  Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-champagne hover:bg-champagne-dark text-white font-semibold"
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="absolute bottom-4 left-0 right-0 text-center z-10">
          <p className="text-white/60 text-sm">
            Powered by Zolara Management System
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex relative"
      style={{
        backgroundImage:
          "url('https://ekvjnydomfresnkealpb.supabase.co/storage/v1/object/public/avatars/logo_1764609621458.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-md bg-black/40" />

      {/* Left Side - Welcome Message */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center items-center p-12 text-white">
        <div className="max-w-md text-center space-y-6">
          <div className="mx-auto w-24 h-24 bg-white/20 backdrop-blur rounded-full flex items-center justify-center overflow-hidden border-2 border-champagne shadow-xl">
            <img
              src={
                settings.logo_url ||
                "https://ekvjnydomfresnkealpb.supabase.co/storage/v1/object/public/avatars/logo_1764609621458.jpg"
              }
              className="w-full h-full object-cover"
              alt="Zolara Logo"
            />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            {/* @ts-ignore */}
            Welcome to {settings?.business_name || "Zolara Beauty Studio"}
          </h1>
          <p className="text-xl text-white/80 italic flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-champagne" />
            Where Beauty Meets Excellence
            <Sparkles className="w-5 h-5 text-champagne" />
          </p>
          <div className="pt-6 space-y-3">
            <p className="text-white/70">
              Book appointments, manage your beauty journey, and experience
              premium salon services.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 relative z-10 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-2xl bg-white/10 backdrop-blur-xl border-white/20 rounded-2xl">
          <CardHeader className="text-center space-y-2">
            {/* Mobile Logo */}
            <div className="lg:hidden mx-auto w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mb-2 overflow-hidden border-2 border-champagne">
              <img
                src={settings.logo_url ?? "/assets/zolara-logo.jpg"}
                className="w-full h-full object-cover"
                alt="Zolara Logo"
              />
            </div>

            <CardTitle className="text-2xl font-bold text-white">
              {/* @ts-ignore */}
              {settings?.business_name || "Zolara Beauty Studio"}
            </CardTitle>
            <CardDescription className="text-white/70 lg:hidden flex items-center justify-center gap-1">
              <Sparkles className="w-4 h-4 text-champagne" />
              Where Beauty Meets Excellence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/10 border border-white/20">
                <TabsTrigger
                  value="login"
                  className="data-[state=active]:bg-champagne data-[state=active]:text-white text-white/70"
                >
                  Login
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="data-[state=active]:bg-champagne data-[state=active]:text-white text-white/70"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              {/* Login Form */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-white/90">
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-champagne"
                    />
                  </div>
                  <div className="space-y-2 relative">
                    <Label htmlFor="login-password" className="text-white/90">
                      Password
                    </Label>
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="pr-10 bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-champagne"
                    />
                    <button
                      type="button"
                      className="absolute top-[38px] right-3 text-white/50 hover:text-white/80"
                      onClick={() => setShowPassword((prev) => !prev)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-champagne hover:bg-champagne-dark text-white font-semibold shadow-lg"
                    disabled={loading}
                  >
                    {loading ? "Logging in..." : "Login"}
                  </Button>

                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => setShowResetDialog(true)}
                      className="text-sm text-champagne hover:text-white transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>
              </TabsContent>

              {/* Signup Form */}
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-white/90">
                      Full Name
                    </Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      required
                      className="bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-champagne"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-white/90">
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      className="bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-champagne"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-phone" className="text-white/90">
                      Phone
                    </Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="+233 30 1234567"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      required
                      className="bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-champagne"
                    />
                  </div>
                  <div className="space-y-2 relative">
                    <Label htmlFor="signup-password" className="text-white/90">
                      Password
                    </Label>
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      className="pr-10 bg-white/10 border-white/30 text-white placeholder:text-white/50 focus:border-champagne"
                    />
                    <button
                      type="button"
                      className="absolute top-[38px] right-3 text-white/50 hover:text-white/80"
                      onClick={() => setShowPassword((prev) => !prev)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Optional: Role Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-role" className="text-white/90">
                      Role
                    </Label>
                    <RoleSelect
                      value={signupRole}
                      onChange={(val) => setSignupRole(val as any)}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-champagne hover:bg-champagne-dark text-white font-semibold shadow-lg"
                    disabled={loading}
                  >
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Password Reset Dialog */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white/10 backdrop-blur-xl border-white/20 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-white">Reset Password</CardTitle>
              <CardDescription className="text-white/70">
                Enter your email address and we'll send you a link to reset your
                password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-white/90">
                    Email
                  </Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-white/30 text-white hover:bg-white/10"
                    onClick={() => {
                      setShowResetDialog(false);
                      setResetEmail("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-champagne hover:bg-champagne-dark text-white"
                    disabled={loading}
                  >
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center z-10">
        <p className="text-white/60 text-sm">
          Powered by Zolara Management System
        </p>
      </div>
    </div>
  );
};

export default Auth;
