import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/fornecedores")({
  component: Fornecedores,
  head: () => ({ meta: [{ title: "Fornecedores — Gestor MiniMarket" }, { name: "description", content: "Cadastro de fornecedores." }] }),
});

function Fornecedores() {
  const qc = useQueryClient();
  const sb: any = supabase;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const empty = { razao_social: "", nome_fantasia: "", cnpj: "", telefone: "", whatsapp: "", email: "", endereco: "", vendedor: "", prazo_entrega_dias: null, condicoes_pagamento: "", observacoes: "", ativo: true };
  const [form, setForm] = useState<any>(empty);

  const { data } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await sb.from("suppliers").select("*").order("razao_social")).data ?? [],
  });

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(s: any) { setEditing(s); setForm({ ...s }); setOpen(true); }

  async function save() {
    if (!form.razao_social?.trim()) return toast.error("Razão social obrigatória");
    const payload = { ...form }; delete payload.id; delete payload.created_at; delete payload.updated_at;
    const res = editing ? await sb.from("suppliers").update(payload).eq("id", editing.id) : await sb.from("suppliers").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Fornecedor atualizado" : "Fornecedor criado");
    setOpen(false); qc.invalidateQueries({ queryKey: ["suppliers"] });
  }

  async function remove(s: any) {
    if (!confirm(`Excluir fornecedor "${s.razao_social}"?`)) return;
    const { error } = await sb.from("suppliers").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Fornecedor excluído");
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Fornecedores</h1><p className="text-sm text-muted-foreground">{data?.length ?? 0} cadastrados</p></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Razão social</TableHead><TableHead>CNPJ</TableHead><TableHead>Telefone</TableHead><TableHead>Vendedor</TableHead><TableHead>Prazo</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(!data || data.length === 0) && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum fornecedor cadastrado</TableCell></TableRow>}
              {data?.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell><div className="font-medium">{s.razao_social}</div>{s.nome_fantasia && <div className="text-xs text-muted-foreground">{s.nome_fantasia}</div>}</TableCell>
                  <TableCell className="font-mono text-xs">{s.cnpj ?? "—"}</TableCell>
                  <TableCell>{s.telefone ?? "—"}</TableCell>
                  <TableCell>{s.vendedor ?? "—"}</TableCell>
                  <TableCell>{s.prazo_entrega_dias ? `${s.prazo_entrega_dias} dias` : "—"}</TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Edit className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(s)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Razão social *</Label><Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></div>
            <div><Label>Nome fantasia</Label><Input value={form.nome_fantasia ?? ""} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></div>
            <div><Label>CNPJ</Label><Input value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Vendedor</Label><Input value={form.vendedor ?? ""} onChange={(e) => setForm({ ...form, vendedor: e.target.value })} /></div>
            <div><Label>Prazo entrega (dias)</Label><Input type="number" value={form.prazo_entrega_dias ?? ""} onChange={(e) => setForm({ ...form, prazo_entrega_dias: e.target.value ? Number(e.target.value) : null })} /></div>
            <div><Label>Condições pagamento</Label><Input value={form.condicoes_pagamento ?? ""} onChange={(e) => setForm({ ...form, condicoes_pagamento: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Endereço</Label><Input value={form.endereco ?? ""} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
