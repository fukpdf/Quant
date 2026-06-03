import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { apiForgotPassword, ApiError } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiForgotPassword(email);
      setSent(true);
    } catch {
      // Always succeed to prevent email enumeration — show success regardless
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reset password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
            <div className="text-4xl">📧</div>
            <p className="text-sm text-foreground font-medium">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
            </p>
            <Link href="/login" className="block text-sm text-primary hover:underline mt-2">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <Link href="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
