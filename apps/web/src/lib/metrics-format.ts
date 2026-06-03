// Spec: specs/dashboard-kpi.md §4 / §5.2 — KPI 顯示設定與格式化
// 由 GET /metrics/kpi 回傳的純量值（金額為元、margin 為百分比）轉成畫面字串。

export type MetricKey =
  | "wager"
  | "validWager"
  | "ggr"
  | "margin"
  | "playerCount"
  | "betCount"
  | "atppu";

type Format = "money-k" | "percent" | "int" | "money";

export interface MetricMeta {
  key: MetricKey;
  label: string;
  format: Format;
}

// KPI 卡顯示順序，對齊截圖
export const METRIC_META: MetricMeta[] = [
  { key: "wager", label: "Wager", format: "money-k" },
  { key: "validWager", label: "Valid Wager", format: "money-k" },
  { key: "ggr", label: "GGR", format: "money-k" },
  { key: "margin", label: "Margin", format: "percent" },
  { key: "playerCount", label: "Player Count", format: "int" },
  { key: "betCount", label: "Bet Count", format: "int" },
  { key: "atppu", label: "ATPPU", format: "money" },
];

const intFmt = new Intl.NumberFormat("en-US");

/** 主數值顯示（如 7,397K / -63.83% / 16,901） */
export function formatValue(value: number, format: Format): string {
  switch (format) {
    case "money-k": {
      const k = value / 1000;
      return `${intFmt.format(Math.round(k))}K`;
    }
    case "percent":
      return `${value.toFixed(2)}%`;
    case "int":
      return intFmt.format(Math.round(value));
    case "money":
      return intFmt.format(Math.round(value));
  }
}

/** 比較期文字（vs 2,961K Comp Period） */
export function formatCompare(value: number, format: Format): string {
  return `vs ${formatValue(value, format)} Comp Period`;
}

/** 變化率：回 { text, positive }；null → 顯示 — */
export function formatChange(changePct: number | null): {
  text: string;
  positive: boolean | null;
} {
  if (changePct === null) return { text: "—", positive: null };
  const positive = changePct >= 0;
  const arrow = positive ? "▲" : "▼";
  return { text: `${arrow} ${Math.abs(changePct).toFixed(1)}%`, positive };
}
