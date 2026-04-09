import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mountain } from "lucide-react";

// Google icon SVG
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { user, login, register, loginWithGoogle } = useAuth();
  const { toast } = useToast();

  // Detect ?tab=register in the hash query string
  const hashParams = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const [tab, setTab] = useState<"login" | "register">(
    hashParams.get("tab") === "register" ? "register" : "login"
  );

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // If already logged in redirect to race calendar
  useEffect(() => {
    if (user) navigate("/races");
  }, [user]);

  // Check for Google error in URL
  useEffect(() => {
    if (window.location.hash.includes("error=google_failed")) {
      toast({ title: "Google sign-in failed", description: "Please try again.", variant: "destructive" });
    }
  }, []);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (tab === "register" && (!form.name || form.name.length < 2)) e.name = "Name must be at least 2 characters";
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password || form.password.length < 6) e.password = "Password must be at least 6 characters";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
      if (tab === "login") {
        await login(form.email, form.password);
        toast({ title: "Welcome back!", description: "You're signed in." });
      } else {
        await register(form.name, form.email, form.password);
        toast({ title: "Account created!", description: `Welcome, ${form.name}!` });
      }
      navigate("/races");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="hsl(var(--primary))" />
          <circle cx="14" cy="6" r="2" fill="hsl(var(--primary-foreground))" />
          <line x1="14" y1="8" x2="14" y2="14" stroke="hsl(var(--primary-foreground))" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="14" y1="11" x2="10" y2="15" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" />
          <line x1="14" y1="11" x2="18" y2="13" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" />
          <line x1="14" y1="14" x2="10" y2="20" stroke="hsl(var(--primary-foreground))" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="10" y1="20" x2="8" y2="24" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" />
          <line x1="14" y1="14" x2="18" y2="19" stroke="hsl(var(--primary-foreground))" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="18" y1="19" x2="21" y2="23" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="font-display font-bold text-xl text-foreground tracking-tight">
          RunHub<span className="text-primary">HK</span>
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-lg">
        {/* Tab switcher */}
        <div className="flex bg-muted rounded-xl p-1 mb-6">
          <button
            onClick={() => setTab("login")}
            className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${tab === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-login"
          >
            Sign in
          </button>
          <button
            onClick={() => setTab("register")}
            className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${tab === "register" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-register"
          >
            Create account
          </button>
        </div>

        {/* Google button */}
        <button
          onClick={loginWithGoogle}
          className="w-full flex items-center justify-center gap-2.5 border border-border bg-background hover:bg-muted text-foreground text-sm font-medium py-2.5 rounded-xl transition-colors mb-4"
          data-testid="button-google-login"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {tab === "register" && (
            <div>
              <input
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${errors.name ? "border-destructive" : "border-border"}`}
                data-testid="input-name"
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
          )}

          <div>
            <input
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={`w-full bg-background border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${errors.email ? "border-destructive" : "border-border"}`}
              data-testid="input-email"
            />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>

          <div>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className={`w-full bg-background border rounded-xl px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${errors.password ? "border-destructive" : "border-border"}`}
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-all text-sm mt-1"
            data-testid="button-submit-auth"
          >
            {loading ? (tab === "login" ? "Signing in…" : "Creating account…") : (tab === "login" ? "Sign in" : "Create account")}
          </button>
        </form>

        {/* Terms */}
        {tab === "register" && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            By creating an account you agree to our terms of service.
          </p>
        )}
      </div>

      {/* Back to landing */}
      <a href="/#/" className="mt-5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        ← Back to home
      </a>
    </div>
  );
}
