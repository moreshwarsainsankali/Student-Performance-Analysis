// DataLens AI — all analysis runs in the browser on the user's uploaded CSV.
import Papa from "papaparse";

export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ROWS = 50000;

export type Row = Record<string, string>;
export type ColType = "numeric" | "categorical";

export interface NumericStats {
  count: number; mean: number; std: number; min: number; q1: number;
  median: number; q3: number; max: number; outliers: number;
}
export interface ColumnSummary {
  name: string; type: ColType; missing: number; unique: number;
  numeric?: NumericStats;
  topValues?: { value: string; count: number }[];
}
export interface Analysis {
  rows: Row[]; columns: string[]; rowCount: number; duplicates: number;
  summaries: ColumnSummary[];
  correlation: { cols: string[]; matrix: number[][] } | null;
  insights: string[];
}

export class CsvError extends Error {}

export function isMissing(v: unknown) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toLowerCase();
  return s === "" || s === "na" || s === "n/a" || s === "nan" || s === "null";
}

export function parseCsv(text: string): { rows: Row[]; columns: string[] } {
  if (!text.trim()) throw new CsvError("The file is empty.");
  const res = Papa.parse<Row>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  const columns = (res.meta.fields ?? []).filter((c) => c !== "");
  if (columns.length < 1) throw new CsvError("No header row was found. The first line must contain column names.");
  if (new Set(columns).size !== columns.length) throw new CsvError("Column names must be unique.");
  const rows = res.data;
  if (rows.length === 0) throw new CsvError("The file has a header but no data rows.");
  if (rows.length > MAX_ROWS) throw new CsvError(`Too many rows (${rows.length}). Maximum is ${MAX_ROWS}.`);
  const badRows = res.errors.filter((e) => e.type === "FieldMismatch").length;
  if (badRows > rows.length * 0.2) throw new CsvError("This does not look like a valid CSV: many rows have the wrong number of fields.");
  return { rows, columns };
}

function quantile(sorted: number[], q: number) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function numericStats(values: number[]): NumericStats {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const std = n > 1 ? Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75), iqr = q3 - q1;
  const outliers = s.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length;
  return { count: n, mean, std, min: s[0], q1, median: quantile(s, 0.5), q3, max: s[n - 1], outliers };
}

export function pearson(a: number[], b: number[]) {
  const n = a.length;
  if (n < 3) return NaN;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da === 0 || db === 0 ? NaN : num / Math.sqrt(da * db);
}

export function countDuplicates(rows: Row[], columns: string[]) {
  const seen = new Set<string>(); let d = 0;
  for (const r of rows) { const k = JSON.stringify(columns.map((c) => r[c] ?? "")); if (seen.has(k)) d++; else seen.add(k); }
  return d;
}

export function toNum(v: string) { const n = Number(String(v).trim().replace(/,/g, "")); return Number.isFinite(n) ? n : null; }

export function analyze(rows: Row[], columns: string[]): Analysis {
  const summaries: ColumnSummary[] = columns.map((name) => {
    const vals = rows.map((r) => r[name]);
    const present = vals.filter((v) => !isMissing(v));
    const nums = present.map(toNum).filter((n): n is number => n !== null);
    const isNum = present.length > 0 && nums.length / present.length >= 0.9;
    const base = { name, missing: vals.length - present.length, unique: new Set(present.map((v) => String(v).trim())).size };
    if (isNum) return { ...base, type: "numeric" as const, numeric: numericStats(nums) };
    const freq = new Map<string, number>();
    present.forEach((v) => { const k = String(v).trim(); freq.set(k, (freq.get(k) ?? 0) + 1); });
    const topValues = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([value, count]) => ({ value, count }));
    return { ...base, type: "categorical" as const, topValues };
  });

  const numCols = summaries.filter((s) => s.type === "numeric").map((s) => s.name);
  let correlation: Analysis["correlation"] = null;
  if (numCols.length >= 2) {
    const matrix = numCols.map((a) => numCols.map((b) => {
      const xs: number[] = [], ys: number[] = [];
      rows.forEach((r) => { const x = toNum(r[a]), y = toNum(r[b]); if (!isMissing(r[a]) && !isMissing(r[b]) && x !== null && y !== null) { xs.push(x); ys.push(y); } });
      return pearson(xs, ys);
    }));
    correlation = { cols: numCols, matrix };
  }

  const duplicates = countDuplicates(rows, columns);
  const a: Analysis = { rows, columns, rowCount: rows.length, duplicates, summaries, correlation, insights: [] };
  a.insights = buildInsights(a);
  return a;
}

