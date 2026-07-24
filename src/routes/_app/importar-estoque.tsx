import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMemo, useState } from "react";
import { readSpreadsheet, downloadXLSX, matchColumn } from "@/lib/xlsx-utils";
import { supabase } from "@/integrations/supabase/client";
import { brl, num } from "@/lib/format";
import { toast } from "sonner";
import { Download, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/importar-estoque")({
  component: ImportarEstoque,
  head: () => ({ meta: [{ title: "Importar estoque — Gestor MiniMarket" }, { name: "description", content: "Importe planilhas XLSX/CSV de estoque." }] }),
});

type Row = Record<string, any>;

function ImportarEstoque() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [tipo, setTipo] = useState<"saldo_inicial" | "substituir" | "ajustar" | "adicionar">("substituir");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<{ ok: number; novos: number; erros: string[] } | null>(null);

  async function handleFile(f: File) {
    try {
      const { headers, rows } = await readSpreadsheet(f);
      setHeaders(headers); setRows(rows); setReport(null);
      setMapping({
        codigo_barras: matchColumn(headers, ["codigo de barras", "codigo_barras", "ean", "gtin", "cod barras", "cod. barras"]) ?? "",
        nome: matchColumn(headers, ["nome", "produto", "descricao", "descrição"]) ?? "",
        quantidade: matchColumn(headers, ["quantidade", "qtd", "estoque"]) ?? "",
        custo: matchColumn(headers, ["custo", "preco custo", "preço custo", "valor custo"]) ?? "",
        preco_venda: matchColumn(headers, ["preco", "preço", "preco venda", "preço venda", "valor"]) ?? "",
        categoria: matchColumn(headers, ["categoria"]) ?? "",
        estoque_minimo: matchColumn(headers, ["estoque minimo", "estoque mínimo", "min", "minimo"]) ?? "",
      });
    } catch (e: any) { toast.error("Erro ao ler arquivo: " + e.message); }
  }

  const preview = useMemo(() => rows.slice(0, 5), [rows]);

  async function runImport() {
    if (!rows.length) return toast.error("Nenhum dado carregado");
    if (!mapping.codigo_barras && !mapping.nome) return toast.error("Mapeie ao menos código de barras ou nome");
    setImporting(true);
    const erros: string[] = [];
    let ok = 0, novos = 0;

    // Load categories cache
    const catsRes = await supabase.from("categories").select("id, nome");
    const catMap = new Map<string, string>();
    (catsRes.data ?? []).forEach((c: any) => catMap.set(c.nome.toLowerCase().trim(), c.id));

    const { data: batchRow } = await supabase.from("import_batches").insert({
      tipo: "estoque", subtipo: tipo, created_by: user?.id, status: "processando", total_registros: rows.length,
    }).select("id").single();
    const batchId = batchRow?.id;

    for (const r of rows) {
      try {
        const cb = mapping.codigo_barras ? String(r[mapping.codigo_barras] ?? "").trim() : "";
        const nome = mapping.nome ? String(r[mapping.nome] ?? "").trim() : "";
        if (!cb && !nome) { erros.push("Linha sem código nem nome"); continue; }
        const qtd = mapping.quantidade ? Number(String(r[mapping.quantidade] ?? "0").replace(",", ".")) : 0;
        const custo = mapping.custo ? Number(String(r[mapping.custo] ?? "0").replace(",", ".")) : 0;
        const preco = mapping.preco_venda ? Number(String(r[mapping.preco_venda] ?? "0").replace(",", ".")) : 0;
        const estMin = mapping.estoque_minimo ? Number(String(r[mapping.estoque_minimo] ?? "0").replace(",", ".")) : 0;
        const catNome = mapping.categoria ? String(r[mapping.categoria] ?? "").trim() : "";
        let catId: string | null = null;
        if (catNome) {
          catId = catMap.get(catNome.toLowerCase()) ?? null;
          if (!catId) {
            const ins = await supabase.from("categories").insert({ nome: catNome }).select("id").single();
            if (ins.data) { catId = ins.data.id; catMap.set(catNome.toLowerCase(), catId); }
          }
        }

        // Find product
        let prod: any = null;
        if (cb) {
          const { data } = await supabase.from("products").select("id, estoque_atual").eq("codigo_barras", cb).maybeSingle();
          prod = data;
        }
        if (!prod && nome) {
          const { data } = await supabase.from("products").select("id, estoque_atual").eq("nome", nome).maybeSingle();
          prod = data;
        }

        if (!prod) {
          // Create
          const payload: any = {
            codigo_barras: cb || null, nome: nome || `Produto ${cb}`,
            custo_medio: custo, custo_ultima_compra: custo, preco_venda: preco,
            estoque_atual: qtd, estoque_minimo: estMin, categoria_id: catId,
          };
          const { data, error } = await supabase.from("products").insert(payload).select("id").single();
          if (error) throw error;
          novos++;
          if (qtd > 0) {
            await supabase.rpc("apply_stock_movement" as any, {
              _product_id: data.id, _tipo: "inventario", _quantidade: qtd, _custo: custo, _motivo: `Importação: ${tipo}`, _documento_ref: batchId,
            });
          }
        } else {
          const atual = Number(prod.estoque_atual);
          let delta = 0;
          if (tipo === "substituir" || tipo === "saldo_inicial") delta = qtd - atual;
          else if (tipo === "ajustar") delta = qtd - atual;
          else if (tipo === "adicionar") delta = qtd;
          if (delta !== 0) {
            const { error } = await supabase.rpc("apply_stock_movement" as any, {
              _product_id: prod.id, _tipo: "inventario", _quantidade: delta, _custo: custo || null, _motivo: `Importação: ${tipo}`, _documento_ref: batchId,
            });
            if (error) throw error;
          }
          // Update prices if provided
          const update: any = {};
          if (custo > 0) update.custo_ultima_compra = custo;
          if (preco > 0) update.preco_venda = preco;
          if (estMin > 0) update.estoque_minimo = estMin;
          if (catId) update.categoria_id = catId;
          if (Object.keys(update).length) await supabase.from("products").update(update).eq("id", prod.id);
        }
        ok++;
      } catch (e: any) {
        erros.push(e.message ?? "Erro");
      }
    }

    if (batchId) await supabase.from("import_batches").update({
      status: erros.length ? "concluido_com_erros" : "concluido",
      total_sucesso: ok, total_erros: erros.length, completed_at: new Date().toISOString(),
    }).eq("id", batchId);

    setReport({ ok, novos, erros });
    setImporting(false);
    toast.success(`Importação concluída: ${ok} produtos processados`);
  }

  function downloadModelo() {
    downloadXLSX("modelo_estoque.xlsx", [
      { codigo_barras: "7891234567890", nome: "Arroz 5kg", categoria: "Alimentos", quantidade: 20, custo: 22.50, preco_venda: 29.90, estoque_minimo: 5 },
      { codigo_barras: "7891234567891", nome: "Feijão 1kg", categoria: "Alimentos", quantidade: 30, custo: 6.80, preco_venda: 8.99, estoque_minimo: 10 },
    ]);
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-2xl font-bold">Importar estoque</h1><p className="text-sm text-muted-foreground">Envie um XLSX ou CSV com seus produtos</p></div>
        <Button variant="outline" onClick={downloadModelo}><Download className="h-4 w-4 mr-2" />Baixar modelo</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>1. Arquivo e tipo de importação</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label>Arquivo (XLSX, XLS, CSV)</Label><Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files && handleFile(e.target.files[0])} /></div>
          <div><Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="saldo_inicial">Saldo inicial (primeira carga)</SelectItem>
                <SelectItem value="substituir">Substituir estoque atual</SelectItem>
                <SelectItem value="ajustar">Ajustar (diferença)</SelectItem>
                <SelectItem value="adicionar">Adicionar às quantidades</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardHeader><CardTitle>2. Mapeamento das colunas</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {["codigo_barras", "nome", "quantidade", "custo", "preco_venda", "estoque_minimo", "categoria"].map((f) => (
              <div key={f}><Label className="capitalize">{f.replace("_", " ")}</Label>
                <Select value={mapping[f] || "none"} onValueChange={(v) => setMapping({ ...mapping, [f]: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— ignorar —</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {preview.length > 0 && (
        <Card>
          <CardHeader><CardTitle>3. Prévia ({rows.length} linhas)</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{preview.map((r, i) => <TableRow key={i}>{headers.map((h) => <TableCell key={h} className="text-xs">{String(r[h] ?? "")}</TableCell>)}</TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={runImport} disabled={importing} size="lg"><Upload className="h-4 w-4 mr-2" />{importing ? "Importando..." : `Importar ${rows.length} linhas`}</Button>
        </div>
      )}

      {report && (
        <Alert className={report.erros.length ? "border-yellow-500" : "border-green-500"}>
          {report.erros.length ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <AlertDescription>
            <div><strong>{report.ok}</strong> processados · <strong>{report.novos}</strong> novos · <strong>{report.erros.length}</strong> erros</div>
            {report.erros.length > 0 && <details className="mt-2"><summary className="cursor-pointer text-sm">Ver erros</summary><ul className="text-xs mt-2 space-y-1">{report.erros.slice(0, 50).map((e, i) => <li key={i}>• {e}</li>)}</ul></details>}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
