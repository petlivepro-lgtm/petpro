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

export type StockChartPoint = { name: string; stock: number; min: number };

// Ênfase (estoque) + série de contexto em cinza; identidade reforçada por legenda e tooltip.
const STOCK_COLOR = "#2D6CDF";
const MIN_COLOR = "#66717C";

/** Barras horizontais: estoque atual x mínimo dos produtos mais críticos. */
export function StockBarChart({ data }: { data: StockChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        barGap={2}
        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid horizontal={false} stroke="#E5E9ED" />
        <XAxis
          type="number"
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#66717C", fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#3A4148", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "rgba(29, 78, 95, 0.06)" }}
          formatter={(value) => `${value} un.`}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ color: "#3A4148", fontSize: 12 }}>{value}</span>
          )}
        />
        <Bar
          dataKey="stock"
          name="Estoque atual"
          fill={STOCK_COLOR}
          maxBarSize={16}
          radius={[0, 4, 4, 0]}
        />
        <Bar
          dataKey="min"
          name="Mínimo"
          fill={MIN_COLOR}
          maxBarSize={16}
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
