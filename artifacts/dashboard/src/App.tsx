import { Switch, Route } from "wouter";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";
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

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="quantforge-theme">
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Switch>
            <Route path="/" component={OverviewPage} />
            <Route path="/operations" component={OperationsPage} />
            <Route path="/service-health" component={ServiceHealthPage} />
            <Route path="/alerts" component={AlertsPage} />
            <Route path="/incidents" component={IncidentsPage} />
            <Route path="/portfolio" component={PortfolioPage} />
            <Route path="/strategy-rankings" component={StrategyRankingsPage} />
            <Route path="/risk" component={RiskPage} />
            <Route path="/execution" component={ExecutionPage} />
            <Route path="/streaming" component={StreamingPage} />
            <Route path="/ai-insights" component={AiInsightsPage} />
            <Route component={NotFoundPage} />
          </Switch>
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
