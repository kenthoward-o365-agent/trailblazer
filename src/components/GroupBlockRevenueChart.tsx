import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Allocation {
  allocation_date: string;
  rooms_blocked: number;
  override_rate: number | null;
}

interface GroupReservation {
  total_price: number;
}

interface GroupBlockRevenueChartProps {
  allocations: Allocation[];
  reservations: GroupReservation[];
}

export const GroupBlockRevenueChart = ({
  allocations,
  reservations,
}: GroupBlockRevenueChartProps) => {
  // Calculate blocked revenue from allocations (rooms_blocked * override_rate)
  const blockedRevenue = allocations.reduce(
    (sum, a) => sum + a.rooms_blocked * (a.override_rate || 0),
    0
  );

  // Calculate picked up revenue from reservations
  const pickedUpRevenue = reservations.reduce(
    (sum, r) => sum + (r.total_price || 0),
    0
  );

  // Remaining (forecasted but not yet picked up)
  const remainingRevenue = Math.max(0, blockedRevenue - pickedUpRevenue);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const chartData = [
    { name: "Picked Up", value: pickedUpRevenue, fill: "hsl(142, 71%, 45%)" },
    { name: "Remaining", value: remainingRevenue, fill: "hsl(217, 91%, 60%)" },
  ].filter((d) => d.value > 0);

  const pickupPercentage =
    blockedRevenue > 0 ? Math.round((pickedUpRevenue / blockedRevenue) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Forecasted Room Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        {blockedRevenue === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Add allocations with rates to see revenue forecast
          </div>
        ) : (
          <>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={2}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => (
                      <span className="text-xs text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5 text-sm border-t pt-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Blocked:</span>
                <span className="font-medium">{formatCurrency(blockedRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Picked Up:</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatCurrency(pickedUpRevenue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pickup %:</span>
                <span className="font-medium">{pickupPercentage}%</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
