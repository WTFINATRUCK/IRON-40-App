-- IRON 40 — API functions. Every mutation lives here and checks who is calling.
-- Error messages are stable codes that the apps map to user-facing copy.

-- ================= internal helpers =================

create function private.require_staff(p_roles public.staff_role[] default null)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  v_tenant := private.staff_tenant(p_roles);
  if v_tenant is null then raise exception 'forbidden' using errcode = '42501'; end if;
  return v_tenant;
end $$;

create function private.audit(p_tenant uuid, p_action text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (tenant_id, actor, action, detail) values (p_tenant, auth.uid(), p_action, p_detail);
$$;

create function private.order_event(p_order uuid, p_event text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.order_events (order_id, actor, event, detail) values (p_order, auth.uid(), p_event, p_detail);
$$;

create function private.account_kind(p_uid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.staff     where user_id = p_uid) then 'staff'
    when exists (select 1 from public.drivers   where user_id = p_uid) then 'driver'
    when exists (select 1 from public.customers where user_id = p_uid) then 'customer'
    else null end
$$;

-- Give a queued order to the nearest online driver who is carrying every item.
create function private.try_assign(p_order uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_o public.orders;
  v_driver public.drivers;
begin
  select * into v_o from public.orders where id = p_order and status = 'queued' for update skip locked;
  if not found then return null; end if;

  select d.* into v_driver
  from public.drivers d
  where d.tenant_id = v_o.tenant_id
    and d.active and d.status = 'online'
    and d.last_seen_at > now() - interval '3 minutes'
    and d.lat is not null
    and private.distance_km(d.lat, d.lng, v_o.lat, v_o.lng) <= 60
    and (select count(*) from public.orders o
         where o.driver_id = d.user_id and o.status in ('assigned', 'en_route', 'arrived')) < d.max_active_orders
    and not exists (
      select 1 from public.order_items oi
      left join public.driver_inventory di on di.driver_id = d.user_id and di.product_id = oi.product_id
      where oi.order_id = v_o.id and coalesce(di.qty, 0) < oi.qty)
  order by private.distance_km(d.lat, d.lng, v_o.lat, v_o.lng)
  limit 1
  for update of d skip locked;

  if not found then return null; end if;

  -- reserve stock in the vehicle (check constraint qty >= 0 guards races)
  update public.driver_inventory di set qty = di.qty - x.qty
  from (select product_id, sum(qty)::int as qty from public.order_items
        where order_id = v_o.id group by product_id) x
  where di.driver_id = v_driver.user_id and di.product_id = x.product_id;

  update public.orders
     set status = 'assigned', driver_id = v_driver.user_id, driver_name = v_driver.display_name, assigned_at = now()
   where id = v_o.id;

  perform private.order_event(v_o.id, 'assigned', jsonb_build_object('driver', v_driver.user_id));
  return v_driver.user_id;
end $$;

create function private.dispatch_queued(p_tenant uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in select id from public.orders where tenant_id = p_tenant and status = 'queued' order by created_at limit 50 loop
    if private.try_assign(r.id) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Put reserved stock back into the vehicle when an order does not complete.
create function private.return_stock(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_o public.orders;
begin
  select * into v_o from public.orders where id = p_order;
  if v_o.driver_id is null or v_o.status not in ('assigned', 'en_route', 'arrived') then return; end if;
  insert into public.driver_inventory as di (driver_id, product_id, qty)
  select v_o.driver_id, product_id, sum(qty)::int from public.order_items
  where order_id = p_order and product_id is not null group by product_id
  on conflict (driver_id, product_id) do update set qty = di.qty + excluded.qty;
end $$;

-- ================= anyone =================

create function public.whoami()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v jsonb;
begin
  if v_uid is null then return jsonb_build_object('kind', null); end if;
  select jsonb_build_object('kind', 'staff', 'tenant_id', s.tenant_id, 'role', s.role, 'name', s.name)
    into v from public.staff s where s.user_id = v_uid;
  if v is not null then return v; end if;
  select jsonb_build_object('kind', 'driver', 'tenant_id', d.tenant_id, 'name', d.display_name, 'active', d.active)
    into v from public.drivers d where d.user_id = v_uid;
  if v is not null then return v; end if;
  select jsonb_build_object('kind', 'customer', 'tenant_id', c.tenant_id, 'id_status', c.id_status, 'name', c.full_name)
    into v from public.customers c where c.user_id = v_uid;
  return coalesce(v, jsonb_build_object('kind', null));
end $$;

-- Menu with a yes/no stock flag. Quantities and hub locations are never exposed.
create function public.get_menu(p_tenant_slug text)
returns table (id uuid, category public.product_category, subcategory text, name text, description text,
               strain text, thc_pct numeric, weight_g numeric, price_cents int, in_stock boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.category, p.subcategory, p.name, p.description, p.strain, p.thc_pct, p.weight_g, p.price_cents,
    (exists (select 1 from public.driver_inventory di join public.drivers d on d.user_id = di.driver_id
             where di.product_id = p.id and di.qty > 0 and d.active and d.status = 'online'
               and d.last_seen_at > now() - interval '3 minutes')
     or exists (select 1 from public.location_inventory li join public.locations l on l.id = li.location_id
                where li.product_id = p.id and li.qty > 0 and l.active)) as in_stock
  from public.products p
  join public.tenants t on t.id = p.tenant_id
  where t.slug = p_tenant_slug and t.active and p.active
  order by p.category, p.sort, p.name
$$;

-- QR scan counter (called by the storefront's /q/<code> route).
create function public.record_qr_scan(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_code !~ '^[a-z0-9]{6,16}$' then return false; end if;
  update public.qr_campaigns set scans = scans + 1, last_scan_at = now() where code = p_code;
  return found;
end $$;

-- ================= customers =================

create function public.upsert_customer_profile(p_tenant_slug text, p_full_name text, p_phone text, p_dob date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_c public.customers;
  v_kind text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform private.rate_limit('profile', 20, interval '1 hour');
  v_kind := private.account_kind(v_uid);
  if v_kind in ('staff', 'driver') then raise exception 'account_type_conflict'; end if;
  select id into v_tenant from public.tenants where slug = p_tenant_slug and active;
  if v_tenant is null then raise exception 'unknown_store'; end if;
  if p_dob is null or p_dob > (current_date - interval '21 years')::date then raise exception 'under_21'; end if;

  select * into v_c from public.customers where user_id = v_uid;
  if found then
    if v_c.tenant_id <> v_tenant then raise exception 'account_type_conflict'; end if;
    -- name and date of birth are locked once an ID has been submitted
    if v_c.id_status in ('pending', 'approved')
       and (v_c.full_name <> btrim(p_full_name) or v_c.dob <> p_dob) then
      raise exception 'locked_after_submission';
    end if;
    update public.customers set full_name = btrim(p_full_name), phone = btrim(p_phone), dob = p_dob
     where user_id = v_uid;
  else
    insert into public.customers (user_id, tenant_id, full_name, phone, dob)
    values (v_uid, v_tenant, btrim(p_full_name), btrim(p_phone), p_dob);
  end if;
end $$;

create function public.submit_id_verification(p_front_path text, p_selfie_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_c public.customers;
  v_prefix text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform private.rate_limit('id_submit', 5, interval '1 day');
  select * into v_c from public.customers where user_id = v_uid;
  if not found then raise exception 'profile_required'; end if;
  if v_c.id_status not in ('unsubmitted', 'rejected') then raise exception 'already_submitted'; end if;

  v_prefix := v_c.tenant_id::text || '/' || v_uid::text || '/';
  if p_front_path is null or p_selfie_path is null or p_front_path = p_selfie_path
     or left(p_front_path, length(v_prefix)) <> v_prefix
     or left(p_selfie_path, length(v_prefix)) <> v_prefix
     or substr(p_front_path,  length(v_prefix) + 1) !~ '^[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp)$'
     or substr(p_selfie_path, length(v_prefix) + 1) !~ '^[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp)$' then
    raise exception 'invalid_upload';
  end if;
  if (select count(*) from storage.objects o
      where o.bucket_id = 'id-docs' and o.name in (p_front_path, p_selfie_path)
        and o.owner_id = v_uid::text) <> 2 then
    raise exception 'invalid_upload';
  end if;

  update public.customers
     set id_status = 'pending', id_front_path = p_front_path, selfie_path = p_selfie_path,
         submitted_at = now(), rejection_reason = null, reviewed_by = null, reviewed_at = null
   where user_id = v_uid;
end $$;

create function public.save_address(p_label text, p_line1 text, p_line2 text, p_city text, p_state text,
                                    p_zip text, p_lat double precision, p_lng double precision, p_instructions text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_c public.customers;
  v_id uuid;
  v_in_zone boolean;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform private.rate_limit('address', 10, interval '1 day');
  select * into v_c from public.customers where user_id = v_uid;
  if not found then raise exception 'profile_required'; end if;
  if (select count(*) from public.addresses where user_id = v_uid) >= 5 then raise exception 'too_many_addresses'; end if;

  insert into public.addresses (user_id, label, line1, line2, city, state, zip, lat, lng, instructions)
  values (v_uid, coalesce(nullif(btrim(p_label), ''), 'Home'), btrim(p_line1), coalesce(btrim(p_line2), ''),
          btrim(p_city), upper(btrim(p_state)), btrim(p_zip), p_lat, p_lng, coalesce(btrim(p_instructions), ''))
  returning id into v_id;

  v_in_zone := exists (select 1 from public.locations l where l.tenant_id = v_c.tenant_id and l.active
                       and private.distance_km(l.lat, l.lng, p_lat, p_lng) <= l.radius_km);
  return jsonb_build_object('id', v_id, 'in_zone', v_in_zone);
end $$;

create function public.delete_address(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.addresses where id = p_id and user_id = auth.uid();
$$;

create function public.address_in_zone(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.addresses a
    join public.customers c on c.user_id = a.user_id
    join public.locations l on l.tenant_id = c.tenant_id and l.active
    where a.id = p_id and a.user_id = auth.uid()
      and private.distance_km(l.lat, l.lng, a.lat, a.lng) <= l.radius_km)
$$;

-- Prices, taxes, limits and dispatch are all decided here; the client only sends ids and quantities.
create function public.place_order(p_address_id uuid, p_items jsonb, p_payment public.payment_method, p_notes text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_c public.customers;
  v_t public.tenants;
  v_a public.addresses;
  v_hour int;
  v_requested int;
  v_matched int;
  v_sub int; v_canna int; v_flower numeric; v_conc numeric;
  v_excise int; v_tax int;
  v_order uuid;
  v_receipt bigint;
  v_driver uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform private.rate_limit('place_order', 5, interval '10 minutes');

  select * into v_c from public.customers where user_id = v_uid;
  if not found then raise exception 'profile_required'; end if;
  if v_c.id_status <> 'approved' then raise exception 'id_not_verified'; end if;
  if v_c.dob > (current_date - interval '21 years')::date then raise exception 'under_21'; end if;
  if exists (select 1 from public.orders where customer_id = v_uid and status in ('queued', 'assigned', 'en_route', 'arrived')) then
    raise exception 'order_in_progress';
  end if;

  select * into v_t from public.tenants where id = v_c.tenant_id and active;
  if not found then raise exception 'unknown_store'; end if;
  v_hour := extract(hour from (now() at time zone v_t.timezone))::int;
  if not (v_hour >= v_t.open_hour and v_hour < v_t.close_hour) then raise exception 'store_closed'; end if;

  select * into v_a from public.addresses where id = p_address_id and user_id = v_uid;
  if not found then raise exception 'invalid_address'; end if;
  if not exists (select 1 from public.locations l where l.tenant_id = v_t.id and l.active
                 and private.distance_km(l.lat, l.lng, v_a.lat, v_a.lng) <= l.radius_km) then
    raise exception 'out_of_zone';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'invalid_cart';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
             where jsonb_typeof(e) <> 'object'
                or coalesce(e->>'product_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                or coalesce(e->>'qty', '') !~ '^[1-9][0-9]?$') then
    raise exception 'invalid_cart';
  end if;

  -- normalise the cart against live, active products of this store
  create temp table if not exists pg_temp.cart (product_id uuid primary key, qty int, name text,
    category public.product_category, subcategory text, weight_g numeric, price_cents int) on commit drop;
  delete from pg_temp.cart;
  insert into pg_temp.cart
  select p.id, sum((e->>'qty')::int)::int, p.name, p.category, p.subcategory, p.weight_g, p.price_cents
  from jsonb_array_elements(p_items) e
  join public.products p on p.id = (e->>'product_id')::uuid and p.tenant_id = v_t.id and p.active
  group by p.id;

  select count(distinct (e->>'product_id')) into v_requested from jsonb_array_elements(p_items) e;
  select count(*) into v_matched from pg_temp.cart;
  if v_matched <> v_requested then raise exception 'item_unavailable'; end if;
  if exists (select 1 from pg_temp.cart where qty > 20) then raise exception 'invalid_cart'; end if;

  select coalesce(sum(qty * price_cents), 0),
         coalesce(sum(qty * price_cents) filter (where category <> 'gear'), 0),
         coalesce(sum(qty * weight_g) filter (where category = 'flower'), 0),
         coalesce(sum(qty * weight_g) filter (where category = 'concentrate'), 0)
    into v_sub, v_canna, v_flower, v_conc
  from pg_temp.cart;

  if v_flower > v_t.max_flower_g then raise exception 'flower_limit'; end if;
  if v_conc > v_t.max_concentrate_g then raise exception 'concentrate_limit'; end if;
  if v_sub < v_t.min_order_cents then raise exception 'below_minimum'; end if;

  v_excise := round(v_canna * v_t.excise_rate);
  v_tax    := round(v_sub * v_t.sales_tax_rate);

  insert into public.orders (tenant_id, customer_id, customer_name, customer_phone, address, lat, lng,
    subtotal_cents, cannabis_subtotal_cents, excise_cents, sales_tax_cents, delivery_fee_cents, total_cents,
    payment_method, notes)
  values (v_t.id, v_uid, v_c.full_name, v_c.phone,
    jsonb_build_object('label', v_a.label, 'line1', v_a.line1, 'line2', v_a.line2, 'city', v_a.city,
                       'state', v_a.state, 'zip', v_a.zip, 'instructions', v_a.instructions),
    v_a.lat, v_a.lng, v_sub, v_canna, v_excise, v_tax, v_t.delivery_fee_cents,
    v_sub + v_excise + v_tax + v_t.delivery_fee_cents, p_payment, left(coalesce(btrim(p_notes), ''), 300))
  returning id, receipt_no into v_order, v_receipt;

  insert into public.order_items (order_id, product_id, name, category, subcategory, weight_g, unit_price_cents, qty, line_total_cents)
  select v_order, product_id, name, category, subcategory, weight_g, price_cents, qty, qty * price_cents from pg_temp.cart;

  perform private.order_event(v_order, 'placed');
  v_driver := private.try_assign(v_order);

  return jsonb_build_object('id', v_order, 'receipt_no', v_receipt,
                            'status', case when v_driver is null then 'queued' else 'assigned' end);
end $$;

create function public.cancel_order(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_o public.orders;
begin
  select * into v_o from public.orders where id = p_order and customer_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if v_o.status not in ('queued', 'assigned') then raise exception 'too_late_to_cancel'; end if;
  perform private.return_stock(p_order);
  update public.orders set status = 'canceled', cancel_reason = 'customer', closed_at = now() where id = p_order;
  perform private.order_event(p_order, 'canceled', '{"by":"customer"}');
end $$;

-- ================= drivers =================

create function public.redeem_driver_invite(p_code text, p_display_name text, p_phone text, p_vehicle text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_inv public.invites;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform private.rate_limit('redeem', 5, interval '1 hour');
  if private.account_kind(v_uid) is not null then raise exception 'account_type_conflict'; end if;
  select * into v_inv from public.invites
   where code_hash = encode(extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
     and kind = 'driver' and used_at is null and expires_at > now()
   for update;
  if not found then raise exception 'invalid_invite'; end if;
  insert into public.drivers (user_id, tenant_id, display_name, phone, vehicle)
  values (v_uid, v_inv.tenant_id, btrim(p_display_name), btrim(p_phone), btrim(coalesce(p_vehicle, '')));
  update public.invites set used_at = now(), used_by = v_uid where id = v_inv.id;
  perform private.audit(v_inv.tenant_id, 'driver_joined', jsonb_build_object('driver', v_uid));
end $$;

create function public.driver_set_status(p_online boolean, p_lat double precision default null, p_lng double precision default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_d public.drivers; v_n int := 0;
begin
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

create function public.driver_ping(p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  perform private.rate_limit('ping', 120, interval '1 hour');
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'location_required'; end if;
  update public.drivers set lat = p_lat, lng = p_lng, last_seen_at = now()
   where user_id = auth.uid() and active and status = 'online'
  returning tenant_id into v_tenant;
  if v_tenant is not null then perform private.dispatch_queued(v_tenant); end if;
end $$;

create function public.driver_advance_order(p_order uuid, p_status public.order_status)
returns void language plpgsql security definer set search_path = '' as $$
declare v_o public.orders;
begin
  select * into v_o from public.orders where id = p_order and driver_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if p_status = 'en_route' and v_o.status = 'assigned' then
    update public.orders set status = 'en_route', en_route_at = now() where id = p_order;
  elsif p_status = 'arrived' and v_o.status = 'en_route' then
    update public.orders set status = 'arrived', arrived_at = now() where id = p_order;
  else
    raise exception 'invalid_transition';
  end if;
  perform private.order_event(p_order, p_status::text);
end $$;

-- Door-side ID check: driver types the birth year printed on the physical ID.
create function public.driver_complete_order(p_order uuid, p_birth_year int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_o public.orders; v_dob date;
begin
  select * into v_o from public.orders where id = p_order and driver_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if v_o.status <> 'arrived' then raise exception 'invalid_transition'; end if;
  select dob into v_dob from public.customers where user_id = v_o.customer_id;

  if extract(year from v_dob)::int is distinct from p_birth_year then
    update public.orders set id_check_attempts = id_check_attempts + 1 where id = p_order;
    perform private.order_event(p_order, 'id_mismatch');
    if v_o.id_check_attempts + 1 >= 3 then
      perform private.return_stock(p_order);
      update public.orders set status = 'failed', failed_reason = 'ID did not match', closed_at = now() where id = p_order;
      perform private.order_event(p_order, 'failed', '{"reason":"id_mismatch"}');
      return jsonb_build_object('ok', false, 'failed', true);
    end if;
    return jsonb_build_object('ok', false, 'attempts_left', 2 - v_o.id_check_attempts);
  end if;

  update public.orders set status = 'delivered', delivered_at = now(), closed_at = now() where id = p_order;
  perform private.order_event(p_order, 'delivered', '{"id_checked":true}');
  return jsonb_build_object('ok', true);
end $$;

create function public.driver_fail_order(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_o public.orders;
begin
  select * into v_o from public.orders where id = p_order and driver_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if v_o.status not in ('assigned', 'en_route', 'arrived') then raise exception 'invalid_transition'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 200 then raise exception 'reason_required'; end if;
  perform private.return_stock(p_order);
  update public.orders set status = 'failed', failed_reason = btrim(p_reason), closed_at = now() where id = p_order;
  perform private.order_event(p_order, 'failed', jsonb_build_object('reason', btrim(p_reason)));
end $$;

-- ================= operators =================

create function public.redeem_staff_invite(p_code text, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_inv public.invites;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform private.rate_limit('redeem', 5, interval '1 hour');
  if private.account_kind(v_uid) is not null then raise exception 'account_type_conflict'; end if;
  select * into v_inv from public.invites
   where code_hash = encode(extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
     and kind in ('dispatcher', 'admin') and used_at is null and expires_at > now()
   for update;
  if not found then raise exception 'invalid_invite'; end if;
  insert into public.staff (user_id, tenant_id, role, name)
  values (v_uid, v_inv.tenant_id, v_inv.kind::text::public.staff_role, left(btrim(coalesce(p_name, '')), 80));
  update public.invites set used_at = now(), used_by = v_uid where id = v_inv.id;
  perform private.audit(v_inv.tenant_id, 'staff_joined', jsonb_build_object('user', v_uid, 'role', v_inv.kind));
end $$;

create function public.ops_create_invite(p_kind public.invite_kind, p_label text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_code text; v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int; b bytea;
begin
  v_tenant := private.require_staff(array['owner', 'admin']::public.staff_role[]);
  if p_kind = 'admin' and private.staff_tenant(array['owner']::public.staff_role[]) is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform private.rate_limit('invite', 30, interval '1 day');
  b := extensions.gen_random_bytes(12);
  v_code := '';
  for i in 0..11 loop
    v_code := v_code || substr(v_alphabet, (get_byte(b, i) % length(v_alphabet)) + 1, 1);
  end loop;
  insert into public.invites (tenant_id, kind, label, code_hash, expires_at, created_by)
  values (v_tenant, p_kind, left(btrim(coalesce(p_label, '')), 80),
          encode(extensions.digest(v_code, 'sha256'), 'hex'), now() + interval '48 hours', auth.uid());
  perform private.audit(v_tenant, 'invite_created', jsonb_build_object('kind', p_kind, 'label', p_label));
  return substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4) || '-' || substr(v_code, 9, 4);
end $$;

create function public.ops_revoke_invite(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  v_tenant := private.require_staff(array['owner', 'admin']::public.staff_role[]);
  update public.invites set expires_at = now() where id = p_id and tenant_id = v_tenant and used_at is null;
end $$;

create function public.ops_review_customer(p_user uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_c public.customers;
begin
  v_tenant := private.require_staff();
  select * into v_c from public.customers where user_id = p_user and tenant_id = v_tenant for update;
  if not found then raise exception 'not_found'; end if;
  if v_c.id_status <> 'pending' then raise exception 'not_pending'; end if;
  if p_approve then
    if v_c.dob > (current_date - interval '21 years')::date then raise exception 'under_21'; end if;
    update public.customers set id_status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = null
     where user_id = p_user;
  else
    if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'reason_required'; end if;
    update public.customers set id_status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
           rejection_reason = left(btrim(p_reason), 200)
     where user_id = p_user;
  end if;
  perform private.audit(v_tenant, case when p_approve then 'id_approved' else 'id_rejected' end,
                        jsonb_build_object('customer', p_user));
end $$;

create function public.ops_upsert_product(p_id uuid, p_category public.product_category, p_subcategory text, p_name text,
  p_description text, p_strain text, p_thc_pct numeric, p_weight_g numeric, p_price_cents int, p_sort int, p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_id uuid;
begin
  v_tenant := private.require_staff(array['owner', 'admin']::public.staff_role[]);
  if p_id is null then
    insert into public.products (tenant_id, category, subcategory, name, description, strain, thc_pct, weight_g, price_cents, sort, active)
    values (v_tenant, p_category, btrim(p_subcategory), btrim(p_name), coalesce(btrim(p_description), ''),
            nullif(p_strain, ''), p_thc_pct, p_weight_g, p_price_cents, coalesce(p_sort, 100), coalesce(p_active, true))
    returning id into v_id;
  else
    update public.products set category = p_category, subcategory = btrim(p_subcategory), name = btrim(p_name),
      description = coalesce(btrim(p_description), ''), strain = nullif(p_strain, ''), thc_pct = p_thc_pct,
      weight_g = p_weight_g, price_cents = p_price_cents, sort = coalesce(p_sort, 100), active = coalesce(p_active, true)
    where id = p_id and tenant_id = v_tenant returning id into v_id;
    if v_id is null then raise exception 'not_found'; end if;
  end if;
  perform private.audit(v_tenant, 'product_saved', jsonb_build_object('product', v_id, 'price_cents', p_price_cents));
  return v_id;
end $$;

create function public.ops_upsert_location(p_id uuid, p_name text, p_address text, p_lat double precision,
  p_lng double precision, p_radius_km numeric, p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_id uuid;
begin
  v_tenant := private.require_staff(array['owner', 'admin']::public.staff_role[]);
  if p_id is null then
    insert into public.locations (tenant_id, name, address, lat, lng, radius_km, active)
    values (v_tenant, btrim(p_name), btrim(p_address), p_lat, p_lng, p_radius_km, coalesce(p_active, true))
    returning id into v_id;
  else
    update public.locations set name = btrim(p_name), address = btrim(p_address), lat = p_lat, lng = p_lng,
      radius_km = p_radius_km, active = coalesce(p_active, true)
    where id = p_id and tenant_id = v_tenant returning id into v_id;
    if v_id is null then raise exception 'not_found'; end if;
  end if;
  perform private.audit(v_tenant, 'location_saved', jsonb_build_object('location', v_id));
  return v_id;
end $$;

create function public.ops_set_location_stock(p_location uuid, p_product uuid, p_qty int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  v_tenant := private.require_staff(array['owner', 'admin']::public.staff_role[]);
  if p_qty is null or p_qty not between 0 and 100000 then raise exception 'invalid_qty'; end if;
  if not exists (select 1 from public.locations where id = p_location and tenant_id = v_tenant)
     or not exists (select 1 from public.products where id = p_product and tenant_id = v_tenant) then
    raise exception 'not_found';
  end if;
  insert into public.location_inventory (location_id, product_id, qty) values (p_location, p_product, p_qty)
  on conflict (location_id, product_id) do update set qty = excluded.qty;
  perform private.audit(v_tenant, 'stock_set', jsonb_build_object('location', p_location, 'product', p_product, 'qty', p_qty));
end $$;

-- Move stock between a hub and a vehicle. Positive = load into the vehicle, negative = unload.
create function public.ops_transfer_stock(p_driver uuid, p_location uuid, p_product uuid, p_qty int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  v_tenant := private.require_staff();
  if p_qty is null or p_qty = 0 or abs(p_qty) > 1000 then raise exception 'invalid_qty'; end if;
  perform 1 from public.drivers where user_id = p_driver and tenant_id = v_tenant for update;
  if not found then raise exception 'not_found'; end if;
  if not exists (select 1 from public.locations where id = p_location and tenant_id = v_tenant)
     or not exists (select 1 from public.products where id = p_product and tenant_id = v_tenant) then
    raise exception 'not_found';
  end if;

  if p_qty > 0 then
    update public.location_inventory set qty = qty - p_qty
     where location_id = p_location and product_id = p_product and qty >= p_qty;
    if not found then raise exception 'insufficient_stock'; end if;
    insert into public.driver_inventory as di (driver_id, product_id, qty) values (p_driver, p_product, p_qty)
    on conflict (driver_id, product_id) do update set qty = di.qty + excluded.qty;
  else
    update public.driver_inventory set qty = qty + p_qty
     where driver_id = p_driver and product_id = p_product and qty >= -p_qty;
    if not found then raise exception 'insufficient_stock'; end if;
    insert into public.location_inventory as li (location_id, product_id, qty) values (p_location, p_product, -p_qty)
    on conflict (location_id, product_id) do update set qty = li.qty + excluded.qty;
  end if;

  perform private.audit(v_tenant, 'stock_transfer',
    jsonb_build_object('driver', p_driver, 'location', p_location, 'product', p_product, 'qty', p_qty));
  if p_qty > 0 then perform private.dispatch_queued(v_tenant); end if;
end $$;

create function public.ops_set_driver_active(p_driver uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  v_tenant := private.require_staff(array['owner', 'admin']::public.staff_role[]);
  if not p_active and exists (select 1 from public.orders where driver_id = p_driver and status in ('assigned', 'en_route', 'arrived')) then
    raise exception 'finish_active_orders';
  end if;
  update public.drivers set active = p_active, status = case when p_active then status else 'offline' end
   where user_id = p_driver and tenant_id = v_tenant;
  if not found then raise exception 'not_found'; end if;
  perform private.audit(v_tenant, 'driver_active', jsonb_build_object('driver', p_driver, 'active', p_active));
end $$;

create function public.ops_dispatch(p_order uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  v_tenant := private.require_staff();
  if p_order is null then return private.dispatch_queued(v_tenant); end if;
  if not exists (select 1 from public.orders where id = p_order and tenant_id = v_tenant) then raise exception 'not_found'; end if;
  return case when private.try_assign(p_order) is null then 0 else 1 end;
end $$;

create function public.ops_cancel_order(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_o public.orders;
begin
  v_tenant := private.require_staff();
  select * into v_o from public.orders where id = p_order and tenant_id = v_tenant for update;
  if not found then raise exception 'not_found'; end if;
  if v_o.status not in ('queued', 'assigned', 'en_route', 'arrived') then raise exception 'invalid_transition'; end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'reason_required'; end if;
  perform private.return_stock(p_order);
  update public.orders set status = 'canceled', cancel_reason = left(btrim(p_reason), 200), closed_at = now() where id = p_order;
  perform private.order_event(p_order, 'canceled', jsonb_build_object('by', 'operator', 'reason', btrim(p_reason)));
end $$;

create function public.ops_create_qr(p_label text, p_placement text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_code text;
begin
  v_tenant := private.require_staff(array['owner', 'admin']::public.staff_role[]);
  v_code := lower(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8));
  insert into public.qr_campaigns (tenant_id, code, label, placement)
  values (v_tenant, v_code, btrim(p_label), left(btrim(coalesce(p_placement, '')), 120));
  return v_code;
end $$;

create function public.ops_update_settings(p_name text, p_license_number text, p_license_state text, p_timezone text,
  p_open_hour int, p_close_hour int, p_excise_rate numeric, p_sales_tax_rate numeric, p_delivery_fee_cents int,
  p_min_order_cents int, p_max_flower_g numeric, p_max_concentrate_g numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  v_tenant := private.require_staff(array['owner', 'admin']::public.staff_role[]);
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then raise exception 'invalid_timezone'; end if;
  if p_close_hour <= p_open_hour then raise exception 'invalid_hours'; end if;
  update public.tenants set name = btrim(p_name), license_number = btrim(p_license_number),
    license_state = upper(btrim(p_license_state)), timezone = p_timezone, open_hour = p_open_hour,
    close_hour = p_close_hour, excise_rate = p_excise_rate, sales_tax_rate = p_sales_tax_rate,
    delivery_fee_cents = p_delivery_fee_cents, min_order_cents = p_min_order_cents,
    max_flower_g = p_max_flower_g, max_concentrate_g = p_max_concentrate_g
  where id = v_tenant;
  perform private.audit(v_tenant, 'settings_updated');
end $$;

-- ================= grants =================
revoke execute on all functions in schema public  from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.staff_tenant(public.staff_role[]) to authenticated;
grant execute on function private.driver_tenant() to authenticated;

grant execute on function public.get_menu(text), public.record_qr_scan(text) to anon, authenticated;
grant execute on function
  public.whoami(),
  public.upsert_customer_profile(text, text, text, date),
  public.submit_id_verification(text, text),
  public.save_address(text, text, text, text, text, text, double precision, double precision, text),
  public.delete_address(uuid),
  public.address_in_zone(uuid),
  public.place_order(uuid, jsonb, public.payment_method, text),
  public.cancel_order(uuid),
  public.redeem_driver_invite(text, text, text, text),
  public.driver_set_status(boolean, double precision, double precision),
  public.driver_ping(double precision, double precision),
  public.driver_advance_order(uuid, public.order_status),
  public.driver_complete_order(uuid, int),
  public.driver_fail_order(uuid, text),
  public.redeem_staff_invite(text, text),
  public.ops_create_invite(public.invite_kind, text),
  public.ops_revoke_invite(uuid),
  public.ops_review_customer(uuid, boolean, text),
  public.ops_upsert_product(uuid, public.product_category, text, text, text, text, numeric, numeric, int, int, boolean),
  public.ops_upsert_location(uuid, text, text, double precision, double precision, numeric, boolean),
  public.ops_set_location_stock(uuid, uuid, int),
  public.ops_transfer_stock(uuid, uuid, uuid, int),
  public.ops_set_driver_active(uuid, boolean),
  public.ops_dispatch(uuid),
  public.ops_cancel_order(uuid, text),
  public.ops_create_qr(text, text),
  public.ops_update_settings(text, text, text, text, int, int, numeric, numeric, int, int, numeric, numeric)
to authenticated;
