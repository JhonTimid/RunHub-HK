import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Check, Zap, MessageSquare, CalendarPlus, Star, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SubStatus {
  isPremium: boolean;
  premiumUntil: string | null;
  role: string;
}

export default function SubscriptionPage() {
  const [location] = useLocation();
  const { toast } = useToast();

  const { data: status, isLoading, refetch } = useQuery<SubStatus>({
    queryKey: ["/api/subscription/status"],
  });

  // Handle Stripe redirect back
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    if (params.get("success") === "1") {
      refetch();
      toast({ title: "🎉 Welcome to Premium!", description: "Your subscription is now active." });
    } else if (params.get("cancelled") === "1") {
      toast({ title: "Checkout cancelled", description: "You can upgrade any time.", variant: "destructive" });
    }
  }, []);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/checkout");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error ?? "Failed to create checkout session");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/portal");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error ?? "Failed to open portal");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPremium = status?.isPremium || status?.role === "admin";
  const isAdmin = status?.role === "admin";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full">
            <Crown className="w-10 h-10 text-amber-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">RunHub Premium</h1>
        <p className="text-muted-foreground">Unlock unlimited hosting and community features</p>
      </div>

      {/* Current status banner */}
      {isPremium && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
          <Crown className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-300">
              {isAdmin ? "Admin Account — All features unlocked" : "You're on Premium"}
            </p>
            {status?.premiumUntil && !isAdmin && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Active until {new Date(status.premiumUntil).toLocaleDateString("en-HK", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Free plan */}
        <Card className="border-2 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Free</CardTitle>
              <Badge variant="secondary">Current</Badge>
            </div>
            <p className="text-3xl font-bold">HK$0<span className="text-base font-normal text-muted-foreground">/mo</span></p>
          </CardHeader>
          <CardContent className="space-y-3">
            <FeatureLine ok text="Browse all race listings" />
            <FeatureLine ok text="RSVP to community runs" />
            <FeatureLine ok text="View run details & chat" />
            <FeatureLine ok={false} text="Host up to 2 runs / month" dim />
            <FeatureLine ok={false} text="Chat room posting" />
            <FeatureLine ok={false} text="Unlimited hosting" />
          </CardContent>
        </Card>

        {/* Premium plan */}
        <Card className={`border-2 ${isPremium ? "border-amber-400 dark:border-amber-600" : "border-primary"} relative overflow-hidden`}>
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">BEST VALUE</div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-lg">Premium</CardTitle>
            </div>
            <p className="text-3xl font-bold">HK$30<span className="text-base font-normal text-muted-foreground">/mo</span></p>
          </CardHeader>
          <CardContent className="space-y-3">
            <FeatureLine ok text="Everything in Free" />
            <FeatureLine ok text="Unlimited run hosting" />
            <FeatureLine ok text="Full chat room access" />
            <FeatureLine ok text="Priority listing in feed" />
            <FeatureLine ok text="Premium badge on profile" />
            <FeatureLine ok text="Cancel anytime" />

            {!isPremium ? (
              <Button
                className="w-full mt-2"
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                data-testid="button-upgrade"
              >
                {checkoutMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting…</>
                ) : (
                  <><Zap className="w-4 h-4 mr-2" /> Upgrade to Premium</>
                )}
              </Button>
            ) : (
              !isAdmin && (
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  data-testid="button-manage"
                >
                  {portalMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…</>
                  ) : "Manage Subscription"}
                </Button>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <HighlightCard icon={<CalendarPlus className="w-6 h-6 text-primary" />} title="Unlimited Hosting" desc="Host as many community runs as you want, every month." />
        <HighlightCard icon={<MessageSquare className="w-6 h-6 text-primary" />} title="Group Chat" desc="Join the conversation before and after every run." />
        <HighlightCard icon={<Star className="w-6 h-6 text-amber-500" />} title="Premium Badge" desc="Stand out as a verified premium host in the community." />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Secured by Stripe · Cancel anytime · No hidden fees
      </p>
    </div>
  );
}

function FeatureLine({ ok, text, dim }: { ok: boolean; text: string; dim?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${dim ? "text-muted-foreground" : ""}`}>
      {ok ? (
        <Check className="w-4 h-4 text-primary shrink-0" />
      ) : (
        <span className="w-4 h-4 rounded-full border border-border shrink-0 inline-block" />
      )}
      <span className={ok ? "" : "text-muted-foreground"}>{text}</span>
    </div>
  );
}

function HighlightCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-4 space-y-2">
      {icon}
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
