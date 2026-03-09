import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function BuyGiftCard() {
  const [amount, setAmount] = useState<number | "">(50);
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return toast.error("Enter a valid amount");

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-gift-card", {
        body: {
          purchaser_email: purchaserEmail || undefined,
          recipient_email: recipientEmail || undefined,
          amount: Number(amount),
          message: message || undefined,
        },
      });

      if (error) throw error;
      if (!data?.authorization_url) {
        toast.error("Payment initialization failed");
        return;
      }

      toast.success("Redirecting to payment...");
      // Open paystack authorization URL
      window.open(data.authorization_url, "_blank");
    } catch (err: any) {
      console.error("BuyGiftCard error:", err);
      toast.error(err.message || "Failed to start purchase");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <CardTitle>Buy a Gift Card</CardTitle>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1">Amount (NGN)</label>
              <Input
                type="number"
                value={amount as any}
                onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                min={50}
                step={50}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Your email (optional)</label>
              <Input value={purchaserEmail} onChange={(e) => setPurchaserEmail(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Recipient email (optional)</label>
              <Input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Message (optional)</label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={processing} className="w-full">
                {processing ? "Processing…" : "Buy Gift Card"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
