export function normalizeTimeTo24(input: string): string {
  if (!input) return input;
  // Normalize whitespace
  const v = input.trim();
  // If already in HH:mm (24h) format, return as-is (allow optional seconds like HH:mm:ss)
  const hhmm24 = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
  const m24 = v.match(hhmm24);
  if (m24) {
    // Return only HH:mm portion
    return `${m24[1]}:${m24[2]}`;
  }

  // Try to parse 12-hour formats like "4:13 PM", "04:13PM", or with seconds "4:13:00 PM"
  const m = v.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
  if (!m) return input; // unknown format — return original and let validators handle it

  let hour = parseInt(m[1], 10);
  const minute = m[2];
  const ampm = m[4].toUpperCase();

  if (ampm === "PM" && hour !== 12) hour = hour + 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  const hh = hour.toString().padStart(2, "0");
  return `${hh}:${minute}`;
}

export function timeToMinutes(time: string): number {
  if (!time) return NaN;
  const parts = time.split(":");
  if (parts.length < 2) return NaN;
  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  return hh * 60 + mm;
}

export function isTimeWithinRange(time: string, start: string, end: string) {
  if (!time || !start || !end) return true; // If we don't have range information, treat as allowed
  const t = timeToMinutes(time);
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (isNaN(t) || isNaN(s) || isNaN(e)) return false;
  return t >= s && t <= e;
}

export function formatTo12Hour(time: string): string {
  if (!time) return "";
  const parts = time.split(":");
  if (parts.length < 2) return time;
  let hh = parseInt(parts[0], 10);
  const mm = parts[1];
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12 || 12;
  return `${hh}:${mm} ${ampm}`;
}
