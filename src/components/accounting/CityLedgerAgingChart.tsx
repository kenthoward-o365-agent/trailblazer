import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface AgingData {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
}

interface CityLedgerAgingChartProps {
  data: AgingData;
  size?: "small" | "large";
}

const COLORS = {
  current: "hsl(142, 76%, 36%)", // Green
  days30: "hsl(48, 96%, 53%)",   // Yellow
  days60: "hsl(25, 95%, 53%)",   // Orange
  days90: "hsl(0, 84%, 60%)",    // Red
  over90: "hsl(0, 72%, 51%)",    // Dark Red
};

export function CityLedgerAgingChart({ data, size = "large" }: CityLedgerAgingChartProps) {
  const chartData = [
    { name: "Current", value: data.current, color: COLORS.current },
    { name: "1-30 Days", value: data.days30, color: COLORS.days30 },
    { name: "31-60 Days", value: data.days60, color: COLORS.days60 },
    { name: "61-90 Days", value: data.days90, color: COLORS.days90 },
    { name: "90+ Days", value: data.over90, color: COLORS.over90 },
  ].filter(item => item.value > 0);

  const total = Object.values(data).reduce((sum, val) => sum + val, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No outstanding invoices
      </div>
    );
  }

  const renderCustomLabel = ({ name, value, percent }: any) => {
    if (size === "small") return null;
    return `$${value.toFixed(0)} (${(percent * 100).toFixed(0)}%)`;
  };

  return (
    <ResponsiveContainer width="100%" height={size === "small" ? 120 : 300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={size === "small" ? 25 : 60}
          outerRadius={size === "small" ? 50 : 100}
          paddingAngle={2}
          dataKey="value"
          label={size === "large" ? renderCustomLabel : false}
          labelLine={size === "large"}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [`$${value.toFixed(2)}`, "Amount"]}
        />
        {size === "large" && (
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-sm">{value}</span>}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
