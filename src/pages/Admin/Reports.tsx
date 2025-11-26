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

const Reports = () => {
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [filterType, setFilterType] = useState("all");
  const [reportData, setReportData] = useState<any>(null);
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
      const { data, error } = await supabase
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
          services:service_id (name, category),
          staff:staff_id (full_name),
          clients:client_id (full_name)
        )
      `
        )
        .eq("payment_status", "completed")
        .gte("payment_date", startDate)
        .lte("payment_date", endDate)
        .order("payment_date", { ascending: false });

      if (error) throw error;

      /* ===============================
       BASIC METRICS
    ============================== */
      const totalRevenue =
        data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const totalBookings = data?.length || 0;

      /* ===============================
       SERVICE BREAKDOWN
    ============================== */
      const serviceBreakdown = data?.reduce((acc: any, row: any) => {
        const name = row.bookings?.services?.name || "Unknown";
        if (!acc[name]) acc[name] = { count: 0, revenue: 0 };

        acc[name].count += 1;
        acc[name].revenue += Number(row.amount);
        return acc;
      }, {});

      /* ===============================
       STAFF BREAKDOWN
    ============================== */
      const staffBreakdown = data?.reduce((acc: any, row: any) => {
        const name = row.bookings?.staff?.full_name || "Unassigned";
        if (!acc[name]) acc[name] = { count: 0, revenue: 0 };

        acc[name].count += 1;
        acc[name].revenue += Number(row.amount);
        return acc;
      }, {});

      /* ===============================
       COMBINED EXPORT FORMAT
       ============================== */
      const exportRows = data.map((p) => {
        const booking = Array.isArray(p.bookings) ? p.bookings[0] : p.bookings;

        const appointmentDate = booking?.appointment_date ?? "";
        const appointmentTime = booking?.appointment_time ?? "";

        return {
          AppointmentDateTime: formatDateTime(appointmentDate, appointmentTime),
          Client: booking?.clients?.full_name ?? "",
          Staff: booking?.staff?.full_name ?? "",
          Service: booking?.services?.name ?? "",
          ServiceCategory: booking?.services?.category ?? "",
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
        staffBreakdown,
        exportRows,
        rawData: data,
      });
    } catch (err) {
      console.error("Report Error:", err);
    } finally {
      setLoading(false);
    }
  };

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
                  <SelectItem value="service">By Service</SelectItem>
                  <SelectItem value="staff">By Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={generateReport} disabled={loading}>
              {loading ? "Generating..." : "Generate Report"}
            </Button>
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={!reportData}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export CSV
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
                <CardTitle>Total Bookings</CardTitle>
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
        </>
      )}
    </div>
  );
};

export default Reports;
