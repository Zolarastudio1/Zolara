-- Migration: Create RPC to validate booking times and staff availability
-- This function returns NULL when the booking is valid, otherwise returns an error message text.

create or replace function public.rpc_validate_booking(
  p_staff_id uuid,
  p_appointment_date date,
  p_appointment_time text
)
returns text
language plpgsql
security definer
as $$
declare
  t_time time;
  shop_open time;
  shop_close time;
  day_idx int;
  cnt int;
begin
  begin
    t_time := p_appointment_time::time;
  exception when others then
    return 'Invalid appointment time format';
  end;

  -- read settings if available
  select open_time::time, close_time::time into shop_open, shop_close from public.settings limit 1;

  -- default shop hours if not configured
  if shop_open is null then
    shop_open := '08:30'::time;
  end if;
  if shop_close is null then
    shop_close := '21:00'::time;
  end if;

  if t_time < shop_open or t_time > shop_close then
    return format('Appointment time must be within operating hours (%s — %s)', shop_open::text, shop_close::text);
  end if;

  if p_staff_id is not null then
    -- check off days
    select count(*) into cnt from public.staff_off_days where staff_id = p_staff_id and off_date = p_appointment_date;
    if cnt > 0 then
      return 'Selected staff is off on the chosen date';
    end if;

    -- check working hours for the staff
    day_idx := extract(dow from p_appointment_date)::int; -- 0-6
    select count(*) into cnt from public.staff_working_hours where staff_id = p_staff_id;
    if cnt = 0 then
      -- no staff schedule configured; allow if it fits shop hours (already checked)
      return null;
    end if;

    select count(*) into cnt from public.staff_working_hours
      where staff_id = p_staff_id
        and day_of_week = day_idx
        and p_appointment_time::time between start_time::time and end_time::time;

    if cnt = 0 then
      return 'Selected staff is not available at the chosen time';
    end if;

    -- check staff active flag
    select count(*) into cnt from public.staff where id = p_staff_id and (status is null or status = 'active' or is_active = true);
    if cnt = 0 then
      return 'Selected staff is not active';
    end if;
  end if;

  return null;
end;
$$;

grant execute on function public.rpc_validate_booking(uuid,date,text) to public;

-- end migration
