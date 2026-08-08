import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, Package, Warehouse, FileUp, ShoppingCart, Truck,
  ClipboardList, TrendingDown, Wallet, BarChart3, Bell, Users, Settings,
  Store, LogOut, Menu, FileDown, Tags, Calculator,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AppLayout,
});

const menu = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/categorias", label: "Categorias", icon: Tags },
  { to: "/precos", label: "Preços e margem", icon: Calculator },
  { to: "/estoque", label: "Estoque", icon: Warehouse },

  { to: "/importar-estoque", label: "Importar estoque", icon: FileUp },
  { to: "/importar-vendas", label: "Importar vendas", icon: FileDown },
  { to: "/compras", label: "Compras e notas", icon: ShoppingCart },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck },
  { to: "/inventario", label: "Inventário", icon: ClipboardList },
  { to: "/perdas", label: "Perdas", icon: TrendingDown },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/alertas", label: "Alertas", icon: Bell },
  { to: "/usuarios", label: "Usuários", icon: Users, adminOnly: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function AppLayout() {
  const { user, roles, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = menu.filter((m) => !("adminOnly" in m && m.adminOnly) || isAdmin);

  const Nav = ({ onNav }: { onNav?: () => void }) => (
    <nav className="flex flex-col gap-1 px-2">
      {items.map((m) => {
        const active = pathname.startsWith(m.to);
        return (
          <Link key={m.to} to={m.to} onClick={onNav}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}>
            <m.icon className="h-4 w-4" />{m.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card">
        <div className="h-16 flex items-center gap-2 px-4 border-b">
          <Store className="h-6 w-6 text-primary" />
          <span className="font-semibold">MiniMarket</span>
        </div>
        <div className="flex-1 overflow-y-auto py-3"><Nav /></div>
        <div className="border-t p-3 space-y-2">
          <div className="text-xs">
            <div className="font-medium truncate">{user?.email}</div>
            <div className="text-muted-foreground capitalize">{roles.join(", ") || "sem papel"}</div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={signOut}><LogOut className="h-4 w-4 mr-2" />Sair</Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden"><Menu /></Button></SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <div className="h-16 flex items-center gap-2 px-4 border-b"><Store className="h-6 w-6 text-primary" /><span className="font-semibold">MiniMarket</span></div>
                <div className="py-3"><Nav onNav={() => setOpen(false)} /></div>
              </SheetContent>
            </Sheet>
            <h1 className="text-lg font-semibold hidden sm:block">Gestor MiniMarket</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="lg:hidden"><LogOut className="h-4 w-4" /></Button>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
