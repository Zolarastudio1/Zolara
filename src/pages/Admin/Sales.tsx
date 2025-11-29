import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { DollarSign, Calendar } from "lucide-react";
import { CSVLink } from "react-csv"; // For CSV export

const SalesRevenue = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMethod, setFilterMethod] = useState<string | null>(null);

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter by method if selected
  const filteredPayments = filterMethod
    ? payments.filter((p) => p.payment_method === filterMethod)
    : payments;

  // Separate completed and pending payments
  const completedPayments = filteredPayments.filter(
    (p) => p.payment_status === "completed"
  );
  const pendingPayments = filteredPayments.filter(
    (p) => p.payment_status === "pending"
  );

  const getPaymentMethodColor = (method: string) => {
    const colors: any = {
      cash: "bg-success/10 text-success",
      momo: "bg-info/10 text-info",
      card: "bg-primary/10 text-primary",
      bank_transfer: "bg-accent/10 text-accent",
    };
    return colors[method] || "bg-muted text-muted-foreground";
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: any = {
      completed: "bg-success/10 text-success",
      pending: "bg-warning/10 text-warning",
      refunded: "bg-destructive/10 text-destructive",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  // const exportPDF = () => {
  //   const doc = new jsPDF();
  //   doc.text("Revenue Summary", 14, 20);

  //   const formatTable = (data: any[], title: string, yStart: number) => {
  //     doc.text(title, 14, yStart - 5);
  //     const tableData = data.map((p) => [
  //       p.bookings?.clients?.full_name || "N/A",
  //       p.bookings?.services?.name || "N/A",
  //       p.payment_method,
  //       `GH₵${Number(p.amount).toLocaleString()}`,
  //       format(new Date(p.payment_date), "MMM dd, yyyy"),
  //       p.notes || "",
  //     ]);
  //     (doc as any).autoTable({
  //       startY: yStart,
  //       head: [["Client", "Service", "Method", "Amount", "Date", "Notes"]],
  //       body: tableData,
  //       theme: "grid",
  //       headStyles: { fillColor: [30, 144, 255] },
  //     });
  //     return (doc as any).lastAutoTable.finalY + 10;
  //   };

  //   let yPos = 25;
  //   if (completedPayments.length > 0) {
  //     yPos = formatTable(completedPayments, "Completed Payments", yPos);
  //   }
  //   if (pendingPayments.length > 0) {
  //     formatTable(pendingPayments, "Pending Payments", yPos);
  //   }

  //   doc.save("revenue_summary.pdf");
  // };

  if (loading)
    return (
      <div className="flex justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sales & Revenue</h1>
        <p className="text-muted-foreground">
          Track salon revenue and payments
        </p>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {/* All Payments Button */}
        <Button
          key="all"
          variant={filterMethod === null ? "default" : "outline"}
          onClick={() => setFilterMethod(null)}
        >
          ALL
        </Button>
        {/* Payment Method Buttons */}
        {["cash", "momo", "card", "bank_transfer"].map((method) => (
          <Button
            key={method}
            variant={filterMethod === method ? "default" : "outline"}
            onClick={() =>
              setFilterMethod(filterMethod === method ? null : method)
            }
          >
            {method.toUpperCase()}
          </Button>
        ))}
        <CSVLink
          data={filteredPayments.map((p) => ({
            client: p.bookings?.clients?.full_name,
            service: p.bookings?.services?.name,
            method: p.payment_method,
            status: p.payment_status,
            amount: p.amount,
            date: format(new Date(p.payment_date), "MMM dd, yyyy"),
          }))}
          filename="revenue_summary.csv"
        >
          <Button variant="outline">Export CSV</Button>
        </CSVLink>
      </div>

      {/* Completed Revenue */}
      <Card className="bg-green-50 border border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <DollarSign className="w-5 h-5" />
            Completed Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold">
            Total Amount: GH₵
            {completedPayments
              .reduce((sum, p) => sum + Number(p.amount), 0)
              .toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            Total Transactions: {completedPayments.length}
          </p>
        </CardContent>
      </Card>

      {/* Pending Revenue */}
      <Card className="bg-yellow-50 border border-yellow-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-700">
            <DollarSign className="w-5 h-5" />
            Pending Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold">
            Total Amount: GH₵
            {pendingPayments
              .reduce((sum, p) => sum + Number(p.amount), 0)
              .toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            Total Transactions: {pendingPayments.length}
          </p>
        </CardContent>
      </Card>

      {/* Payment List */}
      <div className="space-y-4 mt-4">
        {filteredPayments.length > 0 ? (
          filteredPayments.map((payment) => (
            <Card key={payment.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {payment.bookings?.clients?.full_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {payment.bookings?.services?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      GH₵{Number(payment.amount).toLocaleString()}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge
                        className={getPaymentMethodColor(
                          payment.payment_method
                        )}
                      >
                        {payment.payment_method}
                      </Badge>
                      <Badge
                        className={getPaymentStatusColor(
                          payment.payment_status
                        )}
                      >
                        {payment.payment_status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {format(
                      new Date(payment.payment_date),
                      "MMM dd, yyyy 'at' h:mm a"
                    )}
                  </span>
                </div>
                {payment.notes && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Note: {payment.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
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

export default SalesRevenue;
