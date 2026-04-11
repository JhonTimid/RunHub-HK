import type { Request, Response, NextFunction } from "express";

/**
 * Rejects unauthenticated requests with 401.
 * Use on any route that requires a logged-in user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  return res.status(401).json({ error: "Not authenticated" });
}
