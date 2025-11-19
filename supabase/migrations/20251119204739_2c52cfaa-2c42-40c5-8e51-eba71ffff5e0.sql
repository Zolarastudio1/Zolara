-- Add indexes for better performance on attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_staff_id ON public.attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in ON public.attendance(check_in DESC);