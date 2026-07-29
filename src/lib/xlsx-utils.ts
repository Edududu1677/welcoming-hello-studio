import * as XLSX from "xlsx";

export async function readSpreadsheet(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // Read as matrix so we can detect the header row (some PDV exports have title/blank rows at top)
  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: "" });
  return matrixToRows(matrix);
}

function matrixToRows(matrix: any[][]): { headers: string[]; rows: Record<string, any>[] } {
  // find first row with 2+ non-empty cells and mostly text -> header row
  let headerIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const row = matrix[i] ?? [];
    const nonEmpty = row.filter((c) => String(c ?? "").trim() !== "");
    if (nonEmpty.length >= 2) { headerIdx = i; break; }
  }
  const rawHeaders = (matrix[headerIdx] ?? []).map((h, i) => {
    const s = String(h ?? "").trim();
    return s || `col_${i + 1}`;
  });
  // dedupe headers
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h) => {
    const n = (seen.get(h) ?? 0) + 1;
    seen.set(h, n);
    return n === 1 ? h : `${h} (${n})`;
  });
  const rows: Record<string, any>[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if (row.every((c) => String(c ?? "").trim() === "")) continue;
    const obj: Record<string, any> = {};
    headers.forEach((h, j) => (obj[h] = row[j] ?? ""));
    rows.push(obj);
  }
  return { headers, rows };
}

export function parsePastedData(text: string): { headers: string[]; rows: Record<string, any>[] } {
  const cleaned = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (!cleaned.trim()) return { headers: [], rows: [] };
  const lines = cleaned.split("\n");
  // detect delimiter: prefer tab (Excel copy), then ;, then ,
  const first = lines[0];
  const delim = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
  const matrix = lines.map((l) => splitDelim(l, delim));
  return matrixToRows(matrix);
}

function splitDelim(line: string, delim: string): string[] {
  if (delim === "\t") return line.split("\t");
  // simple CSV parser with quotes
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === delim) { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function downloadXLSX(filename: string, rows: Record<string, any>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, filename);
}

export const exportToXlsx = downloadXLSX;

export function exportToCsv(filename: string, rows: Record<string, any>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export function normKey(s: string): string {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export function matchColumn(headers: string[], candidates: string[]): string | null {
  const map = new Map(headers.map((h) => [normKey(h), h]));
  for (const c of candidates) {
    const found = map.get(normKey(c));
    if (found) return found;
  }
  return null;
}
