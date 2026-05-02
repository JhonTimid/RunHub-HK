import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import {
  communityRuns,
  runParticipants, runMessages, runRatings, users,
} from "../shared/schema";
import type {
  CommunityRun, InsertCommunityRun, RunParticipant,
  RunMessage, InsertRunMessage, RunRating, InsertRunRating,
  User, InsertUser,
} from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

// ─── Init tables ─────────────────────────────────────────────────────────────
export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      handle TEXT NOT NULL,
      avatar_initials TEXT NOT NULL,
      avatar_color TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT 'Hong Kong',
      bio TEXT,
      total_runs INTEGER NOT NULL DEFAULT 0,
      avg_rating REAL,
      created_at TEXT NOT NULL,
      email TEXT,
      password_hash TEXT,
      google_id TEXT,
      google_avatar TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'local',
      role TEXT NOT NULL DEFAULT 'user'
    );
    CREATE TABLE IF NOT EXISTS community_runs (
      id SERIAL PRIMARY KEY,
      host_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      run_type TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      meeting_point TEXT NOT NULL,
      meeting_lat REAL,
      meeting_lng REAL,
      distance_km REAL NOT NULL,
      pace_min TEXT,
      pace_max TEXT,
      max_participants INTEGER,
      description TEXT,
      visibility TEXT NOT NULL DEFAULT 'public',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS run_participants (
      id SERIAL PRIMARY KEY,
      run_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'joined',
      joined_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS run_messages (
      id SERIAL PRIMARY KEY,
      run_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS run_ratings (
      id SERIAL PRIMARY KEY,
      run_id INTEGER NOT NULL,
      rater_id INTEGER NOT NULL,
      host_id INTEGER NOT NULL,
      stars INTEGER NOT NULL,
      review TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session (
      sid VARCHAR NOT NULL COLLATE "default",
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session (expire);
  `);
}

export interface IStorage {
  getAllUsers(): Promise<User[]>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: any): Promise<User>;
  insertUser(user: InsertUser): Promise<User>;
  updateUserStats(id: number, data: Partial<User>): Promise<void>;
  updateUserGoogleAvatar(id: number, avatar: string): Promise<void>;
  getRunsHostedThisMonth(userId: number): Promise<number>;

  getAllCommunityRuns(opts?: { hostId?: number; status?: string }): Promise<CommunityRun[]>;
  getCommunityRunById(id: number): Promise<CommunityRun | undefined>;
  insertCommunityRun(run: InsertCommunityRun): Promise<CommunityRun>;
  updateCommunityRun(id: number, data: Partial<InsertCommunityRun>): Promise<CommunityRun | undefined>;

  getParticipants(runId: number): Promise<RunParticipant[]>;
  getParticipantCount(runId: number): Promise<number>;
  isJoined(runId: number, userId: number): Promise<boolean>;
  joinRun(runId: number, userId: number): Promise<RunParticipant>;
  leaveRun(runId: number, userId: number): Promise<void>;

  getMessages(runId: number): Promise<RunMessage[]>;
  insertMessage(msg: InsertRunMessage): Promise<RunMessage>;

  getRatingsForHost(hostId: number): Promise<RunRating[]>;
  insertRating(rating: InsertRunRating): Promise<RunRating>;
  hasRated(runId: number, raterId: number): Promise<boolean>;
}

export const storage: IStorage = {
  async getAllUsers() {
    return db.select().from(users);
  },
  async getUserById(id) {
    return db.select().from(users).where(eq(users.id, id)).then(r => r[0]);
  },
  async getUserByEmail(email) {
    return db.select().from(users).where(eq(users.email, email)).then(r => r[0]);
  },
  async getUserByGoogleId(googleId) {
    return db.select().from(users).where(eq(users.googleId, googleId)).then(r => r[0]);
  },
  async createUser(user) {
    return db.insert(users).values(user).returning().then(r => r[0]);
  },
  async insertUser(user) {
    return db.insert(users).values(user).returning().then(r => r[0]);
  },
  async updateUserStats(id, data) {
    await db.update(users).set(data as any).where(eq(users.id, id));
  },
  async updateUserGoogleAvatar(id, avatar) {
    await db.update(users).set({ googleAvatar: avatar }).where(eq(users.id, id));
  },
  async getRunsHostedThisMonth(userId) {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const all = await db.select().from(communityRuns).where(eq(communityRuns.hostId, userId));
    return all.filter(r => r.createdAt >= monthStart).length;
  },

  async getAllCommunityRuns(opts = {}) {
    const all = await db.select().from(communityRuns);
    return all.filter(r => {
      if (opts.hostId != null && r.hostId !== opts.hostId) return false;
      if (opts.status && r.status !== opts.status) return false;
      return true;
    }).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  },
  async getCommunityRunById(id) {
    return db.select().from(communityRuns).where(eq(communityRuns.id, id)).then(r => r[0]);
  },
  async insertCommunityRun(run) {
    return db.insert(communityRuns).values(run).returning().then(r => r[0]);
  },
  async updateCommunityRun(id, data) {
    return db.update(communityRuns).set(data as any).where(eq(communityRuns.id, id)).returning().then(r => r[0]);
  },

  async getParticipants(runId) {
    return db.select().from(runParticipants)
      .where(and(eq(runParticipants.runId, runId), eq(runParticipants.status, "joined")));
  },
  async getParticipantCount(runId) {
    return db.select().from(runParticipants)
      .where(and(eq(runParticipants.runId, runId), eq(runParticipants.status, "joined")))
      .then(r => r.length);
  },
  async isJoined(runId, userId) {
    return db.select().from(runParticipants)
      .where(and(eq(runParticipants.runId, runId), eq(runParticipants.userId, userId), eq(runParticipants.status, "joined")))
      .then(r => r.length > 0);
  },
  async joinRun(runId, userId) {
    const existing = await db.select().from(runParticipants)
      .where(and(eq(runParticipants.runId, runId), eq(runParticipants.userId, userId)))
      .then(r => r[0]);
    if (existing) {
      return db.update(runParticipants)
        .set({ status: "joined", joinedAt: new Date().toISOString() })
        .where(eq(runParticipants.id, existing.id))
        .returning().then(r => r[0]);
    }
    return db.insert(runParticipants)
      .values({ runId, userId, status: "joined", joinedAt: new Date().toISOString() })
      .returning().then(r => r[0]);
  },
  async leaveRun(runId, userId) {
    await db.update(runParticipants).set({ status: "cancelled" })
      .where(and(eq(runParticipants.runId, runId), eq(runParticipants.userId, userId)));
  },

  async getMessages(runId) {
    return db.select().from(runMessages).where(eq(runMessages.runId, runId));
  },
  async insertMessage(msg) {
    return db.insert(runMessages).values(msg).returning().then(r => r[0]);
  },

  async getRatingsForHost(hostId) {
    return db.select().from(runRatings).where(eq(runRatings.hostId, hostId));
  },
  async insertRating(rating) {
    const r = await db.insert(runRatings).values(rating).returning().then(r => r[0]);
    const all = await db.select().from(runRatings).where(eq(runRatings.hostId, rating.hostId));
    const avg = all.reduce((s, r) => s + r.stars, 0) / all.length;
    await db.update(users).set({ avgRating: Math.round(avg * 10) / 10 }).where(eq(users.id, rating.hostId));
    return r;
  },
  async hasRated(runId, raterId) {
    return db.select().from(runRatings)
      .where(and(eq(runRatings.runId, runId), eq(runRatings.raterId, raterId)))
      .then(r => r.length > 0);
  },
};
