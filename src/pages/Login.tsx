import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { PasswordStrengthIndicator, validatePassword } from "@/components/PasswordStrengthIndicator";
import { MFAVerification } from "@/components/MFAVerification";

const DEFAULT_PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireNumber: true,
  requireSpecial: true,
};

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextRaw = searchParams.get("next");
  // Only accept same-origin relative paths.
  const safeNext = nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : null;
  const [loading, setLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "front_desk",
  });
  const [passwordRequirements, setPasswordRequirements] = useState(DEFAULT_PASSWORD_REQUIREMENTS);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkPasswordExpiry(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Never await Supabase calls inside the auth callback — it deadlocks
        // the auth lock and signInWithPassword never resolves.
        setTimeout(() => {
          checkPasswordExpiry(session.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkPasswordExpiry = async (userId: string) => {
    try {
      // Get user's property access to check password rotation requirements
      const { data: access } = await supabase
        .from('user_property_access')
        .select('property_id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (access?.property_id) {
        const { data: property } = await supabase
          .from('properties')
          .select('password_rotation_days')
          .eq('id', access.property_id)
          .single();

        if (property?.password_rotation_days) {
          // Check last password change
          const { data: history } = await supabase
            .from('user_password_history')
            .select('password_changed_at')
            .eq('user_id', userId)
            .order('password_changed_at', { ascending: false })
            .limit(1)
            .single();

          if (history) {
            const lastChange = new Date(history.password_changed_at);
            const daysSinceChange = Math.floor((Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysSinceChange >= property.password_rotation_days) {
              navigate('/change-password?forced=true');
              return;
            }
          }
        }
      }
      
      navigate(safeNext ?? '/');
    } catch (error) {
      console.error('Error checking password expiry:', error);
      navigate(safeNext ?? '/');
    }
  };

  const checkAccountLockout = async (email: string): Promise<boolean> => {
    try {
      // Check for recent failed login attempts
      const { data: lockout } = await supabase
        .from('user_lockouts')
        .select('locked_at, unlock_at')
        .eq('user_id', email) // Using email as a proxy check
        .is('unlocked_at', null)
        .single();

      if (lockout && lockout.unlock_at) {
        const unlockTime = new Date(lockout.unlock_at);
        if (unlockTime > new Date()) {
          const remainingMinutes = Math.ceil((unlockTime.getTime() - Date.now()) / (1000 * 60));
          toast.error(`Account locked. Try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`);
          return true;
        }
      }
      return false;
    } catch {
      return false; // No lockout found
    }
  };

  const recordLoginAttempt = async (userId: string, success: boolean, propertyId?: string) => {
    try {
      await supabase.from('login_attempts').insert({
        user_id: userId,
        property_id: propertyId,
        success,
        attempt_time: new Date().toISOString(),
      });

      // Log to security audit
      await supabase.from('security_audit_logs').insert({
        user_id: userId,
        property_id: propertyId,
        event_type: success ? 'login_success' : 'login_failed',
        event_description: success ? 'User logged in successfully' : 'Failed login attempt',
      });
    } catch (e) {
      console.error('Failed to record login attempt:', e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) {
        // Record failed attempt (we don't have user_id yet, so use email hash as placeholder)
        await supabase.from('security_audit_logs').insert({
          event_type: 'login_failed',
          event_description: `Failed login attempt for email: ${loginData.email}`,
        });
        throw error;
      }

      // Check if MFA is required
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verifiedFactors = factors?.totp?.filter(f => f.status === 'verified') || [];
      
      if (verifiedFactors.length > 0) {
        setMfaFactorId(verifiedFactors[0].id);
        setMfaRequired(true);
        return;
      }

      // Record successful login
      if (data.user) {
        await recordLoginAttempt(data.user.id, true);
      }
      
      // Clear any previously selected property so the new user gets their correct property
      localStorage.removeItem("roommaster_selected_property");
      
      toast.success("Welcome back!");
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMFASuccess = async () => {
    setMfaRequired(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await recordLoginAttempt(user.id, true);
      await checkPasswordExpiry(user.id);
    }
    localStorage.removeItem("roommaster_selected_property");
    toast.success("Welcome back!");
  };

  const handleMFACancel = async () => {
    await supabase.auth.signOut();
    setMfaRequired(false);
    setMfaFactorId(null);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password strength
    const { isValid } = validatePassword(signupData.password, passwordRequirements);
    if (!isValid) {
      toast.error("Password does not meet the requirements");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            first_name: signupData.firstName,
            last_name: signupData.lastName,
            role: signupData.role,
          },
          emailRedirectTo: `${window.location.origin}${safeNext ?? "/"}`,
        },
      });

      if (error) throw error;
      toast.success("Account created! You can now log in.");
    } catch (error: any) {
      toast.error(error.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  // Show MFA verification screen if required
  if (mfaRequired && mfaFactorId) {
    return (
      <MFAVerification
        factorId={mfaFactorId}
        onSuccess={handleMFASuccess}
        onCancel={handleMFACancel}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-6">
          <BrandLogo variant="aspire" size="lg" className="mx-auto mb-4 justify-center [&>img]:!h-48" />
          <p className="text-muted-foreground">Property Management Portal</p>
        </div>

        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={signupData.firstName}
                    onChange={(e) => setSignupData({ ...signupData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={signupData.lastName}
                    onChange={(e) => setSignupData({ ...signupData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  required
                />
                <PasswordStrengthIndicator
                  password={signupData.password}
                  requirements={passwordRequirements}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Sign Up"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Login;
