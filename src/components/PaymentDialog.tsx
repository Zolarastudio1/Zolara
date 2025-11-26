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
import { CreditCard, Loader2 } from "lucide-react";
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
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "card" | "momo" | "bank_transfer"
  >("cash");
  const [amount, setAmount] = useState<string>(booking?.services?.price || "");
  const [notes, setNotes] = useState<string>("");

  const handlePaymentSubmit = async () => {
    setLoading(true);

    try {
      if (!amount || parseFloat(amount) <= 0) {
        toast.error("Please enter a valid amount");
        return;
      }

      const paymentAmount = parseFloat(amount);

      // Non-cash payments (card, momo, bank_transfer)
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

        if (error)
          throw new Error(error.message || "Failed to initialize payment");

        if (data?.authorization_url) {
          toast.success("Redirecting to payment gateway...");
          window.open(data.authorization_url, "_blank");
          onOpenChange(false);
          onPaymentComplete();
        } else if (data?.error) {
          throw new Error(data.error);
        } else {
          throw new Error("Payment URL not returned");
        }
      } else {
        if (admin) {
          // Cash, Mobile Money, Bank Transfer
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

          toast.success("Payment recorded successfully!");
          onOpenChange(false);
          onPaymentComplete();
        }
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      toast.error(err.message || "Failed to process payment");
    } finally {
      setLoading(false);
    }
  };

  const [paymentInfo, setPaymentInfo] = useState<any>(null);

  useEffect(() => {
    const fetchPaymentInfo = async () => {
      const { data, error } = await supabase
        .from("payment_settings")
        .select("*")
        .single(); // Get the single row
      if (!error) setPaymentInfo(data);
    };
    fetchPaymentInfo();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            {admin ? "Record Payment" : "Make payment"}
          </DialogTitle>
          <DialogDescription>
            {admin
              ? `Record Payment for ${booking?.clients?.full_name} - ${booking?.services?.name}`
              : `Make Payment for ${booking?.clients?.full_name} - ${booking?.services?.name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) =>
                setPaymentMethod(
                  value as "cash" | "card" | "momo" | "bank_transfer"
                )
              }
            >
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                {admin && <SelectItem value="cash">Cash</SelectItem>}
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="momo">Mobile Money</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (GH₵)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          {paymentMethod === "cash" ? (
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this payment"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          ) : (
            <div className="bg-muted p-3 rounded-md text-sm">
              <p className="text-muted-foreground">
                Click "Process Payment" to open Paystack payment page where the
                customer can complete the payment.
              </p>
            </div>
          )}

          {paymentMethod === "bank_transfer" && (
            <div className="bg-muted p-4 rounded-md text-sm space-y-2">
              <p className="font-medium">Bank Transfer Details</p>
              {paymentMethod === "bank_transfer" && paymentInfo && (
                <div className="bg-muted p-3 rounded-md text-sm">
                  <p>Bank Name: {paymentInfo.bank_name}</p>
                  <p>Account Name: {paymentInfo.account_name}</p>
                  <p>Account Number: {paymentInfo.account_number}</p>
                  <p>Amount: GH₵ {amount || booking?.services?.price}</p>
                </div>
              )}

              <p className="text-gray-500 text-xs">
                After making the transfer, please note the reference and update
                us.
              </p>
            </div>
          )}

          {/* {paymentMethod !== "cash" && (
            <div className="bg-muted p-3 rounded-md text-sm">
              <p className="text-muted-foreground">
                Click "Process Payment" to open Paystack payment page where the
                customer can complete the payment.
              </p>
            </div>
          )} */}
          <Button
            onClick={handlePaymentSubmit}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : paymentMethod === "bank_transfer" ? (
              "Cick to use Paystack instead"
            ) : (
              "Process Payment"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
