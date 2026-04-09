import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Star, Users, Calendar, MapPin, Clock,
  Mountain, Route, CircleDot, Smile, Heart,
  ChevronRight, Edit3, XCircle, Ruler, BarChart3, Award,
} from "lucide-react";



// ── Types ─────────────────────────────────────────────────────────────────────
type RunType = "road" | "trail" | "track" | "fun_run" | "recovery";

interface User {
  id: number;
  name: string;
  handle: string;
  avatarInitials: string;
  avatarColor: string;
  totalRuns: number;
  avgRating: number;
  bio: string;
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
  status: string;
  participantCount: number;
  participants: { id: number; name: string; avatarInitials: string; avatarColor: string }[];
}

interface UserProfile extends User {
  hostedRuns: CommunityRun[];
  ratings: { id: number; stars: number; review: string | null }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const RUN_TYPE_META: Record<RunType, { label: string; icon: React.ElementType; badgeClass: string }> = {
  trail:    { label: "Trail",    icon: Mountain,  badgeClass: "badge-trail" },
  road:     { label: "Road",     icon: Route,     badgeClass: "badge-road" },
  track:    { label: "Track",    icon: CircleDot, badgeClass: "badge-track" },
  fun_run:  { label: "Fun Run",  icon: Smile,     badgeClass: "badge-fun_run" },
  recovery: { label: "Recovery", icon: Heart,     badgeClass: "badge-recovery" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-HK", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={12}
          className={s <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}
        />
      ))}
    </div>
  );
}

function Avatar({ user, size = 36 }: { user: { avatarInitials: string; avatarColor: string }; size?: number }) {
  return (
    <span
      className="flex-shrink-0 inline-flex items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: user.avatarColor, fontSize: size * 0.38 }}
    >
      {user.avatarInitials}
    </span>
  );
}

