/**
 * Scraper for HK race calendars.
 * Fetches from public sources and normalises race data.
 * Falls back gracefully if any source is unavailable.
 */

import { storage } from "./storage";
import type { InsertRace } from "../shared/schema";

function now() {
  return new Date().toISOString();
}

function parseDistancesKm(distancesJson: string): { min: number | null; max: number | null } {
  try {
    const arr: string[] = JSON.parse(distancesJson);
    const nums = arr
      .map((d) => parseFloat(d.replace(/[^\d.]/g, "")))
      .filter((n) => !isNaN(n));
    if (nums.length === 0) return { min: null, max: null };
    return { min: Math.min(...nums), max: Math.max(...nums) };
  } catch {
    return { min: null, max: null };
  }
}

interface ScrapedRace {
  name: string;
  date: string;
  dateTbc: boolean;
  location: string;
  type: "road" | "trail" | "mixed";
  distances: string[]; // human readable e.g. "10km"
  registrationStatus: "open" | "closed" | "unknown" | "tbc";
  registrationUrl?: string;
  sourceUrl: string;
  sourceName: string;
  description?: string;
}

async function fetchText(url: string, timeoutMs = 10000): Promise<string | null> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { "User-Agent": "HKRaceFinder/1.0 (public race calendar aggregator)" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Scrape gorunningtours.com HK race list */
async function scrapeGoRunningTours(): Promise<ScrapedRace[]> {
  const html = await fetchText("https://gorunningtours.com/hong-kong-running-races/");
  if (!html) return [];

  const results: ScrapedRace[] = [];
  // Very lightweight regex parse — Cheerio not available as ESM easily, do manual extraction
  const sections = html.split(/<h[23]/i).slice(1);
  for (const section of sections) {
    const nameMatch = section.match(/^[^>]*>(.*?)<\/h[23]/i);
    if (!nameMatch) continue;
    const name = nameMatch[1].replace(/<[^>]+>/g, "").trim();
    if (!name || name.length < 5) continue;

    const dateMatch = section.match(/\*\*Date[:\*]*\*\*:?\s*([^\n<]+)/i);
    const rawDate = dateMatch ? dateMatch[1].trim() : "";
    const distMatch = section.match(/\*\*Distance[s:\*]*\*\*:?\s*([^\n<]+)/i) ||
      section.match(/(\d+\s*km)/gi);
    const distStr = Array.isArray(distMatch)
      ? distMatch[0].replace(/<[^>]+>/g, "").trim()
      : (distMatch?.[1] ?? "");

    const typeHint = /trail/i.test(section) ? "trail" : /road/i.test(section) ? "road" : "mixed";
    const locationMatch = section.match(/\*\*Location[:\*]*\*\*:?\s*([^\n<]+)/i);
    const location = locationMatch ? locationMatch[1].trim() : "Hong Kong";

    const distances = distStr
      ? distStr.split(/[,/]/).map((d) => d.trim()).filter(Boolean)
      : [];
    const dateTbc = /tbc/i.test(rawDate);

    results.push({
      name,
      date: rawDate || now().slice(0, 7),
      dateTbc,
      location,
      type: typeHint,
      distances,
      registrationStatus: "unknown",
      sourceUrl: "https://gorunningtours.com/hong-kong-running-races/",
      sourceName: "Go Running Tours",
    });
  }
  return results;
}

/** Scrape finishers.com HK calendar */
async function scrapeFinishers(): Promise<ScrapedRace[]> {
  // This page is JS-rendered so we'll parse what we can from text
  const html = await fetchText("https://www.finishers.com/en/destinations/asia/hong-kong");
  if (!html) return [];
  // Minimal — just log that we tried
  return [];
}

async function scrapeHK100(): Promise<ScrapedRace[]> {
  const html = await fetchText("https://hk100ultra.com/hk100/");
  if (!html) return [];

  const nameMatch = html.match(/Hong Kong 100/i);
  if (!nameMatch) return [];

  const dateMatch = html.match(/(\d+\s+\w+\s+\d{4})/);
  const rawDate = dateMatch ? dateMatch[1] : "";

  return [
    {
      name: "Hong Kong 100 Ultra Marathon",
      date: rawDate || "2027-02",
      dateTbc: !rawDate,
      location: "Sai Kung – Tai Mo Shan",
      type: "trail",
      distances: ["33km", "56km", "103km"],
      registrationStatus: "tbc",
      registrationUrl: "https://hk100ultra.com",
      sourceUrl: "https://hk100ultra.com/hk100/",
      sourceName: "HK100 Official",
      description: "UTMB Index race. 103km from Pak Tam Chung across Maclehose Trail, finishing at Tai Mo Shan.",
    },
  ];
}

function normaliseDate(raw: string): string {
  // Try to parse common formats → YYYY-MM-DD or YYYY-MM
  const patterns = [
    /(\d{1,2})\s+(\w+)\s+(\d{4})/, // "24 January 2026"
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // "January 24, 2026"
    /(\d{4})-(\d{2})-(\d{2})/, // ISO already
    /(\d{4})-(\d{2})/, // YYYY-MM
  ];
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
  };
  for (const p of patterns) {
    const m = raw.match(p);
    if (!m) continue;
    if (m[0].match(/\d{4}-\d{2}-\d{2}/)) return m[0];
    if (m[0].match(/\d{4}-\d{2}/)) return m[0];
    if (m[1] && m[2] && m[3]) {
      const mo = months[m[2].toLowerCase()] || months[m[1].toLowerCase()];
      const yr = m[3].match(/\d{4}/) ? m[3] : (m[1].match(/\d{4}/) ? m[1] : "2026");
      const day = (m[1].match(/^\d{1,2}$/) ? m[1].padStart(2, "0") :
        m[2].match(/^\d{1,2}$/) ? m[2].padStart(2, "0") : "01");
      if (mo) return `${yr}-${mo}-${day}`;
    }
  }
  return raw || "2026-12";
}

