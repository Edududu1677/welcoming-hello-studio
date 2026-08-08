import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Store {
  id: string;
  nome: string;
  endereco: string | null;
  ativo: boolean;
}

interface StoreCtx {
  storeId: string | null;
  store: Store | null;
  stores: Store[];
  loading: boolean;
  setStoreId: (id: string) => void;
}

const Ctx = createContext<StoreCtx>({
  storeId: null, store: null, stores: [], loading: true, setStoreId: () => {},
});

const KEY = "gm.storeId";

export function StoreProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [storeId, setStoreIdState] = useState<string | null>(null);

  const { data: stores, isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("stores").select("id, nome, endereco, ativo").order("nome");
      if (error) throw error;
      return (data ?? []) as Store[];
    },
  });

  useEffect(() => {
    if (!stores?.length) return;
    setStoreIdState((prev) => {
      if (prev && stores.some((s) => s.id === prev)) return prev;
      const saved = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
      return saved && stores.some((s) => s.id === saved) ? saved : stores[0].id;
    });
  }, [stores]);

  function setStoreId(id: string) {
    if (typeof window !== "undefined") localStorage.setItem(KEY, id);
    setStoreIdState(id);
    qc.invalidateQueries();
  }

  const list = stores ?? [];
  return (
    <Ctx.Provider value={{
      storeId,
      store: list.find((s) => s.id === storeId) ?? null,
      stores: list,
      loading: isLoading,
      setStoreId,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useStore = () => useContext(Ctx);
