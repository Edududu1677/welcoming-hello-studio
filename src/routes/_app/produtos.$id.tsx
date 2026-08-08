import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/produtos/$id")({
  component: ProdutoEdit,
  head: () => ({ meta: [{ title: "Produto — Gestor MiniMarket" }, { name: "description", content: "Cadastro / edição de produto." }] }),
});

const empty: any = {
  codigo_interno: "", codigo_barras: "", nome: "", descricao: "", marca: "",
  categoria_id: null, subcategoria: "", unidade_medida: "UN", qtd_por_embalagem: null,
  fornecedor_id: null, custo_ultima_compra: 0, custo_medio: 0, preco_venda: 0,
  estoque_atual: 0, estoque_minimo: 0, estoque_maximo: null, localizacao: "",
  observacoes: "", ativo: true,
};

function ProdutoEdit() {
  const { id } = useParams({ from: "/_app/produtos/$id" });
  const isNew = id === "novo";
  const nav = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(empty);
  const { storeId } = useStore();
  const [saving, setSaving] = useState(false);

  const { data: cats } = useQuery({ queryKey: ["categories"], queryFn: async () => (await supabase.from("categories").select("id, nome").eq("ativo", true).order("nome")).data ?? [] });
  const { data: sups } = useQuery({ queryKey: ["suppliers-lite"], queryFn: async () => (await supabase.from("suppliers").select("id, razao_social").eq("ativo", true).order("razao_social")).data ?? [] });

  const { data: existing } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => (await supabase.from("products").select("*").eq("id", id).maybeSingle()).data,
    enabled: !isNew,
  });
  useEffect(() => { if (existing) setForm({ ...existing }); }, [existing]);

  function up<K extends string>(k: K, v: unknown) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.nome?.trim()) return toast.error("Nome é obrigatório");
    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.categorias;
      // Duplicate barcode check
      if (payload.codigo_barras) {
        const { data: dup } = await supabase.from("products").select("id, nome").eq("codigo_barras", payload.codigo_barras).eq("store_id", storeId!).maybeSingle();
        if (dup && dup.id !== id) {
          if (!confirm(`Código de barras já usado por "${dup.nome}". Continuar mesmo assim?`)) { setSaving(false); return; }
        }
      }
      if (isNew) {
        delete payload.id;
        payload.store_id = storeId;
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        toast.success("Produto criado");
        qc.invalidateQueries({ queryKey: ["products"] });
        nav({ to: "/produtos/$id", params: { id: data.id } });
      } else {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
        toast.success("Produto atualizado");
        qc.invalidateQueries();
      }
    } catch (e: any) { toast.error(e.message ?? "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm("Excluir este produto? Movimentações e vendas relacionadas manterão referência histórica.")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Produto excluído");
    qc.invalidateQueries({ queryKey: ["products"] });
    nav({ to: "/produtos" });
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild><Link to="/produtos"><ArrowLeft /></Link></Button>
          <h1 className="text-2xl font-bold">{isNew ? "Novo produto" : "Editar produto"}</h1>
        </div>
        <div className="flex gap-2">
          {!isNew && <Button variant="destructive" size="sm" onClick={remove}><Trash2 className="h-4 w-4 mr-2" />Excluir</Button>}
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Label>Nome *</Label><Input value={form.nome ?? ""} onChange={(e) => up("nome", e.target.value)} /></div>
          <div><Label>Código de barras</Label><Input value={form.codigo_barras ?? ""} onChange={(e) => up("codigo_barras", e.target.value || null)} /></div>
          <div><Label>Código interno</Label><Input value={form.codigo_interno ?? ""} onChange={(e) => up("codigo_interno", e.target.value)} /></div>
          <div><Label>Marca</Label><Input value={form.marca ?? ""} onChange={(e) => up("marca", e.target.value)} /></div>
          <div><Label>Unidade de medida</Label><Input value={form.unidade_medida ?? ""} onChange={(e) => up("unidade_medida", e.target.value)} /></div>
          <div><Label>Categoria</Label>
            <Select value={form.categoria_id ?? "none"} onValueChange={(v) => up("categoria_id", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {cats?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Fornecedor principal</Label>
            <Select value={form.fornecedor_id ?? "none"} onValueChange={(v) => up("fornecedor_id", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {sups?.map((s) => <SelectItem key={s.id} value={s.id}>{s.razao_social}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2"><Label>Descrição</Label><Textarea value={form.descricao ?? ""} onChange={(e) => up("descricao", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Preços e estoque</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div><Label>Custo médio (R$)</Label><Input type="number" step="0.01" value={form.custo_medio ?? 0} onChange={(e) => up("custo_medio", Number(e.target.value))} /></div>
          <div><Label>Última compra (R$)</Label><Input type="number" step="0.01" value={form.custo_ultima_compra ?? 0} onChange={(e) => up("custo_ultima_compra", Number(e.target.value))} /></div>
          <div><Label>Preço venda (R$)</Label><Input type="number" step="0.01" value={form.preco_venda ?? 0} onChange={(e) => up("preco_venda", Number(e.target.value))} /></div>
          <div><Label>Estoque atual</Label><Input type="number" step="0.001" value={form.estoque_atual ?? 0} onChange={(e) => up("estoque_atual", Number(e.target.value))} disabled={!isNew} />
            {!isNew && <p className="text-xs text-muted-foreground mt-1">Use ajuste de estoque para alterar após criado.</p>}
          </div>
          <div><Label>Estoque mínimo</Label><Input type="number" step="0.001" value={form.estoque_minimo ?? 0} onChange={(e) => up("estoque_minimo", Number(e.target.value))} /></div>
          <div><Label>Estoque máximo</Label><Input type="number" step="0.001" value={form.estoque_maximo ?? ""} onChange={(e) => up("estoque_maximo", e.target.value ? Number(e.target.value) : null)} /></div>
          <div><Label>Localização</Label><Input value={form.localizacao ?? ""} onChange={(e) => up("localizacao", e.target.value)} /></div>
          <div className="flex items-center gap-2 pt-6"><Switch checked={!!form.ativo} onCheckedChange={(v) => up("ativo", v)} /><Label>Ativo</Label></div>
        </CardContent>
      </Card>
    </div>
  );
}
