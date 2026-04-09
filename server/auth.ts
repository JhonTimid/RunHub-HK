import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { storage } from "./storage";

// ── Serialise / Deserialise ───────────────────────────────────────────────────
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await storage.getUserById(id);
    done(null, user ?? false);
  } catch (err) {
    done(err);
  }
});

// ── Local Strategy (email + password) ─────────────────────────────────────────
passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) return done(null, false, { message: "No account found with that email." });
      if (!user.passwordHash) return done(null, false, { message: "This account uses Google sign-in." });
      const valid = bcrypt.compareSync(password, user.passwordHash);
      if (!valid) return done(null, false, { message: "Incorrect password." });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// ── Google OAuth Strategy ─────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:5000/api/auth/google/callback";

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value ?? "";
          const name = profile.displayName ?? "Runner";
          const avatar = profile.photos?.[0]?.value ?? null;

          // Check if user already exists by Google ID or email
          let user = await storage.getUserByGoogleId(profile.id);
          if (!user && email) user = await storage.getUserByEmail(email);

          if (user) {
            // Update google avatar if changed
            if (avatar && user.googleAvatar !== avatar) {
              await storage.updateUserGoogleAvatar(user.id, avatar);
              user = { ...user, googleAvatar: avatar };
            }
            return done(null, user);
          }

          // Create new user from Google profile
          const initials = name
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          const colors = ["#22c55e", "#3b82f6", "#f97316", "#a855f7", "#ec4899", "#14b8a6"];
          const color = colors[Math.floor(Math.random() * colors.length)];
          const handle = email.split("@")[0].replace(/[^a-z0-9]/gi, "_").toLowerCase() + "_hk";

          const newUser = await storage.createUser({
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
            passwordHash: null,
            googleId: profile.id,
            googleAvatar: avatar,
            authProvider: "google",
          });

          return done(null, newUser);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

export default passport;
