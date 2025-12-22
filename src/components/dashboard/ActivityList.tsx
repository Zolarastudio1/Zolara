import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  title: string;
  subtitle?: string;
  date: Date | string;
  status?: string;
  amount?: number;
  icon?: React.ReactNode;
}

interface ActivityListProps {
  title: string;
  subtitle?: string;
  items: ActivityItem[];
  emptyMessage?: string;
  showAmount?: boolean;
  icon?: React.ReactNode;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-info-light text-info",
  confirmed: "bg-success-light text-success",
  completed: "bg-muted text-foreground",
  cancelled: "bg-destructive-light text-destructive",
  no_show: "bg-warning-light text-warning",
  pending: "bg-warning-light text-warning",
};

export const ActivityList = ({
  title,
  subtitle,
  items,
  emptyMessage = "No activity yet",
  showAmount = false,
  icon,
}: ActivityListProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card className="glass-card h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <CardTitle className="text-xl font-display">{title}</CardTitle>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 * index }}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.icon && (
                      <div className="flex-shrink-0 p-2 rounded-lg bg-background">
                        {item.icon}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.subtitle ||
                          format(new Date(item.date), "MMM d, yyyy • h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.status && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "capitalize font-medium",
                          statusColors[item.status] || "bg-muted text-foreground"
                        )}
                      >
                        {item.status.replace("_", " ")}
                      </Badge>
                    )}
                    {showAmount && item.amount !== undefined && (
                      <Badge className="bg-success-light text-success font-semibold">
                        GH₵{item.amount.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ActivityList;