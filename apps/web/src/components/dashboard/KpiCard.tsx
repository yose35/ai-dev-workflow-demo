"use client";
// Spec: specs/dashboard-kpi.md §5.2 — 單張 KPI 卡（值 + 環比 + sparkline）
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import type { KpiCell } from "@/lib/api-types";
import {
  formatValue,
  formatCompare,
  formatChange,
  type MetricMeta,
} from "@/lib/metrics-format";

const GREEN = "#16a34a";
const RED = "#dc2626";

export function KpiCard({ meta, cell }: { meta: MetricMeta; cell: KpiCell }) {
  const change = formatChange(cell.changePct);
  const changeColor =
    change.positive === null
      ? "text-slate-400"
      : change.positive
        ? "text-green-600"
        : "text-red-600";
  const sparkColor = change.positive === false ? RED : GREEN;
  const sparkData = cell.spark.map((v, i) => ({ i, v }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 w-[200px] shrink-0 snap-start">
      <p className="text-sm text-slate-500 mb-1">{meta.label}</p>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold text-primary-900 tabular-nums">
          {formatValue(cell.value, meta.format)}
        </span>
        <span className={`text-xs font-semibold ${changeColor}`}>{change.text}</span>
      </div>
      <p className="text-xs text-slate-400 mb-2">
        {formatCompare(cell.compare, meta.format)}
      </p>
      <div className="h-10">
        {sparkData.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line
                type="monotone"
                dataKey="v"
                stroke={sparkColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
