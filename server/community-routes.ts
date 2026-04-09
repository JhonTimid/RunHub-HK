import type { Express } from "express";
import { storage } from "./storage";
import { z } from "zod";
import type { CommunityRun } from "../shared/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function enrichRun(run: CommunityRun) {
  const host = await storage.getUserById(run.hostId);
  const participantCount = await storage.getParticipantCount(run.id);
  const participantRows = await storage.getParticipants(run.id);
  const participants = await Promise.all(
    participantRows.map(p => storage.getUserById(p.userId))
  );
  return { ...run, host, participantCount, participants: participants.filter(Boolean) };
}

// ─── Validation schemas ───────────────────────────────────────────────────────
const createRunSchema = z.object({
  hostId: z.number(),
  title: z.string().min(3),
  runType: z.enum(["road", "trail", "track", "fun_run", "recovery"]),
  date: z.string(),
  startTime: z.string(),
  meetingPoint: z.string().min(3),
  meetingLat: z.number().optional(),
  meetingLng: z.number().optional(),
  distanceKm: z.number().positive(),
  paceMin: z.string().optional(),
  paceMax: z.string().optional(),
  maxParticipants: z.number().int().positive().optional().nullable(),
  description: z.string().optional(),
  visibility: z.enum(["public", "friends"]).default("public"),
});

const createMessageSchema = z.object({
  userId: z.number(),
  message: z.string().min(1),
});

const createRatingSchema = z.object({
  raterId: z.number(),
  stars: z.number().int().min(1).max(5),
  review: z.string().optional(),
});

