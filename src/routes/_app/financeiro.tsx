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
import { brl, formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/financeiro")({
  component: Financeiro,
  head: () => ({ meta: [{ title: "Financeiro — Gestor MiniMarket" }, { name: "description", content: "Despesas e contas a pagar." }] }),
});

const CATEGORIAS = ["energia", "internet", "aluguel", "funcionarios", "manutencao", "sistemas", "taxas", "impostos", "compras", "outras"];

function Financeiro() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const sb: any = supabase;
  const [open, setOpen] = useState(false);
  const empty: any = { descricao: "", categoria: "outras", valor: 0, data_vencimento: "", data_pagamento: null, forma_pagamento: "", status: "pendente", observacoes: "" };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<any>(null);

  const { data: exp } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => (await sb.from("expenses").select("*").order("data_vencimento", { ascending: true }).limit(200)).data ?? [],
  });

  async function save() {
    if (!form.descricao?.trim() || !Number(form.valor)) return toast.error("Descrição e valor obrigatórios");
    const payload = { ...form, user_id: user?.id };
    if (!payload.data_vencimento) delete payload.data_vencimento;
    if (!payload.data_pagamento) delete payload.data_pagamento;
    const res = editing ? await sb.from("expenses").update(payload).eq("id", editing.id) : await sb.from("expenses").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Atualizado" : "Registrado");
    setOpen(false); setEditing(null); setForm(empty);
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  async function pagar(e: any) {
    const { error } = await sb.from("expenses").update({ status: "pago", data_pagamento: new Date().toISOString().slice(0, 10) }).eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Marcado como pago");
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  async function remove(e: any) {
    if (!confirm(`Excluir a despesa "${e.descricao}"?`)) return;
    const { error } = await sb.from("expenses").delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Despesa excluída");
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  const totalPend = exp?.filter((e: any) => e.status === "pendente" || e.status === "vencido").reduce((a: number, e: any) => a + Number(e.valor), 0) ?? 0;
  const totalPago = exp?.filter((e: any) => e.status === "pago").reduce((a: number, e: any) => a + Number(e.valor), 0) ?? 0;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-2xl font-bold">Financeiro</h1><p className="text-sm text-muted-foreground">Despesas e contas a pagar</p></div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button>Nova despesa</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar despesa" : "Nova despesa"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Descrição *</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Categoria</Label>
                  <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Vencimento</Label><Input type="date" value={form.data_vencimento ?? ""} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} /></div>
                <div><Label>Forma pagamento</Label><Input value={form.forma_pagamento ?? ""} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} /></div>
              </div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Observações</Label><Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm">A pagar</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-red-600">{brl(totalPend)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Pago</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-green-600">{brl(totalPago)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Total lançado</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{brl(totalPend + totalPago)}</CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(!exp || exp.length === 0) && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma despesa registrada</TableCell></TableRow>}
              {exp?.map((e: any) => {
                const vencido = e.status === "pendente" && e.data_vencimento && e.data_vencimento < today;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.descricao}</TableCell>
                    <TableCell className="text-xs">{e.categoria}</TableCell>
                    <TableCell>{e.data_vencimento ? formatDate(e.data_vencimento) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{brl(e.valor)}</TableCell>
                    <TableCell>
                      {e.status === "pago" && <Badge className="bg-green-600">Pago</Badge>}
                      {(e.status === "pendente" && !vencido) && <Badge variant="secondary">Pendente</Badge>}
                      {(e.status === "vencido" || vencido) && <Badge variant="destructive">Vencido</Badge>}
                      {e.status === "cancelado" && <Badge variant="outline">Cancelado</Badge>}
                    </TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      {e.status !== "pago" && <Button size="sm" variant="ghost" onClick={() => pagar(e)}>Pagar</Button>}
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(e); setForm({ ...e }); setOpen(true); }}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(e)}>Excluir</Button>
                    </TableCell>
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
