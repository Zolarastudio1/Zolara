import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, Crown, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface TopServiceCardProps {
  serviceName: string;
  bookingCount?: number;
  revenue?: number;
}

export const TopServiceCard = ({
  serviceName,
  bookingCount,
  revenue,
}: TopServiceCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      <Card
        className="text-primary-foreground overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg,#D4AF37 0%,#B8956A 100%)",
          color: "#ffffff",
        }}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <CardHeader className="relative z-10 pb-2">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            <CardTitle className="text-lg font-display">Top Service This Month</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Scissors className="w-8 h-8" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{serviceName}</p>
              <div className="flex items-center gap-4 mt-1 text-sm opacity-90">
                {bookingCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    {bookingCount} bookings
                  </span>
                )}
                {revenue !== undefined && (
                  <span>GH₵{revenue.toLocaleString()} revenue</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default TopServiceCard;