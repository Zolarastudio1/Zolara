import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, CheckCircle2, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface SyncStatusProps {
  lastSync: Date | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const SyncStatus = ({ lastSync, isLoading = false, onRefresh }: SyncStatusProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const getTimeSince = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return "Just now";
    if (seconds < 120) return "1 min ago";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
    if (seconds < 7200) return "1 hour ago";
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return format(date, "MMM d, h:mm a");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-3 text-xs text-muted-foreground"
    >
      {/* Connection Status */}
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full",
        isOnline ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
      )}>
        {isOnline ? (
          <>
            <Wifi className="w-3 h-3" />
            <span>Online</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-border" />

      {/* Last Sync */}
      <div className="flex items-center gap-1.5">
        {isLoading ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : (
          <CheckCircle2 className="w-3 h-3 text-success" />
        )}
        <span>
          Last synced: {lastSync ? getTimeSince(lastSync) : "Never"}
        </span>
      </div>

      {/* Refresh Button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 hover:bg-muted rounded-full transition-colors disabled:opacity-50"
          title="Refresh data"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
        </button>
      )}
    </motion.div>
  );
};
