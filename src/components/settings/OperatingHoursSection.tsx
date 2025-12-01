import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface OperatingHoursProps {
  openTime: string;
  closeTime: string;
  currency: string;
  use24HourFormat: boolean;
  onOpenTimeChange: (value: string) => void;
  onCloseTimeChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onFormatChange: (value: boolean) => void;
}

function convertTo12Hour(time24: string): string {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function OperatingHoursSection({
  openTime,
  closeTime,
  currency,
  use24HourFormat,
  onOpenTimeChange,
  onCloseTimeChange,
  onCurrencyChange,
  onFormatChange,
}: OperatingHoursProps) {
  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-xl font-semibold">Operating Hours & Currency</h2>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Time Format</Label>
          <p className="text-sm text-muted-foreground">
            {use24HourFormat ? "24-hour format (08:30 — 20:30)" : "12-hour format (8:30 AM — 8:30 PM)"}
          </p>
        </div>
        <Switch
          checked={use24HourFormat}
          onCheckedChange={onFormatChange}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="open_time">Opening Time</Label>
          <Input
            id="open_time"
            type="time"
            value={openTime}
            onChange={(e) => onOpenTimeChange(e.target.value)}
          />
          {!use24HourFormat && openTime && (
            <p className="text-xs text-muted-foreground mt-1">
              {convertTo12Hour(openTime)}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="close_time">Closing Time</Label>
          <Input
            id="close_time"
            type="time"
            value={closeTime}
            onChange={(e) => onCloseTimeChange(e.target.value)}
          />
          {!use24HourFormat && closeTime && (
            <p className="text-xs text-muted-foreground mt-1">
              {convertTo12Hour(closeTime)}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="currency">Default Currency</Label>
          <Input
            id="currency"
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            placeholder="GH₵"
          />
        </div>
      </div>
    </Card>
  );
}
