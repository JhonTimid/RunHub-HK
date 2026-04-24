import type { Request, Response, NextFunction } from "express";

/**
 * Rejects non-admin users with 403.
 * Must be used after requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  if (user.role === "admin") {
    return next();
  }
  return res.status(403).json({ error: "Admin access required" });
}
