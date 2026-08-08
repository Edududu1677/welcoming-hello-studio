import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl, num } from "@/lib/format";
import { Package, AlertTriangle, TrendingUp, DollarSign, ShoppingBag, Warehouse } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Gestor MiniMarket" }, { name: "description", content: "Visão geral do minimercado." }] }),
});

function Dashboard() {
  const { storeId, store } = useStore();
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", storeId],
    queryFn: async () => {
      const [prod, sales, stockLow, expenses] = await Promise.all([
        supabase.from("products").select("id, estoque_atual, custo_medio, preco_venda, estoque_minimo, ativo").eq("store_id", storeId!),
        supabase.from("sales").select("valor_total, lucro_bruto, data_venda").eq("store_id", storeId!).gte("data_venda", new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from("products").select("id").eq("ativo", true).eq("store_id", storeId!),
        supabase.from("expenses").select("valor, status").eq("store_id", storeId!).in("status", ["pendente", "vencido"]),
      ]);
      const products = prod.data ?? [];
      const s = sales.data ?? [];
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const fatToday = s.filter((x) => x.data_venda >= today).reduce((a, x) => a + Number(x.valor_total), 0);
      const fatWeek = s.filter((x) => x.data_venda >= weekAgo).reduce((a, x) => a + Number(x.valor_total), 0);
      const fatMonth = s.filter((x) => x.data_venda >= monthStart).reduce((a, x) => a + Number(x.valor_total), 0);
      const lucroMonth = s.filter((x) => x.data_venda >= monthStart).reduce((a, x) => a + Number(x.lucro_bruto), 0);

      const stockValueCost = products.reduce((a, p) => a + Number(p.estoque_atual) * Number(p.custo_medio), 0);
      const stockValueSale = products.reduce((a, p) => a + Number(p.estoque_atual) * Number(p.preco_venda), 0);
      const lowStock = products.filter((p) => Number(p.estoque_atual) <= Number(p.estoque_minimo) && Number(p.estoque_minimo) > 0).length;
      const zeroStock = products.filter((p) => Number(p.estoque_atual) <= 0).length;
      const contasAPagar = (expenses.data ?? []).reduce((a, x) => a + Number(x.valor), 0);

      return {
        fatToday, fatWeek, fatMonth, lucroMonth,
        totalProdutos: (stockLow.data ?? []).length,
        stockValueCost, stockValueSale, lowStock, zeroStock,
        contasAPagar,
        numVendas: s.filter((x) => x.data_venda >= monthStart).length,
        ticketMedio: s.filter((x) => x.data_venda >= monthStart).length
          ? fatMonth / s.filter((x) => x.data_venda >= monthStart).length : 0,
      };
    },
  });

  const cards = [
    { label: "Faturamento hoje", value: brl(stats?.fatToday), icon: DollarSign, color: "text-green-600" },
    { label: "Faturamento 7 dias", value: brl(stats?.fatWeek), icon: TrendingUp, color: "text-green-600" },
    { label: "Faturamento mês", value: brl(stats?.fatMonth), icon: DollarSign, color: "text-green-600" },
    { label: "Lucro bruto mês", value: brl(stats?.lucroMonth), icon: TrendingUp, color: "text-emerald-600" },
    { label: "Valor estoque (custo)", value: brl(stats?.stockValueCost), icon: Warehouse, color: "text-blue-600" },
    { label: "Valor estoque (venda)", value: brl(stats?.stockValueSale), icon: Warehouse, color: "text-blue-600" },
    { label: "Produtos ativos", value: num(stats?.totalProdutos), icon: Package, color: "text-blue-600" },
    { label: "Vendas no mês", value: num(stats?.numVendas), icon: ShoppingBag, color: "text-blue-600" },
    { label: "Ticket médio", value: brl(stats?.ticketMedio), icon: TrendingUp, color: "text-blue-600" },
    { label: "Estoque baixo", value: num(stats?.lowStock), icon: AlertTriangle, color: "text-yellow-600" },
    { label: "Sem estoque", value: num(stats?.zeroStock), icon: AlertTriangle, color: "text-red-600" },
    { label: "Contas a pagar", value: brl(stats?.contasAPagar), icon: DollarSign, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard — {store?.nome ?? "Mercado"}</h1>
        <p className="text-sm text-muted-foreground">Visão geral dos últimos 30 dias deste mercado.</p>
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={"h-4 w-4 " + c.color} />
            </CardHeader>
            <CardContent><div className="text-xl font-bold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Como começar</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Cadastre <strong>categorias</strong> e <strong>fornecedores</strong> nas telas correspondentes.</p>
          <p>2. Importe seu <strong>estoque inicial</strong> em <em>Importar estoque</em> (XLSX/CSV).</p>
          <p>3. Diariamente, importe a <strong>planilha de vendas</strong> em <em>Importar vendas</em> — o sistema baixa o estoque e calcula lucro automaticamente.</p>
          <p>4. Lance <strong>compras/notas fiscais</strong> (XML de NF-e ou manual) para atualizar custos e formar preços.</p>
        </CardContent>
      </Card>
    </div>
  );
}
