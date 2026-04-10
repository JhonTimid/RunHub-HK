import { Link } from "wouter";
import { MapPin, Calendar, ChevronRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Race {
  id: number;
  name: string;
  date: string;
  dateTbc: boolean;
  location: string;
  type: string;
  distances: string[];
  registrationStatus: string;
  registrationUrl: string | null;
  isNew: boolean;
  description: string | null;
  sourceName?: string | null;
  instagramPostUrl?: string | null;
  instagramAccount?: string | null;
}

function formatDate(dateStr: string, tbc: boolean): string {
  if (tbc && dateStr.length <= 7) {
    const [year, month] = dateStr.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mIdx = parseInt(month) - 1;
    return `${months[mIdx] ?? ""} ${year} (TBC)`;
  }
  try {
    const d = new Date(dateStr + (dateStr.length === 10 ? "T00:00:00" : ""));
    return d.toLocaleDateString("en-HK", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function getDaysUntil(dateStr: string, tbc: boolean): string | null {
  if (tbc) return null;
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return null;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 30) return `${diff} days`;
  if (diff <= 365) return `${Math.ceil(diff / 7)}w`;
  return `${Math.ceil(diff / 30)}mo`;
}

export default function RaceCard({ race }: { race: Race }) {
  const dateLabel = formatDate(race.date, race.dateTbc);
  const countdown = getDaysUntil(race.date, race.dateTbc);

  return (
    <Link href={`/race/${race.id}`}>
      <a
        className="block no-underline"
        data-testid={`card-race-${race.id}`}
      >
        <div className={cn(
          "group relative rounded-xl border border-border bg-card p-5 race-card-hover cursor-pointer",
        )}>
          {/* NEW badge top-right */}
          {race.isNew && (
            <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full badge-new flex items-center gap-1">
              <Zap size={10} />
              NEW
            </span>
          )}

          {/* Top row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-foreground leading-tight truncate pr-12" data-testid={`text-race-name-${race.id}`}>
                {race.name}
              </h3>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar size={13} className="shrink-0" />
              <span data-testid={`text-race-date-${race.id}`}>{dateLabel}</span>
              {countdown && (
                <span className="text-xs font-medium text-primary ml-0.5">· {countdown}</span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={13} className="shrink-0" />
              <span className="truncate">{race.location}</span>
            </span>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full", `badge-${race.type}`)}>
              {race.type.charAt(0).toUpperCase() + race.type.slice(1)}
            </span>

            <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full", `badge-${race.registrationStatus}`)}>
              {race.registrationStatus === "unknown" ? "Reg TBC" :
               race.registrationStatus === "tbc" ? "Reg TBC" :
               race.registrationStatus === "open" ? "Open" : "Closed"}
            </span>

            {race.distances.slice(0, 4).map((d, i) => (
              <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                {d}
              </span>
            ))}
            {race.distances.length > 4 && (
              <span className="text-xs text-muted-foreground">+{race.distances.length - 4} more</span>
            )}

            {/* Instagram source badge */}
            {race.instagramAccount && (
              <a
                href={race.instagramPostUrl ?? `https://www.instagram.com/${race.instagramAccount}/`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-pink-500 transition-colors"
                title={`Source: Instagram @${race.instagramAccount}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
                @{race.instagramAccount}
              </a>
            )}
          </div>

          {/* Chevron */}
          <ChevronRight
            size={16}
            className="absolute bottom-5 right-4 text-muted-foreground group-hover:text-primary transition-colors"
          />
        </div>
      </a>
    </Link>
  );
}
