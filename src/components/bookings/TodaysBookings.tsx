import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isToday, parseISO } from "date-fns";
import { CalendarCheck, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface TodaysBookingsProps {
  bookings: any[];
  onBookingClick: (booking: any) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "scheduled":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "confirmed":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "cancelled":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
  }
};

export const TodaysBookings = ({ bookings, onBookingClick }: TodaysBookingsProps) => {
  const todaysBookings = bookings
    .filter((b) => isToday(parseISO(b.appointment_date)))
    .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

  const pendingCount = todaysBookings.filter(
    (b) => b.status === "scheduled" || b.status === "confirmed"
  ).length;
  const completedCount = todaysBookings.filter((b) => b.status === "completed").length;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Today's Bookings</CardTitle>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-primary/10">
              {pendingCount} pending
            </Badge>
            <Badge variant="outline" className="bg-green-100 text-green-800">
              {completedCount} completed
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {todaysBookings.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No bookings scheduled for today
          </p>
        ) : (
          <div className="space-y-2">
            {todaysBookings.slice(0, 5).map((booking) => (
              <div
                key={booking.id}
                onClick={() => onBookingClick(booking)}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {booking.appointment_time}
                  </div>
                  <div>
                    <p className="font-medium">{booking.clients?.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {booking.services?.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {booking.staff?.full_name && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {booking.staff.full_name}
                    </span>
                  )}
                  <Badge className={cn(getStatusColor(booking.status), "text-xs")}>
                    {booking.status}
                  </Badge>
                </div>
              </div>
            ))}
            {todaysBookings.length > 5 && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                +{todaysBookings.length - 5} more bookings today
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
