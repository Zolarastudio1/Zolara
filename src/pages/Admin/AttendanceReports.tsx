import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Download, Calendar } from "lucide-react";
import {
  format,
  parseISO,
  differenceInMinutes,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// interface AttendanceRecord {
//   id: string;
//   staff_id: string;
//   check_in: string;
//   check_out: string | null;
//   status: string;
//   created_at: string;
//   staff?: {
//     full_name: string;
//     email: string;
//   };
// }

// interface StaffReport {
//   staff_id: string;
//   staff_name: string;
//   total_hours: number;
//   late_check_ins: number;
//   early_checkouts: number;
//   total_days: number;
// }

// const EXPECTED_START_HOUR = 9; // 9 AM
// const EXPECTED_END_HOUR = 17; // 5 PM
// const LATE_THRESHOLD_MINUTES = 15;
// const EARLY_THRESHOLD_MINUTES = 15;

interface AttendanceRecord {
  staff_id: string;
  staff?: { full_name: string };
  check_in: string;
  check_out: string;
  notes?: string;
}

interface StaffReport {
  staff_id: string;
  staff_name: string;
  total_hours: number;
  late_check_ins: number;
  early_checkouts: number;
  total_days: number;
  records: StaffRecordRow[];
}

interface StaffRecordRow {
  date: string;
  check_in_time: string;
  check_out_time: string;
  total_hours: string;
  late_check_in: string;
  early_checkout: string;
  notes: string;
}

// Constants for expected working hours
const EXPECTED_START_HOUR = 8;
const EXPECTED_START_MINUTES = 30; // 8:30 AM
const EXPECTED_END_HOUR = 20;
const EXPECTED_END_MINUTES = 30; // 8:30 PM

export default function AttendanceReports() {
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [reports, setReports] = useState<StaffReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (userRole === "owner" || userRole === "receptionist") {
      fetchAttendance();
    }
  }, [userRole, startDate, endDate]);

  const fetchUserRole = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      setUserRole(storedUser.role);
    } catch (err: any) {
      console.error(err);
      toast.error("Unable to fetch user role");
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, staff:staff!staff_id(full_name, email)")
        .gte("check_in", `${startDate}T00:00:00`)
        .lte("check_in", `${endDate}T23:59:59`)
        .order("check_in", { ascending: false });

      if (error) throw error;

      const records = (data as AttendanceRecord[]) || [];
      setAttendanceRecords(records);
      generateReports(records);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load attendance records");
    } finally {
      setLoading(false);
    }
  };

  const generateReports = (records: AttendanceRecord[]) => {
    const staffMap = new Map<string, StaffReport>();

    records.forEach((record) => {
      if (!record.staff_id) return;

      const staffId = record.staff_id;
      const staffName = record.staff?.full_name || "Unknown";
      const notes = record.notes || "";

      let checkIn: Date | null = null;
      let checkOut: Date | null = null;

      try {
        if (record.check_in) checkIn = parseISO(record.check_in);
        if (record.check_out) checkOut = parseISO(record.check_out);
      } catch {
        // Invalid date, ignore parsing
      }

      // Use check-in for date if available, otherwise check-out
      const dateSource = new Date(checkIn);

      
      if (!dateSource) return;
      
      const date = checkIn.toDateString();
      const check_in_time = checkIn ? format(checkIn, "hh:mm a") : "—";
      const check_out_time = checkOut ? format(checkOut, "hh:mm a") : "—";

      // Total hours
      const minutesWorked =
        checkIn && checkOut ? differenceInMinutes(checkOut, checkIn) : 0;
      const total_hours = (minutesWorked / 60).toFixed(2);

      // Late check-in (>8:30 AM)
      const expectedStart = new Date(dateSource);
      expectedStart.setHours(EXPECTED_START_HOUR, EXPECTED_START_MINUTES, 0, 0);
      const late_check_in = checkIn && checkIn > expectedStart ? "Yes" : "No";

      // Early checkout (<8:30 PM)
      const expectedEnd = new Date(dateSource);
      expectedEnd.setHours(EXPECTED_END_HOUR, EXPECTED_END_MINUTES, 0, 0);
      const early_checkout = checkOut && checkOut < expectedEnd ? "Yes" : "No";

      // Initialize staff report
      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, {
          staff_id: staffId,
          staff_name: staffName,
          total_hours: 0,
          late_check_ins: 0,
          early_checkouts: 0,
          total_days: 0,
          records: [],
        });
      }

      const report = staffMap.get(staffId)!;

      report.total_hours += minutesWorked / 60;
      report.total_days += 1;
      if (late_check_in === "Yes") report.late_check_ins += 1;
      if (early_checkout === "Yes") report.early_checkouts += 1;

      report.records.push({
        date,
        check_in_time,
        check_out_time,
        total_hours,
        late_check_in,
        early_checkout,
        notes,
      });
    });

    setReports(Array.from(staffMap.values()));
  };

  const exportToCSV = () => {
    if (reports.length === 0) {
      toast.info("No data to export");
      return;
    }

    // CSV headers
    const headers = [
      "Date",
      "Staff Name",
      "Check-in Time",
      "Check-out Time",
      "Total Hours",
      "Late Check-in?",
      "Early Checkout?",
      "Notes",
    ];

    // Flatten per-record rows for all staff
    const rows = reports.flatMap((report) =>
      report.records.map((r) => [
        r.date,
        report.staff_name,
        r.check_in_time,
        r.check_out_time,
        r.total_hours,
        r.late_check_in,
        r.early_checkout,
        r.notes || "",
      ])
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `attendance-report-${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Report exported successfully!");
  };

  if (userRole !== "owner" && userRole !== "receptionist") {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="p-6 text-center">
          <p className="text-destructive">
            Access Denied. Only owners and receptionists can view reports.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Attendance Reports</h1>
          <Button onClick={exportToCSV} disabled={reports.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={fetchAttendance}>
            <Calendar className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </Card>

        {loading ? (
          <div className="flex justify-center items-center h-[40vh]">
            <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">
              No attendance data found for the selected period.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Staff Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Days Worked
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Avg Hours/Day
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Late Check-ins
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Early Checkouts
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {reports.map((report) => (
                    <tr key={report.staff_id} className="hover:bg-muted/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {report.staff_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {report.total_days}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {report.total_hours.toFixed(2)} hrs
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(report.total_hours / report.total_days).toFixed(2)}{" "}
                        hrs
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={
                            report.late_check_ins > 0
                              ? "text-orange-500 font-medium"
                              : ""
                          }
                        >
                          {report.late_check_ins}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={
                            report.early_checkouts > 0
                              ? "text-orange-500 font-medium"
                              : ""
                          }
                        >
                          {report.early_checkouts}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card className="p-6 bg-muted/30">
          <h3 className="font-semibold mb-2">Report Details:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Expected shift: 9:00 AM - 5:00 PM</li>
            <li>• Late check-in: More than 15 minutes after 9:00 AM</li>
            <li>• Early checkout: More than 15 minutes before 5:00 PM</li>
            <li>• Only completed shifts (with check-out) are included</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
