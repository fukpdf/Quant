import { useQuery } from "@tanstack/react-query";
import { apiListUsers, apiListRoles, type SafeUser } from "@/lib/auth-client";
import { useAuth } from "@/contexts/auth-context";

export default function UserManagementPage() {
  const { hasPermission } = useAuth();

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiListUsers(),
    enabled: hasPermission("users:read"),
  });

  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiListRoles(),
    enabled: hasPermission("users:read"),
  });

  if (!hasPermission("users:read")) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">You don't have permission to view user management.</p>
          <p className="text-xs text-muted-foreground mt-1">Requires: users:read</p>
        </div>
      </div>
    );
  }

  const users = usersData?.data ?? [];
  const roles = rolesData?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} users total</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Users", value: users.length },
          { label: "Active", value: users.filter(u => u.isActive).length },
          { label: "Super Admins", value: users.filter(u => u.isSuperAdmin).length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-semibold text-foreground">All Users</h2>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Verified</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {user.firstName || user.lastName ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "—"}
                        </p>
                        <p className="text-muted-foreground text-xs">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${user.isActive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs ${user.emailVerified ? "text-green-500" : "text-amber-500"}`}>
                        {user.emailVerified ? "✓ Yes" : "✗ No"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {user.isSuperAdmin ? (
                        <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-400">Super Admin</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">No users found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Roles */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold text-foreground">System Roles ({(roles as any[]).length})</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {(roles as any[]).map((role: any) => (
            <div key={role.id} className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <p className="text-sm font-medium text-foreground font-mono">{role.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{role.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
