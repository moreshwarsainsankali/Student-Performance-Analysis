import { describe, expect, it } from "vitest";
import { analyze, parseCsv, CsvError, cleanedCsv, pearson } from "./analysis";

const csv = `name,age,score,city
Ann,20,80,Pune
Bob,22,85,Pune
Cid,,90,Mumbai
Ann,20,80,Pune
Dev,25,1000,Pune`;

describe("analysis", () => {
  it("rejects empty files", () => expect(() => parseCsv("  ")).toThrow(CsvError));
  it("rejects header-only files", () => expect(() => parseCsv("a,b\n")).toThrow(/no data rows/));
  it("computes overview from real data", () => {
    const { rows, columns } = parseCsv(csv);
    const a = analyze(rows, columns);
    expect(a.rowCount).toBe(5);
    expect(a.columns.length).toBe(4);
    expect(a.duplicates).toBe(1);
    const age = a.summaries.find((s) => s.name === "age")!;
    expect(age.type).toBe("numeric");
    expect(age.missing).toBe(1);
    expect(a.summaries.find((s) => s.name === "city")!.type).toBe("categorical");
    expect(a.summaries.find((s) => s.name === "score")!.numeric!.outliers).toBe(1);
  });
  it("cleaned CSV drops duplicates", () => {
    const { rows, columns } = parseCsv(csv);
    expect(cleanedCsv(analyze(rows, columns)).trim().split("\n").length).toBe(5);
  });
  it("pearson is 1 for a perfect line", () => expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1));
});
