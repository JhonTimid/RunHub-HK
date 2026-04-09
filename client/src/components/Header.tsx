import { Link, useLocation } from "wouter";
import { Bell, Sun, Moon, Users, LogOut, LayoutDashboard, ChevronDown, Crown, ShieldCheck, Zap } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Header() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => {
    if (path === "/races") return location === "/races" || location === "/";
    return location.startsWith(path);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    toast({ title: "Signed out", description: "See you next run!" });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/races">
          <a className="flex items-center gap-2.5 text-foreground no-underline" data-testid="link-logo">
            <LogoMark />
            <span className="font-display font-bold text-lg tracking-tight hidden sm:block">
              RunHub<span className="text-primary">HK</span>
            </span>
          </a>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-0.5">
          <Link href="/races">
            <a
              className={`text-sm px-3 py-1.5 rounded-md transition-colors ${isActive("/races") ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="nav-races"
            >
              Races
            </a>
          </Link>
          <Link href="/community">
            <a
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors ${isActive("/community") ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="nav-community"
            >
              <Users size={13} />
              Community
            </a>
          </Link>
          <Link href="/community/dashboard">
            <a
              className={`text-sm px-3 py-1.5 rounded-md transition-colors hidden sm:block ${isActive("/community/dashboard") ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="nav-dashboard"
            >
              My Runs
            </a>
          </Link>
          <Link href="/alerts">
            <a
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors ${isActive("/alerts") ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="nav-alerts"
            >
              <Bell size={13} />
              Alerts
            </a>
          </Link>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            data-testid="button-theme-toggle"
            className="ml-1 w-8 h-8"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </Button>

          {/* User menu */}
          {user && (
            <div className="relative ml-1" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                data-testid="button-user-menu"
              >
                <div className="relative">
                  {user.googleAvatar ? (
                    <img
                      src={user.googleAvatar}
                      alt={user.name}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: user.avatarColor }}
                    >
                      {user.avatarInitials}
                    </span>
                  )}
                  {(user as any).isPremium && (
                    <Crown size={10} className="absolute -top-1 -right-1 text-amber-400 fill-amber-400" />
                  )}
                  {(user as any).role === "admin" && (
                    <ShieldCheck size={10} className="absolute -top-1 -right-1 text-primary fill-primary/20" />
                  )}
                </div>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-xl py-1 z-50">
                  {/* User info */}
                  <div className="px-3 py-2.5 border-b border-border">
                    <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{user.handle}</p>
                    {(user as any).role === "admin" && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-primary">
                        <ShieldCheck size={10} /> Admin
                      </span>
                    )}
                    {(user as any).role !== "admin" && (user as any).isPremium && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-amber-500">
                        <Crown size={10} /> Premium
                      </span>
                    )}
                  </div>

                  <Link href="/community/dashboard">
                    <a
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors no-underline"
                      onClick={() => setMenuOpen(false)}
                      data-testid="menu-dashboard"
                    >
                      <LayoutDashboard size={14} className="text-muted-foreground" />
                      My Runs Dashboard
                    </a>
                  </Link>

                  {/* Subscription link */}
                  {(user as any).role !== "admin" && (
                    <Link href="/subscription">
                      <a
                        className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors no-underline"
                        onClick={() => setMenuOpen(false)}
                        data-testid="menu-subscription"
                      >
                        {(user as any).isPremium ? (
                          <>
                            <Crown size={14} className="text-amber-400" />
                            <span className="text-foreground">Premium Plan</span>
                          </>
                        ) : (
                          <>
                            <Zap size={14} className="text-primary" />
                            <span className="text-primary font-medium">Upgrade to Premium</span>
                          </>
                        )}
                      </a>
                    </Link>
                  )}

                  {/* Admin link — only for admins */}
                  {(user as any).role === "admin" && (
                    <Link href="/admin">
                      <a
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors no-underline"
                        onClick={() => setMenuOpen(false)}
                        data-testid="menu-admin"
                      >
                        <ShieldCheck size={14} className="text-primary" />
                        Admin Dashboard
                      </a>
                    </Link>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    data-testid="button-logout"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="RunHub HK logo" className="flex-shrink-0">
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
