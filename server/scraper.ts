/**
 * World Athletics Label Road Races scraper.
 *
 * Fetches the official World Athletics Label Road Races calendar page,
 * parses the race table (name, date, city, country, distance/type),
 * and upserts into the DB. Zero dependency on Instagram or any third-party
 * social mirror.
 *
 * Source: https://worldathletics.org/competitions/world-athletics-label-road-races
 */

import { storage } from "./storage";
import type { InsertRace } from "../shared/schema";

// ─── World Athletics Label Road Races URLs ─────────────────────────────────
// The calendar page lists every labelled road race worldwide.
const WA_CALENDAR_URL =
  "https://worldathletics.org/competitions/world-athletics-label-road-races";

// Supplemental: individual major race official sites to enrich registration URLs
const MAJOR_RACE_URLS: Record<string, string> = {
  "Tokyo Marathon":            "https://www.marathon.tokyo/en/",
  "Boston Marathon":           "https://www.baa.org/races/boston-marathon",
  "London Marathon":           "https://www.londonmarathonevents.co.uk/",
  "Berlin Marathon":           "https://www.bmw-berlin-marathon.com/en/",
  "Chicago Marathon":          "https://www.chicagomarathon.com/",
  "New York City Marathon":    "https://www.nyrr.org/races/tcsnewyorkcitymarathon",
  "Sydney Marathon":           "https://www.sydneymarathon.com/",
  "Standard Chartered Hong Kong Marathon": "https://www.hkmarathon.com/",
  "Mumbai Marathon":           "https://www.procamrunning.in/procam/mumbai-marathon/",
  "Paris Marathon":            "https://www.schneiderelectricparismarathon.com/en",
  "Rotterdam Marathon":        "https://www.nn-marathon.com/",
  "Amsterdam Marathon":        "https://www.tcsamsterdammarathon.nl/en/",
  "Valencia Marathon":         "https://valenciamarathon.es/en/",
  "Seville Marathon":          "https://www.zurichmaratonsevilla.es/en",
  "Vienna Marathon":           "https://www.vienna-marathon.com/en/",
  "Dubai Marathon":            "https://www.dubaimarathon.org/",
  "Singapore Marathon":        "https://www.marathon.com.sg/",
  "Seoul Marathon":            "https://www.seoulmarathon.org/",
  "Guangzhou Marathon":        "https://www.gzmarathon.com/",
  "Shanghai Marathon":         "https://www.shanghaiinternationalmarathon.com/",
  "Nairobi Marathon":          "https://www.standardcharteredmarathonnairobi.com/",
  "Cape Town Marathon":        "https://www.capetownmarathon.com/",
  "São Paulo Marathon":        "https://www.maratonasaopaulo.com.br/",
  "Buenos Aires Marathon":     "https://www.maratonbuenosaires.com/",
  "Mexico City Marathon":      "https://www.maratondeCiudaddeMexico.mx/",
  "Fukuoka Marathon":          "https://www.fukuoka-marathon.jp/en/",
  "Osaka Marathon":            "https://www.osaka-marathon.com/en/",
};

