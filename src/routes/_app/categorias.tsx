import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/categorias")({
  component: Categorias,
  head: () => ({ meta: [{ title: "Categorias — Gestor MiniMarket" }, { name: "description", content: "Cadastro de categorias de produtos." }] }),
});

function Categorias() {
  const qc = useQueryClient();
  const sb: any = supabase;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const empty = { nome: "", margem_padrao: null, ativo: true };
  const [form, setForm] = useState<any>(empty);

  const { data } = useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => (await sb.from("categories").select("*").order("nome")).data ?? [],
  });

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(c: any) { setEditing(c); setForm({ ...c }); setOpen(true); }

  async function save() {
    if (!form.nome?.trim()) return toast.error("Nome obrigatório");
    const payload = { ...form }; delete payload.id; delete payload.created_at; delete payload.updated_at;
    const res = editing ? await sb.from("categories").update(payload).eq("id", editing.id) : await sb.from("categories").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Categoria atualizada" : "Categoria criada");
    setOpen(false); qc.invalidateQueries({ queryKey: ["categories-all"] }); qc.invalidateQueries({ queryKey: ["categories"] });
  }

  async function remove(c: any) {
    if (!confirm(`Excluir a categoria "${c.nome}"? Produtos vinculados ficarão sem categoria.`)) return;
    const { error } = await sb.from("categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Categoria excluída");
    qc.invalidateQueries({ queryKey: ["categories-all"] }); qc.invalidateQueries({ queryKey: ["categories"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Categorias</h1><p className="text-sm text-muted-foreground">{data?.length ?? 0} cadastradas</p></div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova categoria</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead className="text-right">Margem padrão</TableHead><TableHead>Ativa</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(!data || data.length === 0) && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma categoria cadastrada</TableCell></TableRow>}
              {data?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-right">{c.margem_padrao != null ? `${Number(c.margem_padrao).toFixed(2)}%` : "—"}</TableCell>
                  <TableCell>{c.ativo ? "Sim" : "Não"}</TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Edit className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Margem padrão (%)</Label><Input type="number" step="0.01" value={form.margem_padrao ?? ""} onChange={(e) => setForm({ ...form, margem_padrao: e.target.value === "" ? null : Number(e.target.value) })} /></div>
            <div className="flex items-center gap-2"><Switch checked={!!form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /><Label>Ativa</Label></div>
          </div>
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
