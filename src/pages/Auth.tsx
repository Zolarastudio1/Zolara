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
import { Scissors, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import RoleSelect from "@/components/ui/role-select";

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
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password too long"),
  role: z.enum(["client", "staff", "receptionist", "owner"]).optional(),
});

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState<
    "client" | "staff" | "receptionist" | "owner"
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
          redirectTo: `${window.location.origin}/auth`,
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
      navigate("/auth");
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

      if (error) throw error;
      if (!data.user) throw new Error("User not found");

      // Fetch role from user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .single();

      if (roleError) throw roleError;
      if (!roleData) throw new Error("Role not found for this user");

      const role: string = roleData.role;

      // Save minimal user info
      const userData = { id: data.user.id, email: data.user.email, role };
      localStorage.setItem("user", JSON.stringify(userData));

      toast.success("Login successful!");
      redirectToDashboard(role);
    } catch (error: any) {
      if (error instanceof z.ZodError) toast.error(error.errors[0].message);
      else toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  /** Handle Signup */
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = signupSchema.parse({
        fullName: signupFullName,
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword,
        role: signupRole,
      });

      let roleToAssign = validated.role;

      // Only verify non-client staff emails
      if (validated.role !== "client") {
        const { data: isVerified, error: verifyError } = await supabase.rpc(
          "verify_staff_email",
          { email_to_check: validated.email, role_to_check: validated.role }
        );

        if (verifyError || !isVerified) {
          toast.error(
            "Your email must be registered by an administrator before signing up."
          );
          setLoading(false);
          return;
        }
      }

      // Signup user
      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: { full_name: validated.fullName, role: roleToAssign },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;

      // Insert role into user_roles table
      if (data.user) {
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: roleToAssign,
        });
        if (roleError) throw roleError;

        const userData = {
          id: data.user.id,
          email: data.user.email,
          role: roleToAssign,
        };
        localStorage.setItem("user", JSON.stringify(userData));

        toast.success(
          "Account created successfully! Please check your email to verify your account."
        );

        redirectToDashboard(roleToAssign);
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) toast.error(error.errors[0].message);
      else toast.error(error.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  /** Redirect user based on role */
  const redirectToDashboard = (role: string) => {
    switch (role) {
      case "owner":
        navigate("/admin/dashboard");
        break;
      case "receptionist":
      case "staff":
        navigate("/staff/dashboard");
        break;
      default:
        navigate("/dashboard");
        break;
    }
  };

  // If in password reset mode, show reset form
  if (isResettingPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary/30 via-background to-accent/20 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-2">
              <Scissors className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Set New Password
            </CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary/30 via-background to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-2">
            <Scissors className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Zolara Beauty Salon
          </CardTitle>
          <CardDescription>
            {/* Manage your salon operations efficiently */}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            {/* Login Form */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="pr-10" // space for the eye icon
                  />
                  <button
                    type="button"
                    className="absolute top-[38px] right-3 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1} // avoid focus when tabbing
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </Button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setShowResetDialog(true)}
                    className="text-sm text-primary hover:underline"
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
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={signupFullName}
                    onChange={(e) => setSignupFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    className="pr-10" // space for the eye icon
                  />
                  <button
                    type="button"
                    className="absolute top-[38px] right-3 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1} // avoid focus when tabbing
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Optional: Role Selection */}
                <div className="space-y-2">
                  <Label htmlFor="signup-role">Role</Label>
                  <RoleSelect
                    value={signupRole}
                    onChange={(val) => setSignupRole(val as any)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Password Reset Dialog */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>
                Enter your email address and we'll send you a link to reset your
                password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowResetDialog(false);
                      setResetEmail("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Auth;
