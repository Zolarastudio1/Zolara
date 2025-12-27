import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  bookings: any[];
  onBookingClick: (booking: any) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

const getStatusColor = (status: string) => {
  switch (status) {
    case "scheduled":
      return "bg-blue-100 border-blue-300 text-blue-800";
    case "confirmed":
      return "bg-yellow-100 border-yellow-300 text-yellow-800";
    case "completed":
      return "bg-green-100 border-green-300 text-green-800";
    case "cancelled":
      return "bg-red-100 border-red-300 text-red-800";
    default:
      return "bg-gray-100 border-gray-300 text-gray-700";
  }
};

export const CalendarView = ({ bookings, onBookingClick }: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week">("week");

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getBookingsForDayAndHour = (day: Date, hour: number) => {
    return bookings.filter((booking) => {
      const bookingDate = parseISO(booking.appointment_date);
      const bookingHour = parseInt(booking.appointment_time.split(":")[0], 10);
      return isSameDay(bookingDate, day) && bookingHour === hour;
    });
  };

  const getBookingsForDay = (day: Date) => {
    return bookings.filter((booking) => {
      const bookingDate = parseISO(booking.appointment_date);
      return isSameDay(bookingDate, day);
    });
  };

  const navigatePrev = () => {
    if (view === "week") {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      setCurrentDate(addDays(currentDate, -1));
    }
  };

  const navigateNext = () => {
    if (view === "week") {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={navigatePrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <CardTitle className="text-lg">
            {view === "week"
              ? `${format(weekStart, "MMM d")} - ${format(addDays(weekStart, 6), "MMM d, yyyy")}`
              : format(currentDate, "EEEE, MMMM d, yyyy")}
          </CardTitle>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={view === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("day")}
            >
              Day
            </Button>
            <Button
              variant={view === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("week")}
            >
              Week
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {view === "week" ? (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Day Headers */}
              <div className="grid grid-cols-8 border-b">
                <div className="p-2 text-center text-xs text-muted-foreground font-medium border-r">
                  Time
                </div>
                {weekDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "p-2 text-center border-r last:border-r-0",
                      isSameDay(day, new Date()) && "bg-primary/10"
                    )}
                  >
                    <p className="text-xs text-muted-foreground">
                      {format(day, "EEE")}
                    </p>
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isSameDay(day, new Date()) && "text-primary"
                      )}
                    >
                      {format(day, "d")}
                    </p>
                  </div>
                ))}
              </div>

              {/* Time Slots */}
              {HOURS.map((hour) => (
                <div key={hour} className="grid grid-cols-8 border-b last:border-b-0">
                  <div className="p-2 text-xs text-muted-foreground font-medium border-r text-right pr-3">
                    {hour}:00
                  </div>
                  {weekDays.map((day) => {
                    const dayBookings = getBookingsForDayAndHour(day, hour);
                    return (
                      <div
                        key={`${day.toISOString()}-${hour}`}
                        className="min-h-[60px] p-1 border-r last:border-r-0"
                      >
                        {dayBookings.map((booking) => (
                          <div
                            key={booking.id}
                            onClick={() => onBookingClick(booking)}
                            className={cn(
                              "p-1 rounded text-xs cursor-pointer border hover:shadow-md transition-shadow mb-1",
                              getStatusColor(booking.status)
                            )}
                          >
                            <p className="font-medium truncate">
                              {booking.clients?.full_name}
                            </p>
                            <p className="truncate opacity-80">
                              {booking.services?.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Day View */
          <div>
            {HOURS.map((hour) => {
              const hourBookings = getBookingsForDayAndHour(currentDate, hour);
              return (
                <div key={hour} className="flex border-b last:border-b-0">
                  <div className="w-20 p-3 text-sm text-muted-foreground font-medium border-r text-right">
                    {hour}:00
                  </div>
                  <div className="flex-1 min-h-[80px] p-2">
                    {hourBookings.map((booking) => (
                      <div
                        key={booking.id}
                        onClick={() => onBookingClick(booking)}
                        className={cn(
                          "p-2 rounded-lg cursor-pointer border hover:shadow-md transition-shadow mb-1",
                          getStatusColor(booking.status)
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {booking.clients?.full_name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {booking.appointment_time}
                          </Badge>
                        </div>
                        <p className="text-sm opacity-80">
                          {booking.services?.name}
                        </p>
                        {booking.staff?.full_name && (
                          <p className="text-xs opacity-60">
                            Staff: {booking.staff.full_name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
