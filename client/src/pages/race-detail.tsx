import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Calendar, MapPin, ExternalLink, Mountain, Route, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";

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
  sourceUrl: string | null;
  sourceName: string | null;
  description: string | null;
  isNew: boolean;
  createdAt: string;
  updatedAt: string;
}

function formatDate(dateStr: string, tbc: boolean): string {
  if (tbc && dateStr.length <= 7) {
    const [year, month] = dateStr.split("-");
    const months = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    return `${months[parseInt(month) - 1] ?? ""} ${year} (date TBC)`;
  }
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-HK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function getDaysUntil(dateStr: string, tbc: boolean): { label: string; urgent: boolean } | null {
  if (tbc) return null;
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return null;
  if (diff === 0) return { label: "Today!", urgent: true };
  if (diff === 1) return { label: "Tomorrow", urgent: true };
  if (diff <= 7) return { label: `${diff} days away`, urgent: true };
  if (diff <= 30) return { label: `${diff} days away`, urgent: false };
  const weeks = Math.ceil(diff / 7);
  if (diff <= 90) return { label: `${weeks} weeks away`, urgent: false };
  const months = Math.ceil(diff / 30);
  return { label: `${months} months away`, urgent: false };
}

export default function RaceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: race, isLoading } = useQuery<Race>({
    queryKey: ["/api/races", id],
    queryFn: () => apiRequest("GET", `/api/races/${id}`).then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
          <div className="h-8 w-48 skeleton-shimmer rounded" />
          <div className="h-10 w-96 skeleton-shimmer rounded" />
          <div className="h-40 skeleton-shimmer rounded-xl" />
        </div>
      </div>
    );
  }

  if (!race) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <p className="text-muted-foreground">Race not found.</p>
          <Link href="/"><a><Button variant="ghost" className="mt-4">Back to races</Button></a></Link>
        </div>
      </div>
    );
  }

  const countdown = getDaysUntil(race.date, race.dateTbc);
  const dateLabel = formatDate(race.date, race.dateTbc);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
        {/* Back */}
        <Link href="/">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors" data-testid="link-back">
            <ArrowLeft size={14} />
            All races
          </a>
        </Link>

        {/* Header card */}
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 mb-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full", `badge-${race.type}`)}>
              {race.type.charAt(0).toUpperCase() + race.type.slice(1)}
            </span>
            <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full", `badge-${race.registrationStatus}`)}>
              Registration: {race.registrationStatus === "unknown" ? "TBC" :
                race.registrationStatus === "tbc" ? "TBC" :
                race.registrationStatus === "open" ? "Open" : "Closed"}
            </span>
            {race.isNew && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full badge-new flex items-center gap-1">
                <Zap size={10} /> NEW
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-4 leading-tight" data-testid="text-race-title">
            {race.name}
          </h1>

          {/* Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <MetaItem icon={<Calendar size={15} />} label="Date">
              <span data-testid="text-race-date">{dateLabel}</span>
              {countdown && (
                <span className={cn("ml-2 text-sm font-semibold", countdown.urgent ? "text-primary" : "text-muted-foreground")}>
                  · {countdown.label}
                </span>
              )}
            </MetaItem>
            <MetaItem icon={<MapPin size={15} />} label="Location">
              {race.location}
            </MetaItem>
          </div>

          {/* Distances */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Distances</p>
            <div className="flex flex-wrap gap-2">
              {race.distances.map((d, i) => (
                <span key={i} className="text-sm bg-muted text-foreground px-3 py-1 rounded-full font-semibold" data-testid={`badge-distance-${i}`}>
                  {d}
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          {race.description && (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-description">
                {race.description}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          {race.registrationUrl && (
            <a
              href={race.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-register"
            >
              <Button className="gap-2">
                <ExternalLink size={14} />
                Register / Official Site
              </Button>
            </a>
          )}
          {race.sourceUrl && (
            <a
              href={race.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-source"
            >
              <Button variant="outline" className="gap-2 text-sm">
                <ExternalLink size={13} />
                Source: {race.sourceName ?? "View source"}
              </Button>
            </a>
          )}
          <Link href="/alerts">
            <a>
              <Button variant="ghost" className="gap-2 text-sm" data-testid="link-set-alert">
                Set alert for this type
              </Button>
            </a>
          </Link>
        </div>

        {/* Source info */}
        <p className="text-xs text-muted-foreground">
          Added {new Date(race.createdAt).toLocaleDateString("en-HK", { month: "short", day: "numeric", year: "numeric" })}.
          Always verify with the official organiser before registering.
        </p>
      </div>
    </div>
  );
}

function MetaItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-center gap-1.5 text-foreground text-sm">
        <span className="text-primary">{icon}</span>
        {children}
      </div>
    </div>
  );
}
