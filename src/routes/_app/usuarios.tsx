import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_app/usuarios")({
  component: Usuarios,
  head: () => ({ meta: [{ title: "Usuários — Gestor MiniMarket" }, { name: "description", content: "Gerenciamento de usuários e permissões." }] }),
});

const ROLES = ["admin", "gerente", "operador", "consulta"];

function Usuarios() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const sb: any = supabase;

  const { data } = useQuery({
    queryKey: ["users-all"],
    queryFn: async () => {
      const [profs, roles] = await Promise.all([
        sb.from("profiles").select("id, nome, email, created_at"),
        sb.from("user_roles").select("user_id, role"),
      ]);
      const rolesByUser = new Map<string, string[]>();
      (roles.data ?? []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role); rolesByUser.set(r.user_id, arr);
      });
      return (profs.data ?? []).map((p: any) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }));
    },
  });

  async function setRole(userId: string, role: string) {
    // Remove all existing roles for this user, then set new
    await sb.from("user_roles").delete().eq("user_id", userId);
    const { error } = await sb.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    qc.invalidateQueries({ queryKey: ["users-all"] });
  }

  if (!isAdmin) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Usuários</h1>
      <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Apenas administradores podem gerenciar usuários.</AlertDescription></Alert>
    </div>
  );

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Usuários</h1><p className="text-sm text-muted-foreground">Novos usuários se cadastram pela tela de login</p></div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Perfil</TableHead></TableRow></TableHeader>
            <TableBody>
              {data?.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell>{u.nome || "—"}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Select value={u.roles[0] ?? "consulta"} onValueChange={(v) => setRole(u.id, v)}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
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
