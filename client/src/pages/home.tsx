import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, RefreshCw, TrendingUp, Mountain, MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import RaceCard from "@/components/RaceCard";

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

interface Stats {
  total: number;
  upcoming: number;
  road: number;
  trail: number;
  lastRefreshed: string | null;
}

const DISTANCE_PRESETS = [
  { label: "All distances", min: null, max: null },
  { label: "5–10km", min: 5, max: 10 },
  { label: "Half marathon", min: 21, max: 22 },
  { label: "Marathon", min: 40, max: 43 },
  { label: "Ultra (50km+)", min: 50, max: null },
  { label: "100km+", min: 100, max: null },
];

const TYPE_FILTERS = ["all", "trail", "road", "mixed"];
const STATUS_FILTERS = [
  { value: "all", label: "Any status" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "tbc", label: "TBC" },
  { value: "unknown", label: "Unknown" },
];

export default function HomePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [distPreset, setDistPreset] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showPast, setShowPast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const preset = DISTANCE_PRESETS[distPreset];

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (typeFilter !== "all") params.set("type", typeFilter);
  if (preset.min != null) params.set("minKm", String(preset.min));
  if (preset.max != null) params.set("maxKm", String(preset.max));
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (showPast) params.set("showPast", "true");

  const { data, isLoading, refetch } = useQuery<{ races: Race[]; total: number }>({
    queryKey: ["/api/races", search, typeFilter, distPreset, statusFilter, showPast],
    queryFn: () => apiRequest("GET", `/api/races?${params.toString()}`).then((r) => r.json()),
  });

  const { data: stats, refetch: refetchStats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    queryFn: () => apiRequest("GET", "/api/stats").then((r) => r.json()),
  });

  const races = data?.races ?? [];
  const hasActiveFilters = typeFilter !== "all" || distPreset !== 0 || statusFilter !== "all" || showPast;

  function clearFilters() {
    setTypeFilter("all");
    setDistPreset(0);
    setStatusFilter("all");
    setShowPast(false);
    setSearch("");
  }

  // Refresh button: re-fetches latest data already in the DB.
  // The scraper runs automatically every 6 hours in the background.
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchStats()]);
      toast({ title: "Refreshed", description: "Race list is up to date." });
    } catch {
      toast({ title: "Refresh failed", description: "Could not load data. Please try again.", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero banner */}
      <div className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-1.5 tracking-tight">
                Hong Kong Race Calendar
              </h1>
              <p className="text-muted-foreground text-sm md:text-base max-w-lg">
                Road and trail races across HK — updated automatically from Instagram running accounts.
              </p>
            </div>

            {/* Stats chips */}
            <div className="flex flex-wrap gap-3 shrink-0">
              <StatChip icon={<TrendingUp size={14} />} label="Upcoming" value={stats?.upcoming ?? "—"} />
              <StatChip icon={<Mountain size={14} />} label="Trail" value={stats?.trail ?? "—"} />
              <StatChip icon={<MapPin size={14} />} label="Road" value={stats?.road ?? "—"} />
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-6 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search races, locations…"
              className="pl-10 h-11 bg-muted border-border text-foreground placeholder:text-muted-foreground"
              data-testid="input-search"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-clear-search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {/* Type filters */}
          <div className="flex gap-1.5 flex-wrap" data-testid="filter-type">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "text-xs font-semibold px-3 py-1.5 rounded-full transition-colors",
                  typeFilter === t ? "filter-chip-active" : "filter-chip"
                )}
                data-testid={`button-type-${t}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-border hidden sm:block" />

          {/* Distance preset */}
          <Select
            value={String(distPreset)}
            onValueChange={(v) => setDistPreset(Number(v))}
          >
            <SelectTrigger className="w-40 h-8 text-xs bg-muted border-border" data-testid="select-distance">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISTANCE_PRESETS.map((p, i) => (
                <SelectItem key={i} value={String(i)} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs bg-muted border-border" data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Show past */}
          <button
            onClick={() => setShowPast(!showPast)}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-full transition-colors",
              showPast ? "filter-chip-active" : "filter-chip"
            )}
            data-testid="button-show-past"
          >
            Show past
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
              data-testid="button-clear-filters"
            >
              <X size={12} />
              Clear
            </button>
          )}

          {/* Refresh — re-fetches latest DB data, scraper runs automatically in background */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="ml-auto text-xs gap-1.5 h-8"
            data-testid="button-refresh"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {/* Result count */}
        <p className="text-xs text-muted-foreground mb-4" data-testid="text-result-count">
          {isLoading ? "Loading…" : `${data?.total ?? 0} race${data?.total !== 1 ? "s" : ""}`}
          {stats?.lastRefreshed && (
            <span className="ml-2 opacity-60">
              · Last updated {new Date(stats.lastRefreshed).toLocaleDateString("en-HK", { day: "numeric", month: "short" })}
            </span>
          )}
        </p>

        {/* Race grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 rounded-xl skeleton-shimmer" />
            ))}
          </div>
        ) : races.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🏃</div>
            <p className="text-muted-foreground text-sm">No races match your filters.</p>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-3 text-primary">
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {races.map((race) => (
              <RaceCard key={race.id} race={race} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6 text-center text-xs text-muted-foreground">
        <p>
          Race data sourced from Hong Kong running Instagram accounts, updated automatically every 6 hours.
          Always verify directly with race organisers.
        </p>
      </footer>
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-sm">
      <span className="text-primary">{icon}</span>
      <div>
        <div className="font-bold text-foreground leading-none">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
