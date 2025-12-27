import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CancelBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  bookingInfo?: {
    clientName?: string;
    serviceName?: string;
  };
}

const CANCELLATION_REASONS = [
  "Client no-show",
  "Client cancelled",
  "Staff unavailable",
  "Double booking",
  "Emergency",
  "Rescheduled",
  "Other",
];

export const CancelBookingDialog = ({
  open,
  onOpenChange,
  onConfirm,
  bookingInfo,
}: CancelBookingDialogProps) => {
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const handleConfirm = () => {
    const reason = selectedReason === "Other" ? customReason : selectedReason;
    if (reason) {
      onConfirm(reason);
      onOpenChange(false);
      setSelectedReason("");
      setCustomReason("");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedReason("");
    setCustomReason("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {bookingInfo && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p>
                <span className="text-muted-foreground">Client:</span>{" "}
                <span className="font-medium">{bookingInfo.clientName}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Service:</span>{" "}
                <span className="font-medium">{bookingInfo.serviceName}</span>
              </p>
            </div>
          )}

          <div>
            <Label>Cancellation Reason *</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {CANCELLATION_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedReason === "Other" && (
            <div>
              <Label>Please specify</Label>
              <Textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter cancellation reason..."
                rows={3}
              />
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={handleClose}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!selectedReason || (selectedReason === "Other" && !customReason)}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
