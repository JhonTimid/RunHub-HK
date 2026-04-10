/**
 * Instagram-based race scraper for RunHub HK.
 *
 * Strategy: fetch recent posts from public HK running Instagram accounts via
 * Picuki (public Instagram viewer — no auth needed), then parse captions with
 * keyword + regex heuristics to extract race name, date, distance, type and
 * location. Races are deduplicated by normalised name before storing.
 */

import { storage } from "./storage";
import type { InsertRace } from "../shared/schema";

// ─── Account list ─────────────────────────────────────────────────────────────

const INSTAGRAM_ACCOUNTS: Array<{ handle: string; label: string }> = [
  { handle: "runnerreg_hk",               label: "RunnerReg HK" },
  { handle: "sportsoho",                  label: "Sports OHO HK" },
  { handle: "schkmarathon",               label: "Standard Chartered HK Marathon" },
  { handle: "midnightrunnershk",          label: "Midnight Runners Hong Kong" },
  { handle: "shelterathletics",           label: "SHELTER Athletics" },
  { handle: "oxfamtrailwalkerhongkong",   label: "Oxfam Trailwalker HK" },
  { handle: "streetathon",                label: "Hong Kong Streetathon" },
  { handle: "hkcoastaltrailchallenge",    label: "HK Coastal Trail Challenge" },
  { handle: "runderful_hk",              label: "Runderful HK" },
  { handle: "thepeakhunter",             label: "The Peak Hunter" },
  { handle: "fitz.hk",                   label: "Fitz HK" },
  { handle: "fdc_runclub",               label: "Fire Dragon Collective Run Club" },
  { handle: "garmingrc.hk",             label: "Garmin Run Club Hong Kong" },
  { handle: "trailblazer_hk",           label: "Trailblazer Running" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

async function fetchText(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ─── Post extraction from Picuki ─────────────────────────────────────────────

interface RawPost {
  caption: string;
  postUrl: string;
  imageUrl?: string;
}

/**
 * Fetch recent posts for an Instagram account via Picuki public mirror.
 * Returns up to `limit` posts with captions.
 */
async function fetchAccountPosts(handle: string, limit = 12): Promise<RawPost[]> {
  const url = `https://www.picuki.com/profile/${handle}`;
  const html = await fetchText(url);
  if (!html) {
    console.warn(`[scraper] picuki fetch failed for @${handle}`);
    return [];
  }

  const posts: RawPost[] = [];

  // Extract post blocks — Picuki wraps each post in a <div class="box-photo">
  const boxPattern = /<div class="box-photo">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  let boxMatch: RegExpExecArray | null;

  while ((boxMatch = boxPattern.exec(html)) !== null && posts.length < limit) {
    const block = boxMatch[1];

    // Post URL — href="/media/<id>"
    const linkMatch = block.match(/href="(\/media\/[^"]+)"/);
    const postUrl = linkMatch
      ? `https://www.picuki.com${linkMatch[1]}`
      : `https://www.instagram.com/${handle}/`;

    // Caption — inside <p class="photo-description">
    const captionMatch = block.match(/<p[^>]*class="photo-description"[^>]*>([\s\S]*?)<\/p>/i);
    const rawCaption = captionMatch
      ? captionMatch[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim()
      : "";

    if (rawCaption.length < 20) continue; // too short to be useful

    // Image URL
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    posts.push({ caption: rawCaption, postUrl, imageUrl });
  }

  // Fallback: try a broader extraction if box-photo pattern missed
  if (posts.length === 0) {
    const captionPattern = /<p[^>]*class="photo-description"[^>]*>([\s\S]*?)<\/p>/gi;
    const linkPattern = /href="(\/media\/[^"]+)"/g;
    const captions: string[] = [];
    const links: string[] = [];

    let m: RegExpExecArray | null;
    while ((m = captionPattern.exec(html)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text.length >= 20) captions.push(text);
    }
    while ((m = linkPattern.exec(html)) !== null) {
      links.push(`https://www.picuki.com${m[1]}`);
    }
    for (let i = 0; i < Math.min(captions.length, limit); i++) {
      posts.push({ caption: captions[i], postUrl: links[i] ?? `https://www.instagram.com/${handle}/` });
    }
  }

  return posts;
}

// ─── Caption parsing ──────────────────────────────────────────────────────────

interface ParsedRace {
  name: string;
  date: string;
  dateTbc: boolean;
  location: string;
  type: "road" | "trail" | "mixed" | "track" | "fun_run";
  distances: string[];
  registrationStatus: "open" | "closed" | "unknown" | "tbc";
  registrationUrl?: string;
  description: string;
}

const MONTHS: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

function normaliseDate(raw: string): string {
  if (!raw) return "";

  // ISO already
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;

  // "24 January 2026" or "24 Jan 2026"
  const dMonY = raw.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (dMonY) {
    const mo = MONTHS[dMonY[2].toLowerCase()];
    if (mo) return `${dMonY[3]}-${mo}-${dMonY[1].padStart(2, "0")}`;
  }

  // "January 24, 2026"
  const monDY = raw.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (monDY) {
    const mo = MONTHS[monDY[1].toLowerCase()];
    if (mo) return `${monDY[3]}-${mo}-${monDY[2].padStart(2, "0")}`;
  }

  // "Jan 2026" → YYYY-MM
  const monY = raw.match(/([A-Za-z]+)\s+(\d{4})/);
  if (monY) {
    const mo = MONTHS[monY[1].toLowerCase()];
    if (mo) return `${monY[2]}-${mo}`;
  }

  // "2026年1月24日" (Chinese date)
  const cnDate = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (cnDate) return `${cnDate[1]}-${cnDate[2].padStart(2, "0")}-${cnDate[3].padStart(2, "0")}`;

  // "2026年1月" → YYYY-MM
  const cnMon = raw.match(/(\d{4})年(\d{1,2})月/);
  if (cnMon) return `${cnMon[1]}-${cnMon[2].padStart(2, "0")}`;

  return "";
}

function extractDate(caption: string): { date: string; dateTbc: boolean } {
  // Check for TBC signals
  const tbcSignal = /\b(tbc|tba|date tbc|coming soon|stay tuned|to be (confirmed|announced))\b/i.test(caption);

  // Try to find dates
  const datePatterns = [
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(20\d{2})/gi,
    /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(20\d{2})/gi,
    /(\d{4})年(\d{1,2})月(\d{1,2})日/g,
    /(\d{4})年(\d{1,2})月/g,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/g,
    /(20\d{2})[\/\-](\d{2})[\/\-](\d{2})/g,
  ];

  for (const pat of datePatterns) {
    const m = pat.exec(caption);
    if (m) {
      const normalised = normaliseDate(m[0]);
      if (normalised) return { date: normalised, dateTbc: false };
    }
  }

  // Look for year + month without day
  const ymPat = /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(20\d{2})/gi;
  const ymMatch = ymPat.exec(caption);
  if (ymMatch) {
    const normalised = normaliseDate(ymMatch[0]);
    if (normalised) return { date: normalised, dateTbc: false };
  }

  return { date: "", dateTbc: tbcSignal };
}

function extractDistances(caption: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  // Match patterns like "10km", "10K", "100 km", "10-mile", "42.195km", "Half Marathon", "Full Marathon"
  const patterns = [
    /\b(\d+(?:\.\d+)?)\s*(?:km|kilometers?|公里)\b/gi,
    /\b(\d+(?:\.\d+)?)\s*(?:k)\b/gi,
    /\b(\d+(?:\.\d+)?)\s*(?:miles?|mi)\b/gi,
    /\bhalf[\s\-]?marathon\b/gi,
    /\bfull[\s\-]?marathon\b/gi,
    /\bmarathon\b/gi,
    /\bultra[\s\-]?marathon\b/gi,
    /\b5k\b/gi,
    /\b10k\b/gi,
    /\b21[\s\.]?1\s*km\b/gi,
    /\b42[\s\.]?2\s*km\b/gi,
  ];

  for (const pat of patterns) {
    let m: RegExpExecArray | null;
    const re = new RegExp(pat.source, pat.flags);
    while ((m = re.exec(caption)) !== null) {
      let label = m[0].trim().toLowerCase();
      // Normalise
      if (/half[\s\-]?marathon/i.test(label)) label = "21.1km";
      else if (/full[\s\-]?marathon/i.test(label) || /^marathon$/i.test(label)) label = "42.2km";
      else if (/ultra[\s\-]?marathon/i.test(label)) label = "Ultra";
      else if (/\d/.test(label)) {
        // keep as-is but clean up spaces
        label = label.replace(/\s+/g, "").replace(/kilometers?/i, "km").replace(/miles?/i, "mi");
      }
      if (!seen.has(label)) {
        seen.add(label);
        found.push(label);
      }
    }
  }

  return found;
}

function detectType(caption: string): "road" | "trail" | "mixed" | "track" | "fun_run" {
  const lower = caption.toLowerCase();
  const trailScore = (lower.match(/\b(trail|mountain|hill|trailrun|ultra|hike|麥理浩|林徑|越野)\b/g) ?? []).length;
  const roadScore = (lower.match(/\b(road|street|city|urban|marathon|半馬|全馬|路跑|公路)\b/g) ?? []).length;
  const trackScore = (lower.match(/\b(track|stadium|field|田徑)\b/g) ?? []).length;
  const funScore = (lower.match(/\b(fun run|charity|colour|color|obstacle|carnival)\b/g) ?? []).length;

  if (funScore > 0) return "fun_run";
  if (trackScore > trailScore && trackScore > roadScore) return "track";
  if (trailScore > roadScore) return "trail";
  if (roadScore > trailScore) return "road";
  if (trailScore > 0 && roadScore > 0) return "mixed";
  return "road"; // default for HK race accounts
}

function detectRegistrationStatus(caption: string): "open" | "closed" | "unknown" | "tbc" {
  const lower = caption.toLowerCase();
  if (/\b(register now|sign up now|registration open|now open|entries open|報名|立即報名|名額開放)\b/i.test(lower)) return "open";
  if (/\b(sold out|registration closed|entries closed|full|no more spots|額滿|截止報名)\b/i.test(lower)) return "closed";
  if (/\b(coming soon|registration (opening|coming|tbc|tba)|stay tuned|即將開放)\b/i.test(lower)) return "tbc";
  return "unknown";
}

function extractRegistrationUrl(caption: string): string | undefined {
  // Look for URLs in caption — prefer runnerreg, sportsoho, etc.
  const urlMatch = caption.match(/https?:\/\/[^\s,\)\"\']+/g);
  if (!urlMatch) return undefined;
  // Prefer registration-looking URLs
  const regUrl = urlMatch.find(u =>
    /register|signup|entry|entries|runnerreg|sportsoho|active|racelink|ticketflap/i.test(u)
  );
  return regUrl ?? urlMatch[0];
}

function extractLocation(caption: string): string {
  // Look for common HK locations
  const locations = [
    "Sai Kung", "Lantau", "Tai Mo Shan", "Lion Rock", "Victoria Park",
    "Central", "Wan Chai", "Tsim Sha Tsui", "Kowloon", "New Territories",
    "Tuen Mun", "Sha Tin", "Tai Po", "Ma On Shan", "Clear Water Bay",
    "Stanley", "Repulse Bay", "Deep Water Bay", "Aberdeen", "Causeway Bay",
    "Mong Kok", "Yuen Long", "Fanling", "Sheung Shui", "Tseung Kwan O",
    "Hang Hau", "Sai Wan Ho", "Quarry Bay", "Kennedy Town", "Pok Fu Lam",
    "Pak Tam Chung", "Maclehose Trail", "Wilson Trail", "Dragon's Back",
    "Bowen Road", "Lugard Road", "Twins", "Violet Hill",
    "西貢", "大嶼山", "大帽山", "獅子山", "九龍", "新界",
  ];

  for (const loc of locations) {
    if (caption.includes(loc)) return loc + ", Hong Kong";
  }

  // Look for explicit location markers
  const locMatch = caption.match(/📍\s*([^\n,]+)/);
  if (locMatch) return locMatch[1].trim().replace(/,?\s*Hong Kong\s*$/i, "") + ", Hong Kong";

  const venueMatch = caption.match(/(?:venue|location|start|finish)[:\s]+([^\n,]{5,40})/i);
  if (venueMatch) return venueMatch[1].trim() + ", Hong Kong";

  return "Hong Kong";
}

/**
 * Decide if a caption is likely about a race/event (not just a run club meet-up
 * or general training content).
 */
function isRaceCaption(caption: string): boolean {
  const lower = caption.toLowerCase();

  const raceKeywords = [
    "race", "run", "marathon", "trail", "ultra", "10k", "5k", "half", "km",
    "register", "sign up", "entry", "entries", "results", "finisher", "event",
    "competition", "championship", "challenge", "cup", "series",
    "比賽", "跑步", "馬拉松", "越野", "報名", "賽事",
  ];

  const matchCount = raceKeywords.filter(kw => lower.includes(kw)).length;
  return matchCount >= 2;
}

/**
 * Extract a race name from the caption. Priority:
 * 1. Quoted text: "Race Name 2026" or 'Race Name'
 * 2. Title-cased sequence of 3-6 words before a date
 * 3. Hashtag-based name
 * 4. First meaningful sentence
 */
function extractRaceName(caption: string, accountLabel: string): string {
  // Quoted name
  const quoted = caption.match(/["""''']([A-Z][^"""''']{5,60})["""''']/);
  if (quoted) return quoted[1].trim();

  // Lines that look like a title (Title Case, 3-8 words, possibly with year)
  const lines = caption.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 5);
  for (const line of lines.slice(0, 4)) {
    // Check if it's mostly title case and mentions "run", "race", "marathon" etc.
    if (/\b(run|race|marathon|trail|ultra|challenge|cup|series|open|classic)\b/i.test(line)) {
      const clean = line.replace(/[#@\*_]/g, "").replace(/\s+/g, " ").trim();
      if (clean.length >= 8 && clean.length <= 80) return clean;
    }
  }

  // Hashtag-based: #EventName2026
  const hashMatch = caption.match(/#([A-Z][A-Za-z0-9]{5,}(?:Run|Race|Marathon|Trail|Ultra|Challenge|HK|2026|2027)[A-Za-z0-9]*)/);
  if (hashMatch) return hashMatch[1].replace(/([A-Z])/g, " $1").trim();

  // First line as fallback
  const firstLine = lines[0];
  if (firstLine && firstLine.length <= 60) return firstLine.replace(/[#@]/g, "").trim();

  return `${accountLabel} Event`;
}

function parseCaption(caption: string, handle: string, accountLabel: string): ParsedRace | null {
  if (!isRaceCaption(caption)) return null;

  const { date, dateTbc } = extractDate(caption);

  // Skip posts with no date or TBC if they also have no distance info
  const distances = extractDistances(caption);
  if (!date && !dateTbc && distances.length === 0) return null;

  const name = extractRaceName(caption, accountLabel);
  const type = detectType(caption);
  const location = extractLocation(caption);
  const registrationStatus = detectRegistrationStatus(caption);
  const registrationUrl = extractRegistrationUrl(caption);

  // Use first 300 chars of caption as description
  const description = caption.slice(0, 300).replace(/\s+/g, " ").trim();

  return {
    name,
    date: date || new Date().getFullYear().toString() + "-12",
    dateTbc: dateTbc || !date,
    location,
    type,
    distances,
    registrationStatus,
    registrationUrl,
    description,
  };
}

// ─── Main scraper ─────────────────────────────────────────────────────────────

function parseDistancesKm(distances: string[]): { min: number | null; max: number | null } {
  const nums = distances
    .map(d => {
      if (/ultra/i.test(d)) return 50;
      if (/42/.test(d)) return 42.2;
      if (/21/.test(d)) return 21.1;
      return parseFloat(d.replace(/[^\d.]/g, ""));
    })
    .filter(n => !isNaN(n) && n > 0);
  if (nums.length === 0) return { min: null, max: null };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

function dedupeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "").slice(0, 40);
}

export async function runScraper(): Promise<{ added: number; updated: number }> {
  console.log("[scraper] Starting Instagram scraper...");

  const allParsed: Array<ParsedRace & { handle: string; label: string; postUrl: string }> = [];
  const seenKeys = new Set<string>();

  for (const account of INSTAGRAM_ACCOUNTS) {
    try {
      console.log(`[scraper] Fetching @${account.handle}...`);
      const posts = await fetchAccountPosts(account.handle, 15);
      console.log(`[scraper]   Found ${posts.length} posts from @${account.handle}`);

      for (const post of posts) {
        const parsed = parseCaption(post.caption, account.handle, account.label);
        if (!parsed) continue;

        const key = dedupeKey(parsed.name);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        allParsed.push({
          ...parsed,
          handle: account.handle,
          label: account.label,
          postUrl: post.postUrl,
        });
      }
    } catch (e) {
      console.warn(`[scraper] Failed for @${account.handle}:`, e);
    }
  }

  console.log(`[scraper] Parsed ${allParsed.length} unique race events from Instagram`);

  let added = 0;
  let updated = 0;

  for (const race of allParsed) {
    const distancesJson = JSON.stringify(race.distances);
    const { min, max } = parseDistancesKm(race.distances);
    const ts = now();

    try {
      const existing = await storage.getRaceByName(race.name);

      if (!existing) {
        await storage.insertRace({
          name: race.name,
          date: race.date,
          dateTbc: race.dateTbc,
          location: race.location,
          type: race.type,
          distances: distancesJson,
          minDistanceKm: min,
          maxDistanceKm: max,
          registrationStatus: race.registrationStatus,
          registrationUrl: race.registrationUrl ?? null,
          sourceUrl: race.postUrl,
          sourceName: `Instagram @${race.handle}`,
          description: race.description,
          isNew: true,
          instagramPostUrl: race.postUrl,
          instagramAccount: race.handle,
          createdAt: ts,
          updatedAt: ts,
        } as InsertRace);
        added++;
      } else {
        const changed =
          existing.registrationStatus !== race.registrationStatus ||
          (race.date && existing.date !== race.date);
        if (changed) {
          await storage.updateRace(existing.id, {
            registrationStatus: race.registrationStatus,
            date: race.date,
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
    timestamp: ts(),
    racesAdded: added,
    racesUpdated: updated,
    status: "success",
    message: `Instagram scrape: ${allParsed.length} events found across ${INSTAGRAM_ACCOUNTS.length} accounts. ${added} new, ${updated} updated.`,
  });

  console.log(`[scraper] Done. +${added} new, ~${updated} updated`);
  return { added, updated };
}

function ts(): string {
  return new Date().toISOString();
}
