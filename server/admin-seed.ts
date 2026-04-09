import bcrypt from "bcryptjs";
import { storage } from "./storage";

// ── Super Admin credentials (override via env vars in production) ─────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@runhub.hk";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "RunHubAdmin2026!";
const ADMIN_NAME = "Super Admin";

export async function seedAdminAccount() {
  const existing = await storage.getUserByEmail(ADMIN_EMAIL);
  if (existing) {
    // If account exists but isn't admin, promote it
    if ((existing as any).role !== "admin") {
      await storage.setUserRole(existing.id, "admin");
      await storage.updateUserSubscription(existing.id, {
        isPremium: true,
        premiumUntil: "2099-12-31",
      });
      console.log(`[admin-seed] Promoted ${ADMIN_EMAIL} to admin`);
    } else {
      console.log(`[admin-seed] Admin account already exists (${ADMIN_EMAIL})`);
    }
    return;
  }

  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  const user = await storage.createUser({
    name: ADMIN_NAME,
    handle: "superadmin_hk",
    avatarInitials: "SA",
    avatarColor: "#ef4444",
    location: "Hong Kong",
    bio: "RunHub HK Super Administrator",
    totalRuns: 0,
    avgRating: null,
    createdAt: new Date().toISOString(),
    email: ADMIN_EMAIL,
    passwordHash,
    googleId: null,
    googleAvatar: null,
    authProvider: "local",
    role: "admin",
    isPremium: true,
    premiumUntil: "2099-12-31",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  });

  console.log(`[admin-seed] ✅ Super admin created → email: ${ADMIN_EMAIL} | password: ${ADMIN_PASSWORD}`);
}
