import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { brl, num } from "@/lib/format";
import { Plus, Search, Upload, Download, ClipboardPaste, ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { readSpreadsheet, parsePastedData, downloadXLSX } from "@/lib/xlsx-utils";
import { autoMapProducts, importProducts, PRODUCT_FIELDS, type ImportMode } from "@/lib/import-products";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/produtos/")({
  component: ProdutosList,
  head: () => ({ meta: [{ title: "Produtos — Gestor MiniMarket" }, { name: "description", content: "Cadastro de produtos, importação de planilha e estoque por categoria." }] }),
});

function ImportDialog({ onDone }: { onDone: () => void }) {
  const { storeId } = useStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [tipo, setTipo] = useState<ImportMode>("substituir");
  const [fileName, setFileName] = useState("");
  const [pasted, setPasted] = useState("");
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<{ ok: number; novos: number; erros: string[] } | null>(null);

  function load(h: string[], r: Record<string, any>[], name: string) {
    setHeaders(h); setRows(r); setMapping(autoMapProducts(h)); setFileName(name); setReport(null);
    toast.success(`${r.length} linhas carregadas`);
  }

  async function handleFile(f: File) {
    try { const { headers, rows } = await readSpreadsheet(f); load(headers, rows, f.name); }
    catch (e: any) { toast.error("Erro ao ler arquivo: " + e.message); }
  }

  function handlePaste() {
    const { headers, rows } = parsePastedData(pasted);
    if (!rows.length) return toast.error("Nada para processar");
    load(headers, rows, "colagem");
  }

  async function run() {
    if (!rows.length) return toast.error("Nenhum dado carregado");
    if (!mapping.codigo_barras && !mapping.codigo_interno && !mapping.nome) return toast.error("Mapeie código de barras, código interno ou nome");
    setImporting(true);
    try {
      const res = await importProducts({ rows, mapping, storeId: storeId!, tipo, fileName, userId: user?.id });
      setReport(res);
      toast.success(`${res.ok} produtos processados · ${res.novos} novos`);
      onDone();
    } catch (e: any) { toast.error(e.message ?? "Erro na importação"); }
    setImporting(false);
  }

  function modelo() {
    downloadXLSX("modelo_produtos.xlsx", [
      { codigo_barras: "7891234567890", codigo_interno: "PA143", nome: "Arroz 5kg", categoria: "Alimentos", marca: "Tio João", unidade_medida: "un", quantidade: 20, custo: 22.5, preco_venda: 29.9, estoque_minimo: 5 },
    ]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Importar planilha</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar produtos da planilha</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Arquivo (XLSX, XLS, CSV)</Label><Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files && handleFile(e.target.files[0])} /></div>
            <div><Label>Quantidades da planilha</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as ImportMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="saldo_inicial">Saldo inicial (primeira carga)</SelectItem>
                  <SelectItem value="substituir">Substituir estoque atual</SelectItem>
                  <SelectItem value="ajustar">Ajustar (diferença)</SelectItem>
                  <SelectItem value="adicionar">Adicionar ao estoque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ou cole os dados (copiado do Excel/Sheets, com cabeçalho)</Label>
            <Textarea rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Cole aqui..." />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handlePaste}><ClipboardPaste className="h-4 w-4 mr-2" />Processar colagem</Button>
              <Button variant="ghost" size="sm" onClick={modelo}><Download className="h-4 w-4 mr-2" />Baixar modelo</Button>
            </div>
          </div>

          {headers.length > 0 && (
            <div className="space-y-2">
              <Label>Mapeamento das colunas ({rows.length} linhas)</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {PRODUCT_FIELDS.map((f) => (
                  <div key={f}>
                    <span className="text-xs text-muted-foreground capitalize">{f.replace(/_/g, " ")}</span>
                    <Select value={mapping[f] || "none"} onValueChange={(v) => setMapping({ ...mapping, [f]: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— ignorar —</SelectItem>
                        {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={run} disabled={importing}><Upload className="h-4 w-4 mr-2" />{importing ? "Importando..." : `Importar ${rows.length} linhas`}</Button>
              </div>
            </div>
          )}

          {report && (
            <Alert>
              <AlertDescription>
                <strong>{report.ok}</strong> processados · <strong>{report.novos}</strong> novos · <strong>{report.erros.length}</strong> erros
                {report.erros.length > 0 && (
                  <details className="mt-2"><summary className="cursor-pointer text-sm">Ver erros</summary>
                    <ul className="text-xs mt-1 space-y-1">{report.erros.slice(0, 30).map((e, i) => <li key={i}>• {e}</li>)}</ul>
                  </details>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProdutosList() {
  const { storeId } = useStore();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { data, isLoading } = useQuery({
    queryKey: ["products", q, storeId],
    queryFn: async () => {
      let query = supabase.from("products").select("id, codigo_barras, codigo_interno, nome, marca, estoque_atual, estoque_minimo, custo_medio, preco_venda, ativo, categorias:categoria_id(nome)").eq("store_id", storeId!).order("nome").limit(2000);
      if (q.trim()) {
        query = query.or(`nome.ilike.%${q}%,codigo_barras.ilike.%${q}%,codigo_interno.ilike.%${q}%,marca.ilike.%${q}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const grupos = useMemo(() => {
    const map = new Map<string, any[]>();
    (data ?? []).forEach((p: any) => {
      const cat = p.categorias?.nome ?? "Sem categoria";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [data]);

  const totalEstoque = (data ?? []).reduce((s: number, p: any) => s + Number(p.estoque_atual), 0);
  const valorEstoque = (data ?? []).reduce((s: number, p: any) => s + Number(p.estoque_atual) * Number(p.custo_medio), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            {data?.length ?? 0} produtos · {grupos.length} categorias · {num(totalEstoque)} itens em estoque · {brl(valorEstoque)} em custo
          </p>
        </div>
        <div className="flex gap-2">
          <ImportDialog onDone={() => qc.invalidateQueries({ queryKey: ["products"] })} />
          <Button asChild><Link to="/produtos/novo"><Plus className="h-4 w-4 mr-2" />Novo produto</Link></Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, código ou marca..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading && <div className="text-center py-8 text-muted-foreground">Carregando...</div>}
          {!isLoading && grupos.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">Nenhum produto. Use <strong>Importar planilha</strong> para carregar tudo de uma vez.</div>
          )}
          {grupos.map(([cat, items]) => {
            const estCat = items.reduce((s, p: any) => s + Number(p.estoque_atual), 0);
            const valCat = items.reduce((s, p: any) => s + Number(p.estoque_atual) * Number(p.custo_medio), 0);
            const isCollapsed = collapsed[cat];
            return (
              <div key={cat} className="border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => setCollapsed({ ...collapsed, [cat]: !isCollapsed })}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-muted/50 hover:bg-muted text-left"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {cat}
                    <Badge variant="secondary">{items.length}</Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">{num(estCat)} em estoque · {brl(valCat)}</span>
                </button>
                {!isCollapsed && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead className="text-right">Estoque</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                        <TableHead className="text-right">Venda</TableHead>
                        <TableHead className="text-right">Margem</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((p: any) => {
                        const est = Number(p.estoque_atual);
                        const min = Number(p.estoque_minimo);
                        const custo = Number(p.custo_medio);
                        const preco = Number(p.preco_venda);
                        const margem = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
                        const lowStock = est <= 0 ? "sem" : (min > 0 && est <= min) ? "baixo" : "ok";
                        return (
                          <TableRow key={p.id}>
                            <TableCell>
                              <Link to="/produtos/$id" params={{ id: p.id }} className="hover:underline font-medium">{p.nome}</Link>
                              {p.marca && <div className="text-xs text-muted-foreground">{p.marca}</div>}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{p.codigo_barras ?? p.codigo_interno ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              {num(est)}
                              {lowStock === "sem" && <Badge variant="destructive" className="ml-1">Zero</Badge>}
                              {lowStock === "baixo" && <Badge className="ml-1 bg-yellow-500">Baixo</Badge>}
                            </TableCell>
                            <TableCell className="text-right">{brl(custo)}</TableCell>
                            <TableCell className="text-right">{brl(preco)}</TableCell>
                            <TableCell className="text-right">{margem.toFixed(1)}%</TableCell>
                            <TableCell><Button asChild variant="ghost" size="sm"><Link to="/produtos/$id" params={{ id: p.id }}>Editar</Link></Button></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