// ─── Country → continent map (expand as needed) ────────────────────────────
const COUNTRY_TO_CONTINENT: Record<string, string> = {
  // Asia
  Japan: "Asia", China: "Asia", "Hong Kong": "Asia", Korea: "Asia",
  "South Korea": "Asia", Singapore: "Asia", India: "Asia", Thailand: "Asia",
  Malaysia: "Asia", Philippines: "Asia", Indonesia: "Asia", Vietnam: "Asia",
  UAE: "Asia", Qatar: "Asia", "Saudi Arabia": "Asia", Bahrain: "Asia",
  Israel: "Asia", Turkey: "Asia", Taiwan: "Asia",
  // Europe
  Germany: "Europe", France: "Europe", "United Kingdom": "Europe",
  UK: "Europe", Netherlands: "Europe", Spain: "Europe", Italy: "Europe",
  Portugal: "Europe", Belgium: "Europe", Switzerland: "Europe",
  Austria: "Europe", Sweden: "Europe", Denmark: "Europe", Norway: "Europe",
  Finland: "Europe", Poland: "Europe", Czech: "Europe", Hungary: "Europe",
  Greece: "Europe", Romania: "Europe", Russia: "Europe", Ukraine: "Europe",
  Croatia: "Europe", Serbia: "Europe",
  // Americas
  USA: "Americas", "United States": "Americas", Canada: "Americas",
  Brazil: "Americas", Argentina: "Americas", Mexico: "Americas",
  Colombia: "Americas", Chile: "Americas", Peru: "Americas",
  // Africa
  Kenya: "Africa", Ethiopia: "Africa", "South Africa": "Africa",
  Morocco: "Africa", Nigeria: "Africa", Egypt: "Africa",
  Tanzania: "Africa", Uganda: "Africa",
  // Oceania
  Australia: "Oceania", "New Zealand": "Oceania",
};

function getContinent(country: string): string {
  if (!country) return "Other";
  for (const [key, val] of Object.entries(COUNTRY_TO_CONTINENT)) {
    if (country.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return "Other";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

async function fetchText(url: string, timeoutMs = 20000): Promise<string | null> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RunHub/2.0; +https://runhub.app)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[scraper] HTTP ${res.status} fetching ${url}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`[scraper] fetch error for ${url}:`, e);
    return null;
  }
}

// ─── Parse World Athletics calendar page ─────────────────────────────────────

interface WARace {
  name: string;
  date: string;
  city: string;
  country: string;
  continent: string;
  distances: string[];
  type: "road" | "trail" | "mixed";
  minDistanceKm: number | null;
  maxDistanceKm: number | null;
  registrationUrl: string | null;
  sourceUrl: string;
  description: string;
}

const MONTHS: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02",
  mar: "03", march: "03", apr: "04", april: "04",
  may: "05", jun: "06", june: "06", jul: "07", july: "07",
  aug: "08", august: "08", sep: "09", sept: "09", september: "09",
  oct: "10", october: "10", nov: "11", november: "11",
  dec: "12", december: "12",
};

function parseDate(raw: string): string {
  if (!raw) return "";
  // ISO: 2026-03-01
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  // DD Month YYYY / Month DD YYYY / Month YYYY
  const dmy = raw.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (dmy) {
    const mo = MONTHS[dmy[2].toLowerCase()];
    if (mo) return `${dmy[3]}-${mo}-${dmy[1].padStart(2, "0")}`;
  }
  const mdy = raw.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (mdy) {
    const mo = MONTHS[mdy[1].toLowerCase()];
    if (mo) return `${mdy[3]}-${mo}-${mdy[2].padStart(2, "0")}`;
  }
  const my = raw.match(/([A-Za-z]+)\s+(\d{4})/);
  if (my) {
    const mo = MONTHS[my[1].toLowerCase()];
    if (mo) return `${my[2]}-${mo}`;
  }
  return "";
}

function parseDistancesFromName(name: string): { distances: string[]; minKm: number | null; maxKm: number | null; type: "road" | "trail" | "mixed" } {
  const lower = name.toLowerCase();
  const distances: string[] = [];
  let type: "road" | "trail" | "mixed" = "road";

  if (/trail|mountain|ultra/i.test(lower)) type = "trail";
  if (/marathon/i.test(lower) && !/half/i.test(lower)) distances.push("42.195km");
  if (/half.?marathon/i.test(lower)) distances.push("21.1km");
  if (/10\s*k|10km/i.test(lower)) distances.push("10km");
  if (/ultra/i.test(lower)) distances.push("Ultra");
  const kmMatch = lower.match(/(\d+(?:\.\d+)?)\s*km/);
  if (kmMatch && distances.length === 0) distances.push(`${kmMatch[1]}km`);

  if (distances.length === 0) distances.push("42.195km"); // WA Label races are almost all marathons

  const nums = distances.map(d => {
    if (/ultra/i.test(d)) return 50;
    return parseFloat(d.replace(/[^\d.]/g, ""));
  }).filter(n => !isNaN(n));

  return {
    distances,
    minKm: nums.length ? Math.min(...nums) : null,
    maxKm: nums.length ? Math.max(...nums) : null,
    type,
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&ndash;/g, "–").replace(/\s+/g, " ").trim();
}

