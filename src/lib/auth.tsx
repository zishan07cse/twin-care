// Auth + role helpers. Session state lives here; components subscribe via useAuth().
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole =
  | "super_admin"
  | "admin"
  | "care_coordinator"
  | "doctor"
  | "nutritionist"
  | "inventory_manager"
  | "finance"
  | "sales_officer"
  | "patient"
  | "dealer";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (r: AppRole) => boolean;
  hasAnyRole: (rs: AppRole[]) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

async function fetchRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) {
    console.error("[auth] fetchRoles", error);
    return [];
  }
  return (data ?? []).map((r) => r.role as AppRole);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener first, then hydrate initial session.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        // Defer role fetch to next tick to avoid deadlocks inside the auth callback.
        setTimeout(() => {
          fetchRoles(s.user.id).then(setRoles);
        }, 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        fetchRoles(data.session.user.id).then(setRoles).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      user: session?.user ?? null,
      roles,
      loading,
      hasRole: (r) => roles.includes(r),
      hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, roles, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// Human-friendly role labels (English/Bengali).
export const ROLE_LABELS: Record<AppRole, { en: string; bn: string }> = {
  super_admin: { en: "Super admin", bn: "সুপার অ্যাডমিন" },
  admin: { en: "Admin", bn: "অ্যাডমিন" },
  care_coordinator: { en: "Care coordinator", bn: "কেয়ার কো-অর্ডিনেটর" },
  doctor: { en: "Doctor", bn: "ডাক্তার" },
  nutritionist: { en: "Nutritionist", bn: "পুষ্টিবিদ" },
  inventory_manager: { en: "Inventory manager", bn: "ইনভেন্টরি ম্যানেজার" },
  finance: { en: "Finance", bn: "ফিনান্স" },
  sales_officer: { en: "Sales officer", bn: "সেলস অফিসার" },
  patient: { en: "Patient", bn: "রোগী" },
  dealer: { en: "Dealer", bn: "ডিলার" },
};
