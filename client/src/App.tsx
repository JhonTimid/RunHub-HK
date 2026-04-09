import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import HomePage from "@/pages/home";
import RaceDetailPage from "@/pages/race-detail";
import AlertsPage from "@/pages/alerts";
import CommunityFeedPage from "@/pages/community-feed";
import CreateRunPage from "@/pages/create-run";
import RunDetailPage from "@/pages/run-detail";
import HostDashboardPage from "@/pages/host-dashboard";
import NotFound from "@/pages/not-found";

// Redirect to login if not authenticated
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  return <Component />;
}

function AppRoutes() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/races" component={HomePage} />
        <Route path="/race/:id" component={RaceDetailPage} />
        <Route path="/alerts">
          {() => <ProtectedRoute component={AlertsPage} />}
        </Route>
        <Route path="/community">
          {() => <ProtectedRoute component={CommunityFeedPage} />}
        </Route>
        <Route path="/community/create">
          {() => <ProtectedRoute component={CreateRunPage} />}
        </Route>
        <Route path="/community/run/:id">
          {() => <ProtectedRoute component={RunDetailPage} />}
        </Route>
        <Route path="/community/dashboard">
          {() => <ProtectedRoute component={HostDashboardPage} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
