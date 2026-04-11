import type { Request, Response, NextFunction } from "express";

/**
 * Rejects non-premium, non-admin users with 403.
 * Must be used after requireAuth.
 */
export function requirePremium(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  if (user.role === "admin" || user.isPremium === true) {
    return next();
  }
  return res.status(403).json({
    error: "PREMIUM_REQUIRED",
    message: "This feature requires a Premium account. Upgrade to Premium to continue.",
  });
}