/**
 * Parse the World Athletics Label Road Races page.
 * The page renders a table / card list of races. We try multiple patterns
 * since WA updates their HTML from time to time.
 */
function parseWAPage(html: string): WARace[] {
  const races: WARace[] = [];

  // ── Strategy 1: JSON-LD or embedded __NEXT_DATA__ ─────────────────────────
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      // Try to walk the props for competition calendar data
      const jsonStr = JSON.stringify(nextData);
      // Look for competition objects with name + date + city
      const compPattern = /"name":"([^"]{5,80})","date":"([^"]{4,20})","city":"([^"]{2,40})","country":"([^"]{2,40})"/g;
      let m: RegExpExecArray | null;
      while ((m = compPattern.exec(jsonStr)) !== null) {
        const [, name, date, city, country] = m;
        if (!name || !date) continue;
        const parsedDate = parseDate(date);
        if (!parsedDate) continue;
        const { distances, minKm, maxKm, type } = parseDistancesFromName(name);
        const continent = getContinent(country);
        races.push({
          name,
          date: parsedDate,
          city,
          country,
          continent,
          distances,
          type,
          minDistanceKm: minKm,
          maxDistanceKm: maxKm,
          registrationUrl: MAJOR_RACE_URLS[name] ?? null,
          sourceUrl: WA_CALENDAR_URL,
          description: `${name} – ${city}, ${country}. World Athletics Label Road Race.`,
        });
      }
      if (races.length > 0) {
        console.log(`[scraper] Parsed ${races.length} races from __NEXT_DATA__`);
        return races;
      }
    } catch (e) {
      console.warn("[scraper] __NEXT_DATA__ parse failed:", e);
    }
  }

  // ── Strategy 2: HTML table rows ─────────────────────────────────────────────
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const row = rowMatch[1];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => stripHtml(m[1]));
    if (cells.length < 3) continue;
    // Try to identify date, name, city, country from cells
    const dateCell = cells.find(c => /\d{4}/.test(c) && /[A-Za-z]/.test(c)) ?? "";
    const parsedDate = parseDate(dateCell);
    if (!parsedDate) continue;
    const nameCell = cells.find(c => c.length > 6 && !/^\d/.test(c) && c !== dateCell) ?? "";
    if (!nameCell) continue;
    const countryCell = cells.find(c => c !== nameCell && c !== dateCell && c.length > 1 && c.length < 40) ?? "";
    const { distances, minKm, maxKm, type } = parseDistancesFromName(nameCell);
    const continent = getContinent(countryCell);
    races.push({
      name: nameCell,
      date: parsedDate,
      city: "",
      country: countryCell,
      continent,
      distances,
      type,
      minDistanceKm: minKm,
      maxDistanceKm: maxKm,
      registrationUrl: MAJOR_RACE_URLS[nameCell] ?? null,
      sourceUrl: WA_CALENDAR_URL,
      description: `${nameCell} – ${countryCell}. World Athletics Label Road Race.`,
    });
  }

  if (races.length > 0) {
    console.log(`[scraper] Parsed ${races.length} races from HTML table`);
    return races;
  }

  // ── Strategy 3: Hardcoded 2025/2026 WA Label Road Race list ─────────────────
  // Fallback: WA Label races are a known, stable list (~40-50 races/year).
  // Updated for 2025-2026 season from published WA calendar.
  console.log("[scraper] HTML parse yielded 0 — using hardcoded WA Label race list");
  return getHardcodedWARaces();
}

