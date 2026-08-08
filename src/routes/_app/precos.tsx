import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, formatDateTime, roundPrice, parseNumberBR } from "@/lib/format";
import { Search, Save, History, Calculator } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/precos")({
  component: PrecosPage,
  head: () => ({
    meta: [
      { title: "Preços e margem — Gestor MiniMarket" },
      { name: "description", content: "Calcule preços de venda por margem ou markup e acompanhe o histórico de preços." },
      { property: "og:title", content: "Preços e margem — Gestor MiniMarket" },
      { property: "og:description", content: "Calcule preços de venda por margem ou markup e acompanhe o histórico de preços." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  nome: string;
  codigo_barras: string | null;
  codigo_interno: string | null;
  custo_medio: number | null;
  preco_venda: number | null;
  estoque_atual: number | null;
};

type Edit = { custo: string; base: "markup" | "margem" | "manual"; valor: string; arred: string; sel: boolean };

const ROUND_OPTS = [
  { v: "centavo", l: "Centavo (padrão)" },
  { v: "99", l: "Terminar em ,99" },
  { v: "90", l: "Terminar em ,90" },
  { v: "49", l: "Terminar em ,49/,99" },
  { v: "inteiro", l: "Valor inteiro" },
  { v: "sem", l: "Sem arredondamento" },
];

function PrecosPage() {
  const qc = useQueryClient();
  const { canWrite, user } = useAuth();
  const { storeId } = useStore();
  const [q, setQ] = useState("");
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [saving, setSaving] = useState(false);
  // bulk
  const [bulkBase, setBulkBase] = useState<"markup" | "margem">("markup");
  const [bulkValor, setBulkValor] = useState("30");
  const [bulkArred, setBulkArred] = useState("99");

  const { data: products, isLoading } = useQuery({
    queryKey: ["precos-products", q, storeId],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, nome, codigo_barras, codigo_interno, custo_medio, preco_venda, estoque_atual")
        .eq("ativo", true)
        .eq("store_id", storeId!)
        .order("nome")
        .limit(500);
      if (q.trim()) query = query.or(`nome.ilike.%${q}%,codigo_barras.ilike.%${q}%,codigo_interno.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: history } = useQuery({
    queryKey: ["price-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_history")
        .select("id, created_at, preco_anterior, preco_novo, motivo, products:product_id(nome, codigo_barras)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  function getEdit(p: Row): Edit {
    return (
      edits[p.id] ?? {
        custo: String(p.custo_medio ?? 0),
        base: "markup",
        valor: "",
        arred: "centavo",
        sel: false,
      }
    );
  }
  function setEdit(id: string, patch: Partial<Edit>, p: Row) {
    setEdits((e) => ({ ...e, [id]: { ...getEdit(p), ...patch } }));
  }

  function calc(p: Row) {
    const e = getEdit(p);
    const custo = parseNumberBR(e.custo);
    const v = parseNumberBR(e.valor);
    let bruto = 0;
    if (e.base === "manual") bruto = v;
    else if (e.base === "margem") bruto = v >= 100 ? 0 : custo / (1 - v / 100);
    else bruto = custo * (1 + v / 100);
    const preco = roundPrice(bruto, e.arred);
    const lucro = preco - custo;
    const margemReal = preco > 0 ? (lucro / preco) * 100 : 0;
    const markupReal = custo > 0 ? (lucro / custo) * 100 : 0;
    const atual = Number(p.preco_venda ?? 0);
    return { custo, preco, lucro, margemReal, markupReal, atual, dif: preco - atual, difPct: atual > 0 ? ((preco - atual) / atual) * 100 : 0, e };
  }

  const selectedIds = useMemo(
    () => (products ?? []).filter((p) => getEdit(p).sel).map((p) => p.id),
    [products, edits],
  );

  function applyBulk() {
    if (!products) return;
    const target = selectedIds.length ? products.filter((p) => selectedIds.includes(p.id)) : products;
    setEdits((prev) => {
      const next = { ...prev };
      for (const p of target) {
        const cur = next[p.id] ?? { custo: String(p.custo_medio ?? 0), base: "markup" as const, valor: "", arred: "centavo", sel: false };
        next[p.id] = { ...cur, base: bulkBase, valor: bulkValor, arred: bulkArred, sel: true };
      }
      return next;
    });
    toast.success(`Cálculo aplicado em ${target.length} produto(s). Revise e clique em Salvar.`);
  }

  async function save() {
    if (!canWrite) return toast.error("Seu perfil não permite alterar preços.");
    if (!products) return;
    const rows = products.filter((p) => getEdit(p).sel);
    if (!rows.length) return toast.error("Selecione ao menos um produto.");
    setSaving(true);
    let ok = 0;
    try {
      for (const p of rows) {
        const c = calc(p);
        if (!(c.preco > 0)) continue;
        const custoMudou = Math.abs(c.custo - Number(p.custo_medio ?? 0)) > 0.0001;
        const { error } = await supabase
          .from("products")
          .update({ preco_venda: c.preco, ...(custoMudou ? { custo_medio: c.custo } : {}) })
          .eq("id", p.id);
        if (error) throw error;

        await supabase.from("price_history").insert({
          product_id: p.id,
          preco_anterior: p.preco_venda ?? null,
          preco_novo: c.preco,
          user_id: user?.id ?? null,
          motivo:
            c.e.base === "manual"
              ? "Preço manual (pesquisa de mercado)"
              : `${c.e.base === "margem" ? "Margem" : "Markup"} ${parseNumberBR(c.e.valor)}% sobre custo ${brl(c.custo)}`,
        });
        if (custoMudou) {
          await supabase.from("cost_history").insert({
            product_id: p.id,
            custo_anterior: p.custo_medio ?? null,
            custo_novo: c.custo,
            tipo: "pesquisa",
            documento_ref: "Pesquisa de mercado",
          });
        }
        ok++;
      }
      toast.success(`${ok} preço(s) atualizado(s) com histórico.`);
      setEdits({});
      qc.invalidateQueries({ queryKey: ["precos-products"] });
      qc.invalidateQueries({ queryKey: ["price-history"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err) {
      toast.error((err as Error).message ?? "Erro ao salvar preços");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Preços e margem</h1>
        <p className="text-sm text-muted-foreground">
          Informe o custo (pesquisa de mercado ou nota), escolha margem/markup e confirme para atualizar — tudo fica no histórico.
        </p>
      </div>

      <Tabs defaultValue="calc">
        <TabsList>
          <TabsTrigger value="calc"><Calculator className="h-4 w-4 mr-2" />Calcular preços</TabsTrigger>
          <TabsTrigger value="hist"><History className="h-4 w-4 mr-2" />Histórico de preços</TabsTrigger>
        </TabsList>

        <TabsContent value="calc" className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Aplicar em massa</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-5 items-end">
              <div>
                <Label>Base do cálculo</Label>
                <Select value={bulkBase} onValueChange={(v) => setBulkBase(v as "markup" | "margem")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markup">Markup % sobre o custo</SelectItem>
                    <SelectItem value="margem">Margem % sobre a venda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Percentual</Label><Input value={bulkValor} onChange={(e) => setBulkValor(e.target.value)} /></div>
              <div>
                <Label>Arredondamento</Label>
                <Select value={bulkArred} onValueChange={setBulkArred}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROUND_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button variant="secondary" onClick={applyBulk}>
                {selectedIds.length ? `Aplicar nos ${selectedIds.length} selecionados` : "Aplicar em todos listados"}
              </Button>
              <Button onClick={save} disabled={saving || !selectedIds.length}>
                <Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : `Salvar ${selectedIds.length || ""}`}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar produto, código de barras ou código interno..." value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="w-32">Custo (R$)</TableHead>
                    <TableHead className="w-36">Base</TableHead>
                    <TableHead className="w-24">Valor</TableHead>
                    <TableHead className="w-40">Arredondar</TableHead>
                    <TableHead className="text-right">Preço sugerido</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead className="text-right">Margem / Markup</TableHead>
                    <TableHead className="text-right">Preço atual</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
                  {!isLoading && !products?.length && <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado.</TableCell></TableRow>}
                  {products?.map((p) => {
                    const c = calc(p);
                    return (
                      <TableRow key={p.id}>
                        <TableCell><Checkbox checked={c.e.sel} onCheckedChange={(v) => setEdit(p.id, { sel: !!v }, p)} /></TableCell>
                        <TableCell>
                          <div className="font-medium">{p.nome}</div>
                          <div className="text-xs text-muted-foreground">{p.codigo_barras || p.codigo_interno || "—"}</div>
                        </TableCell>
                        <TableCell><Input className="w-28" value={c.e.custo} onChange={(e) => setEdit(p.id, { custo: e.target.value, sel: true }, p)} /></TableCell>
                        <TableCell>
                          <Select value={c.e.base} onValueChange={(v) => setEdit(p.id, { base: v as Edit["base"], sel: true }, p)}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="markup">Markup %</SelectItem>
                              <SelectItem value="margem">Margem %</SelectItem>
                              <SelectItem value="manual">Preço manual</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input className="w-20" value={c.e.valor} onChange={(e) => setEdit(p.id, { valor: e.target.value, sel: true }, p)} /></TableCell>
                        <TableCell>
                          <Select value={c.e.arred} onValueChange={(v) => setEdit(p.id, { arred: v, sel: true }, p)}>
                            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>{ROUND_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{c.preco > 0 ? brl(c.preco) : "—"}</TableCell>
                        <TableCell className={`text-right ${c.lucro < 0 ? "text-destructive" : ""}`}>{c.preco > 0 ? brl(c.lucro) : "—"}</TableCell>
                        <TableCell className="text-right text-xs">
                          {c.preco > 0 ? `${c.margemReal.toFixed(1)}% / ${c.markupReal.toFixed(1)}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right">{brl(c.atual)}</TableCell>
                        <TableCell className="text-right text-xs">
                          {c.preco > 0 && c.atual > 0 ? (
                            <Badge variant={c.dif >= 0 ? "default" : "destructive"}>
                              {c.dif >= 0 ? "+" : ""}{brl(c.dif)} ({c.difPct.toFixed(1)}%)
                            </Badge>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hist">
          <Card>
            <CardHeader><CardTitle className="text-base">Últimas alterações de preço</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">De</TableHead>
                    <TableHead className="text-right">Para</TableHead>
                    <TableHead className="text-right">Variação</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!history?.length && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma alteração registrada ainda.</TableCell></TableRow>}
                  {history?.map((h: any) => {
                    const ant = Number(h.preco_anterior ?? 0);
                    const nov = Number(h.preco_novo ?? 0);
                    const dif = nov - ant;
                    return (
                      <TableRow key={h.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(h.created_at)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{h.products?.nome ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{h.products?.codigo_barras ?? ""}</div>
                        </TableCell>
                        <TableCell className="text-right">{ant ? brl(ant) : "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{brl(nov)}</TableCell>
                        <TableCell className="text-right">
                          {ant ? (
                            <span className={dif >= 0 ? "text-emerald-600" : "text-destructive"}>
                              {dif >= 0 ? "+" : ""}{brl(dif)} ({((dif / ant) * 100).toFixed(1)}%)
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{h.motivo ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
