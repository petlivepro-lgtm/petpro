"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type FinanceChartPoint = { month: string; income: number; expense: number };

// Paleta validada (scripts/validate_palette.js — lightness, croma, CVD, contraste ≥ 3:1)
const INCOME_COLOR = "#2D6CDF";
const EXPENSE_COLOR = "#B8842B";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Barras agrupadas: receitas x despesas por mês (valores em reais). */
export function FinanceBarChart({ data }: { data: FinanceChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#E5E9ED" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#66717C", fontSize: 12 }}
        />
        <YAxis
          width={64}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#66717C", fontSize: 12 }}
          tickFormatter={(v: number) => brl.format(v).replace(/,00$/, "")}
        />
        <Tooltip
          cursor={{ fill: "rgba(29, 78, 95, 0.06)" }}
          formatter={(value) => brl.format(Number(value))}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ color: "#3A4148", fontSize: 12 }}>{value}</span>
          )}
        />
        <Bar
          dataKey="income"
          name="Receitas"
          fill={INCOME_COLOR}
          maxBarSize={28}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="expense"
          name="Despesas"
          fill={EXPENSE_COLOR}
          maxBarSize={28}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
