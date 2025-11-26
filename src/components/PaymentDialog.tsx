import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Clipboard, CreditCard, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface PaymentDialogProps {
  admin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  onPaymentComplete: () => void;
}

export default function PaymentDialog({
  admin,
  open,
  onOpenChange,
  booking,
  onPaymentComplete,
}: PaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "card" | "momo" | "bank_transfer"
  >("cash");

  const [amount, setAmount] = useState<string>(booking?.services?.price || "");
  const [notes, setNotes] = useState<string>("");

  const [paymentInfo, setPaymentInfo] = useState({
    id: null,
    bank_name: "",
    account_name: "",
    account_number: "",
  });

  const label = admin
    ? `Record Payment for ${booking?.clients?.full_name} - ${booking?.services?.name}`
    : `Make Payment for ${booking?.clients?.full_name} - ${booking?.services?.name}`;

  // -----------------------------------
  // SAVE OR UPDATE PAYMENT ACCOUNT INFO
  // -----------------------------------
  const handleSavePaymentInfo = async () => {
    const { data, error } = await supabase.from("payment_settings").upsert({
      id: paymentInfo.id || 1, // force single row
      bank_name: paymentInfo.bank_name,
      account_name: paymentInfo.account_name,
      account_number: paymentInfo.account_number,
    });

    if (error) {
      toast.error("Failed to save bank information");
      return;
    }

    toast.success("Bank details updated!");
  };

  // -----------------------------------
  // PAYMENT SUBMISSION
  // -----------------------------------
  const handlePaymentSubmit = async () => {
    setLoading(true);

    try {
      if (!amount || parseFloat(amount) <= 0) {
        toast.error("Please enter a valid amount");
        return;
      }

      const paymentAmount = parseFloat(amount);

      // Non-cash payments use Paystack edge function
      if (paymentMethod !== "cash") {
        const { data, error } = await supabase.functions.invoke(
          "initialize-payment",
          {
            body: {
              email: booking.clients?.email,
              amount: paymentAmount,
              booking_id: booking.id,
              callback_url: `${window.location.origin}/admin/bookings`,
              metadata: {
                client_name: booking.clients?.full_name,
                service_name: booking.services?.name,
              },
            },
          }
        );

        if (error) throw new Error(error.message);

        if (data?.authorization_url) {
          toast.success("Redirecting...");
          window.open(data.authorization_url, "_blank");
          onOpenChange(false);
          onPaymentComplete();
        } else {
          throw new Error("Payment URL missing");
        }
      } else {
        // CASH PAYMENT (admin only)
        if (admin) {
          const { error: paymentError } = await supabase
            .from("payments")
            .insert([
              {
                booking_id: booking.id,
                amount: paymentAmount,
                payment_method: paymentMethod,
                payment_status: "completed",
                notes: notes || `Payment via ${paymentMethod}`,
              },
            ]);

          if (paymentError) throw paymentError;

          toast.success("Payment recorded!");
          onOpenChange(false);
          onPaymentComplete();
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process payment");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------
  // FETCH PAYMENT ACCOUNT DETAILS
  // -----------------------------------
  useEffect(() => {
    const fetchPaymentInfo = async () => {
      const { data, error } = await supabase
        .from("payment_settings")
        .select("*")
        .single();

      if (!error && data) {
        setPaymentInfo({
          id: data.id,
          bank_name: data.bank_name,
          account_name: data.account_name,
          account_number: data.account_number,
        });
      }
    };

    fetchPaymentInfo();
  }, []);

  // -----------------------------------
  // UI
  // -----------------------------------
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            {admin ? "Record Payment" : "Make payment"}
          </DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>

        {/* ADMIN EDIT MODAL */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6">
            <div className="bg-white p-6 rounded-md w-full max-w-md space-y-4">
              <h2 className="font-semibold text-lg">
                {paymentInfo.bank_name
                  ? "Edit Bank Details"
                  : "Add Bank Details"}
              </h2>

              <Input
                placeholder="Bank Name"
                value={paymentInfo.bank_name}
                onChange={(e) =>
                  setPaymentInfo({ ...paymentInfo, bank_name: e.target.value })
                }
              />

              <Input
                placeholder="Account Name"
                value={paymentInfo.account_name}
                onChange={(e) =>
                  setPaymentInfo({
                    ...paymentInfo,
                    account_name: e.target.value,
                  })
                }
              />

              <Input
                placeholder="Account Number"
                value={paymentInfo.account_number}
                onChange={(e) =>
                  setPaymentInfo({
                    ...paymentInfo,
                    account_number: e.target.value,
                  })
                }
              />

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    handleSavePaymentInfo();
                    setShowEditModal(false);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* SELECT PAYMENT METHOD */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) =>
                setPaymentMethod(
                  value as "card" | "momo" | "bank_transfer" | "cash"
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="momo">Mobile Money</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                {admin && <SelectItem value="cash">Cash</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* AMOUNT */}
          <div className="space-y-2">
            <Label>Amount (GH₵)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* NOTES (CASH ONLY) */}
          {paymentMethod === "cash" && (
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}

          {/* BANK TRANSFER DETAILS */}
          {paymentMethod === "bank_transfer" && (
            <div className="bg-muted rounded-md text-sm space-y-3">
              <p className="font-medium flex justify-between">
                Bank Transfer Details
                {admin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditModal(true)}
                  >
                    {paymentInfo.bank_name ? "Edit" : "Add"}
                  </Button>
                )}
              </p>

              {paymentInfo.bank_name ? (
                <div className="bg-background border p-3 rounded-md space-y-2">
                  {["Bank Name", "Account Name", "Account Number"].map(
                    (label, idx) => {
                      const value =
                        label === "Bank Name"
                          ? paymentInfo.bank_name
                          : label === "Account Name"
                          ? paymentInfo.account_name
                          : paymentInfo.account_number;

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between"
                        >
                          <p>
                            <span className="font-medium">{label}:</span>{" "}
                            {value}
                          </p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(value);
                              toast.success(`${label} copied!`);
                            }}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Clipboard className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    }
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  No bank details added yet.
                </p>
              )}
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <Button
            onClick={handlePaymentSubmit}
            disabled={loading}
            className="w-full"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {paymentMethod === "bank_transfer"
              ? "Click to use Paystack instead"
              : "Process Payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
