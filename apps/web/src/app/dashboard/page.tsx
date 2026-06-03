"use client";
// Spec: specs/dashboard-kpi.md — 營運 KPI 儀表板（第一期：Revenue Volume）
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useApiReady } from "@/components/MswProvider";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MetricChart, CHART_GREEN } from "@/components/dashboard/MetricChart";
import { METRIC_META } from "@/lib/metrics-format";
import type {
  KpiResponse,
  TimeseriesResponse,
  TimeseriesPoint,
} from "@/lib/api-types";

const BRANDS = [
  { key: "choice", label: "Choice" },
  { key: "eeze", label: "Eeze" },
  { key: "lucky", label: "Lucky" },
] as const;

const GRANULARITIES = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
] as const;

const TABS = ["Revenue Volume", "User Growth", "User Engagement", "Monetization"];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function defaultRange() {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to.getTime() - 6 * 86_400_000);
  return { from: ymd(from), to: ymd(to) };
}

export default function DashboardPage() {
  const api = useApiReady();
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");
  // 空陣列 = All
  const [brands, setBrands] = useState<string[]>([]);
  const [tab, setTab] = useState(TABS[0]);

  const [kpi, setKpi] = useState<KpiResponse["data"] | null>(null);
  const [points, setPoints] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!api.ready) return;
    const { from, to } = defaultRange();
    const brandParam = brands.length ? `&brands=${brands.join(",")}` : "";
    const base = `from=${from}&to=${to}&granularity=${granularity}${brandParam}`;

    setLoading(true);
    setErr(null);
    Promise.all([
      apiFetch<KpiResponse>(`/metrics/kpi?${base}`),
      apiFetch<TimeseriesResponse>(
        `/metrics/timeseries?${base}&metrics=wager,validWager,ggr,margin,atppu`
      ),
    ])
      .then(([k, ts]) => {
        setKpi(k.data);
        setPoints(ts.data.points);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [api.ready, granularity, brands]);

  function toggleBrand(key: string) {
    setBrands((prev) =>
      prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key]
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      {/* ── 標題列 ───────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-primary-900">KPI Overview</h1>
          {kpi && (
            <p className="text-xs text-slate-400 mt-1">
              本期 {kpi.period.from} ~ {kpi.period.to} · 比較期 {kpi.compare.from} ~{" "}
              {kpi.compare.to}
              {kpi.source === "seed" && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                  示範資料 (seed)
                </span>
              )}
            </p>
          )}
        </div>
        {/* View by */}
        <div className="flex items-center gap-1 text-sm">
          <span className="text-slate-400 mr-1">View by</span>
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              onClick={() => setGranularity(g.key)}
              className={
                granularity === g.key
                  ? "px-2.5 py-1 rounded-md bg-primary-900 text-white font-semibold"
                  : "px-2.5 py-1 rounded-md text-slate-600 hover:bg-slate-100"
              }
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 品牌篩選 chips ───────────────────────────── */}
      <div className="flex items-center gap-2 mb-6">
        <Chip active={brands.length === 0} onClick={() => setBrands([])}>
          All
        </Chip>
        {BRANDS.map((b) => (
          <Chip key={b.key} active={brands.includes(b.key)} onClick={() => toggleBrand(b.key)}>
            {b.label}
          </Chip>
        ))}
      </div>

      {/* ── 錯誤 / 載入 ──────────────────────────────── */}
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm mb-6">
          載入失敗：{err}
        </div>
      )}

      {/* ── KPI 卡片（橫向捲動，spec §5.2）──────────────── */}
      <div className="flex gap-3 mb-8 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {loading || !kpi
          ? METRIC_META.map((m) => <CardSkeleton key={m.key} />)
          : METRIC_META.map((m) => (
              <KpiCard key={m.key} meta={m} cell={kpi.kpis[m.key]} />
            ))}
      </div>

      {/* ── Chart View ───────────────────────────────── */}
      <div className="border-b border-slate-200 mb-5 flex gap-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "pb-2 -mb-px border-b-2 border-primary-900 text-primary-900 font-semibold text-sm"
                : "pb-2 text-slate-500 hover:text-slate-700 text-sm"
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Revenue Volume" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MetricChart
            title="Wager Volume Analysis"
            points={points}
            series={[{ key: "wager", label: "Wager", format: "money-k", color: CHART_GREEN }]}
          />
          <MetricChart
            title="Valid Wager Analysis"
            points={points}
            series={[
              { key: "validWager", label: "Valid Wager", format: "money-k", color: CHART_GREEN },
            ]}
          />
          <MetricChart
            title="Margin"
            points={points}
            zeroBaseline
            series={[{ key: "margin", label: "Margin", format: "percent", color: CHART_GREEN }]}
          />
          <MetricChart
            title="GGR"
            points={points}
            zeroBaseline
            series={[{ key: "ggr", label: "GGR", format: "money-k", color: CHART_GREEN }]}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-400">
          「{tab}」分頁為第二期範圍（見 specs/dashboard-kpi.md §2）。
        </div>
      )}
    </main>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "px-3 py-1.5 rounded-full border border-primary-900 bg-primary-50 text-primary-900 text-sm font-semibold"
          : "px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 text-sm hover:border-slate-300"
      }
    >
      {children}
    </button>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 w-[200px] shrink-0 animate-pulse">
      <div className="h-3 w-16 bg-slate-100 rounded mb-3" />
      <div className="h-6 w-24 bg-slate-100 rounded mb-2" />
      <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
      <div className="h-10 bg-slate-50 rounded" />
    </div>
  );
}
