import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPage,
  head: () => ({ meta: [{ title: "Nova senha — Gestor MiniMarket" }, { name: "description", content: "Defina uma nova senha." }] }),
});

function ResetPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada!");
    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Definir nova senha</CardTitle></CardHeader>
        <CardContent>
          {!ready ? <p className="text-sm text-muted-foreground">Abra este link a partir do e-mail de recuperação.</p> : (
            <form onSubmit={submit} className="space-y-4">
              <div><Label>Nova senha</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" className="w-full" disabled={loading}>Salvar</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
