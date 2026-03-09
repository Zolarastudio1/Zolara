import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, User, Clock, Calendar, AlertCircle, Check, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface AttendanceRecord {
  id: string;
  staff_id: string;
  check_in: string;
  check_out: string | null;
  status: string;
  created_at: string;
  // optional DB columns
  total_hours?: number | null;
  overtime_hours?: number | null;
  late_flag?: boolean | null;
  early_flag?: boolean | null;
  edit_reason?: string | null;
  // joined staff
  staff?: { id?: string; full_name?: string; email?: string };
}

interface Staff {
  id: string;
  full_name: string;
  email: string;
}

export default function Attendance() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  // filters
  const [filterStart, setFilterStart] = useState<string>(new Date(new Date().setHours(0,0,0,0)).toISOString().slice(0,10));
  const [filterEnd, setFilterEnd] = useState<string>(new Date().toISOString().slice(0,10));
  const [filterStaff, setFilterStaff] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all"); // all | present | absent | late | early

  // profile dialog
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileStaff, setProfileStaff] = useState<Staff | null>(null);
  const [profileAttendance, setProfileAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (userRole === "owner" || userRole === "receptionist") {
      fetchStaff();
      fetchAttendance();
    }
  }, [userRole]);

  useEffect(() => {
    // refetch when filters change
    if (userRole === "owner" || userRole === "receptionist") fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStart, filterEnd, filterStaff, filterStatus]);

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setUserRole("");
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
      const metaDataRole = (user as any).user_metadata?.role;
      setUserRole(roleData?.role || metaDataRole || "");
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase.from("staff").select("id, full_name, email").order("full_name");
      if (error) throw error;
      setStaffList(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load staff list");
    }
  };

  // helpers
  const computeHours = (inIso: string, outIso: string) => {
    try {
      const a = new Date(inIso).getTime();
      const b = new Date(outIso).getTime();
      const hrs = Math.max(0, (b - a) / (1000 * 60 * 60));
      return Math.round(hrs * 100) / 100;
    } catch (e) { return 0; }
  };
  const isLate = (inIso: string) => {
    try { const d = new Date(inIso); return d.getHours() > 9 || (d.getHours() === 9 && d.getMinutes() > 0); } catch { return false; }
  };
  const isEarly = (outIso: string) => {
    try { const d = new Date(outIso); return d.getHours() < 17; } catch { return false; }
  };

  const computeDerived = (r: any): AttendanceRecord => {
    const rec: AttendanceRecord = { ...(r as any) };
    rec.staff = rec.staff || (r.staff || null);
    rec.total_hours = rec.total_hours ?? (rec.check_in && rec.check_out ? computeHours(rec.check_in, rec.check_out) : 0);
    rec.overtime_hours = rec.overtime_hours ?? Math.max(0, (rec.total_hours || 0) - 8);
    rec.late_flag = rec.late_flag ?? (rec.check_in ? isLate(rec.check_in) : false);
    rec.early_flag = rec.early_flag ?? (rec.check_out ? isEarly(rec.check_out) : false);
    return rec;
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const startIso = new Date(`${filterStart}T00:00:00`).toISOString();
      const endIso = new Date(`${filterEnd}T23:59:59`).toISOString();
      // Always fetch by date range (and staff if specified). Status filtering for 'late'/'early' is applied client-side.
      let q: any = supabase.from("attendance").select("*, staff:staff!staff_id(id,full_name,email)").gte("check_in", startIso).lte("check_in", endIso).order("check_in", { ascending: true });
      if (filterStaff && filterStaff !== "all") q = q.eq("staff_id", filterStaff);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []).map((r: any) => computeDerived(r));
      setAttendanceRecords(rows as AttendanceRecord[]);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load attendance");
    } finally { setLoading(false); }
  };

  // actions
  const handleCheckIn = async (staffId: string) => {
    try {
      const start = new Date(); start.setHours(0,0,0,0);
      const end = new Date(); end.setHours(23,59,59,999);
      const { data: existing } = await supabase.from("attendance").select("*").eq("staff_id", staffId).gte("check_in", start.toISOString()).lte("check_in", end.toISOString());
      const ongoing = (existing || []).find((r:any) => !r.check_out && r.status !== 'absent');
      if (ongoing) { toast.info("This staff is already checked in"); return; }
      const { error } = await supabase.from("attendance").insert([ { staff_id: staffId, check_in: new Date().toISOString(), status: 'checked_in' } ]);
      if (error) throw error; toast.success("Checked in"); fetchAttendance();
    } catch (err:any) { console.error(err); toast.error("Failed to check in"); }
  };

  const handleCheckOut = async (rec: AttendanceRecord) => {
    try {
      if (!rec || !rec.check_in) { toast.error('No check-in found'); return; }
      const outIso = new Date().toISOString();
      const total = computeHours(rec.check_in, outIso);
      const overtime = Math.max(0, total - 8);
      const late = isLate(rec.check_in);
      const early = isEarly(outIso);
      const { error } = await supabase.from('attendance').update({ check_out: outIso, total_hours: total, overtime_hours: overtime, late_flag: late, early_flag: early, status: 'checked_out' }).eq('id', rec.id);
      if (error) { // fallback minimal
        const { error: fe } = await supabase.from('attendance').update({ check_out: outIso, status: 'checked_out' }).eq('id', rec.id);
        if (fe) throw fe;
      }
      toast.success('Checked out'); fetchAttendance();
    } catch (err:any) { console.error(err); toast.error('Failed to check out'); }
  };

  const handleMarkAbsent = async (staffId: string) => {
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      const { error } = await supabase.from('attendance').insert([{ staff_id: staffId, check_in: today.toISOString(), check_out: null, status: 'absent' }]);
      if (error) throw error; toast.success('Marked absent'); fetchAttendance();
    } catch (err:any) { console.error(err); toast.error('Failed to mark absent'); }
  };

  const handleEditTimes = async (rec: AttendanceRecord) => {
    if (!confirm('Open edit dialog?')) return;
    try {
      const newIn = prompt('New check-in (YYYY-MM-DDTHH:MM) or empty to keep', rec.check_in ? rec.check_in.slice(0,16) : '');
      const newOut = prompt('New check-out (YYYY-MM-DDTHH:MM) or empty to keep', rec.check_out ? rec.check_out.slice(0,16) : '');
      const reason = prompt('Reason for edit (required)', ''); if (!reason) { toast.error('Reason required'); return; }
      const payload: any = { edit_reason: reason };
      if (newIn) payload.check_in = new Date(newIn).toISOString();
      if (newOut) payload.check_out = new Date(newOut).toISOString();
      if (payload.check_in && payload.check_out) {
        const th = computeHours(payload.check_in, payload.check_out);
        payload.total_hours = th; payload.overtime_hours = Math.max(0, th-8);
        payload.late_flag = isLate(payload.check_in); payload.early_flag = isEarly(payload.check_out);
        payload.status = 'checked_out';
      }
      const { error } = await supabase.from('attendance').update(payload).eq('id', rec.id);
      if (error) throw error; toast.success('Updated'); fetchAttendance();
    } catch (err:any) { console.error(err); toast.error('Failed to update'); }
  };

  const openStaffProfile = async (staff: Staff) => {
    try {
      setProfileStaff(staff); setProfileOpen(true);
      const end = new Date(); const start = new Date(); start.setDate(end.getDate()-30);
      const { data, error } = await supabase.from('attendance').select('*, staff:staff!staff_id(id,full_name,email)').eq('staff_id', staff.id).gte('check_in', start.toISOString()).lte('check_in', end.toISOString()).order('check_in', { ascending: false });
      if (error) throw error; setProfileAttendance((data||[]).map((r:any)=>computeDerived(r)));
    } catch (err:any) { console.error(err); toast.error('Failed to load profile'); }
  };

  const exportCSV = () => {
    const headers = ['Staff','Date','Check-in','Check-out','Total Hours','Overtime','Late','Early','Status'];
    const rows = attendanceRecords.map(r => [
      r.staff?.full_name||r.staff_id,
      r.check_in? r.check_in.split('T')[0] : '',
      r.check_in||'',
      r.check_out||'',
      String((r.total_hours||0).toFixed(2)),
      String((r.overtime_hours||0).toFixed(2)),
      r.late_flag? '1' : '0',
      r.early_flag? '1' : '0',
      r.status||''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `attendance_${filterStart}_${filterEnd}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    try {
      const data = attendanceRecords.map(r => ({
        Staff: r.staff?.full_name || r.staff_id,
        Date: r.check_in ? r.check_in.split('T')[0] : '',
        CheckIn: r.check_in ? format(new Date(r.check_in), 'HH:mm') : '',
        CheckOut: r.check_out ? format(new Date(r.check_out), 'HH:mm') : '',
        TotalHours: (r.total_hours||0).toFixed(2),
        Overtime: (r.overtime_hours||0).toFixed(2),
        Late: r.late_flag ? 'Yes' : 'No',
        Early: r.early_flag ? 'Yes' : 'No',
        Status: r.status || '',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `attendance_${filterStart}_${filterEnd}.xlsx`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to export Excel');
    }
  };

  // Aggregations
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter(r => {
      if (filterStaff && filterStaff !== 'all' && r.staff_id !== filterStaff) return false;
      if (filterStatus && filterStatus !== 'all') {
        switch (filterStatus) {
          case 'present':
            return r.status === 'checked_in' || r.status === 'checked_out' || r.status === 'present';
          case 'absent':
            return r.status === 'absent';
          case 'late':
            return !!r.late_flag;
          case 'early':
            return !!r.early_flag;
          default:
            return true;
        }
      }
      return true;
    });
  }, [attendanceRecords, filterStaff, filterStatus]);

  const overallSummary = useMemo(() => {
    const present = filteredRecords.filter(r => r.status === 'checked_in' || r.status === 'checked_out' || r.status === 'present').length;
    const absent = filteredRecords.filter(r => r.status === 'absent').length;
    const late = filteredRecords.filter(r => r.late_flag).length;
    const early = filteredRecords.filter(r => r.early_flag).length;
    const totalHours = filteredRecords.reduce((s, r) => s + (r.total_hours || 0), 0);
    const totalOvertime = filteredRecords.reduce((s, r) => s + (r.overtime_hours || 0), 0);
    const disciplinary = filteredRecords.filter(r => r.late_flag || r.early_flag).length;
    return { present, absent, late, early, totalHours, totalOvertime, disciplinary };
  }, [filteredRecords]);

  const perStaff = useMemo(() => {
    const map: Record<string, any> = {};
    filteredRecords.forEach(r => {
      const id = r.staff_id;
      const name = r.staff?.full_name || id;
      if (!map[id]) map[id] = { staff_id: id, staff: name, days_present: 0, absences: 0, late: 0, early: 0, total_hours: 0, overtime: 0, disciplinary: 0 };
      const entry = map[id];
      if (r.status === 'absent') entry.absences += 1; else entry.days_present += 1;
      if (r.late_flag) entry.late += 1;
      if (r.early_flag) entry.early += 1;
      entry.total_hours += (r.total_hours || 0);
      entry.overtime += (r.overtime_hours || 0);
      if (r.late_flag || r.early_flag) entry.disciplinary += 1;
    });
    return Object.values(map);
  }, [filteredRecords]);

  // summary cards
  const summary = () => {
    const today = new Date(); const s = new Date(); s.setHours(0,0,0,0); const e = new Date(); e.setHours(23,59,59,999);
    const todays = attendanceRecords.filter(r => { const d = new Date(r.check_in); return d>=s && d<=e; });
    const present = todays.filter(r => r.status === 'checked_in' || r.status === 'checked_out').length;
    const absent = todays.filter(r => r.status === 'absent').length;
    const late = todays.filter(r => r.late_flag).length;
    const totalHours = todays.reduce((s, r) => s + (r.total_hours||0), 0);
    return { present, absent, late, totalHours };
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Attendance</h1>
            <p className="text-sm text-muted-foreground">Track staff check-ins, hours and flags</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={exportCSV}>Export CSV</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          {(() => {
            const s = summary();
            return (
              <>
                <Card className="p-4"><CardHeader><CardTitle>Present Today</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{s.present}</div></CardContent></Card>
                <Card className="p-4"><CardHeader><CardTitle>Absent Today</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{s.absent}</div></CardContent></Card>
                <Card className="p-4"><CardHeader><CardTitle>Late Today</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{s.late}</div></CardContent></Card>
                <Card className="p-4"><CardHeader><CardTitle>Hours Today</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{s.totalHours.toFixed(2)}</div></CardContent></Card>
              </>
            );
          })()}
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Start Date</label>
              <Input type="date" value={filterStart} onChange={(e)=>setFilterStart(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">End Date</label>
              <Input type="date" value={filterEnd} onChange={(e)=>setFilterEnd(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Staff</label>
              <Select value={filterStaff} onValueChange={(v)=>setFilterStaff(v)}>
                <SelectTrigger><SelectValue placeholder="All staff"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={filterStatus} onValueChange={(v)=>setFilterStatus(v)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="early">Early checkout</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={()=>fetchAttendance()}>Apply</Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <CardHeader><CardTitle>Report Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between"><span>Days present</span><strong>{overallSummary.present}</strong></div>
                <div className="flex justify-between"><span>Absences</span><strong>{overallSummary.absent}</strong></div>
                <div className="flex justify-between"><span>Late check-ins</span><strong>{overallSummary.late}</strong></div>
                <div className="flex justify-between"><span>Early check-outs</span><strong>{overallSummary.early}</strong></div>
                <div className="flex justify-between"><span>Total hours</span><strong>{overallSummary.totalHours.toFixed(2)}</strong></div>
                <div className="flex justify-between"><span>Total overtime</span><strong>{overallSummary.totalOvertime.toFixed(2)}</strong></div>
                <div className="flex justify-between"><span>Disciplinary flags</span><strong>{overallSummary.disciplinary}</strong></div>
              </div>
            </CardContent>
          </Card>

          <Card className="p-4 lg:col-span-2">
            <CardHeader><CardTitle>Per-staff summary</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Total Days</TableHead>
                      <TableHead>Absences</TableHead>
                      <TableHead>Late</TableHead>
                      <TableHead>Early</TableHead>
                      <TableHead>Total Hrs</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Disciplinary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perStaff.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-4">No staff in range</TableCell></TableRow>
                    ) : perStaff.map((p:any) => (
                      <TableRow key={p.staff_id}>
                        <TableCell className="font-medium">{p.staff}</TableCell>
                        <TableCell>{p.days_present}</TableCell>
                        <TableCell>{p.absences}</TableCell>
                        <TableCell>{p.late}</TableCell>
                        <TableCell>{p.early}</TableCell>
                        <TableCell>{p.total_hours.toFixed(2)}</TableCell>
                        <TableCell>{p.overtime.toFixed(2)}</TableCell>
                        <TableCell>{p.disciplinary}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="p-4">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin"/></div>
          ) : (
            <>
            <div className="flex items-center justify-end gap-2 mb-4">
              <Button variant="ghost" onClick={exportCSV}>Export CSV</Button>
              <Button variant="ghost" onClick={exportExcel}>Export Excel</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Total Hrs</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8">No records</TableCell></TableRow>
                ) : filteredRecords.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium"><button className="flex items-center gap-2" onClick={()=>openStaffProfile({ id: r.staff?.id||r.staff_id, full_name: r.staff?.full_name||'Staff', email: r.staff?.email||''})}>{r.staff?.full_name || r.staff_id} <ChevronRight className="w-4 h-4"/></button></TableCell>
                    <TableCell>{r.staff?.email || '-'}</TableCell>
                    <TableCell>{r.check_in ? format(new Date(r.check_in), 'yyyy-MM-dd') : ''}</TableCell>
                    <TableCell>{r.check_in ? format(new Date(r.check_in), 'HH:mm') : '-'}</TableCell>
                    <TableCell>{r.check_out ? format(new Date(r.check_out), 'HH:mm') : '-'}</TableCell>
                    <TableCell>{(r.total_hours||0).toFixed(2)}</TableCell>
                    <TableCell>{(r.overtime_hours||0).toFixed(2)}</TableCell>
                    <TableCell>{r.late_flag ? <span className="text-red-600">Late</span> : r.early_flag ? <span className="text-orange-600">Early</span> : '-'}</TableCell>
                    <TableCell className="capitalize">{r.status.replace('_',' ')}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={()=>openStaffProfile({ id: r.staff?.id||r.staff_id, full_name: r.staff?.full_name||'Staff', email: r.staff?.email||''})}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          )}
        </Card>

        {/* Profile Dialog */}
        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{profileStaff?.full_name || 'Staff Profile'}</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Card className="p-3"><CardTitle>Total hours (30d)</CardTitle><CardContent>{profileAttendance.reduce((s,a)=>s+(a.total_hours||0),0).toFixed(2)}</CardContent></Card>
                <Card className="p-3"><CardTitle>Late count (30d)</CardTitle><CardContent>{profileAttendance.filter(a=>a.late_flag).length}</CardContent></Card>
                <Card className="p-3"><CardTitle>Absences (30d)</CardTitle><CardContent>{profileAttendance.filter(a=>a.status==='absent').length}</CardContent></Card>
              </div>

              <div className="space-y-2">
                {profileAttendance.map(a => (
                  <div key={a.id} className="p-3 border rounded flex justify-between items-center">
                    <div>
                      <div className="font-medium">{format(new Date(a.check_in), 'PPP')}</div>
                      <div className="text-sm text-muted-foreground">{a.check_in ? format(new Date(a.check_in), 'HH:mm') : '-'} → {a.check_out ? format(new Date(a.check_out), 'HH:mm') : '-'}</div>
                    </div>
                    <div className="text-right">
                      <div>{(a.total_hours||0).toFixed(2)} hrs</div>
                      <div className="text-xs text-muted-foreground">{a.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}