const f = (n: number) => (Math.abs(n) >= 1000 ? n.toFixed(0) : n.toFixed(2));

export function buildInsights(a: Analysis): string[] {
  const out: string[] = [];
  const totalMissing = a.summaries.reduce((s, c) => s + c.missing, 0);
  out.push(`The dataset has ${a.rowCount} rows and ${a.columns.length} columns (${a.summaries.filter((s) => s.type === "numeric").length} numeric, ${a.summaries.filter((s) => s.type === "categorical").length} categorical).`);
  if (totalMissing === 0) out.push("No missing values were detected.");
  a.summaries.filter((s) => s.missing / a.rowCount > 0.2).forEach((s) =>
    out.push(`"${s.name}" is missing ${((s.missing / a.rowCount) * 100).toFixed(1)}% of its values; results for this column may be less reliable.`));
  if (a.duplicates > 0) out.push(`${a.duplicates} duplicate row(s) were found. Consider removing them before modelling.`);
  a.summaries.forEach((s) => {
    const n = s.numeric; if (!n) return;
    if (n.outliers > 0) out.push(`"${s.name}" has ${n.outliers} potential outlier(s) by the 1.5×IQR rule (range ${f(n.min)} to ${f(n.max)}, median ${f(n.median)}).`);
    if (n.std > 0 && Math.abs(n.mean - n.median) > 0.5 * n.std) out.push(`"${s.name}" looks skewed: its mean (${f(n.mean)}) is far from its median (${f(n.median)}).`);
  });
  a.summaries.forEach((s) => {
    const t = s.topValues?.[0]; const present = a.rowCount - s.missing;
    if (t && present > 0 && t.count / present > 0.5 && s.unique > 1) out.push(`In "${s.name}", "${t.value}" makes up ${((t.count / present) * 100).toFixed(0)}% of values — the categories are imbalanced.`);
  });
  if (a.correlation) {
    const { cols, matrix } = a.correlation;
    for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) {
      const r = matrix[i][j];
      if (Math.abs(r) >= 0.7) out.push(`"${cols[i]}" and "${cols[j]}" have a strong ${r > 0 ? "positive" : "negative"} correlation (r = ${r.toFixed(2)}). Correlation does not prove that one causes the other.`);
    }
  }
  return out;
}

export function cleanedCsv(a: Analysis): string {
  const seen = new Set<string>();
  const rows = a.rows.filter((r) => { const k = JSON.stringify(a.columns.map((c) => r[c] ?? "")); if (seen.has(k)) return false; seen.add(k); return true; });
  return Papa.unparse({ fields: a.columns, data: rows.map((r) => a.columns.map((c) => (r[c] ?? "").trim())) });
}

export function summaryText(a: Analysis, fileName: string): string {
  const lines = [`DataLens AI — Analysis summary`, `File: ${fileName}`, `Rows: ${a.rowCount}  Columns: ${a.columns.length}  Duplicate rows: ${a.duplicates}`, ""];
  a.summaries.forEach((s) => {
    lines.push(`[${s.name}] type=${s.type} missing=${s.missing} unique=${s.unique}`);
    if (s.numeric) { const n = s.numeric; lines.push(`  mean=${f(n.mean)} std=${f(n.std)} min=${f(n.min)} median=${f(n.median)} max=${f(n.max)} outliers=${n.outliers}`); }
    if (s.topValues) lines.push(`  top: ${s.topValues.slice(0, 5).map((t) => `${t.value} (${t.count})`).join(", ")}`);
  });
  lines.push("", "Insights:", ...a.insights.map((i) => `- ${i}`));
  return lines.join("\n");
}

export function histogram(values: number[], bins = 10) {
  if (!values.length) return [];
  const min = Math.min(...values), max = Math.max(...values);
  if (min === max) return [{ bin: f(min), count: values.length }];
  const w = (max - min) / bins; const counts = Array(bins).fill(0);
  values.forEach((v) => counts[Math.min(bins - 1, Math.floor((v - min) / w))]++);
  return counts.map((count, i) => ({ bin: f(min + i * w), count }));
}
