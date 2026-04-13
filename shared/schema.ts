import { pgTable, text, integer, real, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Races ───────────────────────────────────────────────────────────────────
export const races = pgTable("races", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: text("date").notNull(),
  dateTbc: boolean("date_tbc").notNull().default(false),
  location: text("location").notNull(),
  type: text("type").notNull(),
  distances: text("distances").notNull(),
  minDistanceKm: real("min_distance_km"),
  maxDistanceKm: real("max_distance_km"),
  registrationStatus: text("registration_status").notNull().default("unknown"),
  registrationUrl: text("registration_url"),
  sourceUrl: text("source_url"),
  sourceName: text("source_name"),
  description: text("description"),
  isNew: boolean("is_new").notNull().default(true),
  instagramPostUrl: text("instagram_post_url"),
  instagramAccount: text("instagram_account"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertRaceSchema = createInsertSchema(races).omit({ id: true });
export type InsertRace = z.infer<typeof insertRaceSchema>;
export type Race = typeof races.$inferSelect;

// ─── Alert Subscriptions ──────────────────────────────────────────────────────
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  filterType: text("filter_type"),
  filterMinDistanceKm: real("filter_min_distance_km"),
  filterMaxDistanceKm: real("filter_max_distance_km"),
  filterDateFrom: text("filter_date_from"),
  createdAt: text("created_at").notNull(),
  verified: boolean("verified").notNull().default(false),
  verifyToken: text("verify_token"),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, verified: true, verifyToken: true, createdAt: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// ─── Refresh Log ──────────────────────────────────────────────────────────────
export const refreshLog = pgTable("refresh_log", {
  id: serial("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  racesAdded: integer("races_added").notNull().default(0),
  racesUpdated: integer("races_updated").notNull().default(0),
  status: text("status").notNull(),
  message: text("message"),
});

export type RefreshLog = typeof refreshLog.$inferSelect;

// ─── Community Runs ───────────────────────────────────────────────────────────
export const communityRuns = pgTable("community_runs", {
  id: serial("id").primaryKey(),
  hostId: integer("host_id").notNull(),
  title: text("title").notNull(),
  runType: text("run_type").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  meetingPoint: text("meeting_point").notNull(),
  meetingLat: real("meeting_lat"),
  meetingLng: real("meeting_lng"),
  distanceKm: real("distance_km").notNull(),
  paceMin: text("pace_min"),
  paceMax: text("pace_max"),
  maxParticipants: integer("max_participants"),
  description: text("description"),
  visibility: text("visibility").notNull().default("public"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertCommunityRunSchema = createInsertSchema(communityRuns).omit({ id: true });
export type InsertCommunityRun = z.infer<typeof insertCommunityRunSchema>;
export type CommunityRun = typeof communityRuns.$inferSelect;

// ─── Run Participants ─────────────────────────────────────────────────────────
export const runParticipants = pgTable("run_participants", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),
  userId: integer("user_id").notNull(),
  status: text("status").notNull().default("joined"),
  joinedAt: text("joined_at").notNull(),
});

export const insertRunParticipantSchema = createInsertSchema(runParticipants).omit({ id: true });
export type InsertRunParticipant = z.infer<typeof insertRunParticipantSchema>;
export type RunParticipant = typeof runParticipants.$inferSelect;

// ─── Run Chat Messages ────────────────────────────────────────────────────────
export const runMessages = pgTable("run_messages", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),
  userId: integer("user_id").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertRunMessageSchema = createInsertSchema(runMessages).omit({ id: true });
export type InsertRunMessage = z.infer<typeof insertRunMessageSchema>;
export type RunMessage = typeof runMessages.$inferSelect;

// ─── Run Ratings ──────────────────────────────────────────────────────────────
export const runRatings = pgTable("run_ratings", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),
  raterId: integer("rater_id").notNull(),
  hostId: integer("host_id").notNull(),
  stars: integer("stars").notNull(),
  review: text("review"),
  createdAt: text("created_at").notNull(),
});

export const insertRunRatingSchema = createInsertSchema(runRatings).omit({ id: true });
export type InsertRunRating = z.infer<typeof insertRunRatingSchema>;
export type RunRating = typeof runRatings.$inferSelect;

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  handle: text("handle").notNull(),
  avatarInitials: text("avatar_initials").notNull(),
  avatarColor: text("avatar_color").notNull(),
  location: text("location").notNull().default("Hong Kong"),
  bio: text("bio"),
  totalRuns: integer("total_runs").notNull().default(0),
  avgRating: real("avg_rating"),
  createdAt: text("created_at").notNull(),
  email: text("email"),
  passwordHash: text("password_hash"),
  googleId: text("google_id"),
  googleAvatar: text("google_avatar"),
  authProvider: text("auth_provider").notNull().default("local"),
  // ── Subscription & roles ─────────────────────────────────────────────────
  role: text("role").notNull().default("user"),
  isPremium: boolean("is_premium").notNull().default(false),
  premiumUntil: text("premium_until"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  // ── Profile extras ───────────────────────────────────────────────────────
  nickname: text("nickname"),
  gender: text("gender"),                     // 'male' | 'female' | 'non_binary' | 'prefer_not_to_say'
  profilePicUrl: text("profile_pic_url"),     // external image URL (e.g. uploaded via Cloudinary)
  stravaUrl: text("strava_url"),              // e.g. https://www.strava.com/athletes/12345
  runPreferenceType: text("run_preference_type"),   // 'road' | 'trail' | 'mixed' | 'any'
  runPreferencePace: text("run_preference_pace"),   // e.g. '5:00-6:00'
  runPreferenceDistance: text("run_preference_distance"), // e.g. '10-21km'
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
