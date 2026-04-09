import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeft, MapPin, Calendar, Clock, Route, Mountain, CircleDot, Smile, Heart, Users, Ruler, Gauge, Globe, Lock, Crown, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";



type RunType = "road" | "trail" | "track" | "fun_run" | "recovery";

const RUN_TYPES: { value: RunType; label: string; icon: React.ElementType; description: string }[] = [
  { value: "road",     label: "Road",     icon: Route,     description: "Pavements & streets" },
  { value: "trail",    label: "Trail",    icon: Mountain,  description: "Hiking & mountain paths" },
  { value: "track",    label: "Track",    icon: CircleDot, description: "Stadium or loop track" },
  { value: "fun_run",  label: "Fun Run",  icon: Smile,     description: "Social & casual" },
  { value: "recovery", label: "Recovery", icon: Heart,     description: "Easy active recovery" },
];

const TYPE_BADGE: Record<RunType, string> = {
  road: "badge-road", trail: "badge-trail", track: "badge-track",
  fun_run: "badge-fun_run", recovery: "badge-recovery",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{children}</p>;
}

export default function CreateRunPage() {
  const { user: currentUser } = useAuth();
  const CURRENT_USER_ID = currentUser?.id ?? 1;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Subscription status
  const { data: subStatus } = useQuery<{ isPremium: boolean; role: string }>({
    queryKey: ["/api/subscription/status"],
  });
  const isPremium = subStatus?.isPremium || subStatus?.role === "admin";

  const [form, setForm] = useState({
    title: "",
    runType: "road" as RunType,
    date: "",
    startTime: "",
    meetingPoint: "",
    distanceKm: "",
    paceMin: "",
    paceMax: "",
    maxParticipants: "",
    description: "",
    visibility: "public" as "public" | "friends",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim() || form.title.length < 3) errs.title = "Title must be at least 3 characters";
    if (!form.date) errs.date = "Date is required";
    if (!form.startTime) errs.startTime = "Start time is required";
    if (!form.meetingPoint.trim() || form.meetingPoint.length < 3) errs.meetingPoint = "Meeting point is required";
    if (!form.distanceKm || isNaN(Number(form.distanceKm)) || Number(form.distanceKm) <= 0) errs.distanceKm = "Enter a valid distance";
    return errs;
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const payload: any = {
        hostId: CURRENT_USER_ID,
        title: form.title.trim(),
        runType: form.runType,
        date: form.date,
        startTime: form.startTime,
        meetingPoint: form.meetingPoint.trim(),
        distanceKm: Number(form.distanceKm),
        visibility: form.visibility,
      };
      if (form.paceMin) payload.paceMin = form.paceMin;
      if (form.paceMax) payload.paceMax = form.paceMax;
      if (form.maxParticipants) payload.maxParticipants = parseInt(form.maxParticipants);
      if (form.description) payload.description = form.description.trim();

      const res = await apiRequest("POST", "/api/community/runs", payload);
      const data = await res.json();
      if (data.error === "FREE_LIMIT_REACHED") throw new Error("FREE_LIMIT_REACHED");
      return data;
    },
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/runs"] });
      toast({ title: "Run created!", description: "Your run is now live in the community feed." });
      navigate(`/community/run/${run.id}`);
    },
    onError: (e: any) => {
      if (e?.message === "FREE_LIMIT_REACHED" || String(e).includes("FREE_LIMIT_REACHED")) {
        toast({
          title: "Monthly limit reached",
          description: "Free accounts can host up to 2 runs per month. Upgrade to Premium for unlimited hosting.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: "Could not create run. Please try again.", variant: "destructive" });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    mutate();
  };

  const selectedType = RUN_TYPES.find((t) => t.value === form.runType)!;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Back nav */}
        <button
          onClick={() => navigate("/community")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
          data-testid="button-back"
        >
          <ChevronLeft size={15} />
          Community Runs
        </button>

        <h1 className="text-xl font-display font-bold text-foreground mb-1">Host a Run</h1>
        <p className="text-sm text-muted-foreground mb-4">Organise a group run and invite the community</p>

        {/* Free user limit banner */}
        {!isPremium && (
          <div className="mb-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-start gap-3">
            <Crown className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Free plan: 2 hosted runs per month</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Upgrade to Premium for unlimited hosting — HK$30/month</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/subscription")}
              className="shrink-0 text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              <Zap className="w-3 h-3" /> Upgrade
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Run Type */}
          <div>
            <SectionLabel>Run Type</SectionLabel>
            <div className="grid grid-cols-5 gap-1.5">
              {RUN_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set("runType", t.value)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      form.runType === t.value
                        ? `${TYPE_BADGE[t.value]} border-current`
                        : "border-border text-muted-foreground hover:border-muted-foreground bg-card"
                    }`}
                    data-testid={`type-${t.value}`}
                  >
                    <Icon size={16} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <SectionLabel>Run Title</SectionLabel>
            <input
              type="text"
              placeholder={`e.g. ${selectedType.description} Group Run`}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className={`w-full bg-card border rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${errors.title ? "border-destructive" : "border-border"}`}
              data-testid="input-title"
            />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <SectionLabel>Date</SectionLabel>
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className={`w-full bg-card border rounded-lg pl-8 pr-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${errors.date ? "border-destructive" : "border-border"}`}
                  data-testid="input-date"
                />
              </div>
              {errors.date && <p className="text-xs text-destructive mt-1">{errors.date}</p>}
            </div>
            <div>
              <SectionLabel>Start Time</SectionLabel>
              <div className="relative">
                <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => set("startTime", e.target.value)}
                  className={`w-full bg-card border rounded-lg pl-8 pr-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${errors.startTime ? "border-destructive" : "border-border"}`}
                  data-testid="input-time"
                />
              </div>
              {errors.startTime && <p className="text-xs text-destructive mt-1">{errors.startTime}</p>}
            </div>
          </div>

          {/* Meeting Point */}
          <div>
            <SectionLabel>Meeting Point</SectionLabel>
            <div className="relative">
              <MapPin size={13} className="absolute left-3 top-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="e.g. Victoria Park Main Entrance, Causeway Bay"
                value={form.meetingPoint}
                onChange={(e) => set("meetingPoint", e.target.value)}
                className={`w-full bg-card border rounded-lg pl-8 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${errors.meetingPoint ? "border-destructive" : "border-border"}`}
                data-testid="input-meeting-point"
              />
            </div>
            {errors.meetingPoint && <p className="text-xs text-destructive mt-1">{errors.meetingPoint}</p>}
            <p className="text-xs text-muted-foreground mt-1">Be specific — include landmark, district, nearest MTR</p>
          </div>

          {/* Distance + Pace */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <SectionLabel>Distance (km)</SectionLabel>
              <div className="relative">
                <Ruler size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="200"
                  placeholder="10"
                  value={form.distanceKm}
                  onChange={(e) => set("distanceKm", e.target.value)}
                  className={`w-full bg-card border rounded-lg pl-8 pr-2 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors ${errors.distanceKm ? "border-destructive" : "border-border"}`}
                  data-testid="input-distance"
                />
              </div>
              {errors.distanceKm && <p className="text-xs text-destructive mt-1">{errors.distanceKm}</p>}
            </div>
            <div>
              <SectionLabel>Min Pace</SectionLabel>
              <div className="relative">
                <Gauge size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="5:00"
                  value={form.paceMin}
                  onChange={(e) => set("paceMin", e.target.value)}
                  className="w-full bg-card border border-border rounded-lg pl-7 pr-2 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  data-testid="input-pace-min"
                />
              </div>
            </div>
            <div>
              <SectionLabel>Max Pace</SectionLabel>
              <div className="relative">
                <Gauge size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="6:30"
                  value={form.paceMax}
                  onChange={(e) => set("paceMax", e.target.value)}
                  className="w-full bg-card border border-border rounded-lg pl-7 pr-2 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  data-testid="input-pace-max"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-4">Pace in min:sec per km (e.g. 5:30). Leave blank if open to all paces.</p>

          {/* Max participants */}
          <div>
            <SectionLabel>Max Participants (optional)</SectionLabel>
            <div className="relative">
              <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="number"
                min="2"
                max="200"
                placeholder="No limit"
                value={form.maxParticipants}
                onChange={(e) => set("maxParticipants", e.target.value)}
                className="w-full bg-card border border-border rounded-lg pl-8 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                data-testid="input-max-participants"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <SectionLabel>Notes & Description</SectionLabel>
            <textarea
              rows={4}
              placeholder="What should runners know? Terrain, difficulty, what to bring, post-run plans…"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
              data-testid="input-description"
            />
          </div>

          {/* Visibility */}
          <div>
            <SectionLabel>Visibility</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {(["public", "friends"] as const).map((v) => {
                const Icon = v === "public" ? Globe : Lock;
                const label = v === "public" ? "Public" : "Friends only";
                const desc = v === "public" ? "Anyone can join" : "Only your connections";
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set("visibility", v)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      form.visibility === v
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                    }`}
                    data-testid={`visibility-${v}`}
                  >
                    <Icon size={16} />
                    <div>
                      <p className="text-sm font-medium leading-none">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all text-sm"
            data-testid="button-submit-run"
          >
            {isPending ? "Creating…" : "Create Run"}
          </button>
        </form>
      </main>
    </div>
  );
}
