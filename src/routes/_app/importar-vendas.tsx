import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo, useState } from "react";
import { readSpreadsheet, downloadXLSX, matchColumn, parsePastedData } from "@/lib/xlsx-utils";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store-context";
import { brl, num, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Download, Upload, CheckCircle2, AlertCircle, Undo2, ClipboardPaste } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_app/importar-vendas")({
  component: ImportarVendas,
  head: () => ({ meta: [{ title: "Importar vendas — Gestor MiniMarket" }, { name: "description", content: "Importe planilhas diárias de vendas." }] }),
});

function ImportarVendas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const sb: any = supabase;
  const [rows, setRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [pasted, setPasted] = useState("");

  const { data: batches } = useQuery({
    queryKey: ["import-batches-vendas"],
    queryFn: async () => (await sb.from("import_batches").select("id, arquivo_nome, status, registros_total, registros_ok, registros_erro, registros_duplicados, created_at").eq("tipo", "vendas").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  function autoMap(hdrs: string[]) {
    setMapping({
      data: matchColumn(hdrs, ["data", "data_venda", "data venda", "date", "dt", "dt_venda", "data emissao", "data da venda", "emissao", "data hora", "datahora"]) ?? "",
      hora: matchColumn(hdrs, ["hora", "time", "horario", "hr"]) ?? "",
      codigo_barras: matchColumn(hdrs, ["codigo de barras", "codigo_barras", "cod barras", "cod_barras", "ean", "gtin", "codigo ean", "barras", "cod_ean", "codbarras"]) ?? "",
      codigo_interno: matchColumn(hdrs, ["codigo do produto", "codigo produto", "codigo_produto", "codigo interno", "codigo_interno", "cod produto", "cod_produto", "codprod", "sku", "codigo", "cod"]) ?? "",
      nome: matchColumn(hdrs, ["produto", "nome", "descricao", "descrição", "nome_produto", "desc_produto", "desc", "item", "mercadoria"]) ?? "",
      quantidade: matchColumn(hdrs, ["quantidade", "qtd", "qtde", "qte", "qt", "quant", "qtd_vendida", "quantidade vendida"]) ?? "",
      preco_unitario: matchColumn(hdrs, ["preco unitario", "preço unitário", "valor unitario", "valor unitário", "preco", "preço", "vlr_unit", "vl_unit", "pr_unit", "preco_unit", "unitario"]) ?? "",
      valor_total: matchColumn(hdrs, ["valor total", "total", "valor", "vlr_total", "vl_total", "total_venda", "valor_venda", "subtotal", "vlr"]) ?? "",
      forma_pagamento: matchColumn(hdrs, ["forma pagamento", "forma de pagamento", "pagamento", "fpagto", "meio_pagamento", "forma_pag", "tipo_pagamento"]) ?? "",
      codigo_venda: matchColumn(hdrs, ["codigo venda", "codigo_venda", "cupom", "numero venda", "transacao", "transação", "num_venda", "nr_venda", "ncupom", "num_cupom", "cupom_fiscal", "id_venda"]) ?? "",
      operador: matchColumn(hdrs, ["operador", "maquina", "máquina", "cliente", "local", "loja", "vendedor", "caixa", "pdv"]) ?? "",
    });
  }

  async function handleFile(f: File) {
    try {
      const { headers, rows } = await readSpreadsheet(f);
      setHeaders(headers); setRows(rows); setReport(null); setFileName(f.name);
      autoMap(headers);
      if (!rows.length) toast.warning("Nenhuma linha detectada no arquivo");
    } catch (e: any) { toast.error("Erro ao ler: " + e.message); }
  }

  function handlePaste() {
    try {
      const { headers, rows } = parsePastedData(pasted);
      if (!rows.length) return toast.error("Nada para importar. Cole com a primeira linha sendo os títulos das colunas.");
      setHeaders(headers); setRows(rows); setReport(null); setFileName("(colado)");
      autoMap(headers);
      toast.success(`${rows.length} linhas carregadas`);
    } catch (e: any) { toast.error("Erro ao processar: " + e.message); }
  }

  const preview = useMemo(() => rows.slice(0, 5), [rows]);

  function parseDate(v: any, hora?: any): string {
    let base = new Date();
    if (v) {
      if (v instanceof Date) base = v;
      else {
        const s = String(v).trim();
        // "28/07/2026 20:22" or "28/07/2026 20:22:33"
        const md = s.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (md) {
          const [, dd, mm, yyyy, hh, mi, ss] = md;
          base = new Date(`${yyyy}-${mm}-${dd}T${(hh ?? "00").padStart(2, "0")}:${mi ?? "00"}:${ss ?? "00"}`);
        } else { const d = new Date(s); if (!isNaN(d.getTime())) base = d; }
      }
    }
    if (hora) {
      const hm = String(hora).match(/(\d{1,2}):(\d{2})/);
      if (hm) { base.setHours(Number(hm[1])); base.setMinutes(Number(hm[2])); }
    }
    return base.toISOString();
  }

  async function runImport() {
    if (!rows.length) return toast.error("Nenhum dado carregado");
    if (!mapping.codigo_barras && !mapping.codigo_interno && !mapping.nome) {
      return toast.error("Mapeie ao menos um identificador de produto: código de barras, código do produto ou nome");
    }
    if (!mapping.quantidade) return toast.error("Mapeie a quantidade");
    setImporting(true);
    const erros: string[] = [];
    let ok = 0, duplicados = 0, semProduto = 0;
    let faturamento = 0, lucro = 0;

    const { data: batchRow } = await sb.from("import_batches").insert({
      tipo: "vendas", arquivo_nome: fileName, user_id: user?.id, registros_total: rows.length, status: "processando",
    }).select("id").single();
    const batchId = batchRow?.id;

    for (const r of rows) {
      try {
        const cb = mapping.codigo_barras ? String(r[mapping.codigo_barras] ?? "").trim() : "";
        const ci = mapping.codigo_interno ? String(r[mapping.codigo_interno] ?? "").trim() : "";
        const nomeProd = mapping.nome ? String(r[mapping.nome] ?? "").trim() : "";
        if (!cb && !ci && !nomeProd) { erros.push("Sem identificador de produto"); continue; }

        const qtd = Number(String(r[mapping.quantidade] ?? "0").replace(",", "."));
        if (!qtd || !isFinite(qtd)) { erros.push(`Quantidade inválida (${nomeProd || ci || cb})`); continue; }
        const preco = mapping.preco_unitario ? Number(String(r[mapping.preco_unitario] ?? "0").replace(",", ".")) : 0;
        const valorTot = mapping.valor_total ? Number(String(r[mapping.valor_total] ?? "0").replace(",", ".")) : (preco * qtd);
        const dataVenda = parseDate(mapping.data ? r[mapping.data] : null, mapping.hora ? r[mapping.hora] : null);
        const codVenda = mapping.codigo_venda ? String(r[mapping.codigo_venda] ?? "") : null;
        const forma = mapping.forma_pagamento ? String(r[mapping.forma_pagamento] ?? "") : null;
        const operador = mapping.operador ? String(r[mapping.operador] ?? "") : null;

        const hash = `${codVenda ?? ""}|${cb || ci || nomeProd}|${qtd}|${valorTot}|${dataVenda}`;
        const { data: dup } = await sb.from("sales").select("id").eq("hash_dedupe", hash).eq("store_id", storeId!).maybeSingle();
        if (dup) { duplicados++; continue; }

        // Look up product: by barcode, internal code, or name
        let prod: any = null;
        if (cb) {
          const { data } = await sb.from("products").select("id, custo_medio, nome, codigo_barras").eq("codigo_barras", cb).eq("store_id", storeId!).maybeSingle();
          prod = data;
        }
        if (!prod && ci) {
          const { data } = await sb.from("products").select("id, custo_medio, nome, codigo_barras").eq("codigo_interno", ci).eq("store_id", storeId!).maybeSingle();
          prod = data;
        }
        if (!prod && nomeProd) {
          const { data } = await sb.from("products").select("id, custo_medio, nome, codigo_barras").ilike("nome", nomeProd).eq("store_id", storeId!).maybeSingle();
          prod = data;
        }

        let productId: string | null = prod?.id ?? null;
        const custoUnit = prod ? Number(prod.custo_medio) : 0;
        if (!prod) {
          const { data: novo, error: novoErr } = await sb.from("products").insert({
            codigo_barras: cb || null,
            codigo_interno: ci || null,
            nome: nomeProd || `[Pendente] ${ci || cb}`,
            preco_venda: preco,
            pendente_revisao: true,
            ativo: true,
            store_id: storeId,
          }).select("id").single();
          if (novoErr) throw novoErr;
          productId = novo?.id ?? null;
          semProduto++;
        }

        const lucroBruto = (preco - custoUnit) * qtd;
        faturamento += valorTot;
        lucro += lucroBruto;

        const { data: saleRow, error: saleErr } = await sb.from("sales").insert({
          codigo_venda: codVenda, data_venda: dataVenda, forma_pagamento: forma, operador,
          valor_bruto: valorTot, valor_total: valorTot, custo_total: custoUnit * qtd,
          lucro_bruto: lucroBruto, hash_dedupe: hash, import_batch_id: batchId, store_id: storeId,
        }).select("id").single();
        if (saleErr) throw saleErr;

        await sb.from("sale_items").insert({
          sale_id: saleRow.id, product_id: productId, codigo_barras: cb || prod?.codigo_barras || null,
          descricao: prod?.nome ?? nomeProd ?? null, quantidade: qtd, preco_unitario: preco,
          valor_total: valorTot, custo_unitario: custoUnit, lucro: lucroBruto,
        });

        if (productId) {
          await sb.rpc("apply_stock_movement", {
            _product_id: productId, _tipo: "saida_venda", _quantidade: -Math.abs(qtd),
            _custo: custoUnit || null, _motivo: `Venda importada${codVenda ? ` (cupom ${codVenda})` : ""}`, _documento_ref: batchId,
          });
        }
        ok++;
      } catch (e: any) { erros.push(e.message ?? "Erro"); }
    }

    if (batchId) await sb.from("import_batches").update({
      status: erros.length ? "concluido_com_erros" : "concluido",
      registros_ok: ok, registros_erro: erros.length, registros_duplicados: duplicados,
      erros: erros.slice(0, 200),
    }).eq("id", batchId);

    setReport({ ok, duplicados, semProduto, erros, faturamento, lucro });
    setImporting(false);
    qc.invalidateQueries();
    toast.success(`${ok} vendas importadas`);
  }


  async function undoBatch(id: string) {
    if (!confirm("Desfazer esta importação? Vendas e movimentações de estoque relacionadas serão revertidas.")) return;
    const { data: sales } = await sb.from("sales").select("id").eq("import_batch_id", id);
    for (const s of sales ?? []) {
      const { data: items } = await sb.from("sale_items").select("product_id, quantidade").eq("sale_id", s.id);
      for (const it of items ?? []) {
        if (it.product_id) {
          await sb.rpc("apply_stock_movement", {
            _product_id: it.product_id, _tipo: "cancelamento_venda", _quantidade: Math.abs(Number(it.quantidade)),
            _custo: null, _motivo: "Reversão de importação", _documento_ref: id,
          });
        }
      }
    }
    await sb.from("sales").delete().eq("import_batch_id", id);
    await sb.from("import_batches").update({ status: "revertido" }).eq("id", id);
    toast.success("Importação revertida");
    qc.invalidateQueries();
  }

  function downloadModelo() {
    downloadXLSX("modelo_vendas.xlsx", [
      { data: "24/07/2026", hora: "10:15", codigo_venda: "CUPOM001", codigo_barras: "7891234567890", produto: "Arroz 5kg", quantidade: 1, preco_unitario: 29.90, valor_total: 29.90, forma_pagamento: "Débito" },
      { data: "24/07/2026", hora: "10:20", codigo_venda: "CUPOM002", codigo_barras: "7891234567891", produto: "Feijão 1kg", quantidade: 2, preco_unitario: 8.99, valor_total: 17.98, forma_pagamento: "Pix" },
    ]);
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-2xl font-bold">Importar vendas</h1><p className="text-sm text-muted-foreground">Envie a planilha diária de vendas</p></div>
        <Button variant="outline" onClick={downloadModelo}><Download className="h-4 w-4 mr-2" />Baixar modelo</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Arquivo</CardTitle></CardHeader>
        <CardContent><Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files && handleFile(e.target.files[0])} /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardPaste className="h-4 w-4" />Colar dados</CardTitle>
          <p className="text-xs text-muted-foreground">Copie do Excel/Google Sheets e cole aqui. A 1ª linha deve conter os títulos das colunas. Aceita TAB, ponto-e-vírgula ou vírgula.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="data	hora	codigo_barras	produto	quantidade	preco_unitario	valor_total&#10;24/07/2026	10:15	7891234567890	Arroz 5kg	1	29,90	29,90" className="font-mono text-xs" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPasted("")}>Limpar</Button>
            <Button size="sm" onClick={handlePaste} disabled={!pasted.trim()}><ClipboardPaste className="h-4 w-4 mr-2" />Processar colagem</Button>
          </div>
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Mapeamento</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {["data", "hora", "codigo_barras", "codigo_interno", "nome", "quantidade", "preco_unitario", "valor_total", "forma_pagamento", "codigo_venda", "operador"].map((f) => (
              <div key={f}><Label className="capitalize">{f.replace(/_/g, " ")}</Label>
                <Select value={mapping[f] || "none"} onValueChange={(v) => setMapping({ ...mapping, [f]: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">— ignorar —</SelectItem>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {preview.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Prévia ({rows.length} linhas)</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table><TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{preview.map((r, i) => <TableRow key={i}>{headers.map((h) => <TableCell key={h} className="text-xs">{String(r[h] ?? "")}</TableCell>)}</TableRow>)}</TableBody></Table>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="flex justify-end"><Button onClick={runImport} disabled={importing} size="lg"><Upload className="h-4 w-4 mr-2" />{importing ? "Importando..." : `Importar ${rows.length} vendas`}</Button></div>
      )}

      {report && (
        <Alert className={report.erros.length ? "border-yellow-500" : "border-green-500"}>
          {report.erros.length ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <AlertDescription>
            <div><strong>{report.ok}</strong> vendas · <strong>{report.duplicados}</strong> duplicadas · <strong>{report.semProduto}</strong> produtos pendentes · <strong>{report.erros.length}</strong> erros</div>
            <div className="text-sm mt-1">Faturamento: {brl(report.faturamento)} · Lucro bruto: {brl(report.lucro)}</div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader><CardTitle>Histórico de importações</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Arquivo</TableHead><TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">OK</TableHead><TableHead className="text-right">Duplic.</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(!batches || batches.length === 0) && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma importação registrada</TableCell></TableRow>}
              {batches?.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="text-xs">{b.arquivo_nome ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(b.created_at)}</TableCell>
                  <TableCell><span className="text-xs px-2 py-1 rounded bg-muted">{b.status}</span></TableCell>
                  <TableCell className="text-right">{num(b.registros_total)}</TableCell>
                  <TableCell className="text-right">{num(b.registros_ok)}</TableCell>
                  <TableCell className="text-right">{num(b.registros_duplicados)}</TableCell>
                  <TableCell>{b.status !== "revertido" && <Button size="sm" variant="ghost" onClick={() => undoBatch(b.id)}><Undo2 className="h-3 w-3 mr-1" />Desfazer</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
