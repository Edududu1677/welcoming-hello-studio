import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store-context";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/alertas")({
  component: Alertas,
  head: () => ({ meta: [{ title: "Alertas — Gestor MiniMarket" }, { name: "description", content: "Central de alertas." }] }),
});

function Alertas() {
  const qc = useQueryClient();
  const { storeId } = useStore();
  const sb: any = supabase;

  const { data } = useQuery({
    queryKey: ["alerts", storeId],
    queryFn: async () => (await sb.from("alerts").select("*, products:product_id(nome)").eq("store_id", storeId!).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  async function generateAlerts() {
    // Stock alerts
    const { data: low } = await sb.from("products").select("id, nome, estoque_atual, estoque_minimo").eq("ativo", true).eq("store_id", storeId!);
    let created = 0;
    for (const p of low ?? []) {
      const est = Number(p.estoque_atual), min = Number(p.estoque_minimo);
      if (est <= 0) {
        await sb.from("alerts").upsert({ tipo: "sem_estoque", severidade: "erro", titulo: `Sem estoque: ${p.nome}`, product_id: p.id, status: "novo", store_id: storeId }, { onConflict: "product_id,tipo" as any }).select();
        created++;
      } else if (min > 0 && est <= min) {
        await sb.from("alerts").upsert({ tipo: "estoque_baixo", severidade: "aviso", titulo: `Estoque baixo: ${p.nome}`, product_id: p.id, status: "novo", store_id: storeId }, { onConflict: "product_id,tipo" as any });
        created++;
      }
    }
    toast.success(`Verificação concluída — ${created} alertas`);
    qc.invalidateQueries({ queryKey: ["alerts", storeId] });
  }

  async function markStatus(id: string, status: string) {
    await sb.from("alerts").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["alerts", storeId] });
  }

  async function removeAlert(id: string) {
    await sb.from("alerts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["alerts", storeId] });
  }

  async function clearResolved() {
    if (!confirm("Excluir todos os alertas resolvidos e ignorados?")) return;
    await sb.from("alerts").delete().eq("store_id", storeId!).in("status", ["resolvido", "ignorado"]);
    toast.success("Alertas limpos");
    qc.invalidateQueries({ queryKey: ["alerts", storeId] });
  }

  const icon = (sev: string) => sev === "erro" ? <AlertCircle className="h-4 w-4 text-red-600" /> : sev === "aviso" ? <AlertTriangle className="h-4 w-4 text-yellow-600" /> : <Info className="h-4 w-4 text-blue-600" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Alertas</h1><p className="text-sm text-muted-foreground">{data?.filter((a: any) => a.status === "novo").length ?? 0} novos</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={clearResolved}>Limpar resolvidos</Button>
          <Button variant="outline" onClick={generateAlerts}>Verificar agora</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Sev.</TableHead><TableHead>Tipo</TableHead><TableHead>Título</TableHead><TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(!data || data.length === 0) && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum alerta. Clique em "Verificar agora".</TableCell></TableRow>}
              {data?.map((a: any) => (
                <TableRow key={a.id} className={a.status === "novo" ? "font-medium" : ""}>
                  <TableCell>{icon(a.severidade)}</TableCell>
                  <TableCell className="text-xs">{a.tipo}</TableCell>
                  <TableCell>{a.titulo}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(a.created_at)}</TableCell>
                  <TableCell><Badge variant={a.status === "novo" ? "default" : "outline"}>{a.status}</Badge></TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">
                    {a.status === "novo" && <Button size="sm" variant="ghost" onClick={() => markStatus(a.id, "visualizado")}>Visto</Button>}
                    <Button size="sm" variant="ghost" onClick={() => markStatus(a.id, "resolvido")}><Check className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => removeAlert(a.id)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
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
