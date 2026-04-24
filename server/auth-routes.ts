import { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import passport from "./auth";
import bcrypt from "bcryptjs";
import { storage } from "./storage";

// ── Rate limiters ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // max 10 attempts per window
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                   // max 5 registrations per hour per IP
  message: { error: "Too many accounts created from this IP. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export function registerAuthRoutes(app: Express) {
  // ── GET /api/auth/me ── returns current session user ────────────────────────
  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      const u = req.user as any;
      res.json({
        id: u.id,
        name: u.name,
        handle: u.handle,
        email: u.email,
        avatarInitials: u.avatarInitials,
        avatarColor: u.avatarColor,
        googleAvatar: u.googleAvatar,
        authProvider: u.authProvider,
        bio: u.bio,
        location: u.location,
        totalRuns: u.totalRuns,
        avgRating: u.avgRating,
        isPremium: u.isPremium,
        role: u.role,
      });
    } else {
      res.status(401).json({ user: null });
    }
  });

  // ── POST /api/auth/register ── email + password sign-up ─────────────────────
  app.post("/api/auth/register", registerLimiter, async (req: Request, res: Response) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    try {
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists." });
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
      const colors = ["#22c55e", "#3b82f6", "#f97316", "#a855f7", "#ec4899", "#14b8a6"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const base = email.split("@")[0].replace(/[^a-z0-9]/gi, "_").toLowerCase();
      // Add random suffix to avoid handle collisions between users with same email prefix
      const handle = `${base}_hk_${Math.floor(Math.random() * 9999)}`;

      const user = await storage.createUser({
        name,
        handle,
        avatarInitials: initials,
        avatarColor: color,
        location: "Hong Kong",
        bio: null,
        totalRuns: 0,
        avgRating: null,
        createdAt: new Date().toISOString(),
        email,
        passwordHash,
        googleId: null,
        googleAvatar: null,
        authProvider: "local",
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ error: "Login failed after registration." });
        res.json({
          id: user.id,
          name: user.name,
          handle: user.handle,
          email: user.email,
          avatarInitials: user.avatarInitials,
          avatarColor: user.avatarColor,
          googleAvatar: user.googleAvatar,
          authProvider: user.authProvider,
          isPremium: user.isPremium,
          role: user.role,
        });
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ── POST /api/auth/login ── email + password login ───────────────────────────
  app.post("/api/auth/login", loginLimiter, (req: Request, res: Response, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message ?? "Login failed." });
      req.login(user, (err2) => {
        if (err2) return next(err2);
        res.json({
          id: user.id,
          name: user.name,
          handle: user.handle,
          email: user.email,
          avatarInitials: user.avatarInitials,
          avatarColor: user.avatarColor,
          googleAvatar: user.googleAvatar,
          authProvider: user.authProvider,
          isPremium: user.isPremium,
          role: user.role,
        });
      });
    })(req, res, next);
  });

  // ── POST /api/auth/logout ────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout(() => {
      res.json({ success: true });
    });
  });

  // ── GET /api/auth/google ── initiate Google OAuth ────────────────────────────
  app.get(
    "/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  // ── GET /api/auth/google/callback ────────────────────────────────────────────
  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/#/login?error=google_failed" }),
    (_req: Request, res: Response) => {
      res.redirect("/#/races");
    }
  );
}
