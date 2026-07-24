import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { brl, num, formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/inventario")({
  component: Inventario,
  head: () => ({ meta: [{ title: "Inventário — Gestor MiniMarket" }, { name: "description", content: "Contagem física de estoque." }] }),
});

function Inventario() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const sb: any = supabase;
  const [current, setCurrent] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");

  const { data: inventarios } = useQuery({
    queryKey: ["inventories"],
    queryFn: async () => (await sb.from("inventories").select("*").order("aberto_em", { ascending: false }).limit(50)).data ?? [],
  });

  async function abrir() {
    const desc = prompt("Descrição do inventário:", `Inventário ${new Date().toLocaleDateString("pt-BR")}`);
    if (!desc) return;
    const { data: inv } = await sb.from("inventories").insert({ descricao: desc, escopo: "completo", user_id: user?.id }).select("*").single();
    if (!inv) return toast.error("Erro");
    const { data: prods } = await sb.from("products").select("id, nome, codigo_barras, estoque_atual, custo_medio").eq("ativo", true);
    const rows = (prods ?? []).map((p: any) => ({ product_id: p.id, nome: p.nome, codigo_barras: p.codigo_barras, quantidade_sistema: p.estoque_atual, quantidade_contada: null, custo_medio: p.custo_medio }));
    if (rows.length) await sb.from("inventory_items").insert(rows.map((r: any) => ({ inventory_id: inv.id, product_id: r.product_id, quantidade_sistema: r.quantidade_sistema })));
    setCurrent(inv);
    setItems(rows);
    toast.success("Inventário aberto — inicie a contagem");
    qc.invalidateQueries({ queryKey: ["inventories"] });
  }

  async function loadInv(inv: any) {
    setCurrent(inv);
    const { data } = await sb.from("inventory_items").select("*, products:product_id(nome, codigo_barras, custo_medio)").eq("inventory_id", inv.id);
    setItems((data ?? []).map((it: any) => ({
      id: it.id, product_id: it.product_id, nome: it.products?.nome, codigo_barras: it.products?.codigo_barras,
      quantidade_sistema: it.quantidade_sistema, quantidade_contada: it.quantidade_contada, custo_medio: it.products?.custo_medio,
      ajustado: it.ajustado,
    })));
  }

  function setContagem(i: number, v: number) {
    const next = [...items]; next[i].quantidade_contada = v; setItems(next);
  }

  async function salvarContagem() {
    if (!current) return;
    for (const it of items) {
      if (it.quantidade_contada === null || it.quantidade_contada === undefined) continue;
      const diff = Number(it.quantidade_contada) - Number(it.quantidade_sistema);
      await sb.from("inventory_items").update({ quantidade_contada: it.quantidade_contada, diferenca: diff }).eq("inventory_id", current.id).eq("product_id", it.product_id);
    }
    toast.success("Contagens salvas");
  }

  async function fechar() {
    if (!confirm("Fechar inventário e aplicar ajustes de estoque?")) return;
    await salvarContagem();
    for (const it of items) {
      if (it.quantidade_contada === null || it.quantidade_contada === undefined) continue;
      const diff = Number(it.quantidade_contada) - Number(it.quantidade_sistema);
      if (diff !== 0) {
        await sb.rpc("apply_stock_movement", {
          _product_id: it.product_id, _tipo: "inventario", _quantidade: diff, _custo: it.custo_medio || null,
          _motivo: `Inventário: ${current.descricao}`, _documento_ref: current.id,
        });
        await sb.from("inventory_items").update({ ajustado: true }).eq("inventory_id", current.id).eq("product_id", it.product_id);
      }
    }
    await sb.from("inventories").update({ status: "fechado", fechado_em: new Date().toISOString() }).eq("id", current.id);
    toast.success("Inventário fechado e ajustes aplicados");
    setCurrent(null); setItems([]); qc.invalidateQueries();
  }

  const filtered = items.filter((it) => !q || it.nome?.toLowerCase().includes(q.toLowerCase()) || it.codigo_barras?.includes(q));
  const totalDiff = items.reduce((a, it) => a + (it.quantidade_contada != null ? (Number(it.quantidade_contada) - Number(it.quantidade_sistema)) * Number(it.custo_medio || 0) : 0), 0);

  if (current) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">{current.descricao}</h1>
            <p className="text-sm text-muted-foreground">Status: {current.status} · Diferença financeira: <span className={totalDiff < 0 ? "text-red-600" : "text-green-600"}>{brl(totalDiff)}</span></p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setCurrent(null); setItems([]); }}>Voltar</Button>
            <Button variant="outline" onClick={salvarContagem}>Salvar contagem</Button>
            {current.status === "aberto" && <Button onClick={fechar}>Fechar e aplicar ajustes</Button>}
          </div>
        </div>
        <Input placeholder="Buscar produto ou código de barras..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Cód. barras</TableHead><TableHead className="text-right">Sistema</TableHead><TableHead className="text-right">Contado</TableHead><TableHead className="text-right">Diferença</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map((it, i) => {
                  const idx = items.indexOf(it);
                  const diff = it.quantidade_contada != null ? Number(it.quantidade_contada) - Number(it.quantidade_sistema) : null;
                  return (
                    <TableRow key={it.product_id}>
                      <TableCell>{it.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{it.codigo_barras ?? "—"}</TableCell>
                      <TableCell className="text-right">{num(it.quantidade_sistema)}</TableCell>
                      <TableCell className="text-right"><Input type="number" step="0.001" className="w-24 h-8 text-right ml-auto" value={it.quantidade_contada ?? ""} onChange={(e) => setContagem(idx, e.target.value === "" ? null as any : Number(e.target.value))} disabled={current.status !== "aberto"} /></TableCell>
                      <TableCell className={"text-right " + (diff && diff < 0 ? "text-red-600" : diff && diff > 0 ? "text-green-600" : "")}>{diff != null ? num(diff) : "—"}</TableCell>
                      <TableCell className="text-right text-xs">{diff != null ? brl(diff * Number(it.custo_medio || 0)) : "—"}</TableCell>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Inventário</h1><p className="text-sm text-muted-foreground">Contagem física de estoque</p></div>
        <Button onClick={abrir}>Abrir novo inventário</Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Aberto em</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(!inventarios || inventarios.length === 0) && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum inventário</TableCell></TableRow>}
              {inventarios?.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.descricao}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(inv.aberto_em)}</TableCell>
                  <TableCell><span className="text-xs px-2 py-1 rounded bg-muted">{inv.status}</span></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => loadInv(inv)}>Abrir</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