export async function runScraper(): Promise<{ added: number; updated: number }> {
  const scrapers = [scrapeGoRunningTours, scrapeHK100, scrapeFinishers];
  const allScraped: ScrapedRace[] = [];

  for (const scraper of scrapers) {
    try {
      const results = await scraper();
      allScraped.push(...results);
    } catch (e) {
      console.warn("[scraper] source failed:", e);
    }
  }

  let added = 0;
  let updated = 0;

  for (const scraped of allScraped) {
    const normDate = normaliseDate(scraped.date);
    const distancesJson = JSON.stringify(scraped.distances);
    const { min, max } = parseDistancesKm(distancesJson);

    const existing = storage.getRaceByName(scraped.name);
    if (!existing) {
      storage.insertRace({
        name: scraped.name,
        date: normDate,
        dateTbc: scraped.dateTbc,
        location: scraped.location,
        type: scraped.type,
        distances: distancesJson,
        minDistanceKm: min,
        maxDistanceKm: max,
        registrationStatus: scraped.registrationStatus,
        registrationUrl: scraped.registrationUrl || null,
        sourceUrl: scraped.sourceUrl,
        sourceName: scraped.sourceName,
        description: scraped.description || null,
        isNew: true,
        createdAt: now(),
        updatedAt: now(),
      });
      added++;
    } else {
      // Update registration status and date if changed
      const changed =
        existing.registrationStatus !== scraped.registrationStatus ||
        existing.date !== normDate;
      if (changed) {
        storage.updateRace(existing.id, {
          registrationStatus: scraped.registrationStatus,
          date: normDate,
          updatedAt: now(),
        });
        updated++;
      }
    }
  }

  storage.logRefresh({
    timestamp: now(),
    racesAdded: added,
    racesUpdated: updated,
    status: "success",
    message: `Scraped ${allScraped.length} races. ${added} new, ${updated} updated.`,
  });

  console.log(`[scraper] Done. +${added} new, ~${updated} updated`);
  return { added, updated };
}
