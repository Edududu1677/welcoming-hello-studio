import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, num } from "@/lib/format";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/produtos/")({
  component: ProdutosList,
  head: () => ({ meta: [{ title: "Produtos — Gestor MiniMarket" }, { name: "description", content: "Cadastro de produtos." }] }),
});

function ProdutosList() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["products", q],
    queryFn: async () => {
      let query = supabase.from("products").select("id, codigo_barras, nome, marca, estoque_atual, estoque_minimo, custo_medio, preco_venda, ativo, categorias:categoria_id(nome)").order("nome").limit(500);
      if (q.trim()) {
        query = query.or(`nome.ilike.%${q}%,codigo_barras.ilike.%${q}%,codigo_interno.ilike.%${q}%,marca.ilike.%${q}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">{data?.length ?? 0} produtos encontrados</p>
        </div>
        <Button asChild><Link to="/produtos/novo"><Plus className="h-4 w-4 mr-2" />Novo produto</Link></Button>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, código de barras ou marca..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Cód. barras</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Venda</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && (!data || data.length === 0) && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum produto cadastrado. Comece importando seu estoque.</TableCell></TableRow>
              )}
              {data?.map((p: any) => {
                const est = Number(p.estoque_atual);
                const min = Number(p.estoque_minimo);
                const custo = Number(p.custo_medio);
                const preco = Number(p.preco_venda);
                const margem = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
                const lowStock = est <= 0 ? "sem" : (min > 0 && est <= min) ? "baixo" : "ok";
                return (
                  <TableRow key={p.id}>
                    <TableCell><Link to="/produtos/$id" params={{ id: p.id }} className="hover:underline font-medium">{p.nome}</Link>{p.marca && <div className="text-xs text-muted-foreground">{p.marca}</div>}</TableCell>
                    <TableCell className="font-mono text-xs">{p.codigo_barras ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.categorias?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {num(est)}
                      {lowStock === "sem" && <Badge variant="destructive" className="ml-1">Zero</Badge>}
                      {lowStock === "baixo" && <Badge className="ml-1 bg-yellow-500">Baixo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{brl(custo)}</TableCell>
                    <TableCell className="text-right">{brl(preco)}</TableCell>
                    <TableCell className="text-right">{margem.toFixed(1)}%</TableCell>
                    <TableCell><Button asChild variant="ghost" size="sm"><Link to="/produtos/$id" params={{ id: p.id }}>Editar</Link></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
