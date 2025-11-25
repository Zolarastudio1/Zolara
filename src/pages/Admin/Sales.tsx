import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { DollarSign, Calendar } from "lucide-react";

const Sales = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("*, bookings(*, clients(*), services(*))")
        .order("payment_date", { ascending: false });

      if (error) throw error;
      
      setPayments(data || []);
      const total = data?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
      setTotalRevenue(total);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodColor = (method: string) => {
    const colors: any = {
      cash: "bg-success/10 text-success",
      momo: "bg-info/10 text-info",
      card: "bg-primary/10 text-primary",
      bank_transfer: "bg-accent/10 text-accent"
    };
    return colors[method] || "bg-muted text-muted-foreground";
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: any = {
      completed: "bg-success/10 text-success",
      pending: "bg-warning/10 text-warning",
      refunded: "bg-destructive/10 text-destructive"
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sales & Payments</h1>
        <p className="text-muted-foreground">Track your salon revenue</p>
      </div>

      <Card className="bg-gradient-to-br from-primary/10 to-accent/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Total Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-primary">GH₵{totalRevenue.toLocaleString()}</p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {payments.map((payment) => (
          <Card key={payment.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{payment.bookings?.clients?.full_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{payment.bookings?.services?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">GH₵{Number(payment.amount).toLocaleString()}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge className={getPaymentMethodColor(payment.payment_method)}>
                      {payment.payment_method}
                    </Badge>
                    <Badge className={getPaymentStatusColor(payment.payment_status)}>
                      {payment.payment_status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(payment.payment_date), "MMM dd, yyyy 'at' h:mm a")}</span>
              </div>
              {payment.notes && (
                <p className="text-sm text-muted-foreground mt-2">Note: {payment.notes}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {payments.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No payments recorded yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Sales;
