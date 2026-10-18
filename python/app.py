"""DataLens AI — Streamlit version (run locally; the web preview uses the browser version).

Run:  pip install -r requirements.txt  &&  streamlit run app.py
"""
import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st

MAX_MB = 5

st.set_page_config(page_title="DataLens AI", layout="wide")
st.title("DataLens AI")
st.caption("Upload a CSV to get an overview, statistics, charts, quality checks and insights.")


def load_csv(file):
    """Read and validate an uploaded CSV. Returns a DataFrame or raises ValueError."""
    if file.size > MAX_MB * 1024 * 1024:
        raise ValueError(f"File too large. Maximum is {MAX_MB} MB.")
    try:
        df = pd.read_csv(file)
    except pd.errors.EmptyDataError:
        raise ValueError("The file is empty.")
    except pd.errors.ParserError:
        raise ValueError("This does not look like a valid CSV.")
    if df.empty:
        raise ValueError("The file has a header but no data rows.")
    return df


def outlier_count(s: pd.Series) -> int:
    """Count values outside 1.5 x IQR."""
    q1, q3 = s.quantile([0.25, 0.75])
    iqr = q3 - q1
    return int(((s < q1 - 1.5 * iqr) | (s > q3 + 1.5 * iqr)).sum())


def insights(df: pd.DataFrame) -> list[str]:
    """Rule-based insights from calculated statistics only."""
    out = [f"{len(df)} rows and {df.shape[1]} columns."]
    for col, pct in (df.isna().mean() * 100).items():
        if pct > 20:
            out.append(f"'{col}' is missing {pct:.1f}% of values.")
    if (d := df.duplicated().sum()) > 0:
        out.append(f"{d} duplicate rows found.")
    num = df.select_dtypes(np.number)
    for col in num:
        if (n := outlier_count(num[col].dropna())) > 0:
            out.append(f"'{col}' has {n} potential outlier(s) (1.5×IQR).")
    if num.shape[1] >= 2:
        corr = num.corr()
        cols = corr.columns
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                r = corr.iloc[i, j]
                if abs(r) >= 0.7:
                    out.append(f"'{cols[i]}' and '{cols[j]}' are strongly correlated (r={r:.2f}). Correlation is not causation.")
    return out


file = st.file_uploader("Upload CSV", type="csv")
if file:
    try:
        df = load_csv(file)
    except ValueError as e:
        st.error(str(e))
        st.stop()

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Rows", len(df)); c2.metric("Columns", df.shape[1])
    c3.metric("Missing cells", int(df.isna().sum().sum())); c4.metric("Duplicates", int(df.duplicated().sum()))

    st.subheader("Preview"); st.dataframe(df.head(10))
    st.subheader("Data types & missing values")
    st.dataframe(pd.DataFrame({"dtype": df.dtypes.astype(str), "missing": df.isna().sum(), "unique": df.nunique()}))

    num = df.select_dtypes(np.number); cat = df.select_dtypes(exclude=np.number)
    if not num.empty:
        st.subheader("Descriptive statistics"); st.dataframe(num.describe().T)
        col = st.selectbox("Distribution of", num.columns)
        st.plotly_chart(px.histogram(df, x=col), use_container_width=True)
    if not cat.empty:
        col = st.selectbox("Category counts for", cat.columns)
        counts = df[col].value_counts().head(10).reset_index()
        counts.columns = [col, "count"]
        st.plotly_chart(px.bar(counts, x=col, y="count"), use_container_width=True)
    if num.shape[1] >= 2:
        st.subheader("Correlation heatmap")
        st.plotly_chart(px.imshow(num.corr(), text_auto=".2f", color_continuous_scale="RdBu", zmin=-1, zmax=1), use_container_width=True)

    st.subheader("Insights")
    for line in insights(df):
        st.write("- " + line)

    st.download_button("Download cleaned CSV", df.drop_duplicates().to_csv(index=False), "cleaned.csv", "text/csv")
