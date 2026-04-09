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
