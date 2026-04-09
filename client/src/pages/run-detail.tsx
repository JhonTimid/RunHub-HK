import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft, MapPin, Clock, Users, Star, Send,
  Mountain, Route, CircleDot, Smile, Heart, Calendar,
  Ruler, Gauge, CheckCircle, XCircle, AlertTriangle, X,
} from "lucide-react";



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

interface Message {
  id: number;
  runId: number;
  userId: number;
  message: string;
  createdAt: string;
  user: User | null;
}

interface Rating {
  id: number;
  stars: number;
  review: string | null;
  raterId: number;
}

interface RunDetail {
  id: number;
  hostId: number;
  title: string;
  runType: RunType;
  date: string;
  startTime: string;
  meetingPoint: string;
  meetingLat: number | null;
  meetingLng: number | null;
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
  messages: Message[];
  ratings: Rating[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const RUN_TYPE_META: Record<RunType, { label: string; icon: React.ElementType; badgeClass: string }> = {
  trail:    { label: "Trail",    icon: Mountain,   badgeClass: "badge-trail" },
  road:     { label: "Road",     icon: Route,      badgeClass: "badge-road" },
  track:    { label: "Track",    icon: CircleDot,  badgeClass: "badge-track" },
  fun_run:  { label: "Fun Run",  icon: Smile,      badgeClass: "badge-fun_run" },
  recovery: { label: "Recovery", icon: Heart,      badgeClass: "badge-recovery" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const base = d.toLocaleDateString("en-HK", { weekday: "long", month: "long", day: "numeric" });
  if (diff === 0) return `Today · ${base}`;
  if (diff === 1) return `Tomorrow · ${base}`;
  if (diff < 0) return `${base} (past)`;
  return base;
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-HK", { hour: "2-digit", minute: "2-digit" });
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 36 }: { user: User; size?: number }) {
  return (
    <span
      className="flex-shrink-0 inline-flex items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: user.avatarColor, fontSize: size * 0.38 }}
    >
      {user.avatarInitials}
    </span>
  );
}

// ── RSVP Confirmation Modal ───────────────────────────────────────────────────
function RSVPModal({ run, onClose, onConfirm, isPending }: {
  run: RunDetail;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const meta = RUN_TYPE_META[run.runType] ?? RUN_TYPE_META.road;
  const Icon = meta.icon;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-rsvp"
      >
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={28} className="text-primary" />
          </div>
          <h2 className="font-display font-bold text-lg text-foreground">Join this Run?</h2>
          <p className="text-sm text-muted-foreground mt-1">You're about to join</p>
        </div>

        <div className="bg-background rounded-xl p-3.5 mb-5 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.badgeClass}`}>
              <Icon size={10} />{meta.label}
            </span>
            <span className="font-semibold text-sm text-foreground">{run.title}</span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar size={11} /> {formatDate(run.date)} · {formatTime(run.startTime)}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin size={11} /> {run.meetingPoint}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Ruler size={11} /> {run.distanceKm} km
            {run.paceMin && run.paceMax && <span>&nbsp;·&nbsp;{run.paceMin}–{run.paceMax} /km</span>}
          </p>
        </div>

        <p className="text-xs text-muted-foreground text-center mb-4">
          The host will be notified of your RSVP.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
            data-testid="button-cancel-rsvp"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all"
            data-testid="button-confirm-rsvp"
          >
            {isPending ? "Joining…" : "Confirm Join"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rating Modal ──────────────────────────────────────────────────────────────
function RatingModal({ run, onClose }: { run: RunDetail; onClose: () => void }) {
  const { toast } = useToast();
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [review, setReview] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/community/runs/${run.id}/rate`, {
        raterId: CURRENT_USER_ID,
        stars,
        review: review.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/runs", run.id] });
      toast({ title: "Rating submitted!", description: "Thanks for your feedback." });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message ?? "Could not submit rating.", variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()} data-testid="modal-rating">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-foreground">Rate this Run</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="button-close-rating">
            <X size={18} />
          </button>
        </div>

        {run.host && (
          <div className="flex items-center gap-2.5 mb-4">
            <Avatar user={run.host} size={38} />
            <div>
              <p className="text-sm font-semibold text-foreground">{run.host.name}</p>
              <p className="text-xs text-muted-foreground">@{run.host.handle} · Host</p>
            </div>
          </div>
        )}

        {/* Stars */}
        <div className="flex items-center justify-center gap-2 my-5">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setStars(s)}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              className="transition-transform hover:scale-110"
              data-testid={`star-${s}`}
            >
              <Star
                size={32}
                className={`transition-colors ${s <= (hovered || stars) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mb-4">
          {stars === 0 ? "Tap to rate" : stars === 5 ? "Excellent!" : stars === 4 ? "Great run!" : stars === 3 ? "Good run" : stars === 2 ? "Okay" : "Poor experience"}
        </p>

        <textarea
          rows={3}
          placeholder="Leave a short review (optional)…"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none mb-4"
          data-testid="input-review"
        />

        <button
          onClick={() => stars > 0 && mutate()}
          disabled={stars === 0 || isPending}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          data-testid="button-submit-rating"
        >
          {isPending ? "Submitting…" : "Submit Rating"}
        </button>
      </div>
    </div>
  );
}

// ── Map Preview Placeholder ───────────────────────────────────────────────────
function MapPlaceholder({ run }: { run: RunDetail }) {
  const mapsUrl = `https://maps.google.com?q=${encodeURIComponent(run.meetingPoint)}`;
  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block relative rounded-xl overflow-hidden border border-border bg-muted h-36 hover:border-primary/50 transition-colors group no-underline"
      data-testid="link-map"
    >
      {/* Grid pattern background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
          <MapPin size={20} className="text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">{run.meetingPoint.split(",")[0]}</p>
        <p className="text-xs text-muted-foreground">Tap to open in Google Maps</p>
      </div>
    </a>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function RunDetailPage() {
  const { user: currentUser } = useAuth();
  const CURRENT_USER_ID = currentUser?.id ?? 1;
  const params = useParams<{ id: string }>();
  const runId = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [showRSVP, setShowRSVP] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [chatMsg, setChatMsg] = useState("");

  const { data: run, isLoading } = useQuery<RunDetail>({
    queryKey: ["/api/community/runs", runId],
    queryFn: () => apiRequest("GET", `/api/community/runs/${runId}`).then((r) => r.json()),
  });

  const { data: joinedData } = useQuery<{ joined: boolean }>({
    queryKey: ["/api/community/runs", runId, "joined"],
    queryFn: () => apiRequest("GET", `/api/community/runs/${runId}/joined?userId=${CURRENT_USER_ID}`).then((r) => r.json()),
    enabled: !!run,
  });

  const isJoined = joinedData?.joined ?? false;
  const isHost = run?.hostId === CURRENT_USER_ID;
  const isFull = !!(run?.maxParticipants && run.participantCount >= run.maxParticipants && !isJoined);
  const isCompleted = run?.status === "completed";
  const alreadyRated = run?.ratings?.some((r) => r.raterId === CURRENT_USER_ID) ?? false;

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/community/runs/${runId}/join`, { userId: CURRENT_USER_ID });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/runs", runId] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/runs", runId, "joined"] });
      setShowRSVP(false);
      toast({ title: "You're in!", description: "You've joined this run. See you there!" });
    },
    onError: (e: any) => {
      setShowRSVP(false);
      toast({ title: "Error", description: e.message ?? "Could not join.", variant: "destructive" });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/community/runs/${runId}/leave`, { userId: CURRENT_USER_ID });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/runs", runId] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/runs", runId, "joined"] });
      toast({ title: "Left run", description: "You've been removed from this run." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not leave run.", variant: "destructive" });
    },
  });

  const msgMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", `/api/community/runs/${runId}/messages`, {
        userId: CURRENT_USER_ID,
        message,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/runs", runId] });
      setChatMsg("");
    },
    onError: () => {
      toast({ title: "Error", description: "Could not send message.", variant: "destructive" });
    },
  });

  const handleSendMsg = () => {
    if (!chatMsg.trim()) return;
    msgMutation.mutate(chatMsg.trim());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-lg px-4 py-6 space-y-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-24 w-full" />
        </main>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-muted-foreground">Run not found.</p>
          <button onClick={() => navigate("/community")} className="mt-4 text-primary text-sm hover:underline">
            Back to Community Runs
          </button>
        </main>
      </div>
    );
  }

  const meta = RUN_TYPE_META[run.runType] ?? RUN_TYPE_META.road;
  const TypeIcon = meta.icon;
  const avgRating = run.ratings.length
    ? (run.ratings.reduce((a, r) => a + r.stars, 0) / run.ratings.length).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-6 pb-24">
        {/* Back */}
        <button
          onClick={() => navigate("/community")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          data-testid="button-back"
        >
          <ChevronLeft size={15} />
          Community Runs
        </button>

        {/* Type badge + title */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${meta.badgeClass}`}>
              <TypeIcon size={10} />
              {meta.label}
            </span>
            <h1 className="font-display font-bold text-xl text-foreground leading-tight">{run.title}</h1>
          </div>
          {isCompleted && (
            <span className="flex-shrink-0 bg-muted text-muted-foreground text-xs px-2.5 py-1 rounded-full">Completed</span>
          )}
        </div>

        {/* Host info */}
        {run.host && (
          <div className="flex items-center gap-2.5 bg-card border border-border rounded-xl p-3 mb-4">
            <Avatar user={run.host} size={40} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">{run.host.name}</p>
              <p className="text-xs text-muted-foreground">@{run.host.handle}</p>
            </div>
            {run.host.avgRating > 0 && (
              <div className="flex items-center gap-1 text-amber-400">
                <Star size={13} fill="currentColor" />
                <span className="text-sm font-semibold">{run.host.avgRating.toFixed(1)}</span>
              </div>
            )}
          </div>
        )}

        {/* Run details */}
        <div className="bg-card border border-border rounded-xl divide-y divide-border mb-4">
          <div className="flex items-center gap-3 px-4 py-3">
            <Calendar size={15} className="text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Date & Time</p>
              <p className="text-sm font-medium text-foreground">{formatDate(run.date)} · {formatTime(run.startTime)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <MapPin size={15} className="text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Meeting Point</p>
              <p className="text-sm font-medium text-foreground">{run.meetingPoint}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Ruler size={15} className="text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Distance</p>
              <p className="text-sm font-medium text-foreground">{run.distanceKm} km</p>
            </div>
          </div>
          {(run.paceMin || run.paceMax) && (
            <div className="flex items-center gap-3 px-4 py-3">
              <Gauge size={15} className="text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Pace Range</p>
                <p className="text-sm font-medium text-foreground">
                  {run.paceMin && run.paceMax ? `${run.paceMin}–${run.paceMax} min/km` : run.paceMin || run.paceMax}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 px-4 py-3">
            <Users size={15} className="text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Participants</p>
              <p className="text-sm font-medium text-foreground">
                {run.participantCount}{run.maxParticipants ? `/${run.maxParticipants}` : ""} joined
                {isFull && <span className="text-destructive ml-1.5">(Full)</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Map preview */}
        <div className="mb-4">
          <MapPlaceholder run={run} />
        </div>

        {/* Description */}
        {run.description && (
          <div className="bg-card border border-border rounded-xl px-4 py-3 mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">About this Run</p>
            <p className="text-sm text-foreground leading-relaxed">{run.description}</p>
          </div>
        )}

        {/* Participants */}
        <div className="bg-card border border-border rounded-xl px-4 py-3 mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Participants ({run.participantCount})
          </p>
          <div className="flex flex-wrap gap-2.5">
            {run.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5" data-testid={`participant-${p.id}`}>
                <Avatar user={p} size={28} />
                <span className="text-xs text-muted-foreground">
                  {p.id === CURRENT_USER_ID ? <span className="text-primary font-medium">You</span> : `@${p.handle}`}
                </span>
              </div>
            ))}
            {run.participants.length === 0 && (
              <p className="text-xs text-muted-foreground">No participants yet. Be the first to join!</p>
            )}
          </div>
        </div>

        {/* Ratings */}
        {run.ratings.length > 0 && (
          <div className="bg-card border border-border rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Host Ratings</p>
              {avgRating && (
                <span className="flex items-center gap-0.5 text-amber-400 text-xs font-semibold">
                  <Star size={11} fill="currentColor" /> {avgRating}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {run.ratings.map((r) => (
                <div key={r.id} className="flex gap-2.5" data-testid={`rating-${r.id}`}>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={11} className={s <= r.stars ? "text-amber-400 fill-amber-400" : "text-muted-foreground"} />
                    ))}
                  </div>
                  {r.review && <p className="text-xs text-muted-foreground leading-relaxed">{r.review}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Group Chat */}
        <div className="bg-card border border-border rounded-xl mb-4">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Group Chat</p>
          </div>
          <div className="p-4 space-y-3 max-h-72 overflow-y-auto" data-testid="chat-thread">
            {run.messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No messages yet. Start the conversation!</p>
            )}
            {run.messages.map((msg) => {
              const isMe = msg.userId === CURRENT_USER_ID;
              return (
                <div key={msg.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`} data-testid={`msg-${msg.id}`}>
                  {msg.user && <Avatar user={msg.user} size={26} />}
                  <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                    {!isMe && <p className="text-xs text-muted-foreground">{msg.user?.name}</p>}
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-background border border-border text-foreground rounded-tl-sm"
                    }`}>
                      {msg.message}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{formatTimestamp(msg.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Chat input */}
          {(isJoined || isHost) ? (
            <div className="px-3 py-2 border-t border-border flex gap-2">
              <input
                type="text"
                placeholder="Message the group…"
                value={chatMsg}
                onChange={(e) => setChatMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMsg()}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                data-testid="input-chat"
              />
              <button
                onClick={handleSendMsg}
                disabled={!chatMsg.trim() || msgMutation.isPending}
                className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-all flex-shrink-0"
                data-testid="button-send-msg"
              >
                <Send size={14} />
              </button>
            </div>
          ) : (
            <div className="px-4 py-2.5 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">Join this run to chat with the group</p>
            </div>
          )}
        </div>

        {/* Rate button for completed runs */}
        {isCompleted && isJoined && !isHost && !alreadyRated && (
          <button
            onClick={() => setShowRating(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-amber-500/50 text-amber-400 bg-amber-900/20 hover:bg-amber-900/30 text-sm font-semibold transition-all mb-3"
            data-testid="button-rate-run"
          >
            <Star size={15} />
            Rate this Run
          </button>
        )}
      </main>

      {/* Sticky RSVP bar */}
      {!isCompleted && !isHost && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3 z-40">
          <div className="mx-auto max-w-lg flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{run.meetingPoint.split(",")[0]}</p>
              <p className="text-sm font-semibold text-foreground truncate">{run.title}</p>
            </div>
            {isJoined ? (
              <button
                onClick={() => leaveMutation.mutate()}
                disabled={leaveMutation.isPending}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-destructive/50 text-destructive text-sm font-semibold hover:bg-destructive/10 disabled:opacity-60 transition-all"
                data-testid="button-leave-run"
              >
                <XCircle size={14} />
                Leave Run
              </button>
            ) : isFull ? (
              <span className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-medium cursor-not-allowed">
                Run Full
              </span>
            ) : (
              <button
                onClick={() => setShowRSVP(true)}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all glow-primary"
                data-testid="button-join-run"
              >
                <CheckCircle size={14} />
                Join Run
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showRSVP && (
        <RSVPModal
          run={run}
          onClose={() => setShowRSVP(false)}
          onConfirm={() => joinMutation.mutate()}
          isPending={joinMutation.isPending}
        />
      )}
      {showRating && (
        <RatingModal run={run} onClose={() => setShowRating(false)} />
      )}
    </div>
  );
}
