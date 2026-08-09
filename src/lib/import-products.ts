import { matchColumn } from "@/lib/xlsx-utils";
import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_FIELDS = [
  "codigo_barras",
  "codigo_interno",
  "nome",
  "quantidade",
  "custo",
  "preco_venda",
  "estoque_minimo",
  "categoria",
  "marca",
  "unidade_medida",
] as const;

export function autoMapProducts(headers: string[]): Record<string, string> {
  return {
    codigo_barras: matchColumn(headers, ["codigo de barras","codigo_barras","ean","gtin","cod barras","cod. barras","barras","codbarras"]) ?? "",
    codigo_interno: matchColumn(headers, ["codigo interno","codigo_interno","codigo","cod interno","sku","cod produto","codigo do produto","código do produto","cod","referencia","ref"]) ?? "",
    nome: matchColumn(headers, ["nome","produto","descricao","descrição","descricao produto","item","nome do produto"]) ?? "",
    quantidade: matchColumn(headers, ["quantidade","qtd","qtde","estoque","saldo","estoque atual"]) ?? "",
    custo: matchColumn(headers, ["custo","preco custo","preço custo","valor custo","custo unitario","custo médio"]) ?? "",
    preco_venda: matchColumn(headers, ["preco","preço","preco venda","preço venda","valor","preco de venda","preço de venda","valor venda"]) ?? "",
    estoque_minimo: matchColumn(headers, ["estoque minimo","estoque mínimo","min","minimo","mínimo","est min"]) ?? "",
    categoria: matchColumn(headers, ["categoria","grupo","departamento","secao","seção"]) ?? "",
    marca: matchColumn(headers, ["marca","fabricante"]) ?? "",
    unidade_medida: matchColumn(headers, ["unidade","unidade de medida","un","um","unid"]) ?? "",
  };
}

export const numBR = (v: any) =>
  Number(String(v ?? "0").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;

export type ImportMode = "saldo_inicial" | "substituir" | "ajustar" | "adicionar";

const TIPO_MAP: Record<ImportMode, string> = {
  saldo_inicial: "estoque_inicial",
  substituir: "estoque_substituir",
  ajustar: "estoque_ajustar",
  adicionar: "estoque_somar",
};

export async function importProducts(opts: {
  rows: Record<string, any>[];
  mapping: Record<string, string>;
  storeId: string;
  tipo: ImportMode;
  fileName?: string;
  userId?: string;
}): Promise<{ ok: number; novos: number; erros: string[] }> {
  const { rows, mapping, storeId, tipo } = opts;
  const sb: any = supabase;
  const erros: string[] = [];
  let ok = 0, novos = 0;

  const catsRes = await sb.from("categories").select("id, nome");
  const catMap = new Map<string, string>();
  (catsRes.data ?? []).forEach((c: any) => catMap.set(String(c.nome).toLowerCase().trim(), c.id));

  const { data: batchRow } = await sb.from("import_batches").insert({
    tipo: TIPO_MAP[tipo], arquivo_nome: opts.fileName ?? "planilha", user_id: opts.userId,
    registros_total: rows.length, status: "processando",
  }).select("id").single();
  const batchId = batchRow?.id;

  for (const r of rows) {
    try {
      const cb = mapping.codigo_barras ? String(r[mapping.codigo_barras] ?? "").trim() : "";
      const ci = mapping.codigo_interno ? String(r[mapping.codigo_interno] ?? "").trim() : "";
      const nome = mapping.nome ? String(r[mapping.nome] ?? "").trim() : "";
      if (!cb && !ci && !nome) { erros.push("Linha sem código nem nome"); continue; }
      const qtd = mapping.quantidade ? numBR(r[mapping.quantidade]) : 0;
      const custo = mapping.custo ? numBR(r[mapping.custo]) : 0;
      const preco = mapping.preco_venda ? numBR(r[mapping.preco_venda]) : 0;
      const estMin = mapping.estoque_minimo ? numBR(r[mapping.estoque_minimo]) : 0;
      const catNome = mapping.categoria ? String(r[mapping.categoria] ?? "").trim() : "";
      const marca = mapping.marca ? String(r[mapping.marca] ?? "").trim() : "";
      const un = mapping.unidade_medida ? String(r[mapping.unidade_medida] ?? "").trim() : "";

      let catId: string | null = null;
      if (catNome) {
        catId = catMap.get(catNome.toLowerCase()) ?? null;
        if (!catId) {
          const ins: any = await sb.from("categories").insert({ nome: catNome }).select("id").single();
          if (ins.data) { catId = ins.data.id as string; catMap.set(catNome.toLowerCase(), catId!); }
        }
      }

      let prod: any = null;
      if (cb) {
        const { data } = await sb.from("products").select("id, estoque_atual").eq("codigo_barras", cb).eq("store_id", storeId).maybeSingle();
        prod = data;
      }
      if (!prod && ci) {
        const { data } = await sb.from("products").select("id, estoque_atual").eq("codigo_interno", ci).eq("store_id", storeId).maybeSingle();
        prod = data;
      }
      if (!prod && nome) {
        const { data } = await sb.from("products").select("id, estoque_atual").eq("nome", nome).eq("store_id", storeId).maybeSingle();
        prod = data;
      }

      if (!prod) {
        const payload: any = {
          codigo_barras: cb || null,
          codigo_interno: ci || null,
          nome: nome || `Produto ${cb || ci}`,
          marca: marca || null,
          unidade_medida: un || "un",
          custo_medio: custo, custo_ultima_compra: custo, preco_venda: preco,
          estoque_atual: 0, estoque_minimo: estMin, categoria_id: catId, store_id: storeId,
        };
        const { data, error } = await sb.from("products").insert(payload).select("id").single();
        if (error) throw error;
        novos++;
        if (qtd !== 0) {
          await sb.rpc("apply_stock_movement", {
            _product_id: data.id, _tipo: "inventario", _quantidade: qtd, _custo: custo || null,
            _motivo: `Importação: ${tipo}`, _documento_ref: batchId,
          });
        }
      } else {
        const atual = Number(prod.estoque_atual);
        let delta = 0;
        if (tipo === "adicionar") delta = qtd;
        else delta = qtd - atual;
        if (delta !== 0) {
          const { error } = await sb.rpc("apply_stock_movement", {
            _product_id: prod.id, _tipo: "inventario", _quantidade: delta, _custo: custo || null,
            _motivo: `Importação: ${tipo}`, _documento_ref: batchId,
          });
          if (error) throw error;
        }
        const update: any = {};
        if (custo > 0) update.custo_ultima_compra = custo;
        if (preco > 0) update.preco_venda = preco;
        if (estMin > 0) update.estoque_minimo = estMin;
        if (catId) update.categoria_id = catId;
        if (ci) update.codigo_interno = ci;
        if (cb) update.codigo_barras = cb;
        if (marca) update.marca = marca;
        if (un) update.unidade_medida = un;
        if (Object.keys(update).length) await sb.from("products").update(update).eq("id", prod.id);
      }
      ok++;
    } catch (e: any) { erros.push(e.message ?? "Erro"); }
  }

  if (batchId) await sb.from("import_batches").update({
    status: erros.length ? "concluido_com_erros" : "concluido",
    registros_ok: ok, registros_erro: erros.length, erros: erros.slice(0, 200),
  }).eq("id", batchId);

  return { ok, novos, erros };
}
