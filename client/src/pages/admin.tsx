import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Crown, Users, Trophy, Activity, ShieldCheck, Search,
  ToggleLeft, ToggleRight, Loader2, TrendingUp, MapPin
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface AdminStats {
  totalUsers: number;
  premiumUsers: number;
  freeUsers: number;
  adminUsers: number;
  totalRaces: number;
  upcomingRaces: number;
  totalCommunityRuns: number;
  activeRuns: number;
  monthlyRevenue: number;
}

interface AdminUser {
  id: number;
  name: string;
  handle: string;
  email: string | null;
  role: string;
  isPremium: boolean;
  premiumUntil: string | null;
  authProvider: string;
  createdAt: string;
  totalRuns: number;
  stripeCustomerId: string | null;
}

export default function AdminPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  // Auth check — redirect if not admin
  const { data: me } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: me?.role === "admin",
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: AdminUser[]; total: number }>({
    queryKey: ["/api/admin/users"],
    enabled: me?.role === "admin",
  });

  const premiumMutation = useMutation({
    mutationFn: async ({ id, isPremium }: { id: number; isPremium: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/premium`, { isPremium });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Updated", description: "User subscription updated." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Updated", description: "User role updated." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Not logged in or not admin
  if (me && me.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <ShieldCheck className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg font-semibold">Admin access required</p>
        <Button variant="outline" onClick={() => navigate("/races")}>Go back</Button>
      </div>
    );
  }

  const filteredUsers = (usersData?.users ?? []).filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    u.handle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-xl">
          <ShieldCheck className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">RunHub HK · Super Administrator</p>
        </div>
        <Badge variant="destructive" className="ml-auto">ADMIN</Badge>
      </div>

      {/* Stats grid */}
      {statsLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={<Users className="w-5 h-5 text-blue-500" />} label="Total Users" value={stats.totalUsers} />
          <StatCard icon={<Crown className="w-5 h-5 text-amber-500" />} label="Premium Users" value={stats.premiumUsers} sub={`HK$${stats.monthlyRevenue}/mo revenue`} />
          <StatCard icon={<Trophy className="w-5 h-5 text-primary" />} label="Total Races" value={stats.totalRaces} sub={`${stats.upcomingRaces} upcoming`} />
          <StatCard icon={<Activity className="w-5 h-5 text-green-500" />} label="Community Runs" value={stats.totalCommunityRuns} sub={`${stats.activeRuns} active`} />
        </div>
      ) : null}

      {/* Tabs */}
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="w-4 h-4 mr-1.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="revenue" data-testid="tab-revenue">
            <TrendingUp className="w-4 h-4 mr-1.5" /> Revenue
          </TabsTrigger>
        </TabsList>

        {/* ── Users tab ─────────────────────────────────────────────────── */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or handle…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-user-search"
            />
          </div>

          {usersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">User</th>
                    <th className="text-left p-3 font-medium hidden sm:table-cell">Email</th>
                    <th className="text-left p-3 font-medium">Plan</th>
                    <th className="text-left p-3 font-medium">Role</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <UserRow
                      key={user.id}
                      user={user}
                      me={me}
                      onTogglePremium={(id, current) => premiumMutation.mutate({ id, isPremium: !current })}
                      onToggleRole={(id, current) => roleMutation.mutate({ id, role: current === "admin" ? "user" : "admin" })}
                      isPending={premiumMutation.isPending || roleMutation.isPending}
                    />
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Revenue tab ────────────────────────────────────────────────── */}
        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Monthly Revenue Estimate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats && (
                <>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold">HK${stats.monthlyRevenue}</span>
                    <span className="text-muted-foreground mb-1">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Based on {stats.premiumUsers} premium subscriber{stats.premiumUsers !== 1 ? "s" : ""} × HK$30/month
                  </p>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <RevenueCard label="Premium Users" value={String(stats.premiumUsers)} color="amber" />
                    <RevenueCard label="Free Users" value={String(stats.freeUsers)} color="slate" />
                    <RevenueCard label="Admins" value={String(stats.adminUsers)} color="red" />
                  </div>
                  <p className="text-xs text-muted-foreground pt-2">
                    * Actual revenue may differ from Stripe due to payment timing and refunds. Check{" "}
                    <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="underline">
                      Stripe Dashboard
                    </a>{" "}
                    for authoritative figures.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4 space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {icon} {label}
        </div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function RevenueCard({ label, value, color }: { label: string; value: string; color: string }) {
  const bg = color === "amber" ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
    : color === "red" ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
    : "bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700";
  return (
    <div className={`${bg} border rounded-lg p-3 text-center`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function UserRow({
  user, me, onTogglePremium, onToggleRole, isPending
}: {
  user: AdminUser;
  me: any;
  onTogglePremium: (id: number, current: boolean) => void;
  onToggleRole: (id: number, current: string) => void;
  isPending: boolean;
}) {
  const isSelf = me?.id === user.id;

  return (
    <tr className="border-t hover:bg-muted/30 transition-colors" data-testid={`row-user-${user.id}`}>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: "#6366f1" }}
          >
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{user.name} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}</p>
            <p className="text-xs text-muted-foreground">@{user.handle}</p>
          </div>
        </div>
      </td>
      <td className="p-3 hidden sm:table-cell text-muted-foreground">{user.email ?? "—"}</td>
      <td className="p-3">
        {user.isPremium ? (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-0">
            <Crown className="w-3 h-3 mr-1" /> Premium
          </Badge>
        ) : (
          <Badge variant="secondary">Free</Badge>
        )}
      </td>
      <td className="p-3">
        {user.role === "admin" ? (
          <Badge variant="destructive">Admin</Badge>
        ) : (
          <Badge variant="outline">User</Badge>
        )}
      </td>
      <td className="p-3">
        <div className="flex items-center justify-end gap-2">
          {/* Toggle premium */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={isPending || isSelf}
            onClick={() => onTogglePremium(user.id, user.isPremium)}
            data-testid={`button-toggle-premium-${user.id}`}
            title={user.isPremium ? "Revoke premium" : "Grant premium"}
          >
            {user.isPremium ? (
              <><ToggleRight className="w-4 h-4 text-amber-500 mr-1" /> Revoke</>
            ) : (
              <><ToggleLeft className="w-4 h-4 mr-1" /> Grant</>
            )}
          </Button>
          {/* Toggle admin */}
          {!isSelf && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={isPending}
              onClick={() => onToggleRole(user.id, user.role)}
              data-testid={`button-toggle-role-${user.id}`}
              title={user.role === "admin" ? "Demote to user" : "Promote to admin"}
            >
              <ShieldCheck className={`w-4 h-4 mr-1 ${user.role === "admin" ? "text-red-500" : "text-muted-foreground"}`} />
              {user.role === "admin" ? "Demote" : "Promote"}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
