import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  apiLogin, apiLogout, apiGetMe, apiRegister,
  setTokens, clearTokens, loadTokensFromStorage, getAccessToken,
  type SafeUser,
} from "@/lib/auth-client";

interface AuthContextValue {
  user: SafeUser | null;
  roles: string[];
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  organizationId: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: { email: string; password: string; firstName?: string; lastName?: string; organizationName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (perms: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      const data = await apiGetMe();
      setUser(data.user);
      setRoles(data.roles);
      setPermissions(data.permissions);
    } catch {
      setUser(null);
      setRoles([]);
      setPermissions([]);
      clearTokens();
    }
  }, []);

  // Load tokens from storage on mount and try to restore session
  useEffect(() => {
    const hasTokens = loadTokensFromStorage();
    if (hasTokens) {
      fetchMe().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }

    const handleLogout = () => {
      setUser(null);
      setRoles([]);
      setPermissions([]);
      clearTokens();
    };
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [fetchMe]);

  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    const result = await apiLogin({ email, password, rememberMe });
    setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    setOrganizationId(result.organizationId);
    setUser(result.user);
    // Fetch full profile with roles/permissions
    await fetchMe();
  }, [fetchMe]);

  const register = useCallback(async (data: { email: string; password: string; firstName?: string; lastName?: string; organizationName?: string }) => {
    const result = await apiRegister(data);
    setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    setUser(result.user);
    await fetchMe();
  }, [fetchMe]);

  const logout = useCallback(async () => {
    await apiLogout();
    clearTokens();
    setUser(null);
    setRoles([]);
    setPermissions([]);
    setOrganizationId(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (getAccessToken()) await fetchMe();
  }, [fetchMe]);

  const hasPermission = useCallback((permission: string) => {
    if (user?.isSuperAdmin) return true;
    return permissions.includes(permission);
  }, [permissions, user]);

  const hasAnyPermission = useCallback((perms: string[]) => {
    if (user?.isSuperAdmin) return true;
    return perms.some(p => permissions.includes(p));
  }, [permissions, user]);

  return (
    <AuthContext.Provider value={{
      user,
      roles,
      permissions,
      isAuthenticated: !!user,
      isLoading,
      organizationId,
      login,
      register,
      logout,
      refreshUser,
      hasPermission,
      hasAnyPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
