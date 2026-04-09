import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, CheckCircle2, ArrowLeft, Zap, Mail } from "lucide-react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Header from "@/components/Header";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  filterType: z.enum(["all", "road", "trail", "mixed"]),
  distancePreset: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

const DISTANCE_PRESETS = [
  { label: "Any distance", value: "any", min: null, max: null },
  { label: "5–10km", value: "5-10", min: 5, max: 10 },
  { label: "Half marathon (21km)", value: "21", min: 21, max: 22 },
  { label: "Marathon (42km)", value: "42", min: 40, max: 43 },
  { label: "Ultra (50km+)", value: "50+", min: 50, max: null },
  { label: "100km+", value: "100+", min: 100, max: null },
];

export default function AlertsPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      filterType: "all",
      distancePreset: "any",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const preset = DISTANCE_PRESETS.find((p) => p.value === values.distancePreset);
      const res = await apiRequest("POST", "/api/alerts", {
        email: values.email,
        filterType: values.filterType === "all" ? undefined : values.filterType,
        filterMinDistanceKm: preset?.min ?? undefined,
        filterMaxDistanceKm: preset?.max ?? undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Could not register your alert. Try again.",
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: FormValues) {
    mutation.mutate(values);
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-2xl px-4 py-8 md:py-14">
        <Link href="/">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft size={14} />
            Back to races
          </a>
        </Link>

        {submitted ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-5">
              <CheckCircle2 size={32} className="text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">You're all set!</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              You'll receive an email whenever new races matching your preferences are added.
              No spam — only real race alerts.
            </p>
            <Link href="/">
              <a>
                <Button variant="outline" data-testid="button-back-to-races">Browse races</Button>
              </a>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                <Zap size={12} />
                Race Alerts
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-2">
                Never miss a race
              </h1>
              <p className="text-muted-foreground text-sm max-w-md">
                Get notified by email when new Hong Kong races are added to the calendar.
                Filter by type and distance so you only hear about races that matter to you.
              </p>
            </div>

            {/* How it works */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                { icon: <Mail size={18} />, title: "Enter email", desc: "Your address stays private" },
                { icon: <Bell size={18} />, title: "Set filters", desc: "Trail, road, distance range" },
                { icon: <Zap size={18} />, title: "Get alerts", desc: "Daily digest of new races" },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center bg-card border border-border rounded-xl p-4">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary mb-2">
                    {step.icon}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            className="bg-muted border-border"
                            data-testid="input-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="filterType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Race type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="bg-muted border-border" data-testid="select-alert-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">All types</SelectItem>
                              <SelectItem value="road">Road</SelectItem>
                              <SelectItem value="trail">Trail</SelectItem>
                              <SelectItem value="mixed">Mixed</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="distancePreset"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Distance</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="bg-muted border-border" data-testid="select-alert-distance">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DISTANCE_PRESETS.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={mutation.isPending}
                    data-testid="button-submit-alert"
                  >
                    <Bell size={15} />
                    {mutation.isPending ? "Registering…" : "Subscribe to alerts"}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    We'll never share your email. Unsubscribe any time.
                  </p>
                </form>
              </Form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
