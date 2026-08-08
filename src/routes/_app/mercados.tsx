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
import { useStore } from "@/lib/store-context";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Check } from "lucide-react";

export const Route = createFileRoute("/_app/mercados")({
  component: Mercados,
  head: () => ({ meta: [{ title: "Mercados — Gestor MiniMarket" }, { name: "description", content: "Cadastro dos mercadinhos gerenciados." }] }),
});

function Mercados() {
  const qc = useQueryClient();
  const sb: any = supabase;
  const { storeId, setStoreId } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const empty = { nome: "", endereco: "", ativo: true };
  const [form, setForm] = useState<any>(empty);

  const { data } = useQuery({
    queryKey: ["stores-all"],
    queryFn: async () => (await sb.from("stores").select("*").order("nome")).data ?? [],
  });

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(s: any) { setEditing(s); setForm({ ...s }); setOpen(true); }

  async function save() {
    if (!form.nome?.trim()) return toast.error("Nome obrigatório");
    const payload = { nome: form.nome, endereco: form.endereco || null, ativo: !!form.ativo };
    const res = editing ? await sb.from("stores").update(payload).eq("id", editing.id) : await sb.from("stores").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Mercado atualizado" : "Mercado criado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["stores-all"] });
    qc.invalidateQueries({ queryKey: ["stores"] });
  }

  async function remove(s: any) {
    if (!confirm(`Excluir o mercado "${s.nome}"? Só é possível se não houver dados vinculados.`)) return;
    const { error } = await sb.from("stores").delete().eq("id", s.id);
    if (error) return toast.error("Não foi possível excluir: existem dados vinculados a este mercado.");
    toast.success("Mercado excluído");
    qc.invalidateQueries({ queryKey: ["stores-all"] });
    qc.invalidateQueries({ queryKey: ["stores"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mercados</h1>
          <p className="text-sm text-muted-foreground">{data?.length ?? 0} cadastrados — cada mercado tem estoque, vendas e dashboard próprios</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo mercado</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Endereço</TableHead><TableHead>Ativo</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(!data || data.length === 0) && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum mercado cadastrado</TableCell></TableRow>}
              {data?.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.nome} {s.id === storeId && <span className="ml-2 text-xs text-primary">(selecionado)</span>}
                  </TableCell>
                  <TableCell>{s.endereco ?? "—"}</TableCell>
                  <TableCell>{s.ativo ? "Sim" : "Não"}</TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">
                    {s.id !== storeId && (
                      <Button size="sm" variant="outline" onClick={() => setStoreId(s.id)}><Check className="h-3 w-3 mr-1" />Selecionar</Button>
                    )}
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar mercado" : "Novo mercado"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Endereço</Label><Input value={form.endereco ?? ""} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={!!form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /><Label>Ativo</Label></div>
          </div>
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
