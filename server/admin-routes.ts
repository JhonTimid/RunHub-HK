import { Express, Request, Response } from "express";
import { storage } from "./storage";
import bcrypt from "bcryptjs";

// ── Middleware: require admin role ────────────────────────────────────────────
function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Login required" });
  }
  const u = req.user as any;
  if (u?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export function registerAdminRoutes(app: Express) {
  // ── GET /api/admin/stats ────────────────────────────────────────────────────
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsersAdmin();
      const allRaces = await storage.getAllRaces();
      const allRuns = await storage.getAllCommunityRuns();

      const premiumUsers = allUsers.filter((u: any) => u.isPremium);
      const adminUsers = allUsers.filter((u: any) => u.role === "admin");
      const today = new Date().toISOString().slice(0, 10);
      const upcomingRaces = allRaces.filter(r => r.date >= today || r.dateTbc);

      res.json({
        totalUsers: allUsers.length,
        premiumUsers: premiumUsers.length,
        freeUsers: allUsers.length - premiumUsers.length - adminUsers.length,
        adminUsers: adminUsers.length,
        totalRaces: allRaces.length,
        upcomingRaces: upcomingRaces.length,
        totalCommunityRuns: allRuns.length,
        activeRuns: allRuns.filter(r => r.status === "active").length,
        monthlyRevenue: premiumUsers.length * 30, // HKD
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ── GET /api/admin/users ────────────────────────────────────────────────────
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsersAdmin();
      // Strip password hashes from response
      const safe = users.map((u: any) => {
        const { passwordHash, ...rest } = u;
        return rest;
      });
      res.json({ users: safe, total: safe.length });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ── PATCH /api/admin/users/:id/role ────────────────────────────────────────
  app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    try {
      const { role } = req.body;
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ error: "Role must be 'user' or 'admin'" });
      }
      await storage.setUserRole(Number(req.params.id), role);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ── PATCH /api/admin/users/:id/premium ────────────────────────────────────
  // Manually grant or revoke premium
  app.patch("/api/admin/users/:id/premium", requireAdmin, async (req, res) => {
    try {
      const { isPremium } = req.body;
      const until = isPremium
        ? (() => {
            const d = new Date();
            d.setFullYear(d.getFullYear() + 100); // effectively permanent when manually granted
            return d.toISOString().slice(0, 10);
          })()
        : null;

      await storage.updateUserSubscription(Number(req.params.id), {
        isPremium: !!isPremium,
        premiumUntil: until,
      });
      res.json({ success: true, isPremium: !!isPremium, premiumUntil: until });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ── DELETE /api/admin/users/:id ───────────────────────────────────────────
  // Soft-delete: demote to free user and clear sensitive fields
  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const me = req.user as any;
      if (me.id === Number(req.params.id)) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      await storage.updateUserSubscription(Number(req.params.id), {
        isPremium: false,
        premiumUntil: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });
      await storage.setUserRole(Number(req.params.id), "user");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ── GET /api/admin/races ──────────────────────────────────────────────────
  app.get("/api/admin/races", requireAdmin, async (req, res) => {
    try {
      const races = await storage.getAllRaces();
      res.json({ races, total: races.length });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ── GET /api/admin/runs ───────────────────────────────────────────────────
  app.get("/api/admin/runs", requireAdmin, async (req, res) => {
    try {
      const runs = await storage.getAllCommunityRuns();
      res.json({ runs, total: runs.length });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
