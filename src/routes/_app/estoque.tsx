import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { brl, num, formatDateTime } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/estoque")({
  component: EstoquePage,
  head: () => ({ meta: [{ title: "Estoque — Gestor MiniMarket" }, { name: "description", content: "Movimentações e ajustes de estoque." }] }),
});

function EstoquePage() {
  const { storeId } = useStore();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<string>("");
  const [tipo, setTipo] = useState("ajuste");
  const [quantidade, setQuantidade] = useState<number>(0);
  const [motivo, setMotivo] = useState("");

  const { data: mov } = useQuery({
    queryKey: ["stock-movements", storeId],
    queryFn: async () => (await supabase.from("stock_movements").select("id, tipo, quantidade, estoque_anterior, estoque_posterior, motivo, created_at, products:product_id(nome, codigo_barras)").eq("store_id", storeId!).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const { data: prods } = useQuery({ queryKey: ["products-lite", storeId], queryFn: async () => (await supabase.from("products").select("id, nome, codigo_barras, estoque_atual").eq("store_id", storeId!).order("nome").limit(500)).data ?? [] });

  async function apply() {
    if (!product) return toast.error("Selecione o produto");
    if (!quantidade) return toast.error("Informe a quantidade");
    const { error } = await supabase.rpc("apply_stock_movement" as any, {
      _product_id: product, _tipo: tipo, _quantidade: quantidade, _custo: null, _motivo: motivo || null, _documento_ref: null,
    });
    if (error) return toast.error(error.message);
    toast.success("Movimentação registrada");
    setOpen(false); setProduct(""); setQuantidade(0); setMotivo(""); setTipo("ajuste");
    qc.invalidateQueries({ queryKey: ["stock-movements", storeId] });
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estoque</h1>
          <p className="text-sm text-muted-foreground">Histórico de movimentações</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>Nova movimentação</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova movimentação</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Produto</Label>
                <Select value={product} onValueChange={setProduct}>
                  <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                  <SelectContent>{prods?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} — estoque {num(p.estoque_atual)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ajuste">Ajuste manual</SelectItem>
                    <SelectItem value="perda">Perda</SelectItem>
                    <SelectItem value="avaria">Avaria</SelectItem>
                    <SelectItem value="vencimento">Vencimento</SelectItem>
                    <SelectItem value="consumo_interno">Consumo interno</SelectItem>
                    <SelectItem value="bonificacao">Bonificação</SelectItem>
                    <SelectItem value="devolucao_fornecedor">Devolução ao fornecedor</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Quantidade (use negativo para saída)</Label><Input type="number" step="0.001" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} /></div>
              <div><Label>Motivo</Label><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={apply}>Registrar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Últimas 200 movimentações</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Tipo</TableHead>
              <TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Antes</TableHead>
              <TableHead className="text-right">Depois</TableHead><TableHead>Motivo</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(!mov || mov.length === 0) && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma movimentação registrada</TableCell></TableRow>}
              {mov?.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{formatDateTime(m.created_at)}</TableCell>
                  <TableCell>{m.products?.nome ?? "—"}</TableCell>
                  <TableCell><span className="text-xs px-2 py-1 rounded bg-muted">{m.tipo}</span></TableCell>
                  <TableCell className={"text-right font-medium " + (Number(m.quantidade) < 0 ? "text-red-600" : "text-green-600")}>{num(m.quantidade)}</TableCell>
                  <TableCell className="text-right">{num(m.estoque_anterior)}</TableCell>
                  <TableCell className="text-right">{num(m.estoque_posterior)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.motivo ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
