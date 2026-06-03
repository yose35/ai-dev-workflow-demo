"use client";
// Spec: specs/dashboard-kpi.md §5.3 — 單張折線圖（Revenue Volume 分頁用）
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeseriesPoint } from "@/lib/api-types";
import { formatValue, type MetricKey } from "@/lib/metrics-format";

interface Series {
  key: MetricKey;
  label: string;
  format: "money-k" | "percent" | "int" | "money";
  color: string;
}

const GREEN = "#16a34a";

export function MetricChart({
  title,
  points,
  series,
  /** 是否畫 0 基準線（GGR / Margin 用） */
  zeroBaseline = false,
}: {
  title: string;
  points: TimeseriesPoint[];
  series: Series[];
  zeroBaseline?: boolean;
}) {
  const empty = points.length === 0;
  const yFmt = (v: number) => formatValue(v, series[0]!.format);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-bold text-primary-900 mb-4">{title}</h3>
      <div className="h-64">
        {empty ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            此區間無資料
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(b: string) => b.slice(5)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={yFmt}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                formatter={(value, name) => {
                  const fmt =
                    series.find((s) => s.label === name)?.format ?? series[0]!.format;
                  return [formatValue(Number(value), fmt), String(name)];
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              {zeroBaseline && <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="4 4" />}
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export const CHART_GREEN = GREEN;
