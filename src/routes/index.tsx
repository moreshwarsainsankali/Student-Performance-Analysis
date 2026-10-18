import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { GraduationCap, Users, TrendingUp, CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Student Performance Intelligence" },
      { name: "description", content: "Dashboard of sample student performance data with a demo score predictor." },
      { property: "og:title", content: "Student Performance Intelligence" },
      { property: "og:description", content: "Sample student performance dashboard with a demo score predictor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

// SAMPLE DATA — illustrative only, not real students.
const trend = [
  { month: "Jan", score: 62 }, { month: "Feb", score: 66 }, { month: "Mar", score: 64 },
  { month: "Apr", score: 70 }, { month: "May", score: 73 }, { month: "Jun", score: 76 },
];
const hoursVsScore = [
  { hours: "0-2", score: 52 }, { hours: "2-4", score: 61 }, { hours: "4-6", score: 70 },
  { hours: "6-8", score: 79 }, { hours: "8+", score: 85 },
];

// Demo formula — NOT a trained model.
export function demoPredict(hours: number, attendance: number) {
  const s = 30 + hours * 4 + attendance * 0.35;
  return Math.max(0, Math.min(100, Math.round(s)));
}

const stats = [
  { label: "Students (sample)", value: "248", icon: Users },
  { label: "Average score", value: "71.4%", icon: TrendingUp },
  { label: "Avg attendance", value: "86%", icon: CalendarCheck },
];

function Index() {
  const [hours, setHours] = useState("5");
  const [att, setAtt] = useState("85");
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState("");

  const predict = (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(hours), a = Number(att);
    if (isNaN(h) || h < 0 || h > 24) return setError("Study hours must be 0–24.");
    if (isNaN(a) || a < 0 || a > 100) return setError("Attendance must be 0–100%.");
    setError("");
    setResult(demoPredict(h, a));
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Student Performance Intelligence</h1>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Explore how study habits and attendance relate to exam results. All figures below are
            <span className="font-semibold text-foreground"> sample data</span> for demonstration.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                {s.label}<s.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 text-3xl font-bold text-card-foreground">{s.value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold text-card-foreground">Average score by month <span className="text-xs text-muted-foreground">(sample)</span></h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" />
                  <YAxis domain={[50, 90]} stroke="var(--muted-foreground)" />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="var(--chart-2)" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold text-card-foreground">Score by weekly study hours <span className="text-xs text-muted-foreground">(sample)</span></h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <BarChart data={hoursVsScore}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hours" stroke="var(--muted-foreground)" />
                  <YAxis stroke="var(--muted-foreground)" />
                  <Tooltip />
                  <Bar dataKey="score" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={predict} className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-card-foreground">Predict a score</h2>
            <label className="block text-sm text-muted-foreground">
              Study hours per day
              <input type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
            </label>
            <label className="block text-sm text-muted-foreground">
              Attendance (%)
              <input type="number" value={att} onChange={(e) => setAtt(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground" />
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit" className="rounded-md bg-primary px-5 py-2 font-medium text-primary-foreground hover:bg-primary/90">
              Predict
            </button>
          </form>

          <div className="rounded-xl border bg-secondary p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-secondary-foreground">Result</h2>
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground border">DEMO PREDICTION</span>
            </div>
            {result === null ? (
              <p className="mt-6 text-muted-foreground">Enter values and click Predict.</p>
            ) : (
              <div className="mt-6">
                <div className="text-5xl font-bold text-foreground">{result}%</div>
                <p className="mt-2 text-sm text-muted-foreground">Estimated exam score</p>
              </div>
            )}
            <p className="mt-6 text-xs text-muted-foreground">
              This uses a simple demo formula, not a trained machine learning model.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
