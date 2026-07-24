import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, num, formatDate } from "@/lib/format";
import { downloadXLSX } from "@/lib/xlsx-utils";
import { Download } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/relatorios")({
  component: Relatorios,
  head: () => ({ meta: [{ title: "Relatórios — Gestor MiniMarket" }, { name: "description", content: "Central de relatórios gerenciais." }] }),
});

function Relatorios() {
  const sb: any = supabase;
  const [days, setDays] = useState(30);

  const { data } = useQuery({
    queryKey: ["reports", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const [prod, saleItems, sales, purchases, losses] = await Promise.all([
        sb.from("products").select("id, nome, codigo_barras, estoque_atual, estoque_minimo, custo_medio, preco_venda, ativo, categorias:categoria_id(nome)"),
        sb.from("sale_items").select("product_id, codigo_barras, descricao, quantidade, valor_total, lucro, sales!inner(data_venda)").gte("sales.data_venda", since),
        sb.from("sales").select("data_venda, valor_total, lucro_bruto").gte("data_venda", since),
        sb.from("purchases").select("data_entrada, valor_total, suppliers:fornecedor_id(razao_social)").gte("data_entrada", since.slice(0, 10)),
        sb.from("losses").select("valor_total, tipo, motivo, data_evento").gte("data_evento", since.slice(0, 10)),
      ]);
      return { products: prod.data ?? [], saleItems: saleItems.data ?? [], sales: sales.data ?? [], purchases: purchases.data ?? [], losses: losses.data ?? [] };
    },
  });

  // Aggregations
  const topProdutos = (() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number; lucro: number }>();
    (data?.saleItems ?? []).forEach((it: any) => {
      const key = it.codigo_barras || it.descricao || it.product_id;
      const cur = map.get(key) ?? { nome: it.descricao || it.codigo_barras || "—", qtd: 0, valor: 0, lucro: 0 };
      cur.qtd += Number(it.quantidade); cur.valor += Number(it.valor_total); cur.lucro += Number(it.lucro);
      map.set(key, cur);
    });
    return [...map.values()].sort((a, b) => b.valor - a.valor);
  })();

  const estoqueBaixo = (data?.products ?? []).filter((p: any) => Number(p.estoque_atual) <= Number(p.estoque_minimo) && p.ativo);
  const totalFaturamento = (data?.sales ?? []).reduce((a: number, s: any) => a + Number(s.valor_total), 0);
  const totalLucro = (data?.sales ?? []).reduce((a: number, s: any) => a + Number(s.lucro_bruto), 0);
  const totalCompras = (data?.purchases ?? []).reduce((a: number, p: any) => a + Number(p.valor_total), 0);
  const totalPerdas = (data?.losses ?? []).reduce((a: number, l: any) => a + Number(l.valor_total || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-2xl font-bold">Relatórios</h1><p className="text-sm text-muted-foreground">Últimos {days} dias</p></div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>{d}d</Button>)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-xs">Faturamento</CardTitle></CardHeader><CardContent className="text-xl font-bold text-green-600">{brl(totalFaturamento)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-xs">Lucro bruto</CardTitle></CardHeader><CardContent className="text-xl font-bold text-emerald-600">{brl(totalLucro)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-xs">Compras</CardTitle></CardHeader><CardContent className="text-xl font-bold text-blue-600">{brl(totalCompras)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-xs">Perdas</CardTitle></CardHeader><CardContent className="text-xl font-bold text-red-600">{brl(totalPerdas)}</CardContent></Card>
      </div>

      <Tabs defaultValue="top">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="top">Mais vendidos</TabsTrigger>
          <TabsTrigger value="baixo">Estoque baixo</TabsTrigger>
          <TabsTrigger value="curva">Curva ABC</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
        </TabsList>

        <TabsContent value="top">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle className="text-base">Produtos mais vendidos</CardTitle>
              <Button size="sm" variant="outline" onClick={() => downloadXLSX("mais_vendidos.xlsx", topProdutos)}><Download className="h-3 w-3 mr-1" />XLSX</Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Faturamento</TableHead><TableHead className="text-right">Lucro</TableHead></TableRow></TableHeader>
                <TableBody>{topProdutos.slice(0, 50).map((p, i) => <TableRow key={i}><TableCell>{p.nome}</TableCell><TableCell className="text-right">{num(p.qtd)}</TableCell><TableCell className="text-right">{brl(p.valor)}</TableCell><TableCell className="text-right text-emerald-600">{brl(p.lucro)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="baixo">
          <Card>
            <CardHeader><CardTitle className="text-base">Produtos com estoque abaixo do mínimo</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Estoque</TableHead><TableHead className="text-right">Mínimo</TableHead><TableHead className="text-right">Custo</TableHead></TableRow></TableHeader>
                <TableBody>{estoqueBaixo.map((p: any) => <TableRow key={p.id}><TableCell>{p.nome}</TableCell><TableCell>{p.categorias?.nome ?? "—"}</TableCell><TableCell className="text-right">{num(p.estoque_atual)}</TableCell><TableCell className="text-right">{num(p.estoque_minimo)}</TableCell><TableCell className="text-right">{brl(p.custo_medio)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="curva">
          <Card>
            <CardHeader><CardTitle className="text-base">Curva ABC de vendas</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-right">Faturamento</TableHead><TableHead className="text-right">% acum.</TableHead><TableHead>Classe</TableHead></TableRow></TableHeader>
                <TableBody>{(() => {
                  const tot = topProdutos.reduce((a, p) => a + p.valor, 0) || 1;
                  let acum = 0;
                  return topProdutos.slice(0, 100).map((p, i) => {
                    acum += p.valor;
                    const pct = (acum / tot) * 100;
                    const classe = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
                    return <TableRow key={i}><TableCell>{p.nome}</TableCell><TableCell className="text-right">{brl(p.valor)}</TableCell><TableCell className="text-right">{pct.toFixed(1)}%</TableCell><TableCell><span className={"font-bold " + (classe === "A" ? "text-green-600" : classe === "B" ? "text-yellow-600" : "text-red-600")}>{classe}</span></TableCell></TableRow>;
                  });
                })()}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compras">
          <Card>
            <CardHeader><CardTitle className="text-base">Compras por fornecedor</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Fornecedor</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>{(data?.purchases ?? []).map((c: any, i: number) => <TableRow key={i}><TableCell>{formatDate(c.data_entrada)}</TableCell><TableCell>{c.suppliers?.razao_social ?? "—"}</TableCell><TableCell className="text-right">{brl(c.valor_total)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
