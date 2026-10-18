import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Database, Upload, AlertTriangle, Lightbulb, Download } from "lucide-react";
import {
  analyze, parseCsv, CsvError, MAX_BYTES, histogram, toNum, isMissing,
  cleanedCsv, summaryText, type Analysis,
} from "@/lib/analysis";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DataLens AI — CSV Data Analysis" },
      { name: "description", content: "Upload a CSV and get an instant overview, statistics, charts, data-quality checks and insights." },
      { property: "og:title", content: "DataLens AI — CSV Data Analysis" },
      { property: "og:description", content: "Instant exploratory analysis of your own CSV files, in the browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const card = "rounded-xl border bg-card p-5 shadow-sm";
const fmt = (n: number) => (Number.isFinite(n) ? (Math.abs(n) >= 1000 ? n.toFixed(0) : n.toFixed(2)) : "—");

function Index() {
  const [data, setData] = useState<Analysis | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [numCol, setNumCol] = useState("");
  const [catCol, setCatCol] = useState("");

  const load = (text: string, name: string) => {
    try {
      const { rows, columns } = parseCsv(text);
      const a = analyze(rows, columns);
      setData(a); setFileName(name); setError("");
      setNumCol(a.summaries.find((s) => s.type === "numeric")?.name ?? "");
      setCatCol(a.summaries.find((s) => s.type === "categorical")?.name ?? "");
    } catch (e) {
      setData(null);
      setError(e instanceof CsvError ? e.message : "Could not read this file as a CSV.");
    }
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return setError("Unsupported file type. Please upload a .csv file.");
    if (file.size > MAX_BYTES) return setError(`File is too large (${(file.size / 1048576).toFixed(1)} MB). Maximum is 5 MB.`);
    load(await file.text(), file.name);
  };

  const loadSample = async () => load(await (await fetch("/sample_students.csv")).text(), "sample_students.csv");

  const numSummaries = data?.summaries.filter((s) => s.type === "numeric") ?? [];
  const catSummaries = data?.summaries.filter((s) => s.type === "categorical") ?? [];
  const hist = data && numCol
    ? histogram(data.rows.filter((r) => !isMissing(r[numCol])).map((r) => toNum(r[numCol])).filter((n): n is number => n !== null))
    : [];
  const catData = catSummaries.find((s) => s.name === catCol)?.topValues ?? [];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">DataLens AI</h1>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Upload a CSV file to get an overview, statistics, charts, data-quality checks and insights — all calculated from your data, in your browser.
          </p>
        </header>

        <section className={card}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90">
              <Upload className="h-4 w-4" /> Upload CSV
              <input type="file" accept=".csv,text/csv" className="hidden" aria-label="Upload CSV"
                onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button onClick={loadSample} className="rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
              Try sample dataset
            </button>
            <span className="text-sm text-muted-foreground">Max 5 MB, 50,000 rows. First row must be column names.</span>
          </div>
          {error && <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {fileName && data && <p className="mt-3 text-sm text-muted-foreground">Analysing <span className="font-medium text-foreground">{fileName}</span></p>}
        </section>

        {data && (
          <>
            <section className="grid gap-4 sm:grid-cols-4">
              {[
                ["Rows", data.rowCount], ["Columns", data.columns.length],
                ["Missing cells", data.summaries.reduce((s, c) => s + c.missing, 0)], ["Duplicate rows", data.duplicates],
              ].map(([l, v]) => (
                <div key={l} className={card}>
                  <div className="text-sm text-muted-foreground">{l}</div>
                  <div className="mt-1 text-3xl font-bold text-card-foreground">{v}</div>
                </div>
              ))}
            </section>

            <section className={card}>
              <h2 className="mb-3 font-semibold text-card-foreground">Preview (first 10 rows)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr>{data.columns.map((c) => <th key={c} className="border-b px-2 py-1 text-left font-medium text-foreground">{c}</th>)}</tr></thead>
                  <tbody>{data.rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>{data.columns.map((c) => <td key={c} className="border-b px-2 py-1 text-muted-foreground">{r[c]}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
            </section>

            <section className={card}>
              <h2 className="mb-3 font-semibold text-card-foreground">Columns &amp; data types</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-foreground">
                    {["Column", "Type", "Missing", "Unique", "Mean", "Std", "Min", "Median", "Max", "Outliers"].map((h) => <th key={h} className="border-b px-2 py-1 font-medium">{h}</th>)}
                  </tr></thead>
                  <tbody>{data.summaries.map((s) => (
                    <tr key={s.name} className="text-muted-foreground">
                      <td className="border-b px-2 py-1 font-medium text-foreground">{s.name}</td>
                      <td className="border-b px-2 py-1">{s.type}</td>
                      <td className="border-b px-2 py-1">{s.missing}</td>
                      <td className="border-b px-2 py-1">{s.unique}</td>
                      {s.numeric
                        ? [s.numeric.mean, s.numeric.std, s.numeric.min, s.numeric.median, s.numeric.max].map((v, i) => <td key={i} className="border-b px-2 py-1">{fmt(v)}</td>)
                        : <td colSpan={5} className="border-b px-2 py-1 italic">top: {s.topValues?.slice(0, 3).map((t) => `${t.value} (${t.count})`).join(", ")}</td>}
                      <td className="border-b px-2 py-1">{s.numeric?.outliers ?? "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className={card}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-card-foreground">Distribution</h2>
                  {numSummaries.length > 0 && (
                    <select value={numCol} onChange={(e) => setNumCol(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm text-foreground">
                      {numSummaries.map((s) => <option key={s.name}>{s.name}</option>)}
                    </select>
                  )}
                </div>
                {numSummaries.length ? (
                  <div className="h-64"><ResponsiveContainer><BarChart data={hist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="bin" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" allowDecimals={false} /><Tooltip />
                    <Bar dataKey="count" fill="var(--chart-2)" />
                  </BarChart></ResponsiveContainer></div>
                ) : <p className="text-sm text-muted-foreground">No numeric columns found.</p>}
              </div>
              <div className={card}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-card-foreground">Category counts (top 10)</h2>
                  {catSummaries.length > 0 && (
                    <select value={catCol} onChange={(e) => setCatCol(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm text-foreground">
                      {catSummaries.map((s) => <option key={s.name}>{s.name}</option>)}
                    </select>
                  )}
                </div>
                {catSummaries.length ? (
                  <div className="h-64"><ResponsiveContainer><BarChart data={catData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="value" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" allowDecimals={false} /><Tooltip />
                    <Bar dataKey="count" fill="var(--chart-1)" />
                  </BarChart></ResponsiveContainer></div>
                ) : <p className="text-sm text-muted-foreground">No categorical columns found.</p>}
              </div>
            </section>

            {data.correlation && (
              <section className={card}>
                <h2 className="mb-3 font-semibold text-card-foreground">Correlation heatmap (Pearson r)</h2>
                <div className="overflow-x-auto">
                  <table className="text-xs">
                    <thead><tr><th />{data.correlation.cols.map((c) => <th key={c} className="px-2 py-1 font-medium text-foreground">{c}</th>)}</tr></thead>
                    <tbody>{data.correlation.cols.map((c, i) => (
                      <tr key={c}>
                        <th className="px-2 py-1 text-right font-medium text-foreground">{c}</th>
                        {data.correlation!.matrix[i].map((r, j) => (
                          <td key={j} className="h-12 w-16 border text-center text-foreground"
                            style={{ background: Number.isFinite(r) ? `color-mix(in oklch, ${r >= 0 ? "var(--chart-2)" : "var(--destructive)"} ${Math.round(Math.abs(r) * 80)}%, transparent)` : undefined }}>
                            {Number.isFinite(r) ? r.toFixed(2) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="grid gap-4 lg:grid-cols-2">
              <div className={card}>
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-card-foreground"><AlertTriangle className="h-4 w-4 text-destructive" /> Data-quality checks</h2>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {data.summaries.filter((s) => s.missing > 0).map((s) => <li key={"m" + s.name}>Missing values in <b className="text-foreground">{s.name}</b>: {s.missing}</li>)}
                  {data.duplicates > 0 && <li>Duplicate rows: <b className="text-foreground">{data.duplicates}</b></li>}
                  {numSummaries.filter((s) => s.numeric!.outliers > 0).map((s) => <li key={"o" + s.name}>Potential outliers in <b className="text-foreground">{s.name}</b>: {s.numeric!.outliers} (1.5×IQR rule)</li>)}
                  {data.summaries.every((s) => s.missing === 0) && data.duplicates === 0 && numSummaries.every((s) => s.numeric!.outliers === 0) && <li>No issues detected.</li>}
                </ul>
              </div>
              <div className={card}>
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-card-foreground"><Lightbulb className="h-4 w-4 text-primary" /> Insights</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {data.insights.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">Generated by rules from the calculated statistics above — no external AI is used.</p>
              </div>
            </section>

            <section className={`${card} flex flex-wrap gap-3`}>
              <button onClick={() => download(summaryText(data, fileName), "analysis_summary.txt", "text/plain")}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Download className="h-4 w-4" /> Download summary
              </button>
              <button onClick={() => download(cleanedCsv(data), "cleaned_" + fileName, "text/csv")}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
                <Download className="h-4 w-4" /> Download cleaned CSV (duplicates removed, values trimmed)
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
