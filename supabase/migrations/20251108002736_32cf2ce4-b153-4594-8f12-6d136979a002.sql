-- Drop the overly permissive policy that allows all authenticated users to view staff
DROP POLICY IF EXISTS "Authenticated users can view staff" ON public.staff;

-- Create a new policy that restricts SELECT to only owners and receptionists
CREATE POLICY "Only owners and receptionists can view staff"
ON public.staff
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'receptionist'::app_role)
);