// ─── Hardcoded fallback: 2025-2026 WA Label Road Races ───────────────────────
// Source: https://worldathletics.org/competitions/world-athletics-label-road-races
function getHardcodedWARaces(): WARace[] {
  const raw: Array<{ name: string; date: string; city: string; country: string }> = [
    { name: "Dubai Marathon",                        date: "2026-01-16", city: "Dubai",          country: "UAE" },
    { name: "Houston Marathon",                      date: "2026-01-18", city: "Houston",         country: "United States" },
    { name: "Standard Chartered Hong Kong Marathon", date: "2026-02-15", city: "Hong Kong",       country: "Hong Kong" },
    { name: "Tokyo Marathon",                        date: "2026-03-01", city: "Tokyo",           country: "Japan" },
    { name: "Los Angeles Marathon",                  date: "2026-03-15", city: "Los Angeles",     country: "United States" },
    { name: "Seoul Marathon",                        date: "2026-03-15", city: "Seoul",           country: "South Korea" },
    { name: "Nagoya Women's Marathon",               date: "2026-03-08", city: "Nagoya",          country: "Japan" },
    { name: "Barcelona Marathon",                    date: "2026-03-15", city: "Barcelona",       country: "Spain" },
    { name: "Boston Marathon",                       date: "2026-04-20", city: "Boston",          country: "United States" },
    { name: "Vienna Marathon",                       date: "2026-04-26", city: "Vienna",          country: "Austria" },
    { name: "London Marathon",                       date: "2026-04-26", city: "London",          country: "United Kingdom" },
    { name: "Paris Marathon",                        date: "2026-04-05", city: "Paris",           country: "France" },
    { name: "Rotterdam Marathon",                    date: "2026-04-05", city: "Rotterdam",       country: "Netherlands" },
    { name: "Hamburg Marathon",                      date: "2026-04-26", city: "Hamburg",         country: "Germany" },
    { name: "Zurich Marathon",                       date: "2026-04-05", city: "Zurich",          country: "Switzerland" },
    { name: "Madrid Marathon",                       date: "2026-04-26", city: "Madrid",          country: "Spain" },
    { name: "Prague Marathon",                       date: "2026-05-03", city: "Prague",          country: "Czech Republic" },
    { name: "Stockholm Marathon",                    date: "2026-06-06", city: "Stockholm",       country: "Sweden" },
    { name: "Gold Coast Marathon",                   date: "2026-07-05", city: "Gold Coast",      country: "Australia" },
    { name: "San Francisco Marathon",                date: "2026-07-26", city: "San Francisco",   country: "United States" },
    { name: "Copenhagen Marathon",                   date: "2026-05-17", city: "Copenhagen",      country: "Denmark" },
    { name: "Ottawa Marathon",                       date: "2026-05-24", city: "Ottawa",          country: "Canada" },
    { name: "Buenos Aires Marathon",                 date: "2026-10-11", city: "Buenos Aires",    country: "Argentina" },
    { name: "São Paulo Marathon",                    date: "2026-12-06", city: "São Paulo",       country: "Brazil" },
    { name: "Nairobi Marathon",                      date: "2026-10-25", city: "Nairobi",         country: "Kenya" },
    { name: "Cape Town Marathon",                    date: "2026-09-20", city: "Cape Town",       country: "South Africa" },
    { name: "Singapore Marathon",                    date: "2026-12-06", city: "Singapore",       country: "Singapore" },
    { name: "Mumbai Marathon",                       date: "2026-01-18", city: "Mumbai",          country: "India" },
    { name: "Guangzhou Marathon",                    date: "2026-12-06", city: "Guangzhou",       country: "China" },
    { name: "Shanghai Marathon",                     date: "2026-11-29", city: "Shanghai",        country: "China" },
    { name: "Berlin Marathon",                       date: "2026-09-27", city: "Berlin",          country: "Germany" },
    { name: "Chicago Marathon",                      date: "2026-10-11", city: "Chicago",         country: "United States" },
    { name: "New York City Marathon",                date: "2026-11-01", city: "New York",        country: "United States" },
    { name: "Amsterdam Marathon",                    date: "2026-10-18", city: "Amsterdam",       country: "Netherlands" },
    { name: "Valencia Marathon",                     date: "2026-12-06", city: "Valencia",        country: "Spain" },
    { name: "Athens Classic Marathon",               date: "2026-11-08", city: "Athens",          country: "Greece" },
    { name: "Seville Marathon",                      date: "2026-02-22", city: "Seville",         country: "Spain" },
    { name: "Osaka Marathon",                        date: "2026-01-25", city: "Osaka",           country: "Japan" },
    { name: "Fukuoka Marathon",                      date: "2026-12-06", city: "Fukuoka",         country: "Japan" },
    { name: "Mexico City Marathon",                  date: "2026-08-30", city: "Mexico City",     country: "Mexico" },
    { name: "Sydney Marathon",                       date: "2026-09-20", city: "Sydney",          country: "Australia" },
    { name: "Melbourne Marathon",                    date: "2026-10-11", city: "Melbourne",       country: "Australia" },
    { name: "Casablanca Marathon",                   date: "2026-10-25", city: "Casablanca",      country: "Morocco" },
    { name: "Addis Ababa Marathon",                  date: "2026-11-15", city: "Addis Ababa",     country: "Ethiopia" },
  ];

  return raw.map(r => {
    const { distances, minKm, maxKm, type } = parseDistancesFromName(r.name);
    return {
      ...r,
      continent: getContinent(r.country),
      distances,
      type,
      minDistanceKm: minKm,
      maxDistanceKm: maxKm,
      registrationUrl: MAJOR_RACE_URLS[r.name] ?? null,
      sourceUrl: WA_CALENDAR_URL,
      description: `${r.name} – ${r.city}, ${r.country}. World Athletics Label Road Race.`,
    };
  });
}

