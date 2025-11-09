-- ======================================
-- INSERT (Allow trigger & authenticated inserts)
-- ======================================
CREATE POLICY "Allow insert via trigger"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ======================================
-- \SELECT (Restrict to owners & receptionists)
-- ======================================
CREATE POLICY "Only owners and receptionists can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'receptionist'::app_role)
);

-- ======================================
-- UPDATE (Restrict to owners & receptionists)
-- ======================================
CREATE POLICY "Owners and receptionists can update clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'receptionist'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'receptionist'::app_role)
);

-- ======================================
-- DELETE (Restrict to owners & receptionists)
-- ======================================
CREATE POLICY "Owners and receptionists can delete clients"
ON public.clients
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'receptionist'::app_role)
);