export function registerCommunityRoutes(app: Express) {
  // ─── GET /api/community/runs ─────────────────────────────────────────────
  app.get("/api/community/runs", async (req, res) => {
    try {
      const hostId = req.query.hostId ? Number(req.query.hostId) : undefined;
      const status = req.query.status as string | undefined;
      const search = (req.query.search as string | undefined)?.toLowerCase();

      let runs = await storage.getAllCommunityRuns({ hostId, status });

      if (search) {
        runs = runs.filter(r =>
          r.title.toLowerCase().includes(search) ||
          r.meetingPoint.toLowerCase().includes(search) ||
          (r.description ?? "").toLowerCase().includes(search)
        );
      }

      // Filter by type
      const type = req.query.type as string | undefined;
      if (type && type !== "all") {
        runs = runs.filter(r => r.runType === type);
      }

      const enriched = await Promise.all(runs.map(r => enrichRun(r)));
      res.json({ runs: enriched, total: enriched.length });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── GET /api/community/runs/:id ─────────────────────────────────────────
  app.get("/api/community/runs/:id", async (req, res) => {
    try {
      const run = await storage.getCommunityRunById(Number(req.params.id));
      if (!run) return res.status(404).json({ error: "Run not found" });

      const messages = await storage.getMessages(run.id);
      const enrichedMessages = await Promise.all(
        messages.map(async m => ({
          ...m,
          user: await storage.getUserById(m.userId),
        }))
      );

      const enriched = await enrichRun(run);
      const ratings = await storage.getRatingsForHost(run.hostId);
      res.json({ ...enriched, messages: enrichedMessages, ratings });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── POST /api/community/runs ─────────────────────────────────────────────
  app.post("/api/community/runs", async (req, res) => {
    try {
      const parsed = createRunSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      }
      const now = new Date().toISOString();
      const run = await storage.insertCommunityRun({
        ...parsed.data,
        meetingLat: parsed.data.meetingLat ?? null,
        meetingLng: parsed.data.meetingLng ?? null,
        paceMin: parsed.data.paceMin ?? null,
        paceMax: parsed.data.paceMax ?? null,
        maxParticipants: parsed.data.maxParticipants ?? null,
        description: parsed.data.description ?? null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      // Auto-join host as participant
      await storage.joinRun(run.id, parsed.data.hostId);
      const host = await storage.getUserById(parsed.data.hostId);
      await storage.updateUserStats(parsed.data.hostId, { totalRuns: (host?.totalRuns ?? 0) + 1 });
      res.status(201).json(await enrichRun(run));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── PATCH /api/community/runs/:id ───────────────────────────────────────
  app.patch("/api/community/runs/:id", async (req, res) => {
    try {
      const run = await storage.getCommunityRunById(Number(req.params.id));
      if (!run) return res.status(404).json({ error: "Run not found" });
      const updated = await storage.updateCommunityRun(run.id, { ...req.body, updatedAt: new Date().toISOString() });
      res.json(await enrichRun(updated!));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── POST /api/community/runs/:id/join ───────────────────────────────────
  app.post("/api/community/runs/:id/join", async (req, res) => {
    try {
      const run = await storage.getCommunityRunById(Number(req.params.id));
      if (!run) return res.status(404).json({ error: "Run not found" });

      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId required" });

      const count = await storage.getParticipantCount(run.id);
      if (run.maxParticipants && count >= run.maxParticipants) {
        return res.status(400).json({ error: "Run is full" });
      }
      if (await storage.isJoined(run.id, userId)) {
        return res.status(400).json({ error: "Already joined" });
      }

      await storage.joinRun(run.id, userId);
      const newCount = await storage.getParticipantCount(run.id);
      res.json({ success: true, participantCount: newCount });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── POST /api/community/runs/:id/leave ──────────────────────────────────
  app.post("/api/community/runs/:id/leave", async (req, res) => {
    try {
      const run = await storage.getCommunityRunById(Number(req.params.id));
      if (!run) return res.status(404).json({ error: "Run not found" });
      const { userId } = req.body;
      await storage.leaveRun(run.id, userId);
      const newCount = await storage.getParticipantCount(run.id);
      res.json({ success: true, participantCount: newCount });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── GET /api/community/runs/:id/joined ──────────────────────────────────
  app.get("/api/community/runs/:id/joined", async (req, res) => {
    try {
      const userId = Number(req.query.userId);
      const joined = await storage.isJoined(Number(req.params.id), userId);
      res.json({ joined });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── POST /api/community/runs/:id/messages ───────────────────────────────
  app.post("/api/community/runs/:id/messages", async (req, res) => {
    try {
      const run = await storage.getCommunityRunById(Number(req.params.id));
      if (!run) return res.status(404).json({ error: "Run not found" });

      const parsed = createMessageSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid message" });

      const msg = await storage.insertMessage({
        runId: run.id,
        userId: parsed.data.userId,
        message: parsed.data.message,
        createdAt: new Date().toISOString(),
      });
      const user = await storage.getUserById(msg.userId);
      res.status(201).json({ ...msg, user });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── POST /api/community/runs/:id/rate ───────────────────────────────────
  app.post("/api/community/runs/:id/rate", async (req, res) => {
    try {
      const run = await storage.getCommunityRunById(Number(req.params.id));
      if (!run) return res.status(404).json({ error: "Run not found" });

      const parsed = createRatingSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid rating" });

      if (await storage.hasRated(run.id, parsed.data.raterId)) {
        return res.status(400).json({ error: "Already rated this run" });
      }

      const rating = await storage.insertRating({
        runId: run.id,
        raterId: parsed.data.raterId,
        hostId: run.hostId,
        stars: parsed.data.stars,
        review: parsed.data.review ?? null,
        createdAt: new Date().toISOString(),
      });
      const host = await storage.getUserById(run.hostId);
      res.status(201).json({ rating, hostAvgRating: host?.avgRating });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── GET /api/community/users ─────────────────────────────────────────────
  app.get("/api/community/users", async (req, res) => {
    try {
      res.json(await storage.getAllUsers());
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── GET /api/community/users/:id ────────────────────────────────────────
  app.get("/api/community/users/:id", async (req, res) => {
    try {
      const user = await storage.getUserById(Number(req.params.id));
      if (!user) return res.status(404).json({ error: "User not found" });
      const hostedRuns = await storage.getAllCommunityRuns({ hostId: user.id });
      const enrichedHostedRuns = await Promise.all(hostedRuns.map(r => enrichRun(r)));
      const ratings = await storage.getRatingsForHost(user.id);
      res.json({ ...user, hostedRuns: enrichedHostedRuns, ratings });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
