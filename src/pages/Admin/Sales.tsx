import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import jsPDF from "jspdf";
import "jspdf-autotable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { DollarSign, Calendar } from "lucide-react";
import { CSVLink } from "react-csv"; // For CSV export

const SalesRevenue = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMethod, setFilterMethod] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month" | "custom">("month");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [monthlyNet, setMonthlyNet] = useState<number>(0);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  useEffect(() => {
    fetchPayments();
    fetchMonthlyNet();
  }, []);

  useEffect(() => {
    // refetch when dateRange changes
    fetchPayments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customStart, customEnd]);

  // Fetch monthly net revenue same as dashboard
  const fetchMonthlyNet = async () => {
    try {
      const today = new Date();
      const start = format(startOfMonth(today), "yyyy-MM-dd");
      const end = format(endOfMonth(today), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("payments")
        .select("amount")
        .gte("payment_date", start)
        .lte("payment_date", end);
      if (error) throw error;
      const total = (data || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      setMonthlyNet(total);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("payments")
        .select("*, bookings(*, clients(*), services(*))")
        .order("payment_date", { ascending: false });

      // apply date filters
      if (dateRange === "today") {
        const today = format(new Date(), "yyyy-MM-dd");
        query = query.gte("payment_date", today);
      } else if (dateRange === "week") {
        const today = new Date();
        const start = format(startOfWeek(today), "yyyy-MM-dd");
        const end = format(endOfWeek(today), "yyyy-MM-dd");
        query = query.gte("payment_date", start).lte("payment_date", end);
      } else if (dateRange === "month") {
        const today = new Date();
        const start = format(startOfMonth(today), "yyyy-MM-dd");
        const end = format(endOfMonth(today), "yyyy-MM-dd");
        query = query.gte("payment_date", start).lte("payment_date", end);
      } else if (dateRange === "custom") {
        if (customStart) query = query.gte("payment_date", customStart);
        if (customEnd) query = query.lte("payment_date", customEnd);
      }

      const { data, error } = await query;

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

  const openPaymentDialog = (p: any) => {
    setSelectedPayment(p);
    setPaymentDialogOpen(true);
  };

  const updatePaymentStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("payments") //@ts-ignore
        .update({ payment_status: status })
        .eq("id", id);
      if (error) throw error;
      toast.success("Payment status updated");
      fetchPayments();
      fetchMonthlyNet();
      setPaymentDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update status");
    }
  };

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

  const exportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Revenue Summary", 14, 20);
      doc.setFontSize(10);
      const rangeLabel =
        dateRange === "custom"
          ? `${customStart || "N/A"} - ${customEnd || "N/A"}`
          : dateRange;
      doc.text(`Date Range: ${rangeLabel}`, 14, 26);

      const tableData = filteredPayments.map((p) => [
        p.bookings?.clients?.full_name || "N/A",
        p.bookings?.services?.name || "N/A",
        p.payment_method,
        `GH₵${Number(p.amount).toLocaleString()}`,
        format(new Date(p.payment_date), "MMM dd, yyyy"),
        p.payment_status,
        p.notes || "",
      ]);

      (doc as any).autoTable({
        startY: 32,
        head: [["Client", "Service", "Method", "Amount", "Date", "Status", "Notes"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [30, 144, 255] },
        styles: { fontSize: 9 },
        columnStyles: { 6: { cellWidth: 60 } },
      });

      const now = format(new Date(), "yyyyMMdd_HHmmss");
      doc.save(`revenue_summary_${now}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
      toast.error("Failed to export PDF");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

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
        {/* Date range filter */}
        <div className="flex items-center gap-2">
          {[
            ["today", "Today"],
            ["week", "This week"],
            ["month", "This month"],
            ["all", "All"],
            ["custom", "Custom"],
          ].map(([key, label]) => (
            <Button
              key={String(key)}
              variant={dateRange === key ? "default" : "outline"}
              onClick={() => setDateRange(key as any)}
            >
              {label}
            </Button>
          ))}
        </div>
        {dateRange === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-3 py-2 rounded-md border" />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-3 py-2 rounded-md border" />
          </div>
        )}
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
        <Button variant="outline" onClick={exportPDF}>Export PDF</Button>
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
          <p className="text-sm text-muted-foreground mt-2">Net revenue this month: GH₵{monthlyNet.toLocaleString()}</p>
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
            <Card key={payment.id} onClick={() => openPaymentDialog(payment)} className="cursor-pointer">
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
      {/* Payment detail dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Client</h3>
                <p>{selectedPayment.bookings?.clients?.full_name}</p>
                <p className="text-sm text-muted-foreground">{selectedPayment.bookings?.clients?.phone}</p>
              </div>

              <div>
                <h3 className="font-semibold">Service</h3>
                <p>{selectedPayment.bookings?.services?.name}</p>
                <p className="text-sm text-muted-foreground">Duration: {selectedPayment.bookings?.services?.duration_minutes || 'N/A'} min</p>
              </div>

              <div>
                <h3 className="font-semibold">Staff</h3>
                <p>{selectedPayment.bookings?.staff?.full_name || 'Unassigned'}</p>
              </div>

              <div>
                <h3 className="font-semibold">Payment</h3>
                <p>Method: {selectedPayment.payment_method}</p>
                <p>Amount: GH₵{Number(selectedPayment.amount).toFixed(2)}</p>
                <p>Status: {selectedPayment.payment_status}</p>
              </div>

              {selectedPayment.notes && (
                <div>
                  <h3 className="font-semibold">Internal Note</h3>
                  <p className="text-sm text-muted-foreground">{selectedPayment.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                {selectedPayment.payment_status !== 'completed' && (
                  <Button onClick={() => updatePaymentStatus(selectedPayment.id, 'completed')}>Mark Completed</Button>
                )}
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesRevenue;
