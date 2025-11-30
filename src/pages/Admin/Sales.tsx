import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
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
  const [dateRange, setDateRange] = useState<
    "all" | "today" | "week" | "month" | "custom"
  >("month");
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
      const total = (data || []).reduce(
        (s: number, p: any) => s + Number(p.amount),
        0
      );
      setMonthlyNet(total);
    } catch (err) {
      console.error(err);
    }
  };

  // Save the print-friendly HTML as a PDF using html2canvas + jsPDF.
  // This renders the same HTML used by printReport off-screen, captures it with html2canvas,
  // then writes images into a multi-page PDF.
  const saveReportAsPDF = async () => {
    try {
      // Build same rows as printReport
      const rows = filteredPayments.map((p) => ({
        client: p.bookings?.clients?.full_name || "N/A",
        service: p.bookings?.services?.name || "N/A",
        method: p.payment_method || "",
        amount:
          typeof p.amount !== "undefined"
            ? `GH₵${Number(p.amount).toFixed(2)}`
            : "GH₵0.00",
        date: p.payment_date
          ? format(new Date(p.payment_date), "MMM dd, yyyy")
          : "",
        status: p.payment_status || "",
        notes: p.notes || "",
      }));

      const now = new Date();
      const title = `Revenue Summary - ${format(now, "PPP p")}`;

      // Compose the same HTML used by printReport
      const style = `
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111 }
          .report-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px }
          .report-title { font-size:18px; font-weight:700 }
          .report-meta { text-align:right; font-size:12px; color:#666 }
          table { width:100%; border-collapse:collapse; font-size:12px }
          th, td { border:1px solid #ddd; padding:8px; vertical-align:top }
          th { background:#1e90ff; color:#fff; font-weight:700 }
          tfoot td { font-weight:700; }
          .notes { max-width:320px; word-wrap:break-word }
        </style>
      `;

      const header = `
        <div class="report-header">
          <div class="report-title">${title}</div>
          <div class="report-meta">Generated: ${format(now, "PPP p")}</div>
        </div>
      `;

      const tableRows = rows
        .map(
          (r) => `<tr>
            <td>${escapeHtml(r.client)}</td>
            <td>${escapeHtml(r.service)}</td>
            <td>${escapeHtml(r.method)}</td>
            <td style="text-align:right">${r.amount}</td>
            <td>${r.date}</td>
            <td style="text-align:center">${escapeHtml(r.status)}</td>
            <td class="notes">${escapeHtml(r.notes)}</td>
          </tr>`
        )
        .join("\n");

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${style}</head><body>${header}<table><thead><tr><th>Client</th><th>Service</th><th>Method</th><th>Amount</th><th>Date</th><th>Status</th><th>Notes</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`;

      // Create off-screen container
      const wrapper = document.createElement("div");
      wrapper.style.position = "fixed";
      wrapper.style.left = "-9999px";
      wrapper.style.top = "0";
      wrapper.innerHTML = html;
      document.body.appendChild(wrapper);

      // Load html2canvas if not present
      if (!(window as any).html2canvas) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src =
            "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
          s.onload = () => resolve();
          s.onerror = (e) => reject(e);
          document.head.appendChild(s);
        });
      }

      const html2canvas = (window as any).html2canvas;
      if (!html2canvas) throw new Error("html2canvas failed to load");

      // Render wrapper to canvas (higher scale for better quality)
      const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      // Create PDF and split across pages if needed
      const pdf = new jsPDF({
        unit: "pt",
        format: "a4",
        orientation: "landscape",
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Calculate image dimensions to fit width
      const imgProps: any = (pdf as any).getImageProperties(imgData);
      const imgWidth = pdfWidth - 40; // leave margin
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      // If imgHeight fits on single page, just add and save
      if (imgHeight <= pdfHeight - 40) {
        pdf.addImage(imgData, "PNG", 20, 20, imgWidth, imgHeight);
      } else {
        // Need to split canvas into multiple pages
        const pageCanvas = document.createElement("canvas");
        const pageCtx = pageCanvas.getContext("2d")!;
        const scale = canvas.width / imgWidth;
        const pageHeightPx = (pdfHeight - 40) * scale;
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageHeightPx;

        let renderedHeight = 0;
        while (renderedHeight < canvas.height) {
          pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(
            canvas,
            0,
            renderedHeight,
            canvas.width,
            pageCanvas.height,
            0,
            0,
            pageCanvas.width,
            pageCanvas.height
          );
          const pageData = pageCanvas.toDataURL("image/png");
          pdf.addImage(
            pageData,
            "PNG",
            20,
            20,
            imgWidth,
            pageCanvas.height / scale
          );
          renderedHeight += pageCanvas.height;
          if (renderedHeight < canvas.height) pdf.addPage();
        }
      }

      const nowStamp = format(new Date(), "yyyyMMdd_HHmmss");
      pdf.save(`revenue_summary_${nowStamp}.pdf`);

      // cleanup
      document.body.removeChild(wrapper);
    } catch (err) {
      console.error("Save as PDF failed", err);
      toast.error("Failed to save PDF");
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

  // Open a print-friendly HTML page (browser print) which gives highest-fidelity output
  const printReport = () => {
    try {
      const rows = filteredPayments.map((p) => ({
        client: p.bookings?.clients?.full_name || "N/A",
        service: p.bookings?.services?.name || "N/A",
        method: p.payment_method || "",
        amount:
          typeof p.amount !== "undefined"
            ? `GH₵${Number(p.amount).toFixed(2)}`
            : "GH₵0.00",
        date: p.payment_date
          ? format(new Date(p.payment_date), "MMM dd, yyyy")
          : "",
        status: p.payment_status || "",
        notes: p.notes || "",
      }));

      const completedTotal = rows
        .filter((r) => r.status === "completed")
        .reduce((s, r) => s + Number(r.amount.replace(/[^0-9.-]+/g, "")), 0);
      const pendingTotal = rows
        .filter((r) => r.status === "pending")
        .reduce((s, r) => s + Number(r.amount.replace(/[^0-9.-]+/g, "")), 0);

      const now = new Date();
      const title = `Revenue Summary - ${format(now, "PPP p")}`;
      const rangeLabel =
        dateRange === "custom"
          ? `${customStart || "N/A"} - ${customEnd || "N/A"}`
          : dateRange;

      const style = `
        <style>
          @page { size: A4 landscape; margin: 20mm }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111 }
          .report-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px }
          .report-title { font-size:18px; font-weight:700 }
          .report-meta { text-align:right; font-size:12px; color:#666 }
          table { width:100%; border-collapse:collapse; font-size:12px }
          th, td { border:1px solid #ddd; padding:8px; vertical-align:top }
          th { background:#1e90ff; color:#fff; font-weight:700 }
          tfoot td { font-weight:700; }
          .notes { max-width:320px; word-wrap:break-word }
          @media print { .no-print { display:none } }
        </style>
      `;

      const header = `
        <div class="report-header">
          <div class="report-title">${title}</div>
          <div class="report-meta">Date Range: ${rangeLabel}<br/>Generated: ${format(
        now,
        "PPP p"
      )}</div>
        </div>
      `;

      const tableRows = rows
        .map(
          (r) => `<tr>
            <td>${escapeHtml(r.client)}</td>
            <td>${escapeHtml(r.service)}</td>
            <td>${escapeHtml(r.method)}</td>
            <td style="text-align:right">${r.amount}</td>
            <td>${r.date}</td>
            <td style="text-align:center">${escapeHtml(r.status)}</td>
            <td class="notes">${escapeHtml(r.notes)}</td>
          </tr>`
        )
        .join("\n");

      const footer = `
        <tfoot>
          <tr>
            <td colspan="3">Totals</td>
            <td style="text-align:right">GH₵${completedTotal.toFixed(2)}</td>
            <td></td>
            <td></td>
            <td style="text-align:right">Pending: GH₵${pendingTotal.toFixed(
              2
            )}</td>
          </tr>
        </tfoot>
      `;

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${style}</head><body>${header}<table><thead><tr><th>Client</th><th>Service</th><th>Method</th><th>Amount</th><th>Date</th><th>Status</th><th>Notes</th></tr></thead><tbody>${tableRows}</tbody>${footer}</table><div style="margin-top:16px;font-size:12px;color:#444">Total Completed: GH₵${completedTotal.toFixed(
        2
      )} &nbsp;&nbsp;|&nbsp;&nbsp; Total Pending: GH₵${pendingTotal.toFixed(
        2
      )} &nbsp;&nbsp;|&nbsp;&nbsp; Net: GH₵${(
        completedTotal - pendingTotal
      ).toFixed(
        2
      )}</div><script>window.onload=function(){setTimeout(()=>{window.print();},300);};</script></body></html>`;

      const w = window.open("", "_blank");
      if (!w) {
        toast.error("Unable to open print window (blocked)");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (err) {
      console.error("Print report failed", err);
      toast.error("Failed to open print view");
    }
  };

  // small helper to escape HTML
  const escapeHtml = (s: any) => {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Fallback exporter that writes wrapped text lines into the PDF if autoTable isn't available
  const textFallbackExport = async (doc: any, rows: any[]) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const usableWidth = pageWidth - margin * 2;
    let y = 32;
    const lineHeight = 7;

    const header = [
      "Client",
      "Service",
      "Method",
      "Amount",
      "Date",
      "Status",
      "Notes",
    ].join(" | ");
    doc.setFontSize(11);
    doc.text(header, margin, y);
    y += lineHeight;

    doc.setFontSize(9);
    for (const p of rows) {
      const client = p.bookings?.clients?.full_name || "N/A";
      const service = p.bookings?.services?.name || "N/A";
      const method = p.payment_method || "";
      const amount =
        typeof p.amount !== "undefined"
          ? `GHS ${Number(p.amount).toLocaleString()}`
          : "GHS 0";
      let dateStr = "N/A";
      if (p.payment_date) {
        const d = new Date(p.payment_date);
        if (!isNaN(d.getTime())) dateStr = format(d, "MMM dd, yyyy");
      }
      const status = p.payment_status || "";
      const notes = p.notes || "";

      const rowText = [
        client,
        service,
        method,
        amount,
        dateStr,
        status,
        notes,
      ].join(" | ");
      const wrapped = (doc as any).splitTextToSize(rowText, usableWidth);

      if (
        y + wrapped.length * lineHeight >
        doc.internal.pageSize.getHeight() - 20
      ) {
        doc.addPage();
        y = 20;
      }

      doc.text(wrapped, margin, y);
      y += wrapped.length * lineHeight;
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
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-2 rounded-md border"
            />
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-2 rounded-md border"
            />
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
            date: p.payment_date
              ? format(new Date(p.payment_date), "MMM dd, yyyy")
              : "",
          }))}
          filename="revenue_summary.csv"
        >
          <Button variant="outline">Export CSV</Button>
        </CSVLink>
        <Button variant="outline" onClick={saveReportAsPDF} className="ml-2">
          Export PDF
        </Button>
        {/* <Button variant="outline" onClick={printReport} className="ml-2">
          Print Report
        </Button> */}
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
          <p className="text-sm text-muted-foreground mt-2">
            Net revenue this month: GH₵{monthlyNet.toLocaleString()}
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
            <Card
              key={payment.id}
              onClick={() => openPaymentDialog(payment)}
              className="cursor-pointer"
            >
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
                <p className="text-sm text-muted-foreground">
                  {selectedPayment.bookings?.clients?.phone}
                </p>
              </div>

              <div>
                <h3 className="font-semibold">Service</h3>
                <p>{selectedPayment.bookings?.services?.name}</p>
                <p className="text-sm text-muted-foreground">
                  Duration:{" "}
                  {selectedPayment.bookings?.services?.duration_minutes ||
                    "N/A"}{" "}
                  min
                </p>
              </div>

              <div>
                <h3 className="font-semibold">Staff</h3>
                <p>
                  {selectedPayment.bookings?.staff?.full_name || "Unassigned"}
                </p>
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
                  <p className="text-sm text-muted-foreground">
                    {selectedPayment.notes}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                {selectedPayment.payment_status !== "completed" && (
                  <Button
                    onClick={() =>
                      updatePaymentStatus(selectedPayment.id, "completed")
                    }
                  >
                    Mark Completed
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setPaymentDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesRevenue;
