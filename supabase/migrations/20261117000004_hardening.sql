-- Fixes from the security audit (docs/SECURITY_AUDIT.md).

-- F-01: anon menu reads errored because the policy called a staff helper anon can't run. Split per role.
drop policy products_read on public.products;
create policy products_read_public on public.products for select to anon
  using (active and exists (select 1 from public.tenants t where t.id = tenant_id and t.active));
create policy products_read_signed_in on public.products for select to authenticated
  using ((active and exists (select 1 from public.tenants t where t.id = tenant_id and t.active))
         or tenant_id = (select private.staff_tenant()));

-- F-02: drivers kept read access to every past order's name, phone and address forever.
-- Now: active orders, plus 12 hours after an order closes (for disputes at the door).
drop policy orders_read on public.orders;
create policy orders_read on public.orders for select to authenticated
  using (customer_id = (select auth.uid())
         or (driver_id = (select auth.uid())
             and (status in ('assigned', 'en_route', 'arrived') or closed_at > now() - interval '12 hours'))
         or tenant_id = (select private.staff_tenant()));

-- F-03: two simultaneous checkouts could both pass the "one active order" check. Serialize per customer.
create function private.one_active_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.customers where user_id = new.customer_id for update;
  if exists (select 1 from public.orders
             where customer_id = new.customer_id and status in ('queued', 'assigned', 'en_route', 'arrived')) then
    raise exception 'order_in_progress';
  end if;
  return new;
end $$;
revoke execute on function private.one_active_order() from public, anon, authenticated;
create trigger orders_one_active before insert on public.orders
  for each row execute function private.one_active_order();

-- F-04: going online triggers a dispatch sweep; cap how often a driver can toggle.
create or replace function public.driver_set_status(p_online boolean, p_lat double precision default null, p_lng double precision default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_d public.drivers; v_n int := 0;
begin
  perform private.rate_limit('set_status', 60, interval '1 hour');
  select * into v_d from public.drivers where user_id = auth.uid() for update;
  if not found or not v_d.active then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_online then
    if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
      raise exception 'location_required';
    end if;
    update public.drivers set status = 'online', lat = p_lat, lng = p_lng, last_seen_at = now() where user_id = v_d.user_id;
    v_n := private.dispatch_queued(v_d.tenant_id);
  else
    if exists (select 1 from public.orders where driver_id = v_d.user_id and status in ('assigned', 'en_route', 'arrived')) then
      raise exception 'finish_active_orders';
    end if;
    update public.drivers set status = 'offline' where user_id = v_d.user_id;
  end if;
  return jsonb_build_object('status', case when p_online then 'online' else 'offline' end, 'dispatched', v_n);
end $$;
revoke execute on function public.driver_set_status(boolean, double precision, double precision) from public, anon;
grant execute on function public.driver_set_status(boolean, double precision, double precision) to authenticated;
