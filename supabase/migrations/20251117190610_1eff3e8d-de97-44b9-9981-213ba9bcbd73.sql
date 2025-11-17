-- Create attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  check_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  check_out TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'present',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policy: Only owners and receptionists can check in staff
CREATE POLICY "Owners and receptionists can check in staff"
ON public.attendance
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'receptionist'::app_role)
);

-- Policy: Staff can view their own attendance
CREATE POLICY "Staff can view their own attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  staff_id = auth.uid() OR
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'receptionist'::app_role)
);

-- Policy: Staff can check themselves out
CREATE POLICY "Staff can check themselves out"
ON public.attendance
FOR UPDATE
TO authenticated
USING (staff_id = auth.uid())
WITH CHECK (staff_id = auth.uid());

-- Policy: Owners and receptionists can view all attendance
CREATE POLICY "Owners and receptionists can manage attendance"
ON public.attendance
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'receptionist'::app_role)
);

-- Create booking_requests table
CREATE TABLE public.booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on booking_requests
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Clients can view their own requests
CREATE POLICY "Clients can view their own booking requests"
ON public.booking_requests
FOR SELECT
TO authenticated
USING (client_id = auth.uid());

-- Policy: Clients can create booking requests
CREATE POLICY "Clients can create booking requests"
ON public.booking_requests
FOR INSERT
TO authenticated
WITH CHECK (client_id = auth.uid());

-- Policy: Owners and receptionists can manage all booking requests
CREATE POLICY "Owners and receptionists can manage booking requests"
ON public.booking_requests
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'receptionist'::app_role)
);

-- Add trigger for booking_requests updated_at
CREATE TRIGGER update_booking_requests_updated_at
BEFORE UPDATE ON public.booking_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to verify staff/receptionist exists before signup
CREATE OR REPLACE FUNCTION public.verify_staff_email(email_to_check TEXT, role_to_check app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If role is staff or receptionist, verify email exists in staff table
  IF role_to_check = 'staff' OR role_to_check = 'receptionist' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.staff WHERE email = email_to_check
    );
  END IF;
  -- Owner can always sign up (handled by handle_new_user trigger)
  RETURN TRUE;
END;
$$;