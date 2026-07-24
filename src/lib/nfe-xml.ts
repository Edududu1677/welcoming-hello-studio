import { XMLParser } from "fast-xml-parser";

export interface NFeItem {
  codigo_barras: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  desconto: number;
  lote?: string;
  validade?: string;
}
export interface NFeParsed {
  numero: string | null;
  chave: string | null;
  data_emissao: string | null;
  fornecedor_cnpj: string | null;
  fornecedor_nome: string | null;
  valor_produtos: number;
  valor_frete: number;
  valor_desconto: number;
  valor_total: number;
  itens: NFeItem[];
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function num(v: unknown): number {
  const n = Number(String(v ?? "0").replace(",", "."));
  return isNaN(n) ? 0 : n;
}
function toArr<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseNFeXml(xml: string): NFeParsed {
  const doc = parser.parse(xml);
  const nfe = doc?.nfeProc?.NFe ?? doc?.NFe;
  const inf = nfe?.infNFe;
  if (!inf) throw new Error("XML inválido: infNFe não encontrado");
  const emit = inf.emit ?? {};
  const total = inf.total?.ICMSTot ?? {};
  const ide = inf.ide ?? {};
  const chave = (inf["@_Id"] ?? "").toString().replace(/^NFe/, "") || null;

  const itens: NFeItem[] = toArr(inf.det).map((d: any) => {
    const prod = d.prod ?? {};
    const rastro = toArr(prod.rastro)[0];
    return {
      codigo_barras: (prod.cEAN && prod.cEAN !== "SEM GTIN") ? String(prod.cEAN) : null,
      descricao: String(prod.xProd ?? ""),
      quantidade: num(prod.qCom),
      unidade: String(prod.uCom ?? "UN"),
      valor_unitario: num(prod.vUnCom),
      valor_total: num(prod.vProd),
      desconto: num(prod.vDesc),
      lote: rastro?.nLote ? String(rastro.nLote) : undefined,
      validade: rastro?.dVal ? String(rastro.dVal) : undefined,
    };
  });

  return {
    numero: ide.nNF ? String(ide.nNF) : null,
    chave,
    data_emissao: ide.dhEmi ? String(ide.dhEmi).slice(0, 10) : (ide.dEmi ? String(ide.dEmi) : null),
    fornecedor_cnpj: emit.CNPJ ? String(emit.CNPJ) : null,
    fornecedor_nome: String(emit.xNome ?? emit.xFant ?? ""),
    valor_produtos: num(total.vProd),
    valor_frete: num(total.vFrete),
    valor_desconto: num(total.vDesc),
    valor_total: num(total.vNF),
    itens,
  };
}
