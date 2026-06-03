import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiListOrganizations, apiListMembers, apiSendInvitation, ApiError } from "@/lib/auth-client";
import { useAuth } from "@/contexts/auth-context";

export default function OrgSettingsPage() {
  const { organizationId, hasPermission } = useAuth();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => apiListOrganizations(),
  });

  const currentOrgId = organizationId ?? (orgsData?.data as any[])?.[0]?.id;

  const { data: membersData, isLoading: loadingMembers } = useQuery({
    queryKey: ["org-members", currentOrgId],
    queryFn: () => currentOrgId ? apiListMembers(currentOrgId) : Promise.resolve({ data: [], total: 0 }),
    enabled: !!currentOrgId,
  });

  const org = (orgsData?.data as any[])?.find((o: any) => o.id === currentOrgId) ?? (orgsData?.data as any[])?.[0];
  const members = (membersData?.data ?? []) as any[];

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrgId) return;
    setInviting(true);
    try {
      await apiSendInvitation(currentOrgId, { email: inviteEmail, roleToAssign: inviteRole });
      setInviteEmail("");
      toast.success(`Invitation sent to ${inviteEmail}`);
      qc.invalidateQueries({ queryKey: ["org-members", currentOrgId] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send invitation.");
    } finally { setInviting(false); }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Organization Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your organization and team members.</p>
      </div>

      {/* Org info */}
      {org && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold text-foreground">Organization</h2>
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Name:</span> <span className="text-foreground font-medium">{org.name}</span></p>
            <p><span className="text-muted-foreground">Slug:</span> <span className="font-mono text-foreground">{org.slug}</span></p>
            {org.description && <p><span className="text-muted-foreground">Description:</span> <span className="text-foreground">{org.description}</span></p>}
            <p><span className="text-muted-foreground">Plan:</span> <span className="text-foreground capitalize">{org.plan ?? "Free"}</span></p>
            <p><span className="text-muted-foreground">Members:</span> <span className="text-foreground">{members.length} / {org.maxMembers ?? "∞"}</span></p>
          </div>
        </section>
      )}

      {/* Invite member */}
      {hasPermission("users:write") && currentOrgId && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Invite member</h2>
          <form onSubmit={handleInvite} className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email address</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="colleague@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <button type="submit" disabled={inviting} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap">
              {inviting ? "Sending…" : "Send invite"}
            </button>
          </form>
        </section>
      )}

      {/* Members list */}
      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-semibold text-foreground">Members ({members.length})</h2>
        </div>
        <ul className="divide-y divide-border">
          {loadingMembers && <li className="p-4 text-sm text-muted-foreground">Loading…</li>}
          {!loadingMembers && members.length === 0 && <li className="p-4 text-sm text-muted-foreground">No members found.</li>}
          {members.map((m: any) => (
            <li key={m.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {m.user ? `${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim() || m.user.email : m.userId}
                </p>
                {m.user && <p className="text-xs text-muted-foreground">{m.user.email}</p>}
              </div>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground capitalize">{m.orgRole}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
