import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { motion } from "framer-motion";

interface DonutChartProps {
  data: { name: string; value: number; color: string }[];
  title: string;
  subtitle?: string;
  centerValue?: string | number;
  centerLabel?: string;
}

export const DonutChart = ({
  data,
  title,
  subtitle,
  centerValue,
  centerLabel,
}: DonutChartProps) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="glass-card h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-display">{title}</CardTitle>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.75rem",
                    boxShadow: "0 10px 40px -10px rgba(0,0,0,0.2)",
                  }}
                  formatter={(value: number, name: string) => [
                    `${value} (${((value / total) * 100).toFixed(1)}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center text */}
            {centerValue && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold font-display">{centerValue}</span>
                {centerLabel && (
                  <span className="text-sm text-muted-foreground">{centerLabel}</span>
                )}
              </div>
            )}
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {data.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-muted-foreground">
                  {item.name} ({item.value})
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default DonutChart;