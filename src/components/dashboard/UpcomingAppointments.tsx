import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Clock, User, Scissors } from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";

interface Appointment {
  id: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
}

interface UpcomingAppointmentsProps {
  appointments: Appointment[];
  title?: string;
}

export const UpcomingAppointments = ({ appointments, title = "Upcoming Appointments" }: UpcomingAppointmentsProps) => {
  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  const formatTime = (time: string) => {
    try {
      const [hours, minutes] = time.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const formattedHour = hour % 12 || 12;
      return `${formattedHour}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-success/20 text-success border-success/30";
      case "scheduled":
        return "bg-primary/20 text-primary border-primary/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {appointments.length === 0 ? (
          <div className="text-center py-6">
            <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No upcoming appointments</p>
          </div>
        ) : (
          appointments.slice(0, 3).map((apt, index) => (
            <motion.div
              key={apt.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/30"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
                  <span className="text-xs font-medium text-primary">
                    {getDateLabel(apt.date).split(",")[0]}
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {formatTime(apt.time).split(" ")[0]}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-sm font-medium truncate">{apt.clientName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground truncate">{apt.serviceName}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline" className={`text-[10px] ${getStatusColor(apt.status)}`}>
                  {apt.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{getDateLabel(apt.date)}</span>
              </div>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
