import { useEffect, useMemo, useState } from "react";
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
import { Loader2, Edit2, Clock, CheckCircle2, XCircle } from "lucide-react";
import {
  AttendanceRecord as AR,
  Staff as S,
  DEFAULT_SHIFT,
  calcTotalHours,
  calcOvertime,
  formatTimeShort,
  isLate,
  isEarlyCheckout,
  isHalfDay,
  isoForDateRange,
} from "@/lib/attendance";

type FilterStatus = "all" | "checked_in" | "checked_out" | "late" | "absent" | "half_day";

export default function Attendance() {
  const [attendanceRecords, setAttendanceRecords] = useState<AR[]>([]);
  const [staffList, setStaffList] = useState<S[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  // Edit modal state
  const [editing, setEditing] = useState<AR | null>(null);
  const [editCheckIn, setEditCheckIn] = useState<string>("");
  const [editCheckOut, setEditCheckOut] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (userRole === "owner" || userRole === "receptionist" || userRole === "admin") {
      fetchStaff();
      fetchAttendance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  useEffect(() => {
    // refetch when date changes
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const fetchUserRole = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const metaDataRole = (user.user_metadata as any)?.role;
      setUserRole(roleData?.role || metaDataRole || "");
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name, email");
      if (error) throw error;
      setStaffList(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load staff list");
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const { start, end } = isoForDateRange(selectedDate);
      const { data, error } = await supabase
        .from("attendance")
        .select("*, staff:staff!staff_id(full_name, email)")
        .gte("check_in", start)
        .lte("check_in", end);
      if (error) throw error;
      setAttendanceRecords((data as AR[]) || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load attendance records");
    } finally {
      setLoading(false);
    }
  };

  // Helpers to derive display rows: include staff even if no attendance (to mark absent)
  const rows = useMemo(() => {
    return staffList.map((s) => {
      const record = attendanceRecords.find((r) => r.staff_id === s.id);
      const total = calcTotalHours(record?.check_in, record?.check_out);
      const overtime = calcOvertime(total);
      const lateFlag = isLate(record?.check_in, DEFAULT_SHIFT);
      const earlyFlag = record?.check_out ? isEarlyCheckout(record.check_out, DEFAULT_SHIFT) : false;
      const halfDay = isHalfDay(total);
  let status: string;
  // Prefer explicit DB status when present (e.g. 'absent'),
  // fall back to deriving from check_out presence.
  if (!record) status = "Absent";
  else if (record.status === 'absent') status = "Absent";
  else if (!record.check_out) status = "Checked In";
  else status = "Checked Out";
      if (status !== "Absent" && lateFlag) status = "Late";
      if (status !== "Absent" && halfDay) status = "Half-day";

      return {
        staff: s,
        record: record || null,
        total,
        overtime,
        status,
        lateFlag,
        earlyFlag,
        halfDay,
      };
    });
  }, [staffList, attendanceRecords]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (staffFilter !== "all" && r.staff.id !== staffFilter) return false;
      if (statusFilter !== "all") {
        switch (statusFilter) {
          case "checked_in":
            if (r.record && !r.record.check_out) return true;
            return false;
          case "checked_out":
            if (r.record && r.record.check_out) return true;
            return false;
          case "late":
            return r.lateFlag;
          case "absent":
            // Consider explicit absent records OR no record at all
            return (r.record && r.record.status === 'absent') || !r.record;
          case "half_day":
            return r.halfDay;
          default:
            return true;
        }
      }
      return true;
    });
  }, [rows, staffFilter, statusFilter]);

  const summary = useMemo(() => {
    const present = rows.filter((r) => r.record && r.record.status !== 'absent').length;
    const absent = rows.filter((r) => (r.record && r.record.status === 'absent') || !r.record).length;
    const late = rows.filter((r) => r.lateFlag).length;
    const totalHours = rows.reduce((acc, r) => acc + r.total, 0);
    return { present, absent, late, totalHours };
  }, [rows]);

  const handleCheckIn = async (staffId: string) => {
    try {
      const { start, end } = isoForDateRange(selectedDate);
      const { data: existing } = await supabase
        .from("attendance")
        .select("*")
        .eq("staff_id", staffId)
        .gte("check_in", start)
        .lte("check_in", end);

      const ongoing = existing?.find((r) => !r.check_out);
      if (ongoing) {
        toast.info("Staff already checked in for this day.");
        return;
      }

      const payload: any = {
        staff_id: staffId,
        check_in: new Date().toISOString(),
        status: "present",
      };

      const { error } = await supabase.from("attendance").insert([payload]);
      if (error) throw error;
      toast.success("Check-in recorded");
      fetchAttendance();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to check-in");
    }
  };

  const handleCheckOut = async (staffId: string) => {
    try {
      const record = attendanceRecords.find((r) => r.staff_id === staffId && !r.check_out);
      if (!record) {
        toast.info("No active check-in found.");
        return;
      }
      const { error } = await supabase
        .from("attendance")
        .update({ check_out: new Date().toISOString(), status: "present" })
        .eq("id", record.id);
      if (error) throw error;
      toast.success("Checked out");
      fetchAttendance();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to check-out");
    }
  };

  const handleMarkAbsent = async (staffId: string) => {
    try {
      // Insert an absent record for the day if none exists
      const { start, end } = isoForDateRange(selectedDate);
      const { data: existing } = await supabase
        .from("attendance")
        .select("*")
        .eq("staff_id", staffId)
        .gte("check_in", start)
        .lte("check_in", end);

      if (existing && existing.length > 0) {
        toast.info("Attendance already recorded for this staff this day");
        return;
      }

      const payload = {
        staff_id: staffId,
        check_in: new Date(selectedDate + "T00:00:00").toISOString(),
        check_out: new Date(selectedDate + "T00:00:00").toISOString(),
        status: "absent",
      } as any;

      const { error } = await supabase.from("attendance").insert([payload]);
      if (error) throw error;
      toast.success("Marked absent");
      fetchAttendance();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to mark absent");
    }
  };

  const openEdit = (row: any) => {
    setEditing(row.record);
    setEditReason("");
    setEditCheckIn(row.record?.check_in ? (new Date(row.record.check_in)).toISOString().slice(0,16) : "");
    setEditCheckOut(row.record?.check_out ? (new Date(row.record.check_out)).toISOString().slice(0,16) : "");
  };

  const closeEdit = () => {
    setEditing(null);
    setEditReason("");
  };

  const submitEdit = async () => {
    if (!editing) return;
    try {
      const payload: any = {};
      if (editCheckIn) payload.check_in = new Date(editCheckIn).toISOString();
      else payload.check_in = null;
      if (editCheckOut) payload.check_out = new Date(editCheckOut).toISOString();
      else payload.check_out = null;

      // Try to include audit fields; if DB doesn't have them, we'll catch and retry without them
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        (payload as any).last_edited_by = user.id;
        (payload as any).last_edit_reason = editReason || null;
      }

      const { error } = await supabase.from("attendance").update(payload).eq("id", editing.id);
      if (error) {
        // fallback: remove optional audit fields and retry
        const { message } = error as any;
        if (message && /column .* does not exist/i.test(message)) {
          delete payload.last_edited_by;
          delete payload.last_edit_reason;
          const r2 = await supabase.from("attendance").update(payload).eq("id", editing.id);
          if (r2.error) throw r2.error;
        } else {
          throw error;
        }
      }

      toast.success("Attendance updated");
      closeEdit();
      fetchAttendance();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update attendance");
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Attendance Management</h1>

        <Card className="p-4 mb-4">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 gap-3">
            <div>
              <label className="text-sm block mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm block mb-1">Staff</label>
              <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="border rounded px-3 py-2 min-w-[180px]">
                <option value="all">All staff</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm block mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FilterStatus)} className="border rounded px-3 py-2 min-w-[160px]">
                <option value="all">All statuses</option>
                <option value="checked_in">Checked In</option>
                <option value="checked_out">Checked Out</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half-day</option>
              </select>
            </div>

            <div className="ml-auto flex items-end gap-2">
              <Button onClick={() => fetchAttendance()} variant="secondary">Refresh</Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Present</div>
            <div className="text-2xl font-bold">{summary.present}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Absent</div>
            <div className="text-2xl font-bold">{summary.absent}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Late</div>
            <div className="text-2xl font-bold">{summary.late}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total Hours</div>
            <div className="text-2xl font-bold">{summary.totalHours.toFixed(2)}</div>
          </Card>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">No records</TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((r) => (
                    <TableRow key={r.staff.id}>
                      <TableCell className="font-medium">{r.staff.full_name}</TableCell>
                      <TableCell>{r.record ? formatTimeShort(r.record.check_in) : "—"}</TableCell>
                      <TableCell>{r.record ? formatTimeShort(r.record.check_out || null) : "—"}</TableCell>
                      <TableCell>{r.total.toFixed(2)}h{r.overtime ? ` (+${r.overtime} OT)` : ""}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {r.status === "Absent" ? <XCircle className="text-red-500" /> : r.status === "Late" ? <Clock className="text-yellow-500" /> : r.status === "Checked In" ? <CheckCircle2 className="text-green-500" /> : <CheckCircle2 />}
                          <span>{r.status}</span>
                          {r.earlyFlag && <span className="ml-2 text-xs text-muted-foreground">(early out)</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {!r.record ? (
                          <>
                            <Button size="sm" onClick={() => handleCheckIn(r.staff.id)}>Check In</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleMarkAbsent(r.staff.id)}>Mark Absent</Button>
                          </>
                        ) : !r.record.check_out ? (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => handleCheckOut(r.staff.id)}>Check Out</Button>
                            <Button size="sm" onClick={() => openEdit(r)}>Edit</Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" onClick={() => openEdit(r)}><Edit2 className="mr-2"/>Edit</Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Edit Modal - simple inline modal */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded shadow-lg max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold mb-2">Edit Attendance</h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-sm block mb-1">Check-in</label>
                  <input type="datetime-local" value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)} className="border rounded px-3 py-2 w-full" />
                </div>
                <div>
                  <label className="text-sm block mb-1">Check-out</label>
                  <input type="datetime-local" value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)} className="border rounded px-3 py-2 w-full" />
                </div>
                <div>
                  <label className="text-sm block mb-1">Reason for edit</label>
                  <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} className="border rounded px-3 py-2 w-full" rows={3} />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={closeEdit}>Cancel</Button>
                <Button onClick={submitEdit}>Save</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
