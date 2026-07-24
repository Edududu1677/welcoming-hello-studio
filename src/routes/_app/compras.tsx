import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { brl, formatDate } from "@/lib/format";
import { Upload, FileText, Trash2, Package } from "lucide-react";
import { parseNFeXml } from "@/lib/nfe-xml";
import { useAuth } from "@/lib/auth-context";
import { round } from "@/lib/format";

export const Route = createFileRoute("/_app/compras")({
  component: Compras,
  head: () => ({ meta: [{ title: "Compras e notas — Gestor MiniMarket" }, { name: "description", content: "Entrada de mercadorias e notas fiscais." }] }),
});

function Compras() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const sb: any = supabase;
  const [open, setOpen] = useState(false);
  const [nfe, setNfe] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [numeroNota, setNumeroNota] = useState("");
  const [valorFrete, setValorFrete] = useState(0);
  const [valorDespesas, setValorDespesas] = useState(0);
  const [obs, setObs] = useState("");
  const [xmlText, setXmlText] = useState<string>("");

  const { data: compras } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => (await sb.from("purchases").select("id, numero_nota, data_entrada, valor_total, origem, status, suppliers:fornecedor_id(razao_social)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { data: fornecedores } = useQuery({ queryKey: ["suppliers-lite"], queryFn: async () => (await sb.from("suppliers").select("id, razao_social, cnpj")).data ?? [] });

  function reset() {
    setNfe(null); setItems([]); setFornecedorId(""); setNumeroNota("");
    setValorFrete(0); setValorDespesas(0); setObs(""); setXmlText("");
  }

  async function handleXml(f: File) {
    try {
      const text = await f.text();
      setXmlText(text);
      const parsed = parseNFeXml(text);
      setNfe(parsed);
      setNumeroNota(parsed.numero ?? "");
      setValorFrete(parsed.frete ?? 0);
      // Try find supplier by CNPJ
      if (parsed.cnpj) {
        const { data: sup } = await sb.from("suppliers").select("id").eq("cnpj", parsed.cnpj).maybeSingle();
        if (sup) setFornecedorId(sup.id);
        else {
          // Auto-create supplier
          const { data: novo } = await sb.from("suppliers").insert({ razao_social: parsed.fornecedor ?? "Fornecedor NF-e", cnpj: parsed.cnpj }).select("id").single();
          if (novo) { setFornecedorId(novo.id); qc.invalidateQueries({ queryKey: ["suppliers-lite"] }); }
        }
      }
      setItems((parsed.itens ?? []).map((it: any) => ({
        codigo_barras: it.codigo_barras ?? "", descricao: it.descricao ?? "",
        quantidade: it.quantidade ?? 0, valor_unitario: it.valor_unitario ?? 0,
        valor_total: it.valor_total ?? 0, unidade: it.unidade ?? "UN",
        lote: "", validade: "", markup: 40, atualiza_preco: true,
      })));
      toast.success(`NF-e carregada: ${parsed.itens?.length ?? 0} itens`);
    } catch (e: any) { toast.error("Erro ao ler XML: " + e.message); }
  }

  function addItemManual() {
    setItems([...items, { codigo_barras: "", descricao: "", quantidade: 1, valor_unitario: 0, valor_total: 0, unidade: "UN", lote: "", validade: "", markup: 40, atualiza_preco: false }]);
  }

  function updateItem(i: number, k: string, v: any) {
    const next = [...items];
    next[i] = { ...next[i], [k]: v };
    if (k === "quantidade" || k === "valor_unitario") next[i].valor_total = round(Number(next[i].quantidade) * Number(next[i].valor_unitario), 2);
    setItems(next);
  }

  const totalProdutos = items.reduce((a, x) => a + Number(x.valor_total || 0), 0);
  const totalNota = totalProdutos + Number(valorFrete || 0) + Number(valorDespesas || 0);

  async function save() {
    if (!items.length) return toast.error("Adicione ao menos um item");
    const rateioBase = totalProdutos || 1;
    const { data: pRow, error: pErr } = await sb.from("purchases").insert({
      fornecedor_id: fornecedorId || null, numero_nota: numeroNota || null, chave_acesso: nfe?.chave ?? null,
      data_emissao: nfe?.data_emissao ?? null, data_entrada: new Date().toISOString().slice(0, 10),
      valor_produtos: totalProdutos, valor_frete: valorFrete, valor_despesas: valorDespesas,
      valor_total: totalNota, xml_raw: xmlText || null, origem: nfe ? "xml_nfe" : "manual",
      observacoes: obs, user_id: user?.id,
    }).select("id").single();
    if (pErr) return toast.error(pErr.message);

    for (const it of items) {
      const freteRat = round((Number(it.valor_total || 0) / rateioBase) * Number(valorFrete || 0), 4);
      const despRat = round((Number(it.valor_total || 0) / rateioBase) * Number(valorDespesas || 0), 4);
      const custoTotalUnit = round((Number(it.valor_total || 0) + freteRat + despRat) / Math.max(Number(it.quantidade || 1), 0.0001), 4);
      const precoSug = it.markup > 0 ? round(custoTotalUnit * (1 + Number(it.markup) / 100), 2) : null;

      // Find or create product
      let productId: string | null = null;
      if (it.codigo_barras) {
        const { data: pFound } = await sb.from("products").select("id, estoque_atual, custo_medio").eq("codigo_barras", it.codigo_barras).maybeSingle();
        if (pFound) {
          productId = pFound.id;
          const atual = Number(pFound.estoque_atual);
          const custoAnt = Number(pFound.custo_medio);
          const qtd = Number(it.quantidade);
          const novoMedio = (atual + qtd) > 0 ? round((atual * custoAnt + qtd * custoTotalUnit) / (atual + qtd), 4) : custoTotalUnit;
          const update: any = { custo_ultima_compra: custoTotalUnit, custo_medio: novoMedio };
          if (it.atualiza_preco && precoSug) update.preco_venda = precoSug;
          await sb.from("products").update(update).eq("id", productId);
        } else {
          const { data: novo } = await sb.from("products").insert({
            codigo_barras: it.codigo_barras, nome: it.descricao || `Produto ${it.codigo_barras}`,
            unidade_medida: it.unidade, custo_ultima_compra: custoTotalUnit, custo_medio: custoTotalUnit,
            preco_venda: precoSug ?? 0, estoque_atual: 0, fornecedor_id: fornecedorId || null,
          }).select("id").single();
          productId = novo?.id ?? null;
        }
      }
      await sb.from("purchase_items").insert({
        purchase_id: pRow.id, product_id: productId, codigo_barras: it.codigo_barras || null,
        descricao: it.descricao, quantidade: it.quantidade, unidade: it.unidade,
        valor_unitario: it.valor_unitario, valor_total: it.valor_total,
        frete_rateado: freteRat, despesa_rateada: despRat, custo_total_unitario: custoTotalUnit,
        preco_venda_sugerido: precoSug, atualiza_preco: it.atualiza_preco,
        lote: it.lote || null, validade: it.validade || null,
      });
      if (productId) {
        await sb.rpc("apply_stock_movement", {
          _product_id: productId, _tipo: "entrada_compra", _quantidade: Number(it.quantidade),
          _custo: custoTotalUnit, _motivo: `Compra${numeroNota ? ` NF ${numeroNota}` : ""}`, _documento_ref: pRow.id,
        });
      }
    }
    toast.success("Nota lançada com sucesso");
    setOpen(false); reset(); qc.invalidateQueries();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Compras e notas fiscais</h1><p className="text-sm text-muted-foreground">Entrada de mercadorias</p></div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button><Package className="h-4 w-4 mr-2" />Lançar entrada</Button></DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova entrada de mercadorias</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Importar XML de NF-e (opcional)</CardTitle></CardHeader>
                <CardContent><Input type="file" accept=".xml" onChange={(e) => e.target.files && handleXml(e.target.files[0])} /></CardContent>
              </Card>

              {nfe && (
                <Alert><FileText className="h-4 w-4" /><AlertDescription>
                  <strong>NF-e importada:</strong> Nº {nfe.numero} · {nfe.fornecedor} ({nfe.cnpj}) · Emissão {nfe.data_emissao ? formatDate(nfe.data_emissao) : "?"}
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
                <div><Label>Observações</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} /></div>
                <div><Label>Frete (R$)</Label><Input type="number" step="0.01" value={valorFrete} onChange={(e) => setValorFrete(Number(e.target.value))} /></div>
                <div><Label>Outras despesas (R$)</Label><Input type="number" step="0.01" value={valorDespesas} onChange={(e) => setValorDespesas(Number(e.target.value))} /></div>
              </div>

              <div className="flex items-center justify-between">
                <div className="font-semibold">Itens ({items.length})</div>
                <Button size="sm" variant="outline" onClick={addItemManual}>+ item manual</Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Cód. barras</TableHead><TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Vlr unit</TableHead>
                    <TableHead className="text-right">Total</TableHead><TableHead>Lote</TableHead>
                    <TableHead>Validade</TableHead><TableHead className="text-right">Markup %</TableHead>
                    <TableHead>Atualizar preço</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {items.map((it, i) => (
                      <TableRow key={i}>
                        <TableCell><Input className="w-32 h-8" value={it.codigo_barras} onChange={(e) => updateItem(i, "codigo_barras", e.target.value)} /></TableCell>
                        <TableCell><Input className="w-56 h-8" value={it.descricao} onChange={(e) => updateItem(i, "descricao", e.target.value)} /></TableCell>
                        <TableCell><Input type="number" step="0.001" className="w-20 h-8 text-right" value={it.quantidade} onChange={(e) => updateItem(i, "quantidade", Number(e.target.value))} /></TableCell>
                        <TableCell><Input type="number" step="0.0001" className="w-24 h-8 text-right" value={it.valor_unitario} onChange={(e) => updateItem(i, "valor_unitario", Number(e.target.value))} /></TableCell>
                        <TableCell className="text-right text-xs">{brl(it.valor_total)}</TableCell>
                        <TableCell><Input className="w-20 h-8" value={it.lote} onChange={(e) => updateItem(i, "lote", e.target.value)} /></TableCell>
                        <TableCell><Input type="date" className="w-36 h-8" value={it.validade} onChange={(e) => updateItem(i, "validade", e.target.value)} /></TableCell>
                        <TableCell><Input type="number" step="0.01" className="w-20 h-8 text-right" value={it.markup} onChange={(e) => updateItem(i, "markup", Number(e.target.value))} /></TableCell>
                        <TableCell><input type="checkbox" checked={it.atualiza_preco} onChange={(e) => updateItem(i, "atualiza_preco", e.target.checked)} /></TableCell>
                        <TableCell><Button size="sm" variant="ghost" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="text-right text-sm space-y-1 pt-2 border-t">
                <div>Produtos: <strong>{brl(totalProdutos)}</strong></div>
                <div>Frete: {brl(valorFrete)} · Despesas: {brl(valorDespesas)}</div>
                <div className="text-lg">Total da nota: <strong>{brl(totalNota)}</strong></div>
              </div>
            </div>
            <DialogFooter><Button onClick={save} disabled={!items.length}><Upload className="h-4 w-4 mr-2" />Confirmar entrada</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Últimas entradas</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Fornecedor</TableHead><TableHead>Nº nota</TableHead><TableHead>Origem</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
            <TableBody>
              {(!compras || compras.length === 0) && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma entrada registrada</TableCell></TableRow>}
              {compras?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{formatDate(c.data_entrada)}</TableCell>
                  <TableCell>{c.suppliers?.razao_social ?? "—"}</TableCell>
                  <TableCell>{c.numero_nota ?? "—"}</TableCell>
                  <TableCell><span className="text-xs px-2 py-1 rounded bg-muted">{c.origem}</span></TableCell>
                  <TableCell className="text-right font-medium">{brl(c.valor_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
