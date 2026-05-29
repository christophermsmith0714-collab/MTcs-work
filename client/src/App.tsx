import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "./lib/auth";
import { Toaster } from "@/components/ui/toaster";
import TopNav from "./components/TopNav";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Jobs from "./pages/Jobs";
import Team from "./pages/Team";
import Login from "./pages/Login";
import NotFound from "./pages/not-found";

function AppShell() {
  const { user } = useAuth();

  if (!user) return <Login />;

  return (
    <Router hook={useHashLocation}>
      <div className="flex flex-col min-h-screen bg-background">
        <TopNav />
        <main className="flex-1 overflow-y-auto">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/clients" component={Clients} />
            <Route path="/jobs" component={Jobs} />
            {user.role === "admin" && <Route path="/team" component={Team} />}
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
