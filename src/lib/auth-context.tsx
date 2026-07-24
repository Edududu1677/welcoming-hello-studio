import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

type Role = "admin" | "gerente" | "operador" | "consulta";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  roles: Role[];
  loading: boolean;
  isAdmin: boolean;
  canWrite: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null, user: null, roles: [], loading: true,
  isAdmin: false, canWrite: false, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") qc.invalidateQueries();
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [qc, router]);

  useEffect(() => {
    if (!session?.user) { setRoles([]); return; }
    supabase.from("user_roles").select("role").eq("user_id", session.user.id).then(({ data }) => {
      setRoles((data ?? []).map((r) => r.role as Role));
    });
  }, [session?.user?.id]);

  const isAdmin = roles.includes("admin");
  const canWrite = roles.some((r) => r === "admin" || r === "gerente" || r === "operador");

  return (
    <Ctx.Provider value={{
      session, user: session?.user ?? null, roles, loading, isAdmin, canWrite,
      signOut: async () => {
        await qc.cancelQueries();
        qc.clear();
        await supabase.auth.signOut();
        router.navigate({ to: "/auth", replace: true });
      },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
