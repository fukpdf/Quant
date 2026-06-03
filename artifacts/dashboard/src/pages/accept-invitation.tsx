import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/auth-client";
import { useAuth } from "@/contexts/auth-context";

export default function AcceptInvitationPage() {
  const { isAuthenticated, refreshUser } = useAuth();
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [invitation, setInvitation] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "accepted" | "error">("loading");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) { setStatus("error"); return; }
    setToken(t);

    apiFetch<{ invitation: any }>(`/invitations/${t}`)
      .then(data => { setInvitation(data.invitation); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, []);

  async function handleAccept() {
    if (!isAuthenticated) { navigate(`/login?redirect=/accept-invitation?token=${token}`); return; }
    setAccepting(true);
    try {
      await apiFetch(`/invitations/${token}/accept`, { method: "POST" });
      await refreshUser();
      setStatus("accepted");
      toast.success("You've joined the organization!");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to accept invitation.");
    } finally { setAccepting(false); }
  }

  if (status === "loading") return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Loading invitation…</p>
    </div>
  );

  if (status === "error" || !invitation) return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center space-y-4">
        <div className="text-4xl">❌</div>
        <p className="font-medium text-foreground">Invitation not found</p>
        <p className="text-sm text-muted-foreground">This invitation may have expired or already been used.</p>
        <Link href="/" className="block text-sm text-primary hover:underline">Go to dashboard</Link>
      </div>
    </div>
  );

  if (status === "accepted") return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center space-y-4">
        <div className="text-4xl">🎉</div>
        <p className="font-medium text-foreground">You're in!</p>
        <p className="text-sm text-muted-foreground">You've joined the organization as <strong>{invitation.roleToAssign}</strong>.</p>
        <button onClick={() => navigate("/")} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Go to dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">You're invited!</h1>
          <p className="mt-1 text-sm text-muted-foreground">You've been invited to join an organization on QuantForge.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="text-sm space-y-2">
            <p><span className="text-muted-foreground">Role:</span> <span className="font-medium text-foreground capitalize">{invitation.roleToAssign}</span></p>
            <p><span className="text-muted-foreground">Expires:</span> <span className="text-foreground">{new Date(invitation.expiresAt).toLocaleDateString()}</span></p>
          </div>
          {!isAuthenticated && (
            <p className="text-xs text-amber-500 bg-amber-500/10 rounded-md px-3 py-2">
              You need to sign in or create an account to accept this invitation.
            </p>
          )}
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {accepting ? "Accepting…" : isAuthenticated ? "Accept invitation" : "Sign in to accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
