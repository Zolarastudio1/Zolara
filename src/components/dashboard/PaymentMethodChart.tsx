import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Banknote, CreditCard, Smartphone, Building2 } from "lucide-react";

interface PaymentMethodData {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

interface PaymentMethodChartProps {
  data: PaymentMethodData[];
  title?: string;
}

const methodIcons: Record<string, React.ReactNode> = {
  cash: <Banknote className="w-5 h-5" />,
  momo: <Smartphone className="w-5 h-5" />,
  card: <CreditCard className="w-5 h-5" />,
  bank_transfer: <Building2 className="w-5 h-5" />,
};

const methodColors: Record<string, string> = {
  cash: "bg-success/20 text-success border-success/30",
  momo: "bg-warning/20 text-warning border-warning/30",
  card: "bg-primary/20 text-primary border-primary/30",
  bank_transfer: "bg-info/20 text-info border-info/30",
};

const methodLabels: Record<string, string> = {
  cash: "Cash",
  momo: "Mobile Money",
  card: "Card",
  bank_transfer: "Bank Transfer",
};

export const PaymentMethodChart = ({ data, title = "Payment Methods" }: PaymentMethodChartProps) => {
  const totalAmount = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No payment data</p>
        ) : (
          data.map((item, index) => (
            <motion.div
              key={item.method}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg border ${methodColors[item.method] || "bg-muted text-muted-foreground"}`}>
                    {methodIcons[item.method] || <Banknote className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{methodLabels[item.method] || item.method}</p>
                    <p className="text-xs text-muted-foreground">{item.count} transactions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">GH₵{item.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</p>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                  className={`h-full rounded-full ${
                    item.method === "cash" ? "bg-success" :
                    item.method === "momo" ? "bg-warning" :
                    item.method === "card" ? "bg-primary" :
                    "bg-info"
                  }`}
                />
              </div>
            </motion.div>
          ))
        )}
        {data.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Revenue</span>
              <span className="text-lg font-bold text-primary">GH₵{totalAmount.toLocaleString()}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
