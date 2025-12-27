import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Trophy, Star, TrendingUp } from "lucide-react";

interface StaffPerformance {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
  specialization?: string;
}

interface TopStaffCardProps {
  data: StaffPerformance[];
  title?: string;
  subtitle?: string;
}

export const TopStaffCard = ({ data, title = "Top Performing Staff", subtitle }: TopStaffCardProps) => {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return <Badge className="bg-gold text-gold-foreground text-xs"><Trophy className="w-3 h-3 mr-1" />1st</Badge>;
      case 1:
        return <Badge variant="secondary" className="text-xs"><Star className="w-3 h-3 mr-1" />2nd</Badge>;
      case 2:
        return <Badge variant="outline" className="text-xs">3rd</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-gold" />
              {title}
            </CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No staff data available</p>
        ) : (
          data.slice(0, 5).map((staff, index) => (
            <motion.div
              key={staff.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                index === 0 ? "bg-gold/10 border border-gold/20" : "bg-muted/30 hover:bg-muted/50"
              }`}
            >
              <div className="relative">
                <Avatar className={`w-10 h-10 ${index === 0 ? "ring-2 ring-gold" : ""}`}>
                  <AvatarFallback className={index === 0 ? "bg-gold/20 text-gold" : ""}>
                    {getInitials(staff.name)}
                  </AvatarFallback>
                </Avatar>
                {index < 3 && (
                  <div className="absolute -bottom-1 -right-1">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      index === 0 ? "bg-gold text-gold-foreground" :
                      index === 1 ? "bg-muted-foreground/30 text-foreground" :
                      "bg-amber-700/50 text-foreground"
                    }`}>
                      {index + 1}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{staff.name}</p>
                  {index === 0 && getRankBadge(index)}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {staff.specialization || "General"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{staff.bookings} bookings</p>
                <p className="text-xs text-success flex items-center justify-end gap-1">
                  <TrendingUp className="w-3 h-3" />
                  GH₵{staff.revenue.toLocaleString()}
                </p>
              </div>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
