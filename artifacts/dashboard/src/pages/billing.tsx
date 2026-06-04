import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, Zap, BarChart3, Users, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import {
  apiGetSubscription, apiListPlans, apiGetUsage, apiChangePlan, apiCancelSubscription,
  apiCreatePortalSession, apiGetRevenue,
  type BillingPlan,
} from "@/lib/billing-client";
import { useAuth } from "@/contexts/auth-context";

function usd(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function pct(bps: number) { return `${(bps / 100).toFixed(1)}%`; }

const RESOURCE_LABELS: Record<string, string> = {
  api_requests: "API Requests",
  ai_tokens: "AI Tokens",
  backtest_runs: "Backtests",
  research_jobs: "Research Jobs",
  stream_subscriptions: "Stream Connections",
};

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null || limit === 0) return <span className="text-xs text-muted-foreground">Unlimited</span>;
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{used.toLocaleString()} / {limit.toLocaleString()}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PlanCard({ plan, isCurrentPlan, onSelect }: { plan: BillingPlan; isCurrentPlan: boolean; onSelect: () => void }) {
  const isFree = plan.slug === "free";
  const isEnterprise = plan.slug === "enterprise";
  return (
    <div className={`rounded-lg border p-5 flex flex-col gap-4 ${isCurrentPlan ? "border-blue-500 bg-blue-500/5" : "border-border"}`}>
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{plan.name}</h3>
          {isCurrentPlan && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Current</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
        <div className="mt-3">
          {isEnterprise ? (
            <span className="text-lg font-bold">Custom pricing</span>
          ) : (
            <span className="text-lg font-bold">{isFree ? "Free" : `${usd(plan.priceMonthlyUsd)}/mo`}</span>
          )}
        </div>
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground flex-1">
        <li className="flex gap-2"><CheckCircle size={12} className="text-emerald-500 mt-0.5 shrink-0" />{plan.apiRequestsPerDay ? `${plan.apiRequestsPerDay.toLocaleString()} API req/day` : "Unlimited API requests"}</li>
        <li className="flex gap-2"><CheckCircle size={12} className="text-emerald-500 mt-0.5 shrink-0" />{plan.backtestsPerMonth ? `${plan.backtestsPerMonth} backtests/mo` : "Unlimited backtests"}</li>
        <li className="flex gap-2">{plan.aiTokensPerMonth > 0 ? <CheckCircle size={12} className="text-emerald-500 mt-0.5 shrink-0" /> : <XCircle size={12} className="text-muted-foreground mt-0.5 shrink-0" />}{plan.aiTokensPerMonth > 0 ? `${plan.aiTokensPerMonth.toLocaleString()} AI tokens/mo` : "No AI access"}</li>
        <li className="flex gap-2"><CheckCircle size={12} className="text-emerald-500 mt-0.5 shrink-0" />{plan.maxOrgMembers > 1 ? `${plan.maxOrgMembers === 0 ? "Unlimited" : plan.maxOrgMembers} org members` : "1 member"}</li>
      </ul>
      {!isCurrentPlan && !isEnterprise && (
        <button onClick={onSelect} className="mt-auto w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors">
          {isCurrentPlan ? "Current Plan" : plan.slug === "free" ? "Downgrade to Free" : "Upgrade"}
        </button>
      )}
      {isEnterprise && (
        <a href="mailto:sales@quantforge.dev" className="mt-auto block text-center w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
          Contact Sales
        </a>
      )}
    </div>
  );
}

export default function BillingPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const isAdmin = hasPermission("users:write");
  const isOpsAdmin = hasPermission("operations:admin");

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: apiGetSubscription,
  });

  const { data: plansData } = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: apiListPlans,
  });

  const { data: usageData } = useQuery({
    queryKey: ["billing", "usage"],
    queryFn: apiGetUsage,
  });

  const { data: revenueData } = useQuery({
    queryKey: ["billing", "revenue"],
    queryFn: apiGetRevenue,
    enabled: isOpsAdmin,
  });

  const changePlanMut = useMutation({
    mutationFn: (slug: string) => apiChangePlan(slug),
    onSuccess: () => {
      toast.success("Plan updated successfully.");
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: () => toast.error("Failed to change plan."),
  });

  const cancelMut = useMutation({
    mutationFn: () => apiCancelSubscription(false),
    onSuccess: () => {
      toast.success("Subscription cancelled at period end.");
      setShowCancelConfirm(false);
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: () => toast.error("Failed to cancel subscription."),
  });

  const portalMut = useMutation({
    mutationFn: apiCreatePortalSession,
    onSuccess: (data) => { window.location.href = data.url; },
    onError: () => toast.error("Stripe portal unavailable — Stripe is not configured."),
  });

  const currentPlanSlug = subData?.subscription?.planSlug ?? "free";
  const sub = subData?.subscription;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your plan, usage, and billing details.</p>
      </div>

      {/* Current subscription status */}
      {!subLoading && sub && (
        <div className="rounded-lg border border-border p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CreditCard size={18} className="text-blue-400" />
            <div>
              <p className="text-sm font-medium">
                {plansData?.plans.find(p => p.slug === currentPlanSlug)?.name ?? currentPlanSlug} Plan
              </p>
              <p className="text-xs text-muted-foreground">
                Status: <span className="capitalize">{sub.status}</span>
                {sub.cancelAtPeriodEnd && sub.currentPeriodEnd && (
                  <span className="ml-2 text-yellow-400">
                    <AlertTriangle size={11} className="inline mr-1" />
                    Cancels {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </span>
                )}
                {sub.currentPeriodEnd && !sub.cancelAtPeriodEnd && (
                  <span className="ml-2">· Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => portalMut.mutate(undefined)}
                  disabled={portalMut.isPending}
                  className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
                >
                  Manage in Stripe
                </button>
                {currentPlanSlug !== "free" && !sub.cancelAtPeriodEnd && (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="text-xs px-3 py-1.5 rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Cancel Plan
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Cancel confirm modal */}
      {showCancelConfirm && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 space-y-3">
          <p className="text-sm font-medium text-red-400">Cancel subscription?</p>
          <p className="text-xs text-muted-foreground">Your plan will be cancelled at the end of the current billing period. You can still use the platform until then.</p>
          <div className="flex gap-2">
            <button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending} className="text-xs px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700">
              {cancelMut.isPending ? "Cancelling…" : "Confirm Cancellation"}
            </button>
            <button onClick={() => setShowCancelConfirm(false)} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">
              Keep Plan
            </button>
          </div>
        </div>
      )}

      {/* Usage meters */}
      {usageData && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><BarChart3 size={15} /> Current Period Usage</h2>
          <p className="text-xs text-muted-foreground">Period start: {new Date(usageData.periodStart).toLocaleDateString()}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(usageData.usage).map(([key, val]) => (
              <div key={key} className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-medium">{RESOURCE_LABELS[key] ?? key}</p>
                <UsageBar used={val.used} limit={val.limit} />
                {val.periodType && <p className="text-xs text-muted-foreground">Per {val.periodType}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan cards */}
      {plansData && isAdmin && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Zap size={15} /> Available Plans</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {plansData.plans.map(plan => (
              <PlanCard
                key={plan.slug}
                plan={plan}
                isCurrentPlan={plan.slug === currentPlanSlug}
                onSelect={() => {
                  if (changePlanMut.isPending) return;
                  changePlanMut.mutate(plan.slug);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Revenue analytics (admin only) */}
      {isOpsAdmin && revenueData && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Users size={15} /> Revenue Analytics</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "MRR", value: usd(revenueData.metrics.mrrCents) },
              { label: "ARR", value: usd(revenueData.metrics.arrCents) },
              { label: "Active Subs", value: revenueData.metrics.activeSubscriptions.toString() },
              { label: "Conversion", value: pct(revenueData.metrics.conversionRateBps) },
              { label: "New MRR", value: usd(revenueData.metrics.newMrrCents) },
              { label: "Churn MRR", value: usd(revenueData.metrics.churnMrrCents) },
              { label: "Trials", value: revenueData.metrics.trialSubscriptions.toString() },
              { label: "Expansion MRR", value: usd(revenueData.metrics.expansionMrrCents) },
            ].map(item => (
              <div key={item.label} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
