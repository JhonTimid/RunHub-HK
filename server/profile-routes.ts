import type { Express } from "express";
import { storage } from "./storage";
import { z } from "zod";

const profileSchema = z.object({
  nickname: z.string().max(30).nullable().optional(),
  name: z.string().min(1).max(60).optional(),
  bio: z.string().max(300).nullable().optional(),
  gender: z.enum(["male", "female", "non_binary", "prefer_not_to_say"]).nullable().optional(),
  profilePicUrl: z.string().url().nullable().optional(),
  stravaUrl: z.string().url().nullable().optional().refine(
    (v) => !v || v.startsWith("https://www.strava.com/athletes/"),
    { message: "Must be a valid Strava athlete URL" }
  ),
  runPreferenceType: z.enum(["road", "trail", "mixed", "any"]).nullable().optional(),
  runPreferencePace: z.string().max(20).nullable().optional(),
  runPreferenceDistance: z.string().max(20).nullable().optional(),
  location: z.string().max(60).optional(),
});

export function registerProfileRoutes(app: Express) {
  // GET /api/user/profile — returns current user's full profile
  app.get("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const user = await storage.getUserById((req.user as any).id);
      if (!user) return res.status(404).json({ error: "User not found" });
      // Strip sensitive fields before sending
      const { passwordHash, stripeCustomerId, stripeSubscriptionId, ...safe } = user;
      res.json(safe);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // PUT /api/user/profile — update current user's profile
  app.put("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const parsed = profileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      }
      const updated = await storage.updateUserProfile((req.user as any).id, parsed.data);
      const { passwordHash, stripeCustomerId, stripeSubscriptionId, ...safe } = updated;
      res.json(safe);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
