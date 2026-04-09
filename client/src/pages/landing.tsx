import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { Mountain, Route, Users, Star, Calendar, ChevronRight, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const FEATURES = [
  {
    icon: Calendar,
    title: "Hong Kong Race Calendar",
    desc: "Every road & trail race in HK — updated daily from RaceFinder, Finishers.com & HK100.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: Users,
    title: "Community Runs",
    desc: "Join or host informal group runs — trail sessions, tempo runs, recovery jogs and more.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Star,
    title: "Host Reputation",
    desc: "Rate your experience after every group run. Build trust in the running community.",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    icon: Zap,
    title: "Race Alerts",
    desc: "Get notified when new races drop — filter by type, distance and date.",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
];

const STATS = [
  { value: "50+", label: "Races tracked" },
  { value: "5", label: "Run types" },
  { value: "HK", label: "Based in" },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  // Redirect logged-in users straight to race calendar
  useEffect(() => {
    if (!loading && user) navigate("/races");
  }, [user, loading]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <RunnerLogo />
            <span className="font-display font-bold text-lg tracking-tight text-foreground">
              RunHub<span className="text-primary">HK</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <a className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors no-underline">
                Sign in
              </a>
            </Link>
            <Link href="/login?tab=register">
              <a
                className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors no-underline"
                data-testid="button-get-started-nav"
              >
                Get started
              </a>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-5 pt-20 pb-16">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-primary/20">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Built for Hong Kong runners
        </div>

        {/* Headline */}
        <h1 className="font-display font-bold text-foreground leading-tight mb-4 max-w-2xl"
          style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>
          Find races.{" "}
          <span className="text-primary">Host runs.</span>{" "}
          Connect with runners.
        </h1>

        <p className="text-muted-foreground text-base sm:text-lg max-w-xl mb-8 leading-relaxed">
          The community platform for Hong Kong's running scene — race discovery, group runs, and host ratings all in one place.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-16">
          <Link href="/login?tab=register">
            <a
              className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-all text-sm no-underline glow-primary"
              data-testid="button-cta-register"
            >
              Create free account
              <ChevronRight size={16} />
            </a>
          </Link>
          <Link href="/login">
            <a className="flex items-center gap-2 border border-border text-foreground font-medium px-6 py-3 rounded-xl hover:border-muted-foreground transition-colors text-sm no-underline">
              Sign in
            </a>
          </Link>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-8 mb-16">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display font-bold text-2xl text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-card border border-border rounded-xl p-5 text-left hover:border-primary/40 transition-colors">
                <div className={`w-9 h-9 rounded-xl ${f.bg} flex items-center justify-center mb-3`}>
                  <Icon size={18} className={f.color} />
                </div>
                <h3 className="font-semibold text-sm text-foreground mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-5 px-5 text-center">
        <p className="text-xs text-muted-foreground">
          RunHub HK · Built for runners, by runners · Hong Kong 🇭🇰
        </p>
      </footer>
    </div>
  );
}

function RunnerLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="RunHub HK logo">
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
  );
}
