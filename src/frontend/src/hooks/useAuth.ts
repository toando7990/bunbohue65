import { useInternetIdentity } from "@caffeineai/core-infrastructure";

/**
 * Thin wrapper around useInternetIdentity.
 * Provides a consistent auth interface across the app.
 * For role-based access, use useAuthContext() from AuthContext instead.
 */
export function useAuth() {
  const { identity, isAuthenticated, login, clear } = useInternetIdentity();

  return {
    isAuthenticated: isAuthenticated ?? false,
    principal: identity?.getPrincipal() ?? null,
    login,
    logout: clear,
  };
}
