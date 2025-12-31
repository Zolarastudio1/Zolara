export type AttendanceRecord = {
  id: string;
  staff_id: string;
  check_in: string; // ISO
  check_out?: string | null; // ISO or null
  status?: string;
  created_at?: string;
  // optional audit fields (may not exist in DB)
  last_edited_by?: string | null;
  last_edit_reason?: string | null;
};

export type Staff = {
  id: string;
  full_name: string;
  email?: string;
};

export type ShiftSettings = {
  start: string; // HH:MM, local time
  end: string; // HH:MM, local time
  graceMinutes?: number; // minutes allowed before considered late
};

export const DEFAULT_SHIFT: ShiftSettings = {
  start: "09:00",
  end: "17:00",
  graceMinutes: 15,
};

function toLocalDate(dateIso: string) {
  return new Date(dateIso);
}

export function formatTimeShort(iso?: string | null) {
  if (!iso) return "—";
  const d = toLocalDate(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function calcTotalHours(checkInIso?: string | null, checkOutIso?: string | null) {
  if (!checkInIso) return 0;
  const inDate = new Date(checkInIso);
  const outDate = checkOutIso ? new Date(checkOutIso) : new Date();
  const diff = (outDate.getTime() - inDate.getTime()) / 1000 / 3600;
  return Math.max(0, Math.round(diff * 100) / 100); // hours, 2 decimals
}

export function calcOvertime(totalHours: number, shiftHours = 8) {
  return totalHours > shiftHours ? Math.round((totalHours - shiftHours) * 100) / 100 : 0;
}

export function isLate(checkInIso?: string | null, shift: ShiftSettings = DEFAULT_SHIFT) {
  if (!checkInIso) return false;
  const d = new Date(checkInIso);
  const [h, m] = shift.start.split(":").map(Number);
  const shiftStart = new Date(d);
  shiftStart.setHours(h, m + (shift.graceMinutes || 0), 0, 0);
  return d.getTime() > shiftStart.getTime();
}

export function isEarlyCheckout(checkOutIso?: string | null, shift: ShiftSettings = DEFAULT_SHIFT) {
  if (!checkOutIso) return false;
  const d = new Date(checkOutIso);
  const [h, m] = shift.end.split(":").map(Number);
  const shiftEnd = new Date(d);
  shiftEnd.setHours(h, m, 0, 0);
  return d.getTime() < shiftEnd.getTime();
}

export function isHalfDay(totalHours: number) {
  return totalHours > 0 && totalHours < 4;
}

export function isoForDateRange(date: string) {
  // date string in YYYY-MM-DD
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}
