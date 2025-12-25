import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface AttendanceRecord {
  id: string;
  staff_id: string;
  check_in: string;
  check_out: string | null;
  status: string;
  created_at: string;
  staff?: {
    full_name: string;
    email: string;
  };
}

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

export default function Attendance() {
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (userRole == "owner" || userRole == "receptionist") {
      fetchStaff();
      fetchAttendance();
    }
  }, [userRole]);

  /** Fetch Logged-in User Role */
  const fetchUserRole = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const metaDataRole = user.user_metadata.role;

      setUserRole(roleData?.role || metaDataRole);
    } catch (err: any) {
      console.error(err);
      toast.error("Unable to fetch user role");
    }
  };

  /** Fetch Staff List */
  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name, email");

      if (error) throw error;
      setStaffList(data || []);
    } catch (err: any) {
      toast.error("Failed to load staff list");
    }
  };

  /** Fetch Attendance Records for Today */
  const fetchAttendance = async () => {
    setLoading(true);

    try {
      const { todayStart, todayEnd } = getTodayRange();

      const { data, error } = await supabase
        .from("attendance")
        .select("*, staff:staff!staff_id(full_name, email)")
        .gte("check_in", todayStart)
        .lte("check_in", todayEnd);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info("No attendance records found for today");
        setAttendanceRecords([]);
        return;
      }

      setAttendanceRecords(data as AttendanceRecord[]);
    } catch (err: any) {
      console.error("Failed to fetch attendance:", err);
      toast.error("Failed to load attendance records");
    } finally {
      setLoading(false);
    }
  };

  /** Utility: Today's Time Range */
  const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return { todayStart: start.toISOString(), todayEnd: end.toISOString() };
  };

  /** Check-in a Staff */
  const handleCheckIn = async (staffId: string) => {
    console.log("Staff ID:", staffId);

    try {
      const { todayStart, todayEnd } = getTodayRange();

      // Check if there is an existing attendance for today
      const { data: existingRecords, error: fetchError } = await supabase
        .from("attendance")
        .select("*")
        .eq("staff_id", staffId)
        .gte("check_in", todayStart)
        .lte("check_in", todayEnd);

      if (fetchError) throw fetchError;

      // If a record exists and not checked out, warn
      const ongoing = existingRecords?.find((rec) => rec.check_out === null);
      if (ongoing) {
        toast.info("This staff is already checked in.");
        return;
      }

      // Create a new attendance record if none exists
      const { error: insertError } = await supabase.from("attendance").insert([
        {
          staff_id: staffId,
          check_in: new Date().toISOString(),
          status: "present",
        },
      ]);

      if (insertError) throw insertError;

      toast.success("Check-in recorded successfully!");
      await fetchAttendance(); // Refresh UI
    } catch (err: any) {
      console.error("Check-in error:", err);
      toast.error("Error while marking check-in");
    }
  };

  /** Check-out a Staff */
  const handleCheckOut = async (staffId: string) => {
    try {
      const record = attendanceRecords.find(
        (rec) => rec.staff_id === staffId && !rec.check_out
      );
      if (!record) {
        toast.info("No active check-in found for this staff.");
        return;
      }

      const { error } = await supabase
        .from("attendance")
        .update({ check_out: new Date().toISOString() })
        .eq("id", record.id);

      if (error) throw error;
      toast.success("Check-out recorded successfully!");
      fetchAttendance();
    } catch (err: any) {
      toast.error(err.message || "Error while marking check-out");
    }
  };

  /** Main UI */
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-foreground">
          Attendance Management
        </h1>

        {loading ? (
          <div className="flex justify-center items-center h-[60vh]">
            <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
          </div>
        ) : (
          <Card className="p-4 md:p-6 shadow-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      No staff found
                    </TableCell>
                  </TableRow>
                ) : (
                  staffList.map((staff) => {
                    const record = attendanceRecords.find(
                      (rec) => rec.staff_id === staff.id
                    );
                    const isCheckedIn = record && !record.check_out;

                    return (
                      <TableRow key={staff.id}>
                        <TableCell className="font-medium">
                          {staff.full_name}
                        </TableCell>
                        <TableCell>{staff.email}</TableCell>
                        <TableCell>
                          {record
                            ? record.check_out
                              ? "Checked Out"
                              : "Checked In"
                            : "Not Checked In"}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {!record ? (
                            <Button
                              size="sm"
                              onClick={() => handleCheckIn(staff.id)}
                            >
                              Check In
                            </Button>
                          ) : !record.check_out ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleCheckOut(staff.id)}
                            >
                              Check Out
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Completed
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
