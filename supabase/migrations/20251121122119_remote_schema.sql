drop extension if exists "pg_net";

drop trigger if exists "auto_create_client" on "public"."booking_requests";

drop policy "Admins can manage all attendance" on "public"."attendance";

drop policy "Owners and receptionists can check in staff" on "public"."attendance";

drop policy "Owners and receptionists can manage attendance" on "public"."attendance";

drop policy "Staff can check themselves out" on "public"."attendance";

drop policy "Staff can view their own attendance" on "public"."attendance";

drop policy "attendance_insert" on "public"."attendance";

drop policy "attendance_read" on "public"."attendance";

drop policy "attendance_update" on "public"."attendance";

drop policy "Clients can view their own booking requests" on "public"."booking_requests";

drop policy "Owners and receptionists can manage booking requests" on "public"."booking_requests";

drop policy "Authenticated users can view own bookings" on "public"."bookings";

drop policy "Allow insert via trigger" on "public"."clients";

drop policy "Authenticated users can view clients" on "public"."clients";

drop policy "Only owners and receptionists can view clients" on "public"."clients";

drop policy "Owners and receptionists can delete clients" on "public"."clients";

drop policy "Owners and receptionists can update clients" on "public"."clients";

drop policy "Authenticated users can view own payments" on "public"."payments";

alter table "public"."attendance" drop constraint "attendance_status_check";

alter table "public"."attendance" drop constraint "attendance_staff_id_fkey";

drop function if exists "public"."ensure_client_exists"();

drop function if exists "public"."verify_staff_email"(email_to_check text, role_to_check public.app_role);

drop index if exists "public"."idx_attendance_checkin";

drop index if exists "public"."idx_attendance_staff_id";

alter table "public"."attendance" alter column "check_in" drop default;

alter table "public"."attendance" alter column "staff_id" set not null;

alter table "public"."attendance" alter column "status" drop default;

alter table "public"."attendance" add constraint "attendance_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE not valid;

alter table "public"."attendance" validate constraint "attendance_staff_id_fkey";


  create policy "Authenticated users can view bookings"
  on "public"."bookings"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Authenticated users can insert clients"
  on "public"."clients"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Enable insert for authenticated users only"
  on "public"."clients"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Owners & receptionists can manage clients"
  on "public"."clients"
  as permissive
  for all
  to public
using ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'receptionist'::public.app_role)));



  create policy "Owners and receptionists can insert clients"
  on "public"."clients"
  as permissive
  for insert
  to authenticated
with check ((public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'receptionist'::public.app_role)));



  create policy "Authenticated users can view payments"
  on "public"."payments"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Enable read access for all users"
  on "public"."staff"
  as permissive
  for select
  to public
using (true);



