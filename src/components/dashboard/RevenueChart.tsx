import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";

interface RevenueChartProps {
  data: { name: string; revenue: number; bookings?: number }[];
  title?: string;
  subtitle?: string;
}

export const RevenueChart = ({
  data,
  title = "Revenue Overview",
  subtitle = "Monthly revenue trends",
}: RevenueChartProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-display">{title}</CardTitle>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(38, 70%, 50%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(38, 70%, 50%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bookingsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(210, 80%, 52%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(210, 80%, 52%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  className="text-xs fill-muted-foreground"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  className="text-xs fill-muted-foreground"
                  tickFormatter={(value) => `₵${value.toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.75rem",
                    boxShadow: "0 10px 40px -10px rgba(0,0,0,0.2)",
                  }}
                  formatter={(value: number, name: string) => [
                    name === "revenue" ? `GH₵${value.toLocaleString()}` : value,
                    name === "revenue" ? "Revenue" : "Bookings",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(38, 70%, 50%)"
                  strokeWidth={3}
                  fill="url(#revenueGradient)"
                />
                {data[0]?.bookings !== undefined && (
                  <Area
                    type="monotone"
                    dataKey="bookings"
                    stroke="hsl(210, 80%, 52%)"
                    strokeWidth={2}
                    fill="url(#bookingsGradient)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default RevenueChart;