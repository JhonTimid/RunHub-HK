import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { runScraper } from "./scraper";
import { z } from "zod";
import crypto from "crypto";
import type { Race } from "../shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
interface RaceFilters {
  search?: string;
  type?: string;
  minDistanceKm?: number;
  maxDistanceKm?: number;
  dateFrom?: string;
  dateTo?: string;
  registrationStatus?: string;
  showPast?: boolean;
}

function applyFilters(races: Race[], f: RaceFilters): Race[] {
  const today = new Date().toISOString().slice(0, 10);
  return races.filter((r) => {
    // Exclude past races by default
    if (!f.showPast && r.date < today && !r.dateTbc) return false;

    if (f.search) {
      const q = f.search.toLowerCase();
      if (
        !r.name.toLowerCase().includes(q) &&
        !r.location.toLowerCase().includes(q) &&
        !(r.description ?? "").toLowerCase().includes(q)
      )
        return false;
    }
    if (f.type && f.type !== "all") {
      if (r.type !== f.type) return false;
    }
    if (f.minDistanceKm != null && r.maxDistanceKm != null) {
      if (r.maxDistanceKm < f.minDistanceKm) return false;
    }
    if (f.maxDistanceKm != null && r.minDistanceKm != null) {
      if (r.minDistanceKm > f.maxDistanceKm) return false;
    }
    if (f.dateFrom) {
      if (r.date < f.dateFrom) return false;
    }
    if (f.dateTo) {
      if (r.date > f.dateTo) return false;
    }
    if (f.registrationStatus && f.registrationStatus !== "all") {
      if (r.registrationStatus !== f.registrationStatus) return false;
    }
    return true;
  });
}

export async function registerRoutes(httpServer: Server, app: Express) {
  // ─── GET /api/races ─────────────────────────────────────────────────────
  app.get("/api/races", async (req, res) => {
    try {
      const filters: RaceFilters = {
        search: req.query.search as string | undefined,
        type: req.query.type as string | undefined,
        minDistanceKm: req.query.minKm ? Number(req.query.minKm) : undefined,
        maxDistanceKm: req.query.maxKm ? Number(req.query.maxKm) : undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        registrationStatus: req.query.status as string | undefined,
        showPast: req.query.showPast === "true",
      };
      const all = await storage.getAllRaces();
      const filtered = applyFilters(all, filters);
      // Sort by date ascending, TBC at end
      filtered.sort((a, b) => {
        if (a.dateTbc && !b.dateTbc) return 1;
        if (!a.dateTbc && b.dateTbc) return -1;
        return a.date.localeCompare(b.date);
      });
      res.json({
        races: filtered.map((r) => ({
          ...r,
          distances: JSON.parse(r.distances as string),
        })),
        total: filtered.length,
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── GET /api/races/:id ─────────────────────────────────────────────────
  app.get("/api/races/:id", async (req, res) => {
    try {
      const race = await storage.getRaceById(Number(req.params.id));
      if (!race) return res.status(404).json({ error: "Race not found" });
      res.json({ ...race, distances: JSON.parse(race.distances as string) });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── POST /api/scrape ───────────────────────────────────────────────────
  app.post("/api/scrape", async (req, res) => {
    try {
      const result = await runScraper();
      res.json({ success: true, ...result });
    } catch (e) {
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  // ─── GET /api/stats ─────────────────────────────────────────────────────
  app.get("/api/stats", async (req, res) => {
    try {
      const all = await storage.getAllRaces();
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = all.filter((r) => r.date >= today || r.dateTbc);
      const lastRefresh = await storage.getLastRefresh();
      res.json({
        total: all.length,
        upcoming: upcoming.length,
        road: all.filter((r) => r.type === "road").length,
        trail: all.filter((r) => r.type === "trail").length,
        mixed: all.filter((r) => r.type === "mixed").length,
        lastRefreshed: lastRefresh?.timestamp ?? null,
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── POST /api/alerts ───────────────────────────────────────────────────
  const alertSchema = z.object({
    email: z.string().email(),
    filterType: z.enum(["road", "trail", "mixed", "all"]).optional(),
    filterMinDistanceKm: z.number().optional(),
    filterMaxDistanceKm: z.number().optional(),
    filterDateFrom: z.string().optional(),
  });

  app.post("/api/alerts", async (req, res) => {
    try {
      const parsed = alertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      }
      const { email, filterType, filterMinDistanceKm, filterMaxDistanceKm, filterDateFrom } = parsed.data;
      const verifyToken = crypto.randomBytes(24).toString("hex");
      const alert = await storage.insertAlert({
        email,
        filterType: filterType === "all" ? null : filterType ?? null,
        filterMinDistanceKm: filterMinDistanceKm ?? null,
        filterMaxDistanceKm: filterMaxDistanceKm ?? null,
        filterDateFrom: filterDateFrom ?? null,
        createdAt: new Date().toISOString(),
        verified: false,
        verifyToken,
      } as any);

      // Auto-verify for prototype
      await storage.verifyAlert(alert.id);

      res.json({
        success: true,
        message: "Alert registered! You'll receive emails when new races are added.",
        alertId: alert.id,
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── DELETE /api/alerts/:id ──────────────────────────────────────────────
  app.delete("/api/alerts/:id", async (req, res) => {
    try {
      await storage.deleteAlert(Number(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── GET /api/verify-alert ───────────────────────────────────────────────
  app.get("/api/verify-alert", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(400).json({ error: "Missing token" });
      const alert = await storage.getAlertByToken(token);
      if (!alert) return res.status(404).json({ error: "Token not found or already verified" });
      await storage.verifyAlert(alert.id);
      res.json({ success: true, message: "Email verified! You'll receive race alerts." });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
