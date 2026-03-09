import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number | null;
  trendLabel?: string;
  variant?: "default" | "gold" | "blue" | "green" | "purple";
  delay?: number;
}

const variantStyles = {
  default: "from-card to-card border-border/50",
  gold: "from-primary/10 to-primary/5 border-primary/20",
  blue: "from-info/10 to-info/5 border-info/20",
  green: "from-success/10 to-success/5 border-success/20",
  purple: "from-chart-4/10 to-chart-4/5 border-chart-4/20",
};

const iconVariantStyles = {
  default: "bg-muted text-foreground",
  gold: "bg-primary/20 text-primary",
  blue: "bg-info/20 text-info",
  green: "bg-success/20 text-success",
  purple: "bg-chart-4/20 text-chart-4",
};

export const StatCard = ({
  title,
  value,
  icon,
  trend,
  trendLabel = "vs last month",
  variant = "default",
  delay = 0,
}: StatCardProps) => {
  const hasTrend = trend !== null && trend !== undefined;
  const isPositive = hasTrend && trend > 0;
  const isNegative = hasTrend && trend < 0;
  const isNeutral = hasTrend && trend === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card
        className={cn(
          "relative overflow-hidden bg-gradient-to-br border transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group",
          variantStyles[variant]
        )}
      >
        {/* Subtle shimmer effect on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-shimmer-gradient bg-[length:200%_100%] animate-shimmer transition-opacity" />
        
        <CardContent className="p-6 relative z-10">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {title}
              </p>
              <p className="text-3xl font-bold tracking-tight font-display">
                {value}
              </p>
              
              {hasTrend && (
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full",
                      isPositive && "bg-success-light text-success",
                      isNegative && "bg-destructive-light text-destructive",
                      isNeutral && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isPositive && <TrendingUp className="w-3.5 h-3.5" />}
                    {isNegative && <TrendingDown className="w-3.5 h-3.5" />}
                    {isNeutral && <Minus className="w-3.5 h-3.5" />}
                    <span>{isPositive && "+"}{trend}%</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{trendLabel}</span>
                </div>
              )}
            </div>
            
            <div
              className={cn(
                "p-3 rounded-xl transition-transform duration-300 group-hover:scale-110",
                iconVariantStyles[variant]
              )}
            >
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StatCard;