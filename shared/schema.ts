import { pgTable, text, integer, real, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  role: text("role").notNull().default("user"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
