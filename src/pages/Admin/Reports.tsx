import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDown, TrendingUp } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import jsPDF from "jspdf";

const Reports = () => {
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [filterType, setFilterType] = useState("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("all");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("all");
  const [reportData, setReportData] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const formatDateTime = (date: string, time: string) => {
    if (!date || !time) return "";

    let day, month, year;

    // Normalize separators
    const normalized = date.replace(/\//g, "-");
    const parts = normalized.split("-");

    // Detect format: DD-MM-YYYY or YYYY-MM-DD
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      // DD-MM-YYYY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }

    // Time handling
    const [h, m = "0", s = "0"] = time.split(":");
    const hour = parseInt(h, 10);
    const minute = parseInt(m, 10);
    const second = parseInt(s, 10);

    const dt = new Date(year, month, day, hour, minute, second);

    if (isNaN(dt.getTime())) {
      console.log("Invalid parsed date:", {
        date,
        time,
        parts,
        year,
        month,
        day,
      });
      return "";
    }

    return dt.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
  };

  /* ===============================
   GENERATE REPORT (CLEAN VERSION)
================================= */
  const generateReport = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("payments")
        .select(
          `
        id,
        amount,
        payment_method,
        payment_status,
        payment_date,
        bookings:booking_id (
          id,
          appointment_date,
          appointment_time,
          status,
          rating,
          services:service_id (id, name, category),
          staff:staff_id (id, full_name),
          clients:client_id (id, full_name)
        )
      `
        )
        .gte("payment_date", startDate)
        .lte("payment_date", endDate)
        .order("payment_date", { ascending: false });

      // apply payment method/status filters only when the corresponding filter type is selected
      if (filterType === "payment_method" && selectedPaymentMethod && selectedPaymentMethod !== "all") {
        query = query.eq("payment_method", selectedPaymentMethod as "cash" | "momo" | "card" | "bank_transfer");
      }
      if (filterType === "payment_status" && selectedPaymentStatus && selectedPaymentStatus !== "all") {
        query = query.eq("payment_status", selectedPaymentStatus as "pending" | "completed" | "refunded");
      }

      const { data, error } = await query;

      if (error) throw error;

      // helper: normalize booking and nested relations which may be arrays or single objects
      const getBooking = (p: any) => (Array.isArray(p.bookings) ? p.bookings[0] : p.bookings);
      const normalizeRel = (r: any) => (Array.isArray(r) ? r[0] : r);

      // If filtering by client, apply client filter client-side (bookings relation present)
      let rows = data || [];
      if (filterType === "client" && selectedClientId) {
        rows = (rows || []).filter((p: any) => {
          const booking = getBooking(p);
          const clientRel = normalizeRel(booking?.clients);
          const cid = clientRel?.id ?? clientRel?.full_name ?? "";
          // Coerce to string because client ids may be numbers/uuids
          return String(cid) === String(selectedClientId);
        });
      }

      /* ===============================
       BASIC METRICS
    ============================== */
      const totalRevenue = rows.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;

      const totalBookings = rows.length || 0;

      /* ===============================
       SERVICE BREAKDOWN
    ============================== */
      const serviceBreakdown = rows.reduce((acc: any, row: any) => {
        const booking = getBooking(row);
        const serviceRel = normalizeRel(booking?.services);
        const name = serviceRel?.name || "Unknown";
        if (!acc[name]) acc[name] = { count: 0, revenue: 0 };

        acc[name].count += 1;
        acc[name].revenue += Number(row.amount);
        return acc;
      }, {});

      /* ===============================
       MOST ACTIVE CLIENTS
    ============================== */
      const mostActiveClients = rows.reduce((acc: any, row: any) => {
        const booking = getBooking(row);
        const clientRel = normalizeRel(booking?.clients);
        const clientId = clientRel?.id ?? clientRel?.full_name ?? "unknown";
        const clientName = clientRel?.full_name || "Unknown";

        const key = String(clientId);
        if (!acc[key]) acc[key] = { id: clientId, name: clientName, count: 0, revenue: 0 };
        acc[key].count += 1;
        acc[key].revenue += Number(row.amount);
        return acc;
      }, {});

      const mostActiveList = Object.values(mostActiveClients || {}).sort(
        (a: any, b: any) => b.count - a.count
      );

      /* ===============================
       SERVICE HISTORY (for selected client)
    ============================== */
      let serviceHistory: any = {};
      if (filterType === "service_history" && selectedClientId) {
        const rowsForClient = (data || []).filter((p: any) => {
          const booking = getBooking(p);
          const clientRel = normalizeRel(booking?.clients);
          const cid = clientRel?.id ?? clientRel?.full_name ?? "";
          return String(cid) === String(selectedClientId);
        }) || [];

        serviceHistory = rowsForClient.reduce((acc: any, row: any) => {
          const booking = getBooking(row);
          const serviceRel = normalizeRel(booking?.services);
          const name = serviceRel?.name || "Unknown";
          if (!acc[name]) acc[name] = { count: 0, revenue: 0 };
          acc[name].count += 1;
          acc[name].revenue += Number(row.amount);
          return acc;
        }, {});
      }

      /* ===============================
       STAFF BREAKDOWN
    ============================== */
  // Calculate staff breakdown with optional average rating if booking.rating exists
  const staffBreakdown = rows.reduce((acc: any, row: any) => {
        const staffObj = Array.isArray(row.bookings) ? row.bookings[0]?.staff : row.bookings?.staff;
        const name = staffObj?.full_name || "Unassigned";
        const staffId = staffObj?.id || "unknown";
        if (!acc[staffId]) acc[staffId] = { name, count: 0, revenue: 0, ratingSum: 0, ratingCount: 0 };

        acc[staffId].count += 1;
        acc[staffId].revenue += Number(row.amount);

        // support multiple possible rating fields on the booking
        const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;
        const rating = booking?.rating ?? booking?.rating_value ?? booking?.client_rating ?? null;
        if (rating !== null && !isNaN(Number(rating))) {
          acc[staffId].ratingSum += Number(rating);
          acc[staffId].ratingCount += 1;
        }

        return acc;
      }, {});

      // Convert accumulated map to object keyed by name for UI consumption
      const staffBreakdownByName: any = {};
      Object.entries(staffBreakdown || {}).forEach(([staffId, v]: any) => {
        const item = v as any;
        staffBreakdownByName[item.name] = {
          count: item.count,
          revenue: item.revenue,
          avgRating: item.ratingCount ? item.ratingSum / item.ratingCount : null,
        };
      });

  /* ===============================
   COMBINED EXPORT FORMAT
   ============================== */
  const exportRows = rows.map((p) => {
        const booking = getBooking(p);
        const clientRel = normalizeRel(booking?.clients);
        const staffRel = normalizeRel(booking?.staff);
        const serviceRel = normalizeRel(booking?.services);

        const appointmentDate = booking?.appointment_date ?? "";
        const appointmentTime = booking?.appointment_time ?? "";

        return {
          AppointmentDateTime: formatDateTime(appointmentDate, appointmentTime),
          Client: clientRel?.full_name ?? "",
          Staff: staffRel?.full_name ?? "",
          Service: serviceRel?.name ?? "",
          ServiceCategory: serviceRel?.category ?? "",
          Amount: p.amount ?? 0,
          PaymentMethod: p.payment_method ?? "",
          PaymentDate: p.payment_date ?? "",
          BookingStatus: booking?.status ?? "",
          BookingID: booking?.id ?? "",
          PaymentID: p.id ?? "",
        };
      });

      setReportData({
        totalRevenue,
        totalBookings,
        serviceBreakdown,
        staffBreakdown: staffBreakdownByName,
        exportRows,
        rawData: data,
        mostActiveList,
        serviceHistory,
      });
    } catch (err) {
      console.error("Report Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch clients for service history filter
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data } = await supabase
          .from("clients")
          .select("id, full_name")
          .order("full_name");
        if (data) setClients(data);
      } catch (err) {
        console.error("Failed to fetch clients", err);
      }
    };

    fetchClients();
  }, []);

  /* Run on page mount */
  useEffect(() => {
    generateReport();
  }, []);

  /* ===============================
   EXPORT CSV
================================= */
  const exportToCSV = () => {
    if (!reportData?.exportRows || reportData.exportRows.length === 0) return;

    const rows = reportData.exportRows;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r: any) => headers.map((h) => `"${r[h] ?? ""}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `salon-report-${startDate}-to-${endDate}.csv`;
    a.click();

    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Generate and analyze business reports
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Filter Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="payment_method">By Payment Method</SelectItem>
                  <SelectItem value="payment_status">By Payment Status</SelectItem>
                  <SelectItem value="client">By Client</SelectItem>
                  <SelectItem value="service">By Service</SelectItem>
                  <SelectItem value="staff">By Staff</SelectItem>
                  <SelectItem value="most_active">Most Active Clients</SelectItem>
                  <SelectItem value="service_history">Service History (Per Client)</SelectItem>
                </SelectContent>
              </Select>
            </div>
              {filterType === "payment_method" && (
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={selectedPaymentMethod}
                    onValueChange={(v) => setSelectedPaymentMethod(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="momo">MOMO</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filterType === "payment_status" && (
                <div className="space-y-2">
                  <Label>Payment Status</Label>
                  <Select
                    value={selectedPaymentStatus}
                    onValueChange={(v) => setSelectedPaymentStatus(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            {filterType === "service_history" && (
              <div className="space-y-2 md:col-span-3">
                <Label>Choose Client</Label>
                <Select
                  value={selectedClientId}
                  onValueChange={(v) => setSelectedClientId(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All clients</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {filterType === "client" && (
              <div className="space-y-2 md:col-span-3">
                <Label>Choose Client</Label>
                <Select
                  value={selectedClientId}
                  onValueChange={(v) => setSelectedClientId(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All clients</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={generateReport} disabled={loading} className="w-full sm:w-auto">
              {loading ? "Generating..." : "Generate Report"}
            </Button>
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={!reportData}
              className="w-full sm:w-auto"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                // If report not generated, run generateReport first
                if (!reportData) await generateReport();
                // create PDF using reportData
                try {
                  // Build simple HTML from exportRows
                  const rows = (reportData?.exportRows || []).slice();
                  const title = `Revenue Report ${startDate} - ${endDate}`;
                  const style = `
                    <style>
                      @page { size: A4 landscape; margin: 20mm }
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#111 }
                      table { width:100%; border-collapse:collapse; font-size:12px }
                      th, td { border:1px solid #ddd; padding:8px; vertical-align:top }
                      th { background:#1e90ff; color:#fff; font-weight:700 }
                    </style>
                  `;

                  const headers = Object.keys(rows[0] || {});
                  const tableRowsHtml = rows
                    .map(
                      (r: any) =>
                        `<tr>${headers
                          .map((h) => `<td>${(r[h] ?? "").toString()}</td>`)
                          .join("")}</tr>`
                    )
                    .join("");

                  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${style}</head><body><h2>${title}</h2><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${tableRowsHtml}</tbody></table></body></html>`;

                  // create offscreen wrapper and load html2canvas dynamically
                  const wrapper = document.createElement("div");
                  wrapper.style.position = "fixed";
                  wrapper.style.left = "-9999px";
                  wrapper.innerHTML = html;
                  document.body.appendChild(wrapper);

                  if (!(window as any).html2canvas) {
                    await new Promise<void>((resolve, reject) => {
                      const s = document.createElement("script");
                      s.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
                      s.onload = () => resolve();
                      s.onerror = (e) => reject(e);
                      document.head.appendChild(s);
                    });
                  }

                  const html2canvas = (window as any).html2canvas;
                  if (!html2canvas) throw new Error("html2canvas failed to load");

                  const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true });
                  const imgData = canvas.toDataURL("image/png");
                  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
                  const pdfWidth = pdf.internal.pageSize.getWidth();
                  const pdfHeight = pdf.internal.pageSize.getHeight();
                  const imgProps: any = (pdf as any).getImageProperties(imgData);
                  const imgWidth = pdfWidth - 40;
                  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

                  if (imgHeight <= pdfHeight - 40) {
                    pdf.addImage(imgData, "PNG", 20, 20, imgWidth, imgHeight);
                  } else {
                    const pageCanvas = document.createElement("canvas");
                    const pageCtx = pageCanvas.getContext("2d")!;
                    const scale = canvas.width / imgWidth;
                    const pageHeightPx = (pdfHeight - 40) * scale;
                    pageCanvas.width = canvas.width;
                    pageCanvas.height = pageHeightPx;

                    let renderedHeight = 0;
                    while (renderedHeight < canvas.height) {
                      pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
                      pageCtx.drawImage(canvas, 0, renderedHeight, canvas.width, pageCanvas.height, 0, 0, pageCanvas.width, pageCanvas.height);
                      const pageData = pageCanvas.toDataURL("image/png");
                      pdf.addImage(pageData, "PNG", 20, 20, imgWidth, (pageCanvas.height / scale));
                      renderedHeight += pageCanvas.height;
                      if (renderedHeight < canvas.height) pdf.addPage();
                    }
                  }

                  const nowStamp = format(new Date(), "yyyyMMdd_HHmmss");
                  pdf.save(`revenue_report_${nowStamp}.pdf`);
                  document.body.removeChild(wrapper);
                } catch (err) {
                  console.error("Export PDF failed", err);
                  alert("Failed to export PDF");
                }
              }}
              disabled={!reportData}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {reportData && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Total Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  GH₵{reportData.totalRevenue.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total Completed Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{reportData.totalBookings}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Revenue by Service</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(reportData.serviceBreakdown || {}).map(
                  ([service, data]: [string, any]) => (
                    <div
                      key={service}
                      className="flex justify-between items-center p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{service}</p>
                        <p className="text-sm text-muted-foreground">
                          {data.count} bookings
                        </p>
                      </div>
                      <p className="font-bold text-primary">
                        GH₵{data.revenue.toLocaleString()}
                      </p>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue by Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(reportData.staffBreakdown || {}).map(
                  ([staff, data]: [string, any]) => (
                    <div
                      key={staff}
                      className="flex justify-between items-center p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{staff}</p>
                        <p className="text-sm text-muted-foreground">
                          {data.count} bookings
                        </p>
                          {data.avgRating !== null && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Avg rating: {Number(data.avgRating).toFixed(2)}
                            </p>
                          )}
                      </div>
                      <p className="font-bold text-primary">
                        GH₵{data.revenue.toLocaleString()}
                      </p>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          {/* Most active clients (when selected) */}
          {filterType === "most_active" && (
            <Card>
              <CardHeader>
                <CardTitle>Most Active Clients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(reportData.mostActiveList || []).map((c: any) => (
                    <div
                      key={c.id}
                      className="flex justify-between items-center p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {c.count} bookings
                        </p>
                      </div>
                      <p className="font-bold text-primary">
                        GH₵{Number(c.revenue).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Service history for selected client */}
          {filterType === "service_history" && selectedClientId && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Service History for {clients.find((c) => c.id === selectedClientId)?.full_name || "Client"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(reportData.serviceHistory || {}).map(
                    ([service, data]: [string, any]) => (
                      <div
                        key={service}
                        className="flex justify-between items-center p-3 bg-muted rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{service}</p>
                          <p className="text-sm text-muted-foreground">
                            {data.count} times
                          </p>
                        </div>
                        <p className="font-bold text-primary">
                          GH₵{data.revenue.toLocaleString()}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
