import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Attendance {
  id: string;
  staff_id: string;
  check_in: string;
  check_out: string | null;
  status: "present" | "absent" | "late";
  created_at: string;
}

export default function Attendance() {
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkTodayAttendance();
  }, []);

  const getTodayRange = () => {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    return {
      todayStart: todayStart.toISOString(),
      todayEnd: todayEnd.toISOString(),
    };
  };

  const checkTodayAttendance = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;

      const { todayStart, todayEnd } = getTodayRange();

      const { data, error } = await supabase
        //@ts-ignore
        .from<Attendance>("attendance")
        .select("*")
        //@ts-ignore
        .eq("staff_id", userId)
        .gte("check_in", todayStart)
        .lte("check_in", todayEnd)
        .maybeSingle();

      if (error) {
        console.error("Error checking attendance:", error);
        return;
      }

      if (data) {
        setHasCheckedIn(true);
        //@ts-ignore
        setRecordId(data.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckIn = async () => {
    if (hasCheckedIn) {
      toast.info("You have already checked in today.");
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        toast.error("User not authenticated");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        //@ts-ignore

        .from("attendance")
        //@ts-ignore

        .insert([
          {
            staff_id: userId,
            check_in: new Date().toISOString(),
            status: "present",
          },
        ])
        .select()
        .maybeSingle();

      if (error) toast.error(error.message);
      else if (data) {
        toast.success("Checked in successfully!");
        setRecordId(data.id);
        setHasCheckedIn(true);
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!recordId) {
      toast.error("No attendance record found");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        //@ts-ignore
        .from("attendance")
        //@ts-ignore
        .update({ check_out: new Date().toISOString() })
        .eq("id", recordId);

      if (error) toast.error(error.message);
      else toast.success("Checked out successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-card p-6 rounded-2xl shadow">
      <h2 className="text-lg font-semibold mb-4">Attendance</h2>
      {!hasCheckedIn ? (
        <Button onClick={handleCheckIn} disabled={loading}>
          {loading ? "Checking in..." : "Check In"}
        </Button>
      ) : (
        <Button onClick={handleCheckOut} disabled={loading}>
          {loading ? "Checking out..." : "Check Out"}
        </Button>
      )}
    </div>
  );
}
