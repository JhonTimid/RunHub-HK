import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, Clock, Users, ChevronRight, Plus, Search,
  Mountain, Route, CircleDot, Smile, Heart, Star,
} from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────
type RunType = "road" | "trail" | "track" | "fun_run" | "recovery";

interface User {
  id: number;
  name: string;
  handle: string;
  avatarInitials: string;
  avatarColor: string;
  avgRating: number;
}

interface CommunityRun {
  id: number;
  hostId: number;
  title: string;
  runType: RunType;
  date: string;
  startTime: string;
  meetingPoint: string;
  distanceKm: number;
  paceMin: string | null;
  paceMax: string | null;
  maxParticipants: number | null;
  description: string | null;
  visibility: string;
  status: string;
  host: User | null;
  participantCount: number;
  participants: User[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const RUN_TYPE_META: Record<RunType, { label: string; icon: React.ElementType; badgeClass: string }> = {
  trail:    { label: "Trail",    icon: Mountain,   badgeClass: "badge-trail"    },
  road:     { label: "Road",     icon: Route,      badgeClass: "badge-road"     },
  track:    { label: "Track",    icon: CircleDot,  badgeClass: "badge-track"    },
  fun_run:  { label: "Fun Run",  icon: Smile,      badgeClass: "badge-fun_run"  },
  recovery: { label: "Recovery", icon: Heart,      badgeClass: "badge-recovery" },
};

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All Runs" },
  { value: "trail", label: "Trail" },
  { value: "road", label: "Road" },
  { value: "track", label: "Track" },
  { value: "fun_run", label: "Fun Run" },
  { value: "recovery", label: "Recovery" },
];



function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 0 && diff < 7) return d.toLocaleDateString("en-HK", { weekday: "long" });
  return d.toLocaleDateString("en-HK", { month: "short", day: "numeric" });
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 32 }: { user: User; size?: number }) {
  return (
    <span
      className="flex-shrink-0 inline-flex items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: user.avatarColor, fontSize: size * 0.38 }}
    >
      {user.avatarInitials}
    </span>
  );
}

// ── Run Card ──────────────────────────────────────────────────────────────────
function RunCard({ run }: { run: CommunityRun }) {
  const meta = RUN_TYPE_META[run.runType] ?? RUN_TYPE_META.road;
  const Icon = meta.icon;
  const isFull = run.maxParticipants !== null && run.participantCount >= run.maxParticipants;
  const isCompleted = run.status === "completed";
  const capacityText = run.maxParticipants
    ? `${run.participantCount}/${run.maxParticipants}`
    : `${run.participantCount} joined`;

  return (
    <Link href={`/community/run/${run.id}`}>
      <a
        className="block bg-card border border-border rounded-xl p-4 race-card-hover cursor-pointer no-underline"
        data-testid={`card-run-${run.id}`}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {run.host && <Avatar user={run.host} size={34} />}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground leading-none mb-0.5">
                @{run.host?.handle}
                {run.host && run.host.avgRating > 0 && (
                  <span className="inline-flex items-center gap-0.5 ml-1.5 text-amber-400">
                    <Star size={9} fill="currentColor" />
                    {run.host.avgRating.toFixed(1)}
                  </span>
                )}
              </p>
              <p className="font-semibold text-foreground text-sm leading-tight truncate">
                {run.title}
              </p>
            </div>
          </div>
          <span
            className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.badgeClass}`}
            data-testid={`badge-type-${run.id}`}
          >
            <Icon size={10} />
            {meta.label}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            <span className="font-medium text-foreground">{formatDate(run.date)}</span>
            &nbsp;·&nbsp;{formatTime(run.startTime)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={11} />
            <span className="truncate max-w-[180px]">{run.meetingPoint.split(",")[0]}</span>
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-primary font-semibold">{run.distanceKm} km</span>
            {run.paceMin && run.paceMax && (
              <span className="text-muted-foreground">{run.paceMin}–{run.paceMax} /km</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Participant avatars */}
            <div className="flex -space-x-1.5">
              {run.participants.slice(0, 4).map((p) => (
                <Avatar key={p.id} user={p} size={22} />
              ))}
            </div>
            <span className={`text-xs ${isFull ? "text-destructive" : "text-muted-foreground"}`}>
              <Users size={11} className="inline mr-0.5" />
              {capacityText}
              {isFull && " · Full"}
            </span>
            {isCompleted && (
              <span className="text-xs text-muted-foreground italic">Completed</span>
            )}
          </div>
        </div>
      </a>
    </Link>
  );
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────
function RunCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-[34px] h-[34px] rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-36" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CommunityFeedPage() {
  const { user: currentUser } = useAuth();
  const CURRENT_USER_ID = currentUser?.id ?? 1;
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const { data, isLoading } = useQuery<{ runs: CommunityRun[]; total: number }>({
    queryKey: ["/api/community/runs", typeFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (search) params.set("search", search);
      return apiRequest("GET", `/api/community/runs?${params.toString()}`).then((r) => r.json());
    },
  });

  const allRuns = data?.runs ?? [];
  const activeRuns = allRuns.filter((r) => r.status !== "completed");
  const completedRuns = allRuns.filter((r) => r.status === "completed");
  const displayRuns = showCompleted ? allRuns : activeRuns;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">Community Runs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Join a run or host your own</p>
          </div>
          <Link href="/community/create">
            <a
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-3.5 py-2 rounded-lg hover:bg-primary/90 transition-colors no-underline"
              data-testid="button-create-run"
            >
              <Plus size={15} />
              Host a Run
            </a>
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search runs, locations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            data-testid="input-search-runs"
          />
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-5 scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                typeFilter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              }`}
              data-testid={`filter-${f.value}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Run list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <RunCardSkeleton key={i} />)}
          </div>
        ) : (
          <>
            {displayRuns.length === 0 && !isLoading && (
              <div className="text-center py-16">
                <p className="text-3xl mb-3">🏃</p>
                <p className="text-muted-foreground text-sm">No runs found. Why not host one?</p>
                <Link href="/community/create">
                  <a className="inline-flex items-center gap-1.5 mt-4 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors no-underline">
                    <Plus size={14} />
                    Host a Run
                  </a>
                </Link>
              </div>
            )}

            <div className="space-y-3">
              {displayRuns.map((run) => (
                <RunCard key={run.id} run={run} />
              ))}
            </div>

            {completedRuns.length > 0 && (
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-2 transition-colors"
                data-testid="button-toggle-completed"
              >
                {showCompleted ? "Hide" : `Show ${completedRuns.length} completed run${completedRuns.length !== 1 ? "s" : ""}`}
                <ChevronRight size={13} className={`transition-transform ${showCompleted ? "rotate-90" : ""}`} />
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
