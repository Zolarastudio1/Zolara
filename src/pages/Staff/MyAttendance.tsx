import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Loader2, Clock, User } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";

interface AttendanceRecord {
  id: string;
  staff_id: string;
  check_in: string | null;
  check_out: string | null;
  status: "present" | "absent" | "late";
  created_at: string;
  staff?: {
    full_name: string;
    email: string;
  };
}

export default function MyAttendance() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUserId();
  }, []);

  useEffect(() => {
    if (userId) fetchAttendance();
  }, [userId]);

  /** Get logged-in user's ID */
  const fetchUserId = async () => {
    try {
      const { data: userData, error } = await supabase.auth.getUser();
      if (error) throw error;
      setUserId(userData.user?.id || null);
    } catch (err: any) {
      console.error(err);
      toast.error("Unable to fetch user ID");
    }
  };

  /** Fetch own attendance records */
  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, staff:staff(full_name, email)")
        .eq("staff_id", userId)
        .order("check_in", { ascending: false });

      if (error) throw error;
      setAttendanceRecords(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load your attendance records");
    } finally {
      setLoading(false);
    }
  };

  /** Check-out (only allowed if currently checked in) */
  const handleCheckOut = async () => {
    try {
      const record = attendanceRecords.find((rec) => !rec.check_out);
      if (!record) {
        toast.info("You are not currently checked in.");
        return;
      }

      const { error } = await supabase
        .from("attendance")
        .update({ check_out: new Date().toISOString() })
        .eq("id", record.id);

      if (error) throw error;
      toast.success("Checked out successfully!");
      fetchAttendance();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error while checking out");
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold mb-4">My Attendance</h1>

        {loading ? (
          <div className="flex justify-center items-center h-[60vh]">
            <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
          </div>
        ) : attendanceRecords.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-gray-500">No attendance records found.</p>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
            {attendanceRecords.map((record) => (
              <Card
                key={record.id}
                className="rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-lg bg-white/70 backdrop-blur-sm transition-all"
              >
                <div className="p-4 flex flex-col justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">{record.staff?.full_name || "You"}</p>
                    <p className="text-sm text-gray-500">{record.staff?.email}</p>

                    <div className="flex flex-wrap gap-2 mt-2 text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">
                          Check-in:{" "}
                          {record.check_in
                            ? isValid(parseISO(record.check_in))
                              ? format(parseISO(record.check_in), "PPPpp")
                              : "Invalid date"
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">
                          Check-out:{" "}
                          {record.check_out
                            ? isValid(parseISO(record.check_out))
                              ? format(parseISO(record.check_out), "PPPpp")
                              : "Invalid date"
                            : "Not yet"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!record.check_out && (
                    <Button
                      className="mt-2 w-full"
                      variant="destructive"
                      onClick={handleCheckOut}
                    >
                      Check Out
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
