import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { brl, num, formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/perdas")({
  component: Perdas,
  head: () => ({ meta: [{ title: "Perdas — Gestor MiniMarket" }, { name: "description", content: "Registro de perdas, avarias e vencimentos." }] }),
});

function Perdas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const sb: any = supabase;
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [qtd, setQtd] = useState(0);
  const [tipo, setTipo] = useState("perda");
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");

  const { data: losses } = useQuery({
    queryKey: ["losses"],
    queryFn: async () => (await sb.from("losses").select("id, tipo, quantidade, valor_total, motivo, data_evento, products:product_id(nome, codigo_barras)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { data: prods } = useQuery({ queryKey: ["products-lite"], queryFn: async () => (await sb.from("products").select("id, nome, codigo_barras, estoque_atual, custo_medio").order("nome").limit(500)).data ?? [] });

  async function save() {
    if (!productId || !qtd || !motivo) return toast.error("Preencha produto, quantidade e motivo");
    const prod = prods?.find((p: any) => p.id === productId);
    const custo = prod ? Number(prod.custo_medio) : 0;
    const valorTot = custo * qtd;
    const tipoMov = tipo === "avaria" ? "avaria" : tipo === "vencimento" ? "vencimento" : "perda";
    const { error: mErr } = await sb.rpc("apply_stock_movement", {
      _product_id: productId, _tipo: tipoMov, _quantidade: -Math.abs(qtd),
      _custo: custo, _motivo: `${tipo}: ${motivo}`, _documento_ref: null,
    });
    if (mErr) return toast.error(mErr.message);
    await sb.from("losses").insert({
      product_id: productId, quantidade: qtd, custo_unitario: custo, valor_total: valorTot,
      motivo, tipo, observacoes: obs, user_id: user?.id,
    });
    toast.success("Perda registrada");
    setOpen(false); setProductId(""); setQtd(0); setMotivo(""); setObs(""); setTipo("perda");
    qc.invalidateQueries();
  }

  const totalPerdas = losses?.reduce((a: number, x: any) => a + Number(x.valor_total || 0), 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Perdas e avarias</h1><p className="text-sm text-muted-foreground">Total registrado: <span className="text-red-600 font-semibold">{brl(totalPerdas)}</span></p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>Registrar perda</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova perda</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Produto</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{prods?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome} — est. {num(p.estoque_atual)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="perda">Perda</SelectItem>
                    <SelectItem value="avaria">Avaria</SelectItem>
                    <SelectItem value="vencimento">Vencimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Quantidade</Label><Input type="number" step="0.001" value={qtd} onChange={(e) => setQtd(Number(e.target.value))} /></div>
              <div><Label>Motivo *</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
              <div><Label>Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Registrar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
            <TableBody>
              {(!losses || losses.length === 0) && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma perda registrada</TableCell></TableRow>}
              {losses?.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell>{formatDate(l.data_evento)}</TableCell>
                  <TableCell>{l.products?.nome ?? "—"}</TableCell>
                  <TableCell><span className="text-xs px-2 py-1 rounded bg-muted">{l.tipo}</span></TableCell>
                  <TableCell className="text-right">{num(l.quantidade)}</TableCell>
                  <TableCell className="text-right text-red-600 font-medium">{brl(l.valor_total)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.motivo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