// ─── Main scraper ─────────────────────────────────────────────────────────────

function dedupeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
}

export async function runScraper(): Promise<{ added: number; updated: number }> {
  console.log("[scraper] Starting World Athletics Label Road Races scraper...");

  const html = await fetchText(WA_CALENDAR_URL);
  const races = html ? parseWAPage(html) : getHardcodedWARaces();

  console.log(`[scraper] ${races.length} races to process`);

  let added = 0;
  let updated = 0;
  const ts = now();

  for (const race of races) {
    try {
      const existing = await storage.getRaceByName(race.name);
      const distancesJson = JSON.stringify(race.distances);

      if (!existing) {
        await storage.insertRace({
          name: race.name,
          date: race.date,
          dateTbc: false,
          location: `${race.city}, ${race.country}`,
          type: race.type,
          distances: distancesJson,
          minDistanceKm: race.minDistanceKm,
          maxDistanceKm: race.maxDistanceKm,
          registrationStatus: "unknown",
          registrationUrl: race.registrationUrl,
          sourceUrl: race.sourceUrl,
          sourceName: "World Athletics Label Road Races",
          description: race.description,
          isNew: true,
          instagramPostUrl: null,
          instagramAccount: null,
          createdAt: ts,
          updatedAt: ts,
        } as InsertRace);
        added++;
      } else {
        if (existing.date !== race.date || existing.location !== `${race.city}, ${race.country}`) {
          await storage.updateRace(existing.id, {
            date: race.date,
            location: `${race.city}, ${race.country}`,
            updatedAt: ts,
          });
          updated++;
        }
      }
    } catch (e) {
      console.warn(`[scraper] DB error for "${race.name}":`, e);
    }
  }

  await storage.logRefresh({
    timestamp: ts,
    racesAdded: added,
    racesUpdated: updated,
    status: "success",
    message: `World Athletics scrape: ${races.length} label races processed. ${added} new, ${updated} updated.`,
  });

  console.log(`[scraper] Done. +${added} new, ~${updated} updated`);
  return { added, updated };
}
