-- Drop the overly permissive policy that allows all authenticated users to view clients
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;

-- Create a new policy that restricts SELECT to only owners and receptionists
CREATE POLICY "Only owners and receptionists can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'receptionist'::app_role)
);