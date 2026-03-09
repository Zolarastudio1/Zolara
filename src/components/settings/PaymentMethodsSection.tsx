import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface PaymentMethod {
  id: string;
  name: string;
  enabled: boolean;
}

interface PaymentMethodsProps {
  paymentMethods: PaymentMethod[];
  paystackEnabled: boolean;
  onPaymentMethodToggle: (id: string, enabled: boolean) => void;
  onPaystackToggle: (enabled: boolean) => void;
}

export function PaymentMethodsSection({
  paymentMethods,
  paystackEnabled,
  onPaymentMethodToggle,
  onPaystackToggle,
}: PaymentMethodsProps) {
  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-xl font-semibold">Payment Methods</h2>

      <div className="space-y-3">
        {paymentMethods.map((method) => (
          <div
            key={method.id}
            className="flex items-center justify-between p-3 rounded-md border"
          >
            <span className="font-medium">{method.name}</span>
            <Switch
              checked={method.enabled}
              onCheckedChange={(checked) =>
                onPaymentMethodToggle(method.id, checked)
              }
            />
          </div>
        ))}

        <div className="flex items-center justify-between p-3 rounded-md border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2">
            <span className="font-medium">Paystack Integration</span>
            <Badge variant="secondary">Automatic</Badge>
          </div>
          <Switch checked={paystackEnabled} onCheckedChange={onPaystackToggle} />
        </div>
        {paystackEnabled && (
          <p className="text-xs text-muted-foreground pl-3">
            Paystack is configured and ready to accept online payments.
          </p>
        )}
      </div>
    </Card>
  );
}