// ── Run Card for Dashboard ─────────────────────────────────────────────────────
function DashRunCard({ run, onCancel }: { run: CommunityRun; onCancel: (id: number) => void }) {
  const meta = RUN_TYPE_META[run.runType] ?? RUN_TYPE_META.road;
  const TypeIcon = meta.icon;
  const isCompleted = run.status === "completed";
  const isCancelled = run.status === "cancelled";
  const [, navigate] = useLocation();

  return (
    <div
      className={`bg-card border border-border rounded-xl p-4 ${isCompleted || isCancelled ? "opacity-70" : ""}`}
      data-testid={`dash-card-${run.id}`}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-3">
        <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.badgeClass}`}>
          <TypeIcon size={9} />
          {meta.label}
        </span>
        {isCompleted && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Completed</span>}
        {isCancelled && <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">Cancelled</span>}
      </div>
      <h3 className="font-semibold text-sm text-foreground mb-2 leading-tight">{run.title}</h3>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(run.date)} · {formatTime(run.startTime)}</span>
        <span className="flex items-center gap-1"><MapPin size={10} />{run.meetingPoint.split(",")[0]}</span>
        <span className="flex items-center gap-1"><Ruler size={10} />{run.distanceKm} km</span>
      </div>

      {/* Participants */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex -space-x-1.5">
          {run.participants.slice(0, 5).map((p) => (
            <Avatar key={p.id} user={p} size={22} />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          <Users size={10} className="inline mr-0.5" />
          {run.participantCount}{run.maxParticipants ? `/${run.maxParticipants}` : ""} participants
        </span>
      </div>

      {/* Actions */}
      {!isCompleted && !isCancelled && (
        <div className="flex gap-2 pt-2 border-t border-border">
          <Link href={`/community/run/${run.id}`}>
            <a className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-background rounded-lg border border-border hover:border-muted-foreground transition-colors no-underline" data-testid={`button-view-${run.id}`}>
              <ChevronRight size={12} />
              View
            </a>
          </Link>
          <button
            onClick={() => onCancel(run.id)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-destructive bg-destructive/10 rounded-lg hover:bg-destructive/20 transition-colors"
            data-testid={`button-cancel-${run.id}`}
          >
            <XCircle size={12} />
            Cancel
          </button>
        </div>
      )}

      {isCompleted && (
        <div className="pt-2 border-t border-border">
          <Link href={`/community/run/${run.id}`}>
            <a className="text-xs text-muted-foreground hover:text-primary transition-colors no-underline flex items-center gap-1" data-testid={`link-view-completed-${run.id}`}>
              View run & ratings <ChevronRight size={11} />
            </a>
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function HostDashboardPage() {
  const { user: currentUser } = useAuth();
  const CURRENT_USER_ID = currentUser?.id ?? 1;
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/community/users", CURRENT_USER_ID],
    queryFn: () => apiRequest("GET", `/api/community/users/${CURRENT_USER_ID}`).then((r) => r.json()),
  });

  const cancelMutation = useMutation({
    mutationFn: async (runId: number) => {
      const res = await apiRequest("PATCH", `/api/community/runs/${runId}`, { status: "cancelled" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/users", CURRENT_USER_ID] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/runs"] });
      toast({ title: "Run cancelled", description: "Participants have been notified." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not cancel run.", variant: "destructive" });
    },
  });

  const hostedRuns = profile?.hostedRuns ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const upcomingRuns = hostedRuns.filter((r) => r.status === "active" && r.date >= today);
  const pastRuns = hostedRuns.filter((r) => r.status === "completed" || r.status === "cancelled" || r.date < today);
  const avgRating = profile?.avgRating ?? 0;
  const totalRatings = profile?.ratings?.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* Page title + CTA */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">Host Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your runs</p>
          </div>
          <Link href="/community/create">
            <a
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-3.5 py-2 rounded-lg hover:bg-primary/90 transition-colors no-underline"
              data-testid="button-create-run"
            >
              <Plus size={15} />
              New Run
            </a>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* Profile stats card */}
            {profile && (
              <div className="bg-card border border-border rounded-xl p-4 mb-5" data-testid="profile-stats">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar user={profile} size={48} />
                  <div>
                    <p className="font-bold text-foreground">{profile.name}</p>
                    <p className="text-sm text-muted-foreground">@{profile.handle}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center bg-background rounded-xl py-3 px-2">
                    <div className="flex items-center justify-center mb-1">
                      <BarChart3 size={16} className="text-primary" />
                    </div>
                    <p className="text-xl font-display font-bold text-foreground">{hostedRuns.length}</p>
                    <p className="text-xs text-muted-foreground">Runs Hosted</p>
                  </div>
                  <div className="text-center bg-background rounded-xl py-3 px-2">
                    <div className="flex items-center justify-center mb-1">
                      <Star size={16} className="text-amber-400 fill-amber-400" />
                    </div>
                    <p className="text-xl font-display font-bold text-foreground">
                      {avgRating > 0 ? avgRating.toFixed(1) : "–"}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Rating</p>
                  </div>
                  <div className="text-center bg-background rounded-xl py-3 px-2">
                    <div className="flex items-center justify-center mb-1">
                      <Award size={16} className="text-primary" />
                    </div>
                    <p className="text-xl font-display font-bold text-foreground">{totalRatings}</p>
                    <p className="text-xs text-muted-foreground">Reviews</p>
                  </div>
                </div>

                {/* Star breakdown */}
                {avgRating > 0 && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                    <StarRating rating={avgRating} />
                    <span className="text-sm font-semibold text-foreground">{avgRating.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">from {totalRatings} rating{totalRatings !== 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>
            )}

            {/* Reviews section */}
            {profile && profile.ratings && profile.ratings.length > 0 && (
              <div className="bg-card border border-border rounded-xl px-4 py-3 mb-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Reviews</p>
                <div className="space-y-2.5">
                  {profile.ratings.slice(0, 3).map((r) => (
                    <div key={r.id} className="flex gap-2" data-testid={`review-${r.id}`}>
                      <StarRating rating={r.stars} />
                      {r.review && <p className="text-xs text-muted-foreground leading-relaxed">{r.review}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-muted p-1 rounded-xl mb-4">
              <button
                onClick={() => setTab("upcoming")}
                className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${
                  tab === "upcoming"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="tab-upcoming"
              >
                Upcoming ({upcomingRuns.length})
              </button>
              <button
                onClick={() => setTab("past")}
                className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${
                  tab === "past"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="tab-past"
              >
                Past ({pastRuns.length})
              </button>
            </div>

            {/* Run list */}
            {tab === "upcoming" && (
              <>
                {upcomingRuns.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-3xl mb-3">🏃</p>
                    <p className="text-muted-foreground text-sm mb-4">No upcoming runs yet.</p>
                    <Link href="/community/create">
                      <a className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors no-underline">
                        <Plus size={14} />
                        Host a Run
                      </a>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingRuns.map((r) => (
                      <DashRunCard key={r.id} run={r} onCancel={(id) => cancelMutation.mutate(id)} />
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "past" && (
              <>
                {pastRuns.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground text-sm">No past runs yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pastRuns.map((r) => (
                      <DashRunCard key={r.id} run={r} onCancel={(id) => cancelMutation.mutate(id)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
