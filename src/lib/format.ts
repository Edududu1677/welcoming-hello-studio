export const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
export const PCT = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

export const brl = (v: number | null | undefined) => BRL.format(Number(v ?? 0));
export const num = (v: number | null | undefined) => NUM.format(Number(v ?? 0));
export const pct = (v: number | null | undefined) => PCT.format(Number(v ?? 0) / 100);

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}
export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR");
}

export function parseNumberBR(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/\s/g, "").replace(/R\$/g, "");
  // If has both , and . assume BR (1.234,56); else if has , only -> BR decimal
  if (s.includes(",") && s.includes(".")) return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  if (s.includes(",")) return Number(s.replace(",", ".")) || 0;
  return Number(s) || 0;
}

export function roundPrice(value: number, rule: string): number {
  if (!isFinite(value)) return 0;
  const v = value;
  switch (rule) {
    case "99": return Math.floor(v) + 0.99;
    case "90": return Math.floor(v) + 0.90;
    case "49": {
      const base = Math.floor(v);
      return v - base < 0.5 ? base + 0.49 : base + 0.99;
    }
    case "inteiro": return Math.round(v);
    case "sem": return v;
    case "centavo":
    default: return Math.round(v * 100) / 100;
  }
}
