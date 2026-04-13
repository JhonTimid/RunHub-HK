import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, RefreshCw, TrendingUp, Globe, MapPin, X } from "lucide-react";
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
  country: string | null;
  continent: string | null;
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

const REGION_FILTERS = [
  { value: "all", label: "All Regions" },
  { value: "Asia", label: "🌏 Asia" },
  { value: "Europe", label: "🌍 Europe" },
  { value: "Americas", label: "🌎 Americas" },
  { value: "Africa", label: "🌍 Africa" },
  { value: "Oceania", label: "🌏 Oceania" },
  { value: "Other", label: "Other" },
];

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "road", label: "Road" },
  { value: "trail", label: "Trail" },
  { value: "mixed", label: "Mixed" },
];

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
  const [regionFilter, setRegionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [distPreset, setDistPreset] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showPast, setShowPast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const preset = DISTANCE_PRESETS[distPreset];

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (regionFilter !== "all") params.set("continent", regionFilter);
  if (typeFilter !== "all") params.set("type", typeFilter);
  if (preset.min != null) params.set("minKm", String(preset.min));
  if (preset.max != null) params.set("maxKm", String(preset.max));
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (showPast) params.set("showPast", "true");

  const { data, isLoading, refetch } = useQuery<{ races: Race[]; total: number }>({
    queryKey: ["/api/races", search, regionFilter, typeFilter, distPreset, statusFilter, showPast],
    queryFn: () => apiRequest("GET", `/api/races?${params.toString()}`).then((r) => r.json()),
  });

  const { data: stats, refetch: refetchStats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    queryFn: () => apiRequest("GET", "/api/stats").then((r) => r.json()),
  });

  const races = data?.races ?? [];
  const hasActiveFilters = regionFilter !== "all" || typeFilter !== "all" || distPreset !== 0 || statusFilter !== "all" || showPast;

  function clearFilters() {
    setRegionFilter("all");
    setTypeFilter("all");
    setDistPreset(0);
    setStatusFilter("all");
    setShowPast(false);
    setSearch("");
  }

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
                Global Race Calendar
              </h1>
              <p className="text-muted-foreground text-sm md:text-base max-w-lg">
                World Athletics Label Road Races worldwide — marathons, half marathons and long-distance events updated automatically.
              </p>
            </div>

            {/* Stats chips */}
            <div className="flex flex-wrap gap-3 shrink-0">
              <StatChip icon={<TrendingUp size={14} />} label="Upcoming" value={stats?.upcoming ?? "—"} />
              <StatChip icon={<Globe size={14} />} label="Total" value={stats?.total ?? "—"} />
              <StatChip icon={<MapPin size={14} />} label="Road" value={stats?.road ?? "—"} />
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-6 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search races, cities, countries…"
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

          {/* Region dropdown */}
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-40 h-8 text-xs bg-muted border-border" data-testid="select-region">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              {REGION_FILTERS.map((r) => (
                <SelectItem key={r.value} value={r.value} className="text-xs">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Race type dropdown */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32 h-8 text-xs bg-muted border-border" data-testid="select-type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTERS.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-clear-filters"
            >
              <X size={12} />
              Clear
            </button>
          )}

          {/* Refresh */}
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
          {regionFilter !== "all" && (
            <span className="ml-1 text-primary font-medium">in {regionFilter}</span>
          )}
          {stats?.lastRefreshed && (
            <span className="ml-2 opacity-60">
              · Updated {new Date(stats.lastRefreshed).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
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
            <div className="text-4xl mb-3">🌍</div>
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
          Race data sourced from{" "}
          <a
            href="https://worldathletics.org/competitions/world-athletics-label-road-races"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            World Athletics Label Road Races
          </a>
          , updated automatically. Always verify directly with race organisers.
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
