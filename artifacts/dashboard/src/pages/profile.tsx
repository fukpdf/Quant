import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { apiUpdateMe, apiChangePassword, apiListSessions, apiRevokeSession, apiRevokeAllSessions, ApiError } from "@/lib/auth-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function ProfilePage() {
  const { user, refreshUser, roles, permissions } = useAuth();
  const qc = useQueryClient();

  const [profileForm, setProfileForm] = useState({ firstName: user?.firstName ?? "", lastName: user?.lastName ?? "" });
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const { data: sessionsData } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => apiListSessions() as Promise<{ sessions: any[]; total: number }>,
  });

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiUpdateMe({ firstName: profileForm.firstName || undefined, lastName: profileForm.lastName || undefined });
      await refreshUser();
      toast.success("Profile updated.");
    } catch { toast.error("Failed to update profile."); }
    finally { setSavingProfile(false); }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { toast.error("New passwords do not match."); return; }
    if (pwForm.next.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setSavingPw(true);
    try {
      await apiChangePassword(pwForm.current, pwForm.next);
      setPwForm({ current: "", next: "", confirm: "" });
      toast.success("Password changed. All other sessions have been logged out.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to change password.");
    } finally { setSavingPw(false); }
  }

  async function revokeSession(id: string) {
    try {
      await apiRevokeSession(id);
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session revoked.");
    } catch { toast.error("Failed to revoke session."); }
  }

  async function revokeAll() {
    try {
      await apiRevokeAllSessions();
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("All sessions revoked.");
    } catch { toast.error("Failed to revoke sessions."); }
  }

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const labelCls = "block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account settings and security.</p>
      </div>

      {/* Profile info */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Account information</h2>
        <div className="text-sm text-muted-foreground space-y-1">
          <p><span className="text-foreground font-medium">Email:</span> {user?.email}
            {user?.emailVerified
              ? <span className="ml-2 text-xs text-green-500 font-medium">✓ Verified</span>
              : <span className="ml-2 text-xs text-amber-500 font-medium">! Unverified</span>}
          </p>
          <p><span className="text-foreground font-medium">Roles:</span> {roles.length ? roles.join(", ") : "None"}</p>
          <p><span className="text-foreground font-medium">Super admin:</span> {user?.isSuperAdmin ? "Yes" : "No"}</p>
          <p><span className="text-foreground font-medium">Member since:</span> {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</p>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-3 pt-2 border-t border-border">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First name</label>
              <input type="text" value={profileForm.firstName} onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))} className={inputCls} placeholder="Jane" />
            </div>
            <div>
              <label className={labelCls}>Last name</label>
              <input type="text" value={profileForm.lastName} onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))} className={inputCls} placeholder="Smith" />
            </div>
          </div>
          <button type="submit" disabled={savingProfile} className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {savingProfile ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

      {/* Change password */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Change password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className={labelCls}>Current password</label>
            <input type="password" required value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} className={inputCls} placeholder="••••••••" />
          </div>
          <div>
            <label className={labelCls}>New password</label>
            <input type="password" required minLength={8} value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} className={inputCls} placeholder="Min. 8 characters" />
          </div>
          <div>
            <label className={labelCls}>Confirm new password</label>
            <input type="password" required value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} className={inputCls} placeholder="Repeat new password" />
          </div>
          <button type="submit" disabled={savingPw} className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {savingPw ? "Changing…" : "Change password"}
          </button>
        </form>
      </section>

      {/* Sessions */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Active sessions</h2>
          <button onClick={revokeAll} className="text-xs text-destructive hover:underline">Revoke all</button>
        </div>
        <ul className="space-y-2">
          {(sessionsData?.sessions ?? []).map((s: any) => (
            <li key={s.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
              <div className="space-y-0.5">
                <p className="text-foreground font-medium">{s.ipAddress ?? "Unknown IP"} {s.current && <span className="ml-1 text-green-500">(current)</span>}</p>
                <p className="text-muted-foreground">{s.userAgent?.substring(0, 60) ?? "Unknown device"}</p>
                <p className="text-muted-foreground">Last active: {new Date(s.lastActiveAt).toLocaleString()}</p>
              </div>
              {!s.current && (
                <button onClick={() => revokeSession(s.id)} className="ml-3 text-destructive hover:underline shrink-0">Revoke</button>
              )}
            </li>
          ))}
          {!sessionsData?.sessions?.length && <p className="text-sm text-muted-foreground">No active sessions.</p>}
        </ul>
      </section>

      {/* Permissions preview */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold text-foreground">Your permissions</h2>
        <div className="flex flex-wrap gap-1.5">
          {permissions.length ? permissions.map(p => (
            <span key={p} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-mono text-muted-foreground">{p}</span>
          )) : <p className="text-sm text-muted-foreground">No permissions assigned.</p>}
        </div>
      </section>
    </div>
  );
}
