import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, UserPlus, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkComplete: () => void;
  onBulkCancel: (reason: string) => void;
  onBulkAssignStaff: (staffId: string) => void;
  staff: { id: string; full_name: string }[];
}

const CANCELLATION_REASONS = [
  "Client no-show",
  "Client cancelled",
  "Staff unavailable",
  "Double booking",
  "Emergency",
  "Other",
];

export const BulkActions = ({
  selectedCount,
  onClearSelection,
  onBulkComplete,
  onBulkCancel,
  onBulkAssignStaff,
  staff,
}: BulkActionsProps) => {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");

  const handleConfirmCancel = () => {
    const reason = selectedReason === "Other" ? customReason : selectedReason;
    if (reason) {
      onBulkCancel(reason);
      setCancelDialogOpen(false);
      setSelectedReason("");
      setCustomReason("");
    }
  };

  const handleConfirmAssign = () => {
    if (selectedStaffId) {
      onBulkAssignStaff(selectedStaffId);
      setAssignDialogOpen(false);
      setSelectedStaffId("");
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
        <span className="text-sm font-medium text-foreground">
          {selectedCount} booking{selectedCount > 1 ? "s" : ""} selected
        </span>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={onBulkComplete}
            className="bg-background"
          >
            <CheckCircle2 className="w-4 h-4 mr-1 text-green-600" />
            Mark Completed
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCancelDialogOpen(true)}
            className="bg-background"
          >
            <XCircle className="w-4 h-4 mr-1 text-destructive" />
            Cancel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAssignDialogOpen(true)}
            className="bg-background"
          >
            <UserPlus className="w-4 h-4 mr-1 text-blue-600" />
            Assign Staff
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
          className="ml-auto"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel {selectedCount} Booking{selectedCount > 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cancellation Reason</Label>
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
                <Label>Custom Reason</Label>
                <Textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter cancellation reason..."
                  rows={3}
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmCancel}
                disabled={!selectedReason || (selectedReason === "Other" && !customReason)}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Staff Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Staff to {selectedCount} Booking{selectedCount > 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Staff</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmAssign} disabled={!selectedStaffId}>
                Assign Staff
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
