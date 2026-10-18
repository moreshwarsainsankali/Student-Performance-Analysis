# DataLens AI

Upload a CSV and get an instant exploratory data analysis: overview, data types, missing values,
duplicates, descriptive statistics, distributions, category counts, a correlation heatmap,
data-quality checks, rule-based insights, and downloads (summary + cleaned CSV).

## Two versions

| Version | Where | Tech |
|---|---|---|
| Web app (live preview) | `src/` | React + TypeScript, PapaParse, Recharts — runs fully in the browser |
| Python version | `python/` | Streamlit, Pandas, NumPy, Plotly — run locally |

The hosting platform cannot run a Python server, so the live web app implements the same analysis in
TypeScript. The Python version is provided for local use.

## Run the web app
```
bun install
bun run dev
bunx vitest run src/lib/analysis.test.ts   # tests
```

## Run the Python version
```
cd python
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

## Key files
- `src/lib/analysis.ts` — parsing, validation, statistics, correlation, insights, cleaned CSV.
- `src/routes/index.tsx` — the page: upload, tables, charts, downloads.
- `public/sample_students.csv` — small test dataset (contains a missing value, a duplicate and an outlier on purpose).
- `python/app.py` — Streamlit equivalent.
