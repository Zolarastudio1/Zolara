import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bell, 
  AlertTriangle, 
  Calendar, 
  Users, 
  Clock,
  CheckCircle2,
  Info
} from "lucide-react";

export interface Alert {
  id: string;
  type: "warning" | "info" | "success" | "error";
  title: string;
  message: string;
  timestamp?: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
  title?: string;
}

const alertStyles = {
  warning: {
    icon: AlertTriangle,
    bgColor: "bg-warning/10",
    borderColor: "border-warning/30",
    iconColor: "text-warning",
  },
  info: {
    icon: Info,
    bgColor: "bg-info/10",
    borderColor: "border-info/30",
    iconColor: "text-info",
  },
  success: {
    icon: CheckCircle2,
    bgColor: "bg-success/10",
    borderColor: "border-success/30",
    iconColor: "text-success",
  },
  error: {
    icon: AlertTriangle,
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    iconColor: "text-destructive",
  },
};

export const AlertsPanel = ({ alerts, title = "Alerts & Notifications" }: AlertsPanelProps) => {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-warning" />
            {title}
          </CardTitle>
          {alerts.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {alerts.length} new
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <AnimatePresence>
          {alerts.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-10 h-10 text-success/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All clear! No alerts</p>
            </div>
          ) : (
            alerts.slice(0, 5).map((alert, index) => {
              const style = alertStyles[alert.type];
              const Icon = style.icon;
              
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${style.bgColor} ${style.borderColor}`}
                >
                  <div className={`flex-shrink-0 mt-0.5 ${style.iconColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                  </div>
                  {alert.timestamp && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {alert.timestamp}
                    </span>
                  )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

// Helper function to generate common alerts
export const generateAlerts = ({
  todayBookings,
  pendingRequests,
  absentStaff,
  lowBookingThreshold = 3,
}: {
  todayBookings: number;
  pendingRequests: number;
  absentStaff: string[];
  lowBookingThreshold?: number;
}): Alert[] => {
  const alerts: Alert[] = [];

  if (todayBookings < lowBookingThreshold) {
    alerts.push({
      id: "low-bookings",
      type: "warning",
      title: "Low Bookings Today",
      message: `Only ${todayBookings} booking${todayBookings !== 1 ? "s" : ""} scheduled for today`,
      timestamp: "Now",
    });
  }

  if (pendingRequests > 0) {
    alerts.push({
      id: "pending-requests",
      type: "info",
      title: "Pending Requests",
      message: `${pendingRequests} booking request${pendingRequests !== 1 ? "s" : ""} awaiting approval`,
      timestamp: "Now",
    });
  }

  if (absentStaff.length > 0) {
    alerts.push({
      id: "absent-staff",
      type: "warning",
      title: "Staff Absent Today",
      message: absentStaff.length === 1 
        ? `${absentStaff[0]} is not checked in`
        : `${absentStaff.length} staff members not checked in`,
      timestamp: "Now",
    });
  }

  if (todayBookings === 0) {
    alerts.push({
      id: "no-appointments",
      type: "info",
      title: "No Appointments",
      message: "No appointments scheduled for today",
      timestamp: "Now",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "all-good",
      type: "success",
      title: "All Systems Normal",
      message: "Everything is running smoothly",
      timestamp: "Now",
    });
  }

  return alerts;
};
