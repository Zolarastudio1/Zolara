import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

export type DateFilterType = "today" | "week" | "month" | "custom";

interface DateFilterProps {
  onFilterChange: (filter: DateFilterType, dateRange: { start: Date; end: Date }) => void;
  currentFilter: DateFilterType;
}

export const DateFilter = ({ onFilterChange, currentFilter }: DateFilterProps) => {
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleFilterClick = (filter: DateFilterType) => {
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (filter) {
      case "today":
        start = startOfDay(today);
        end = endOfDay(today);
        break;
      case "week":
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "month":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case "custom":
        if (customRange?.from && customRange?.to) {
          start = startOfDay(customRange.from);
          end = endOfDay(customRange.to);
        } else {
          return;
        }
        break;
      default:
        start = startOfDay(today);
        end = endOfDay(today);
    }

    onFilterChange(filter, { start, end });
  };

  const handleCustomRangeSelect = (range: DateRange | undefined) => {
    setCustomRange(range);
    if (range?.from && range?.to) {
      onFilterChange("custom", {
        start: startOfDay(range.from),
        end: endOfDay(range.to),
      });
      setPopoverOpen(false);
    }
  };

  const filters: { key: DateFilterType; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.key}
          variant={currentFilter === filter.key ? "default" : "outline"}
          size="sm"
          onClick={() => handleFilterClick(filter.key)}
          className={cn(
            "text-xs font-medium transition-all",
            currentFilter === filter.key && "bg-primary text-primary-foreground shadow-md"
          )}
        >
          {filter.label}
        </Button>
      ))}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={currentFilter === "custom" ? "default" : "outline"}
            size="sm"
            className={cn(
              "text-xs font-medium gap-1.5",
              currentFilter === "custom" && "bg-primary text-primary-foreground shadow-md"
            )}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            {customRange?.from && customRange?.to
              ? `${format(customRange.from, "MMM d")} - ${format(customRange.to, "MMM d")}`
              : "Custom Range"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={customRange?.from}
            selected={customRange}
            onSelect={handleCustomRangeSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
