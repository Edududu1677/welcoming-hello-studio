import * as XLSX from "xlsx";

export async function readSpreadsheet(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: "" });
}

export function exportToXlsx(filename: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, filename);
}

export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// Normalized column matching
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
