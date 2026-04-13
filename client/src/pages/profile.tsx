import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Link2, Activity, MapPin, Save, ExternalLink } from "lucide-react";

interface UserProfile {
  id: number;
  name: string;
  handle: string;
  nickname: string | null;
  email: string | null;
  bio: string | null;
  gender: string | null;
  profilePicUrl: string | null;
  googleAvatar: string | null;
  stravaUrl: string | null;
  runPreferenceType: string | null;
  runPreferencePace: string | null;
  runPreferenceDistance: string | null;
  location: string;
  totalRuns: number;
  avgRating: number | null;
  avatarInitials: string;
  avatarColor: string;
  isPremium: boolean;
}

export default function ProfilePage() {
  const { user: authUser } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
    queryFn: () => apiRequest("GET", "/api/user/profile").then(r => r.json()),
    enabled: !!authUser,
  });

  const [form, setForm] = useState<Partial<UserProfile> | null>(null);
  const current = form ?? profile ?? {};

  function field<K extends keyof UserProfile>(key: K) {
    return {
      value: (current[key] as string) ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...(prev ?? profile ?? {}), [key]: e.target.value })),
    };
  }

  const mutation = useMutation({
    mutationFn: (data: Partial<UserProfile>) =>
      apiRequest("PUT", "/api/user/profile", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/user/profile"] });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setForm(null);
      toast({ title: "Profile saved!", description: "Your changes have been updated." });
    },
    onError: (e: any) => {
      toast({ title: "Save failed", description: String(e), variant: "destructive" });
    },
  });

  function handleSave() {
    if (!form) return;
    mutation.mutate(form);
  }

  const avatarSrc = profile?.profilePicUrl ?? profile?.googleAvatar ?? null;

  if (!authUser) {
    navigate("/login");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Avatar + name header */}
        <div className="flex items-center gap-4 mb-8">
          {avatarSrc ? (
            <img src={avatarSrc} alt="avatar" className="w-16 h-16 rounded-full object-cover ring-2 ring-border" />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white ring-2 ring-border"
              style={{ backgroundColor: profile?.avatarColor ?? "#22c55e" }}
            >
              {profile?.avatarInitials ?? "?"}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {profile?.nickname ?? profile?.name ?? "Runner"}
            </h1>
            <p className="text-sm text-muted-foreground">@{profile?.handle}</p>
            {profile?.isPremium && (
              <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">Premium</span>
            )}
          </div>
        </div>

        <div className="space-y-6">

          {/* ── Basic Info ───────────────────────────────── */}
          <Section icon={<User size={15} />} title="Basic Info">
            <Field label="Display Name">
              <Input {...field("name")} placeholder="Your full name" />
            </Field>
            <Field label="Nickname (shown on community)">
              <Input {...field("nickname")} placeholder="e.g. SpeedyRyan" maxLength={30} />
            </Field>
            <Field label="Bio">
              <Textarea
                value={(current.bio as string) ?? ""}
                onChange={e => setForm(prev => ({ ...(prev ?? profile ?? {}), bio: e.target.value }))}
                placeholder="Tell the community about yourself…"
                className="resize-none h-20"
                maxLength={300}
              />
            </Field>
            <Field label="Gender">
              <Select
                value={(current.gender as string) ?? ""}
                onValueChange={v => setForm(prev => ({ ...(prev ?? profile ?? {}), gender: v }))}
              >
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Prefer not to say" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="non_binary">Non-binary</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Location">
              <Input {...field("location")} placeholder="e.g. Sai Kung, HK" />
            </Field>
          </Section>

          {/* ── Run Preferences ──────────────────────────── */}
          <Section icon={<Activity size={15} />} title="Run Preferences">
            <Field label="Preferred Run Type">
              <Select
                value={(current.runPreferenceType as string) ?? ""}
                onValueChange={v => setForm(prev => ({ ...(prev ?? profile ?? {}), runPreferenceType: v }))}
              >
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="road">Road</SelectItem>
                  <SelectItem value="trail">Trail</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Typical Pace (min/km)">
              <Input {...field("runPreferencePace")} placeholder="e.g. 5:00-6:30" maxLength={20} />
            </Field>
            <Field label="Typical Distance">
              <Input {...field("runPreferenceDistance")} placeholder="e.g. 10-21km" maxLength={20} />
            </Field>
          </Section>

          {/* ── Links ────────────────────────────────────── */}
          <Section icon={<Link2 size={15} />} title="Links">
            <Field label="Strava Profile URL">
              <div className="flex gap-2 items-center">
                <Input
                  {...field("stravaUrl")}
                  placeholder="https://www.strava.com/athletes/12345"
                  className="flex-1"
                />
                {profile?.stravaUrl && (
                  <a
                    href={profile.stravaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-500 hover:text-orange-400 shrink-0"
                    title="View on Strava"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Paste your Strava athlete page URL to display on your profile.
              </p>
            </Field>
            <Field label="Profile Picture URL">
              <Input
                {...field("profilePicUrl")}
                placeholder="https://… (direct image link)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Link to any public image. Google avatar is used by default.
              </p>
            </Field>
          </Section>

          {/* ── Save button ──────────────────────────────── */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={!form || mutation.isPending}
              className="gap-2"
            >
              <Save size={15} />
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}
