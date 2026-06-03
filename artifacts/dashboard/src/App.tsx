import { Switch, Route, Redirect } from "wouter";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { Sidebar } from "@/components/sidebar";

// Existing pages
import OverviewPage from "@/pages/overview";
import OperationsPage from "@/pages/operations";
import ServiceHealthPage from "@/pages/service-health";
import AlertsPage from "@/pages/alerts";
import IncidentsPage from "@/pages/incidents";
import PortfolioPage from "@/pages/portfolio";
import StrategyRankingsPage from "@/pages/strategy-rankings";
import RiskPage from "@/pages/risk";
import ExecutionPage from "@/pages/execution";
import StreamingPage from "@/pages/streaming";
import AiInsightsPage from "@/pages/ai-insights";
import NotFoundPage from "@/pages/not-found";

// Phase 14 — Auth pages (no sidebar)
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import VerifyEmailPage from "@/pages/verify-email";
import AcceptInvitationPage from "@/pages/accept-invitation";

// Phase 14 — Authenticated pages
import ProfilePage from "@/pages/profile";
import SecurityDashboardPage from "@/pages/security-dashboard";
import UserManagementPage from "@/pages/user-management";
import OrgSettingsPage from "@/pages/org-settings";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center"><span className="text-muted-foreground text-sm">Loading…</span></div>;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function AuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center"><span className="text-muted-foreground text-sm">Loading…</span></div>;
  if (isAuthenticated) return <Redirect to="/" />;
  return <Component />;
}

// Auth-only pages (no sidebar layout)
const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/accept-invitation"];

function AppShell() {
  const [path] = [window.location.pathname];
  const isAuthPage = AUTH_PATHS.some(p => path.startsWith(p));

  return (
    <Switch>
      {/* Auth pages — no sidebar */}
      <Route path="/login" component={() => <AuthRoute component={LoginPage} />} />
      <Route path="/register" component={() => <AuthRoute component={RegisterPage} />} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/accept-invitation" component={AcceptInvitationPage} />

      {/* Main app — with sidebar */}
      <Route>
        {() => (
          <div className="flex h-screen overflow-hidden bg-background text-foreground">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              <Switch>
                <Route path="/" component={() => <ProtectedRoute component={OverviewPage} />} />
                <Route path="/operations" component={() => <ProtectedRoute component={OperationsPage} />} />
                <Route path="/service-health" component={() => <ProtectedRoute component={ServiceHealthPage} />} />
                <Route path="/alerts" component={() => <ProtectedRoute component={AlertsPage} />} />
                <Route path="/incidents" component={() => <ProtectedRoute component={IncidentsPage} />} />
                <Route path="/portfolio" component={() => <ProtectedRoute component={PortfolioPage} />} />
                <Route path="/strategy-rankings" component={() => <ProtectedRoute component={StrategyRankingsPage} />} />
                <Route path="/risk" component={() => <ProtectedRoute component={RiskPage} />} />
                <Route path="/execution" component={() => <ProtectedRoute component={ExecutionPage} />} />
                <Route path="/streaming" component={() => <ProtectedRoute component={StreamingPage} />} />
                <Route path="/ai-insights" component={() => <ProtectedRoute component={AiInsightsPage} />} />
                <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
                <Route path="/security" component={() => <ProtectedRoute component={SecurityDashboardPage} />} />
                <Route path="/users" component={() => <ProtectedRoute component={UserManagementPage} />} />
                <Route path="/org-settings" component={() => <ProtectedRoute component={OrgSettingsPage} />} />
                <Route component={NotFoundPage} />
              </Switch>
            </main>
          </div>
        )}
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="quantforge-theme">
      <AuthProvider>
        <AppShell />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}
