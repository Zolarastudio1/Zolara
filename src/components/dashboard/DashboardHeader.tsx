import { motion } from "framer-motion";
import { format } from "date-fns";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  userName?: string;
}

export const DashboardHeader = ({
  title,
  subtitle,
  userName,
}: DashboardHeaderProps) => {
  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-8"
    >
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold font-display tracking-tight">
            {userName ? `${greeting()}, ${userName}` : title}
          </h1>
          <p className="text-muted-foreground mt-1">
            {subtitle || `Here's what's happening today, ${format(new Date(), "EEEE, MMMM d, yyyy")}`}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm text-muted-foreground">Current time</p>
            <p className="text-lg font-semibold">{format(new Date(), "h:mm a")}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DashboardHeader;