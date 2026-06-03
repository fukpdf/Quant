import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { apiResetPassword, ApiError } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords do not match."); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (!token) { toast.error("Invalid or missing reset token."); return; }
    setLoading(true);
    try {
      await apiResetPassword(token, password);
      setDone(true);
      toast.success("Password reset successfully.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Reset failed. The link may have expired.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  if (done) return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center space-y-4">
        <div className="text-4xl">✅</div>
        <p className="text-sm font-medium text-foreground">Password reset successfully</p>
        <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
        <button onClick={() => navigate("/login")} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Sign in
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">New password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a strong password for your account.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">New password</label>
            <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className={inputCls} placeholder="Min. 8 characters" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Confirm password</label>
            <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} placeholder="Repeat new password" />
          </div>
          <button type="submit" disabled={loading || !token} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading ? "Resetting…" : "Reset password"}
          </button>
          {!token && <p className="text-xs text-destructive text-center">No reset token found. Please use the link from your email.</p>}
        </form>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
