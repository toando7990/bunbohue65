import { createActor } from "@/backend";
import { DEVELOPER_PRINCIPAL_ID } from "@/config/constants";
import { useActor } from "@caffeineai/core-infrastructure";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Principal } from "@icp-sdk/core/principal";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = "developer" | "business_owner" | "blocked" | "unknown";

interface AuthContextValue {
  role: UserRole;
  principalId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Inner provider (needs useActor inside QueryClientProvider) ───────────────

function AuthContextInner({ children }: { children: React.ReactNode }) {
  const { identity, isAuthenticated, login, clear } = useInternetIdentity();
  const { actor, isFetching: actorFetching } = useActor(createActor);

  const [role, setRole] = useState<UserRole>("unknown");
  const [isLoading, setIsLoading] = useState(false);

  // Track the principal we last resolved role for — avoid re-running on re-renders
  const resolvedForRef = useRef<string | null>(null);

  const principalId = identity?.getPrincipal()?.toText() ?? null;

  const resolveRole = useCallback(async () => {
    if (!principalId || !actor) return;

    // Skip if we already resolved for this principal
    if (resolvedForRef.current === principalId) return;

    setIsLoading(true);
    try {
      // Developer: hardcoded ID, no backend call needed
      if (principalId === DEVELOPER_PRINCIPAL_ID) {
        resolvedForRef.current = principalId;
        setRole("developer");
        return;
      }

      // Fetch developer profile to check business owner principal
      const devProfile = await actor.getPublicDeveloperProfile(
        Principal.fromText(DEVELOPER_PRINCIPAL_ID),
      );
      const businessOwnerPrincipal =
        devProfile?.businessOwnerPrincipalId?.toText() ?? null;
      const hasBusinessOwnerSet =
        !!businessOwnerPrincipal && businessOwnerPrincipal !== "2vxsx-fae";

      if (hasBusinessOwnerSet && principalId === businessOwnerPrincipal) {
        resolvedForRef.current = principalId;
        setRole("business_owner");
      } else {
        resolvedForRef.current = principalId;
        setRole("blocked");
      }
    } catch {
      resolvedForRef.current = principalId;
      setRole("blocked");
    } finally {
      setIsLoading(false);
    }
  }, [principalId, actor]);

  // Resolve role once when authenticated + actor is ready
  useEffect(() => {
    if (isAuthenticated && !actorFetching && actor && principalId) {
      resolveRole();
    }
  }, [isAuthenticated, actorFetching, actor, principalId, resolveRole]);

  // Reset on logout
  useEffect(() => {
    if (!isAuthenticated) {
      resolvedForRef.current = null;
      setRole("unknown");
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const handleLogout = useCallback(() => {
    resolvedForRef.current = null;
    setRole("unknown");
    clear();
    // Force navigation to /admin login screen immediately.
    // window.location.replace is the most reliable approach: it bypasses
    // TanStack Router's state and guarantees the login screen is shown.
    window.location.replace("/admin");
  }, [clear]);

  const value: AuthContextValue = {
    role,
    principalId,
    isLoading:
      isLoading || (isAuthenticated && actorFetching && role === "unknown"),
    isAuthenticated,
    login,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Provider export ──────────────────────────────────────────────────────────

export function AuthContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthContextInner>{children}</AuthContextInner>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error("useAuthContext must be used within AuthContextProvider");
  return ctx;
}
