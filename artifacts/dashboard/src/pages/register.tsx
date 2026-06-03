import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/auth-client";

export default function RegisterPage() {
  const { register } = useAuth();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "", firstName: "", lastName: "", organizationName: "" });
  const [loading, setLoading] = useState(false);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        organizationName: form.organizationName || undefined,
      });
      toast.success("Account created! Check your email to verify your address.");
      navigate("/");
    } catch (err) {
      const msg = err instanceof ApiError
        ? (err.code === "EMAIL_TAKEN" ? "This email is already registered." : err.message)
        : "Registration failed. Please try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">QuantForge</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">First name</label>
              <input type="text" value={form.firstName} onChange={set("firstName")} className={inputCls} placeholder="Jane" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Last name</label>
              <input type="text" value={form.lastName} onChange={set("lastName")} className={inputCls} placeholder="Smith" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Email <span className="text-destructive">*</span></label>
            <input type="email" required value={form.email} onChange={set("email")} className={inputCls} placeholder="you@example.com" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Password <span className="text-destructive">*</span></label>
            <input type="password" required minLength={8} value={form.password} onChange={set("password")} className={inputCls} placeholder="Min. 8 characters" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Confirm password <span className="text-destructive">*</span></label>
            <input type="password" required value={form.confirmPassword} onChange={set("confirmPassword")} className={inputCls} placeholder="Repeat password" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Organization name</label>
            <input type="text" value={form.organizationName} onChange={set("organizationName")} className={inputCls} placeholder="My Trading Firm (optional)" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
