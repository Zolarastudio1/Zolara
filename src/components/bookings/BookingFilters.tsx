import { Button } from "@/components/ui/button";
import { Calendar, LayoutGrid, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookingFilter = "all" | "today"| "completed" | "cancelled" | "confirmed" | "scheduled";
export type ViewMode = "card" | "calendar";

interface BookingFiltersProps {
  activeFilter: BookingFilter;
  onFilterChange: (filter: BookingFilter) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  todayCount?: number;
}

const filters: { key: BookingFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "scheduled", label: "Scheduled" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export const BookingFilters = ({
  activeFilter,
  onFilterChange,
  viewMode,
  onViewModeChange,
  todayCount = 0,
}: BookingFiltersProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Button
            key={filter.key}
            variant={activeFilter === filter.key ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange(filter.key)}
            className={cn(
              "rounded-full transition-all",
              activeFilter === filter.key && "shadow-md"
            )}
          >
            {filter.label}
            {filter.key === "today" && todayCount > 0 && (
              <span className="ml-1.5 bg-primary-foreground/20 text-primary-foreground px-1.5 py-0.5 rounded-full text-xs">
                {todayCount}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        <Button
          variant={viewMode === "card" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("card")}
          className="rounded-md"
        >
          <LayoutGrid className="w-4 h-4 mr-1" />
          Cards
        </Button>
        <Button
          variant={viewMode === "calendar" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("calendar")}
          className="rounded-md"
        >
          <CalendarDays className="w-4 h-4 mr-1" />
          Calendar
        </Button>
      </div>
    </div>
  );
};
