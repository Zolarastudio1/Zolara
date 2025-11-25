import { useState } from "react";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  onPaymentComplete: () => void;
}

export default function PaymentDialog({
  open,
  onOpenChange,
  booking,
  onPaymentComplete,
}: PaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "momo" | "bank_transfer">("cash");
  const [amount, setAmount] = useState<string>(booking?.services?.price || "");
  const [notes, setNotes] = useState<string>("");

  const handlePaymentSubmit = async () => {
    setLoading(true);

    try {
      if (!amount || parseFloat(amount) <= 0) {
        toast.error("Please enter a valid amount");
        setLoading(false);
        return;
      }

      const paymentAmount = parseFloat(amount);

      // For card payments, initialize Paystack
      if (paymentMethod === "card") {
        const { data, error } = await supabase.functions.invoke(
          "initialize-payment",
          {
            body: {
              email: booking.clients?.email || "customer@example.com",
              amount: paymentAmount,
              booking_id: booking.id,
              callback_url: `${window.location.origin}/admin/bookings`,
              metadata: {
                client_name: booking.clients?.full_name,
                service: booking.services?.name,
              },
            },
          }
        );

        if (error) {
          console.error("Payment initialization error:", error);
          throw new Error(error.message || "Failed to initialize payment");
        }

        if (data?.authorization_url) {
          toast.success("Redirecting to payment gateway...");
          // Open Paystack payment page in new window
          window.open(data.authorization_url, "_blank");
          
          // Close dialog and refresh after a delay
          setTimeout(() => {
            onOpenChange(false);
            onPaymentComplete();
          }, 2000);
        } else {
          throw new Error("Failed to get payment URL");
        }
      } else {
        // For cash/momo/bank_transfer, record payment directly
        const { error: paymentError } = await supabase.from("payments").insert([{
          booking_id: booking.id,
          amount: paymentAmount,
          payment_method: paymentMethod,
          payment_status: "completed",
          notes: notes || `Payment via ${paymentMethod}`,
        }]);

        if (paymentError) throw paymentError;

        toast.success("Payment recorded successfully!");
        onOpenChange(false);
        onPaymentComplete();
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Failed to process payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Record Payment
          </DialogTitle>
          <DialogDescription>
            Record payment for {booking?.clients?.full_name} -{" "}
            {booking?.services?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select 
              value={paymentMethod} 
              onValueChange={(value) => setPaymentMethod(value as "cash" | "card" | "momo" | "bank_transfer")}
            >
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card (Paystack)</SelectItem>
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

          {paymentMethod !== "card" && (
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
          )}

          {paymentMethod === "card" && (
            <div className="bg-muted p-3 rounded-md text-sm">
              <p className="text-muted-foreground">
                Click "Process Payment" to open Paystack payment page where the
                customer can complete the payment.
              </p>
            </div>
          )}

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
            ) : (
              "Process Payment"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
