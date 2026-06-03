import { useState, useEffect } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { apiVerifyEmail, apiResendVerification, ApiError } from "@/lib/auth-client";
import { useAuth } from "@/contexts/auth-context";

export default function VerifyEmailPage() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<"pending" | "success" | "error" | "already">("pending");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (user?.emailVerified) { setStatus("already"); return; }
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) return;

    setStatus("pending");
    apiVerifyEmail(token)
      .then(() => {
        setStatus("success");
        refreshUser();
        toast.success("Email verified!");
      })
      .catch(err => {
        setStatus("error");
        toast.error(err instanceof ApiError ? err.message : "Verification failed.");
      });
  }, [user, refreshUser]);

  async function handleResend() {
    setResending(true);
    try {
      await apiResendVerification();
      toast.success("Verification email sent.");
    } catch {
      toast.error("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        {status === "already" && (
          <>
            <div className="text-4xl">✅</div>
            <p className="font-medium text-foreground">Email already verified</p>
            <p className="text-sm text-muted-foreground">Your email address is verified. You have full access.</p>
            <Link href="/" className="block text-sm text-primary hover:underline">Go to dashboard</Link>
          </>
        )}
        {status === "success" && (
          <>
            <div className="text-4xl">🎉</div>
            <p className="font-medium text-foreground">Email verified!</p>
            <p className="text-sm text-muted-foreground">Your email address has been verified. Welcome to QuantForge.</p>
            <Link href="/" className="block text-sm text-primary hover:underline">Go to dashboard</Link>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-4xl">❌</div>
            <p className="font-medium text-foreground">Verification failed</p>
            <p className="text-sm text-muted-foreground">The link may have expired. Request a new one below.</p>
            {user && (
              <button onClick={handleResend} disabled={resending} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {resending ? "Sending…" : "Resend verification email"}
              </button>
            )}
            <Link href="/login" className="block text-sm text-muted-foreground hover:text-foreground">Back to sign in</Link>
          </>
        )}
        {status === "pending" && !new URLSearchParams(window.location.search).get("token") && (
          <>
            <div className="text-4xl">📧</div>
            <p className="font-medium text-foreground">Verify your email</p>
            <p className="text-sm text-muted-foreground">Check your inbox for a verification link. Didn't get it?</p>
            {user && (
              <button onClick={handleResend} disabled={resending} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {resending ? "Sending…" : "Resend email"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
