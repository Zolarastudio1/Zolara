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
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .single();

      const role = roleData?.role || "client";

      // Save minimal user data in localStorage
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate inputs
      const validated = signupSchema.parse({
        fullName: signupFullName,
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword,
        role: signupRole,
      });

      let roleToAssign = validated.role;

      
      // Check staff record if not client using the verify_staff_email function
      if (validated.role !== "client") {
        const { data: isVerified, error: verifyError } = await supabase.rpc(
          "verify_staff_email",
          {
            email_to_check: validated.email,
            role_to_check: validated.role,
          }
        );

        if (verifyError || !isVerified) {
          toast.error("Your email must be registered by an administrator before signing up. Please contact the owner.");
          setLoading(false);
          return;
        }
      }

      // Do NOT call redirectToDashboard here
      const emailRedirectLink = `${window.location.origin}/dashboard`;

      // Supabase signup
      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: {
            full_name: validated.fullName,
            role: roleToAssign,
          },
          emailRedirectTo: emailRedirectLink, // just pass the URL, don't call function
        },
      });

      if (error) throw error;

      // After successful signup
      if (!data.user) {
        toast.success(
          "Signup successful! Please check your email to verify your account."
        );
        return;
      }

      // Insert role into user_roles table
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: data.user.id,
          role: roleToAssign as any, // Type will auto-update after migration
        });

      if (roleError) throw roleError;

      // Save user locally
      const userData = {
        id: data.user.id,
        email: data.user.email,
        role: roleToAssign,
      };
      localStorage.setItem("user", JSON.stringify(userData));

      toast.success("Account created successfully!");

      // Redirect manually (AFTER signup)
      redirectToDashboard(roleToAssign);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
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
        navigate("/admin/dashboard");
        break;
      case "receptionist":
        navigate("/staff/dashboard");
        break;
      case "staff":
        navigate("/staff/dashboard");
        break;
      default:
        navigate("/dashboard");
    }
  };

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
    </div>
  );
};

export default Auth;
