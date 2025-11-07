import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, TrendingUp } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

const Reports = () => {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [filterType, setFilterType] = useState("all");
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("payments")
        .select("*, bookings(*, clients(*), staff(*), services(*))")
        .gte("payment_date", startDate)
        .lte("payment_date", endDate);

      const { data, error } = await query;

      if (error) throw error;

      const totalRevenue = data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const totalBookings = data?.length || 0;
      
      const serviceBreakdown = data?.reduce((acc: any, payment: any) => {
        const serviceName = payment.bookings?.services?.name || "Unknown";
        if (!acc[serviceName]) {
          acc[serviceName] = { count: 0, revenue: 0 };
        }
        acc[serviceName].count += 1;
        acc[serviceName].revenue += Number(payment.amount);
        return acc;
      }, {});

      const staffBreakdown = data?.reduce((acc: any, payment: any) => {
        const staffName = payment.bookings?.staff?.full_name || "Unassigned";
        if (!acc[staffName]) {
          acc[staffName] = { count: 0, revenue: 0 };
        }
        acc[staffName].count += 1;
        acc[staffName].revenue += Number(payment.amount);
        return acc;
      }, {});

      setReportData({
        totalRevenue,
        totalBookings,
        serviceBreakdown,
        staffBreakdown,
        rawData: data
      });
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateReport();
  }, []);

  const exportToCSV = () => {
    if (!reportData?.rawData) return;

    const headers = ["Date", "Client", "Service", "Staff", "Amount", "Payment Method"];
    const rows = reportData.rawData.map((payment: any) => [
      format(new Date(payment.payment_date), "yyyy-MM-dd"),
      payment.bookings?.clients?.full_name || "",
      payment.bookings?.services?.name || "",
      payment.bookings?.staff?.full_name || "",
      payment.amount,
      payment.payment_method
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salon-report-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Generate and analyze business reports</p>
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
            <Button variant="outline" onClick={exportToCSV} disabled={!reportData}>
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
                  Total Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  ₦{reportData.totalRevenue.toLocaleString()}
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
                {Object.entries(reportData.serviceBreakdown || {}).map(([service, data]: [string, any]) => (
                  <div key={service} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{service}</p>
                      <p className="text-sm text-muted-foreground">{data.count} bookings</p>
                    </div>
                    <p className="font-bold text-primary">₦{data.revenue.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue by Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(reportData.staffBreakdown || {}).map(([staff, data]: [string, any]) => (
                  <div key={staff} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{staff}</p>
                      <p className="text-sm text-muted-foreground">{data.count} bookings</p>
                    </div>
                    <p className="font-bold text-primary">₦{data.revenue.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Reports;
