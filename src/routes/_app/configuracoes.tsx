import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/configuracoes")({
  component: Configuracoes,
  head: () => ({ meta: [{ title: "Configurações — Gestor MiniMarket" }, { name: "description", content: "Configurações do sistema." }] }),
});

function Configuracoes() {
  const qc = useQueryClient();
  const sb: any = supabase;
  const [form, setForm] = useState<any>(null);

  const { data } = useQuery({ queryKey: ["settings"], queryFn: async () => (await sb.from("settings").select("*").eq("id", 1).maybeSingle()).data });
  useEffect(() => { if (data) setForm(data); }, [data]);

  async function save() {
    if (!form) return;
    const payload = { ...form }; delete payload.updated_at;
    const { error } = await sb.from("settings").upsert(payload);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  if (!form) return <div>Carregando...</div>;
  const up = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Card>
        <CardHeader><CardTitle>Empresa</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><Label>Nome</Label><Input value={form.nome_empresa} onChange={(e) => up("nome_empresa", e.target.value)} /></div>
          <div><Label>CNPJ</Label><Input value={form.cnpj ?? ""} onChange={(e) => up("cnpj", e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={(e) => up("telefone", e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Endereço</Label><Input value={form.endereco ?? ""} onChange={(e) => up("endereco", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Preços e margens</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div><Label>Margem padrão (%)</Label><Input type="number" step="0.01" value={form.margem_padrao} onChange={(e) => up("margem_padrao", Number(e.target.value))} /></div>
          <div><Label>Markup padrão (%)</Label><Input type="number" step="0.01" value={form.markup_padrao} onChange={(e) => up("markup_padrao", Number(e.target.value))} /></div>
          <div><Label>Margem mínima (%)</Label><Input type="number" step="0.01" value={form.margem_minima} onChange={(e) => up("margem_minima", Number(e.target.value))} /></div>
          <div><Label>Taxa cartão (%)</Label><Input type="number" step="0.01" value={form.taxa_cartao} onChange={(e) => up("taxa_cartao", Number(e.target.value))} /></div>
          <div><Label>% perdas médio</Label><Input type="number" step="0.01" value={form.perc_perdas} onChange={(e) => up("perc_perdas", Number(e.target.value))} /></div>
          <div><Label>Arredondamento</Label>
            <Select value={form.regra_arredondamento} onValueChange={(v) => up("regra_arredondamento", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="centavo">Centavo (R$ 0,01)</SelectItem>
                <SelectItem value="99">R$ ,99</SelectItem>
                <SelectItem value="90">R$ ,90</SelectItem>
                <SelectItem value="49">R$ ,49</SelectItem>
                <SelectItem value="inteiro">Inteiro</SelectItem>
                <SelectItem value="nenhum">Sem arredondar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Estoque</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div><Label>Estoque mínimo padrão</Label><Input type="number" step="0.001" value={form.estoque_minimo_padrao} onChange={(e) => up("estoque_minimo_padrao", Number(e.target.value))} /></div>
          <div><Label>Método de custo</Label>
            <Select value={form.metodo_custo} onValueChange={(v) => up("metodo_custo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="medio">Custo médio ponderado</SelectItem>
                <SelectItem value="ultimo">Último custo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2"><Switch checked={form.permite_estoque_negativo} onCheckedChange={(v) => up("permite_estoque_negativo", v)} /><Label>Permitir estoque negativo</Label></div>
        </CardContent>
      </Card>

      <div className="flex justify-end"><Button onClick={save}>Salvar configurações</Button></div>
    </div>
  );
}
