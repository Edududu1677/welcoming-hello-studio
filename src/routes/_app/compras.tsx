import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { brl, formatDate } from "@/lib/format";
import { Upload, FileText, Trash2, Package, Pencil, Tag } from "lucide-react";
import { parseNFeXml } from "@/lib/nfe-xml";
import { useAuth } from "@/lib/auth-context";

const round = (v: number, d = 2) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

type Rounding = "none" | "99" | "90" | "49" | "int";
function applyRounding(v: number, r: Rounding): number {
  if (!isFinite(v) || v <= 0) return v;
  if (r === "none") return round(v, 2);
  if (r === "int") return Math.round(v);
  const base = Math.floor(v);
  const tail = r === "99" ? 0.99 : r === "90" ? 0.90 : 0.49;
  const cand = base + tail;
  return cand >= v ? cand : base + 1 + tail;
}

export const Route = createFileRoute("/_app/compras")({
  component: Compras,
  head: () => ({ meta: [{ title: "Compras e notas — Gestor MiniMarket" }, { name: "description", content: "Entrada de mercadorias e notas fiscais." }] }),
});

function Compras() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const sb: any = supabase;
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState("itens");
  const [nfe, setNfe] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [numeroNota, setNumeroNota] = useState("");
  const [dataEntrada, setDataEntrada] = useState<string>(new Date().toISOString().slice(0, 10));
  const [valorFrete, setValorFrete] = useState(0);
  const [valorDespesas, setValorDespesas] = useState(0);
  const [obs, setObs] = useState("");
  const [xmlText, setXmlText] = useState<string>("");
  const [bulkMarkup, setBulkMarkup] = useState<number>(40);
  const [bulkMargem, setBulkMargem] = useState<number>(30);
  const [bulkRounding, setBulkRounding] = useState<Rounding>("99");

  const { data: compras } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => (await sb.from("purchases").select("id, numero_nota, data_entrada, valor_total, origem, status, suppliers:fornecedor_id(razao_social)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { data: fornecedores } = useQuery({ queryKey: ["suppliers-lite"], queryFn: async () => (await sb.from("suppliers").select("id, razao_social, cnpj")).data ?? [] });

  function reset() {
    setNfe(null); setItems([]); setFornecedorId(""); setNumeroNota("");
    setValorFrete(0); setValorDespesas(0); setObs(""); setXmlText("");
    setEditingId(null); setTab("itens"); setDataEntrada(new Date().toISOString().slice(0, 10));
  }

  async function handleXml(f: File) {
    try {
      const text = await f.text();
      setXmlText(text);
      const parsed = parseNFeXml(text);
      setNfe(parsed);
      setNumeroNota(parsed.numero ?? "");
      setValorFrete(parsed.valor_frete ?? 0);
      if (parsed.fornecedor_cnpj) {
        const { data: sup } = await sb.from("suppliers").select("id").eq("cnpj", parsed.fornecedor_cnpj).maybeSingle();
        if (sup) setFornecedorId(sup.id);
        else {
          const { data: novo } = await sb.from("suppliers").insert({ razao_social: parsed.fornecedor_nome ?? "Fornecedor NF-e", cnpj: parsed.fornecedor_cnpj }).select("id").single();
          if (novo) { setFornecedorId(novo.id); qc.invalidateQueries({ queryKey: ["suppliers-lite"] }); }
        }
      }
      const novos = await Promise.all((parsed.itens ?? []).map(async (it: any) => {
        let precoAtual: number | null = null;
        if (it.codigo_barras) {
          const { data: p } = await sb.from("products").select("preco_venda").eq("codigo_barras", it.codigo_barras).maybeSingle();
          if (p) precoAtual = Number(p.preco_venda);
        }
        return {
          codigo_barras: it.codigo_barras ?? "", descricao: it.descricao ?? "",
          quantidade: it.quantidade ?? 0, valor_unitario: it.valor_unitario ?? 0,
          valor_total: it.valor_total ?? 0, unidade: it.unidade ?? "UN",
          lote: "", validade: "", markup: 40, rounding: "99" as Rounding,
          atualiza_preco: true, preco_atual: precoAtual, preco_manual: null,
        };
      }));
      setItems(novos);
      toast.success(`NF-e carregada: ${parsed.itens?.length ?? 0} itens`);
    } catch (e: any) { toast.error("Erro ao ler XML: " + e.message); }
  }

  function addItemManual() {
    setItems([...items, { codigo_barras: "", descricao: "", quantidade: 1, valor_unitario: 0, valor_total: 0, unidade: "UN", lote: "", validade: "", markup: 40, rounding: "99" as Rounding, atualiza_preco: false, preco_atual: null, preco_manual: null }]);
  }

  function updateItem(i: number, k: string, v: any) {
    const next = [...items];
    next[i] = { ...next[i], [k]: v };
    if (k === "quantidade" || k === "valor_unitario") next[i].valor_total = round(Number(next[i].quantidade) * Number(next[i].valor_unitario), 2);
    setItems(next);
  }

  const totalProdutos = items.reduce((a, x) => a + Number(x.valor_total || 0), 0);
  const totalNota = totalProdutos + Number(valorFrete || 0) + Number(valorDespesas || 0);
  const rateioBase = totalProdutos || 1;

  const precos = useMemo(() => items.map((it) => {
    const freteRat = round((Number(it.valor_total || 0) / rateioBase) * Number(valorFrete || 0), 4);
    const despRat = round((Number(it.valor_total || 0) / rateioBase) * Number(valorDespesas || 0), 4);
    const custoTotalUnit = round((Number(it.valor_total || 0) + freteRat + despRat) / Math.max(Number(it.quantidade || 1), 0.0001), 4);
    let precoSug: number;
    if (it.preco_manual != null && Number(it.preco_manual) > 0) precoSug = Number(it.preco_manual);
    else precoSug = applyRounding(custoTotalUnit * (1 + Number(it.markup || 0) / 100), it.rounding);
    const lucroUnit = precoSug - custoTotalUnit;
    const margemReal = precoSug > 0 ? (lucroUnit / precoSug) * 100 : 0;
    const markupReal = custoTotalUnit > 0 ? (lucroUnit / custoTotalUnit) * 100 : 0;
    const diffAtual = it.preco_atual != null ? precoSug - Number(it.preco_atual) : null;
    const diffPct = it.preco_atual && Number(it.preco_atual) > 0 ? (diffAtual! / Number(it.preco_atual)) * 100 : null;
    return { custoTotalUnit, precoSug, lucroUnit, margemReal, markupReal, diffAtual, diffPct, freteRat, despRat };
  }), [items, valorFrete, valorDespesas, rateioBase]);

  function applyBulkMarkup() {
    setItems(items.map((it) => ({ ...it, markup: bulkMarkup, rounding: bulkRounding, preco_manual: null, atualiza_preco: true })));
    toast.success(`Markup ${bulkMarkup}% aplicado em todos`);
  }
  function applyBulkMargem() {
    // preço = custo / (1 - m/100); convert to markup per item
    setItems(items.map((it, i) => {
      const c = precos[i].custoTotalUnit;
      const p = c / (1 - bulkMargem / 100);
      const mk = c > 0 ? ((p / c) - 1) * 100 : 0;
      return { ...it, markup: round(mk, 2), rounding: bulkRounding, preco_manual: null, atualiza_preco: true };
    }));
    toast.success(`Margem ${bulkMargem}% aplicada em todos`);
  }

  async function reverseStockOf(purchaseId: string) {
    const { data: its } = await sb.from("purchase_items").select("product_id, quantidade, custo_total_unitario").eq("purchase_id", purchaseId);
    for (const it of its ?? []) {
      if (it.product_id) {
        await sb.rpc("apply_stock_movement", {
          _product_id: it.product_id, _tipo: "devolucao_fornecedor",
          _quantidade: -Math.abs(Number(it.quantidade)), _custo: it.custo_total_unitario,
          _motivo: "Reversão de compra", _documento_ref: purchaseId,
        });
      }
    }
    await sb.from("purchase_items").delete().eq("purchase_id", purchaseId);
  }

  async function loadForEdit(c: any) {
    const { data: full } = await sb.from("purchases").select("*, purchase_items(*)").eq("id", c.id).single();
    if (!full) return toast.error("Compra não encontrada");
    setEditingId(c.id);
    setFornecedorId(full.fornecedor_id ?? "");
    setNumeroNota(full.numero_nota ?? "");
    setDataEntrada(full.data_entrada);
    setValorFrete(Number(full.valor_frete ?? 0));
    setValorDespesas(Number(full.valor_despesas ?? 0));
    setObs(full.observacoes ?? "");
    setXmlText(full.xml_raw ?? "");
    const its = await Promise.all((full.purchase_items ?? []).map(async (it: any) => {
      let precoAtual: number | null = null;
      if (it.codigo_barras) {
        const { data: p } = await sb.from("products").select("preco_venda").eq("codigo_barras", it.codigo_barras).maybeSingle();
        if (p) precoAtual = Number(p.preco_venda);
      }
      return {
        codigo_barras: it.codigo_barras ?? "", descricao: it.descricao ?? "",
        quantidade: Number(it.quantidade), valor_unitario: Number(it.valor_unitario),
        valor_total: Number(it.valor_total), unidade: it.unidade ?? "UN",
        lote: it.lote ?? "", validade: it.validade ?? "",
        markup: 40, rounding: "99" as Rounding, atualiza_preco: it.atualiza_preco,
        preco_atual: precoAtual, preco_manual: it.preco_venda_sugerido ? Number(it.preco_venda_sugerido) : null,
      };
    }));
    setItems(its);
    setOpen(true);
  }

  async function save() {
    if (!items.length) return toast.error("Adicione ao menos um item");

    // If editing, reverse and delete the old purchase items first (keep header, we'll update it)
    let purchaseId: string;
    if (editingId) {
      await reverseStockOf(editingId);
      const { error } = await sb.from("purchases").update({
        fornecedor_id: fornecedorId || null, numero_nota: numeroNota || null,
        data_entrada: dataEntrada,
        valor_produtos: totalProdutos, valor_frete: valorFrete, valor_despesas: valorDespesas,
        valor_total: totalNota, observacoes: obs,
      }).eq("id", editingId);
      if (error) return toast.error(error.message);
      purchaseId = editingId;
    } else {
      const { data: pRow, error: pErr } = await sb.from("purchases").insert({
        fornecedor_id: fornecedorId || null, numero_nota: numeroNota || null, chave_acesso: nfe?.chave ?? null,
        data_emissao: nfe?.data_emissao ?? null, data_entrada: dataEntrada,
        valor_produtos: totalProdutos, valor_frete: valorFrete, valor_despesas: valorDespesas,
        valor_total: totalNota, xml_raw: xmlText || null, origem: nfe ? "xml_nfe" : "manual",
        observacoes: obs, user_id: user?.id,
      }).select("id").single();
      if (pErr) return toast.error(pErr.message);
      purchaseId = pRow.id;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const p = precos[i];
      let productId: string | null = null;
      if (it.codigo_barras) {
        const { data: pFound } = await sb.from("products").select("id, estoque_atual, custo_medio, preco_venda").eq("codigo_barras", it.codigo_barras).maybeSingle();
        if (pFound) {
          productId = pFound.id;
          const atual = Number(pFound.estoque_atual);
          const custoAnt = Number(pFound.custo_medio);
          const qtd = Number(it.quantidade);
          const novoMedio = (atual + qtd) > 0 ? round((atual * custoAnt + qtd * p.custoTotalUnit) / (atual + qtd), 4) : p.custoTotalUnit;
          const update: any = { custo_ultima_compra: p.custoTotalUnit, custo_medio: novoMedio };
          if (it.atualiza_preco && p.precoSug) update.preco_venda = p.precoSug;
          await sb.from("products").update(update).eq("id", productId);
          await sb.from("cost_history").insert({
            product_id: productId, custo_anterior: custoAnt, custo_novo: novoMedio,
            tipo: "compra", documento_ref: numeroNota ? `NF ${numeroNota}` : "Compra",
          });
          if (it.atualiza_preco && p.precoSug) {
            await sb.from("price_history").insert({
              product_id: productId, preco_anterior: Number(pFound.preco_venda ?? 0), preco_novo: p.precoSug,
              user_id: user?.id ?? null,
              motivo: `Lançamento de nota${numeroNota ? ` NF ${numeroNota}` : ""} — custo ${p.custoTotalUnit.toFixed(2)}`,
            });
          }
        } else {

          const { data: novo } = await sb.from("products").insert({
            codigo_barras: it.codigo_barras, nome: it.descricao || `Produto ${it.codigo_barras}`,
            unidade_medida: it.unidade, custo_ultima_compra: p.custoTotalUnit, custo_medio: p.custoTotalUnit,
            preco_venda: p.precoSug ?? 0, estoque_atual: 0, fornecedor_id: fornecedorId || null,
          }).select("id").single();
          productId = novo?.id ?? null;
        }
      }
      await sb.from("purchase_items").insert({
        purchase_id: purchaseId, product_id: productId, codigo_barras: it.codigo_barras || null,
        descricao: it.descricao, quantidade: it.quantidade, unidade: it.unidade,
        valor_unitario: it.valor_unitario, valor_total: it.valor_total,
        frete_rateado: p.freteRat, despesa_rateada: p.despRat, custo_total_unitario: p.custoTotalUnit,
        preco_venda_sugerido: p.precoSug, atualiza_preco: it.atualiza_preco,
        lote: it.lote || null, validade: it.validade || null,
      });
      if (productId) {
        await sb.rpc("apply_stock_movement", {
          _product_id: productId, _tipo: "entrada_compra", _quantidade: Number(it.quantidade),
          _custo: p.custoTotalUnit, _motivo: `Compra${numeroNota ? ` NF ${numeroNota}` : ""}`, _documento_ref: purchaseId,
        });
      }
    }
    toast.success(editingId ? "Compra atualizada" : "Nota lançada com sucesso");
    setOpen(false); reset(); qc.invalidateQueries();
  }

  async function removePurchase(c: any) {
    if (!confirm(`Excluir a compra ${c.numero_nota ?? c.id.slice(0, 8)}? O estoque será revertido.`)) return;
    await reverseStockOf(c.id);
    const { error } = await sb.from("purchases").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Compra excluída e estoque revertido");
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-2xl font-bold">Compras e notas fiscais</h1><p className="text-sm text-muted-foreground">Entrada de mercadorias com formação de preços</p></div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button><Package className="h-4 w-4 mr-2" />Lançar entrada</Button></DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Editar entrada" : "Nova entrada de mercadorias"}</DialogTitle></DialogHeader>

            <div className="space-y-4">
              {!editingId && (
                <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Importar XML de NF-e (opcional)</CardTitle></CardHeader>
                  <CardContent><Input type="file" accept=".xml" onChange={(e) => e.target.files && handleXml(e.target.files[0])} /></CardContent>
                </Card>
              )}

              {nfe && (
                <Alert><FileText className="h-4 w-4" /><AlertDescription>
                  <strong>NF-e:</strong> Nº {nfe.numero} · {nfe.fornecedor_nome} ({nfe.fornecedor_cnpj}) · Emissão {nfe.data_emissao ? formatDate(nfe.data_emissao) : "?"}
                </AlertDescription></Alert>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <div><Label>Fornecedor</Label>
                  <Select value={fornecedorId || "none"} onValueChange={(v) => setFornecedorId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">—</SelectItem>{fornecedores?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.razao_social}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Nº da nota</Label><Input value={numeroNota} onChange={(e) => setNumeroNota(e.target.value)} /></div>
                <div><Label>Data de entrada</Label><Input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} /></div>
                <div><Label>Frete (R$)</Label><Input type="number" step="0.01" value={valorFrete} onChange={(e) => setValorFrete(Number(e.target.value))} /></div>
                <div><Label>Outras despesas (R$)</Label><Input type="number" step="0.01" value={valorDespesas} onChange={(e) => setValorDespesas(Number(e.target.value))} /></div>
                <div><Label>Observações</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} /></div>
              </div>

              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="itens"><Package className="h-4 w-4 mr-1" />Itens ({items.length})</TabsTrigger>
                  <TabsTrigger value="precos"><Tag className="h-4 w-4 mr-1" />Preços e margem</TabsTrigger>
                </TabsList>

                <TabsContent value="itens" className="space-y-3">
                  <div className="flex justify-end"><Button size="sm" variant="outline" onClick={addItemManual}>+ item manual</Button></div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Cód. barras</TableHead><TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Vlr unit</TableHead>
                        <TableHead className="text-right">Total</TableHead><TableHead>Un</TableHead>
                        <TableHead>Lote</TableHead><TableHead>Validade</TableHead><TableHead></TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {items.map((it, i) => (
                          <TableRow key={i}>
                            <TableCell><Input className="w-32 h-8" value={it.codigo_barras} onChange={(e) => updateItem(i, "codigo_barras", e.target.value)} /></TableCell>
                            <TableCell><Input className="w-56 h-8" value={it.descricao} onChange={(e) => updateItem(i, "descricao", e.target.value)} /></TableCell>
                            <TableCell><Input type="number" step="0.001" className="w-20 h-8 text-right" value={it.quantidade} onChange={(e) => updateItem(i, "quantidade", Number(e.target.value))} /></TableCell>
                            <TableCell><Input type="number" step="0.0001" className="w-24 h-8 text-right" value={it.valor_unitario} onChange={(e) => updateItem(i, "valor_unitario", Number(e.target.value))} /></TableCell>
                            <TableCell className="text-right text-xs">{brl(it.valor_total)}</TableCell>
                            <TableCell><Input className="w-14 h-8" value={it.unidade} onChange={(e) => updateItem(i, "unidade", e.target.value)} /></TableCell>
                            <TableCell><Input className="w-20 h-8" value={it.lote} onChange={(e) => updateItem(i, "lote", e.target.value)} /></TableCell>
                            <TableCell><Input type="date" className="w-36 h-8" value={it.validade} onChange={(e) => updateItem(i, "validade", e.target.value)} /></TableCell>
                            <TableCell><Button size="sm" variant="ghost" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="precos" className="space-y-3">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Aplicar em todos</CardTitle></CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-5 items-end">
                      <div><Label className="text-xs">Markup %</Label><Input type="number" step="0.01" value={bulkMarkup} onChange={(e) => setBulkMarkup(Number(e.target.value))} /></div>
                      <Button size="sm" variant="secondary" onClick={applyBulkMarkup}>Aplicar markup</Button>
                      <div><Label className="text-xs">Margem %</Label><Input type="number" step="0.01" value={bulkMargem} onChange={(e) => setBulkMargem(Number(e.target.value))} /></div>
                      <Button size="sm" variant="secondary" onClick={applyBulkMargem}>Aplicar margem</Button>
                      <div><Label className="text-xs">Arredondar</Label>
                        <Select value={bulkRounding} onValueChange={(v) => setBulkRounding(v as Rounding)}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem arredondamento</SelectItem>
                            <SelectItem value="99">R$ 0,99</SelectItem>
                            <SelectItem value="90">R$ 0,90</SelectItem>
                            <SelectItem value="49">R$ 0,49</SelectItem>
                            <SelectItem value="int">Inteiro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Custo total</TableHead>
                        <TableHead className="text-right">Markup %</TableHead>
                        <TableHead>Arredondar</TableHead>
                        <TableHead className="text-right">Preço manual</TableHead>
                        <TableHead className="text-right">Preço sugerido</TableHead>
                        <TableHead className="text-right">Lucro unit</TableHead>
                        <TableHead className="text-right">Margem real</TableHead>
                        <TableHead className="text-right">Preço atual</TableHead>
                        <TableHead className="text-right">Δ</TableHead>
                        <TableHead>Atualizar</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {items.map((it, i) => {
                          const p = precos[i];
                          return (
                            <TableRow key={i}>
                              <TableCell className="text-xs max-w-[180px] truncate">{it.descricao || it.codigo_barras || "—"}</TableCell>
                              <TableCell className="text-right text-xs">{brl(p.custoTotalUnit)}</TableCell>
                              <TableCell><Input type="number" step="0.01" className="w-20 h-8 text-right" value={it.markup} onChange={(e) => updateItem(i, "markup", Number(e.target.value))} /></TableCell>
                              <TableCell>
                                <Select value={it.rounding} onValueChange={(v) => updateItem(i, "rounding", v)}>
                                  <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
                                    <SelectItem value="99">,99</SelectItem>
                                    <SelectItem value="90">,90</SelectItem>
                                    <SelectItem value="49">,49</SelectItem>
                                    <SelectItem value="int">Int</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell><Input type="number" step="0.01" className="w-24 h-8 text-right" value={it.preco_manual ?? ""} onChange={(e) => updateItem(i, "preco_manual", e.target.value ? Number(e.target.value) : null)} /></TableCell>
                              <TableCell className="text-right font-semibold text-green-700">{brl(p.precoSug)}</TableCell>
                              <TableCell className="text-right text-xs">{brl(p.lucroUnit)}</TableCell>
                              <TableCell className="text-right text-xs">{p.margemReal.toFixed(1)}%</TableCell>
                              <TableCell className="text-right text-xs">{it.preco_atual != null ? brl(it.preco_atual) : "—"}</TableCell>
                              <TableCell className={"text-right text-xs " + (p.diffAtual == null ? "" : p.diffAtual > 0 ? "text-green-600" : p.diffAtual < 0 ? "text-red-600" : "")}>
                                {p.diffAtual == null ? "—" : `${p.diffAtual > 0 ? "+" : ""}${brl(p.diffAtual)}${p.diffPct != null ? ` (${p.diffPct.toFixed(1)}%)` : ""}`}
                              </TableCell>
                              <TableCell><input type="checkbox" checked={it.atualiza_preco} onChange={(e) => updateItem(i, "atualiza_preco", e.target.checked)} /></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="text-right text-sm space-y-1 pt-2 border-t">
                <div>Produtos: <strong>{brl(totalProdutos)}</strong></div>
                <div>Frete: {brl(valorFrete)} · Despesas: {brl(valorDespesas)}</div>
                <div className="text-lg">Total da nota: <strong>{brl(totalNota)}</strong></div>
              </div>
            </div>
            <DialogFooter><Button onClick={save} disabled={!items.length}><Upload className="h-4 w-4 mr-2" />{editingId ? "Salvar alterações" : "Confirmar entrada"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Últimas entradas</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Fornecedor</TableHead><TableHead>Nº nota</TableHead><TableHead>Origem</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(!compras || compras.length === 0) && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma entrada registrada</TableCell></TableRow>}
              {compras?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{formatDate(c.data_entrada)}</TableCell>
                  <TableCell>{c.suppliers?.razao_social ?? "—"}</TableCell>
                  <TableCell>{c.numero_nota ?? "—"}</TableCell>
                  <TableCell><span className="text-xs px-2 py-1 rounded bg-muted">{c.origem}</span></TableCell>
                  <TableCell className="text-right font-medium">{brl(c.valor_total)}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => loadForEdit(c)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => removePurchase(c)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
